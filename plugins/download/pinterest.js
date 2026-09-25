// plugins/download/pinterest.js — Download gambar/video dari Pinterest
//
// VALIDASI URL: sama kayak fix SSRF di mediafire.js — pakai URL parser ASLI
// (new URL(), cek protocol + hostname SELURUH string) bukan regex.test()
// yang cuma nyari substring "pinterest.com" di mana aja dalam teks. Ini juga
// nutup celah SSRF yang sama (payload kayak
// "http://169.254.169.254/?fake=pinterest.com/pin/x" gak akan lolos).
//
// SUMBER: pinterestdownloader.com — situs publik, gak butuh API key, pola
// requestnya (POST ke /download.php dengan field `url`) udah lama stabil
// dipakai banyak project sejenis. Kalau ke depannya situs ini down/berubah,
// tinggal ganti fungsi resolvePinterest() aja, handler-nya gak perlu diubah.
const axios = require("axios");
const cheerio = require("cheerio");
const { footer } = require("../../lib/theme");

// Terima link pin (pinterest.com/pin/xxx atau pin.it/xxx short-link).
// Balikin URL yang udah divalidasi (aman dipakai) atau null kalau bukan
// link Pinterest yang valid.
function extractSafePinterestUrl(rawText) {
  let parsed;
  try {
    parsed = new URL(rawText.trim());
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;

  const host = parsed.hostname.replace(/^www\./, "");
  const isMainDomain = host === "pinterest.com" || /\.pinterest\.[a-z.]+$/.test(host);
  const isShortLink = host === "pin.it";
  if (!isMainDomain && !isShortLink) return null;

  return parsed.href;
}

// FIX: sumber lama (pinterestdownloader.com, scraping tombol download di
// HTML-nya) sering gagal total — situs pihak ketiga kayak gini gampang
// ganti struktur HTML/domain/endpoint kapan aja tanpa pemberitahuan, dan
// begitu berubah, scraping berbasis `a[href]` di atas langsung gak nemu
// apa-apa (persis kayak yang dialami: "pin mungkin private/sudah dihapus"
// padahal pin-nya valid).
//
// SEKARANG: sumber UTAMA scraping halaman pin.pinterest.com LANGSUNG.
// Pinterest nge-render data pin (termasuk URL gambar resolusi asli & video)
// ke dalam JSON yang nempel di HTML pin page itu sendiri (script
// __PWS_DATA__ / __PWS_INITIAL_PROPS__) — ini data RESMI dari Pinterest
// buat semua orang yang buka pin-nya, jauh lebih stabil daripada situs
// downloader pihak ketiga. pinterestdownloader.com dipertahankan sebagai
// FALLBACK kalau parsing HTML resmi ini gagal (misal Pinterest ubah nama
// key JSON-nya).
async function resolveFromPinterestPage(safeUrl) {
  // pin.it short-link harus di-follow dulu ke URL pin.pinterest.com asli.
  const headers = {
    "User-Agent": "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36",
    "Accept-Language": "en-US,en;q=0.9",
  };
  const res = await axios.get(safeUrl, {
    headers,
    timeout: 20000,
    maxRedirects: 5,
    validateStatus: (s) => s < 500,
  });
  const html = res.data;
  const finalUrl = res.request?.res?.responseUrl || safeUrl;

  if (typeof html !== "string") throw new Error("Respons halaman Pinterest bukan HTML.");

  // Coba beberapa nama script-tag yang pernah dipakai Pinterest buat nyimpen
  // initial state-nya (bisa ganti-ganti seiring waktu, makanya dicoba semua).
  const scriptMatch =
    html.match(/<script[^>]*id="__PWS_DATA__"[^>]*>([\s\S]*?)<\/script>/) ||
    html.match(/<script[^>]*id="__PWS_INITIAL_PROPS__"[^>]*>([\s\S]*?)<\/script>/);

  let mediaUrl = null;
  let isVideo = false;

  if (scriptMatch) {
    try {
      const json = JSON.parse(scriptMatch[1]);
      // Cari object pin di dalam initialReduxState.pins (key-nya = pin id).
      const pins = json?.props?.initialReduxState?.pins || {};
      const pinId = Object.keys(pins)[0];
      const pin = pinId ? pins[pinId] : null;
      const videoList = pin?.videos?.video_list;
      if (videoList) {
        const best = videoList.V_HLSV4 || videoList.V_720P || Object.values(videoList)[0];
        if (best?.url) { mediaUrl = best.url; isVideo = true; }
      }
      if (!mediaUrl) {
        mediaUrl = pin?.images?.orig?.url || pin?.image_large_url || null;
      }
    } catch {
      // lanjut ke fallback regex di bawah
    }
  }

  // Fallback kalau JSON-nya gak ketemu/gak ke-parse: coba tarik langsung
  // dari meta tag og:video / og:image yang tetap ada di HTML pin page.
  if (!mediaUrl) {
    const ogVideo = html.match(/<meta property="og:video(?::url)?" content="([^"]+)"/);
    const ogImage = html.match(/<meta property="og:image" content="([^"]+)"/);
    if (ogVideo) { mediaUrl = ogVideo[1]; isVideo = true; }
    else if (ogImage) { mediaUrl = ogImage[1]; }
  }

  if (!mediaUrl) throw new Error("Gagal parsing data pin dari halaman Pinterest.");
  return { isVideo, mediaUrl, finalUrl };
}

// Fallback lama — dipertahankan buat kasus resolveFromPinterestPage() gagal.
async function resolveFromThirdPartySite(safeUrl) {
  const body = new URLSearchParams({ url: safeUrl });
  const { data: html } = await axios.post(
    "https://pinterestdownloader.com/download.php",
    body,
    {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "Mozilla/5.0",
        Referer: "https://pinterestdownloader.com/",
      },
      timeout: 20000,
    }
  );

  const $ = cheerio.load(html);
  const results = [];
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href || !href.startsWith("http")) return;
    const isVideo = /\.mp4(\?|$)/i.test(href);
    results.push({ url: href, isVideo });
  });

  if (!results.length) {
    throw new Error("Gagal menemukan link media — pin mungkin private/sudah dihapus.");
  }

  const video = results.find((r) => r.isVideo);
  return {
    isVideo: !!video,
    mediaUrl: (video || results[0]).url,
  };
}

async function resolvePinterest(safeUrl) {
  // PENTING: safeUrl WAJIB udah lolos extractSafePinterestUrl() di pemanggil
  // (sama pola dengan mediafire.js) — fungsi ini gak validasi ulang.
  try {
    return await resolveFromPinterestPage(safeUrl);
  } catch (e) {
    console.error("[PINTEREST] Sumber utama (halaman resmi) gagal, coba fallback:", e.message);
    return await resolveFromThirdPartySite(safeUrl);
  }
}

let handler = async (m, { sock, text }) => {
  if (!text) {
    return m.reply(`*Contoh:*\n${m.cmd} https://pinterest.com/pin/xxxxxxxx`);
  }

  const safeUrl = extractSafePinterestUrl(text);
  if (!safeUrl) {
    return m.reply("❌ Link tidak valid! Pastikan link Pinterest (pinterest.com/pin/... atau pin.it/...) benar.");
  }

  await m.reply("⏳ Diproses dulu ya...");

  try {
    const result = await resolvePinterest(safeUrl);

    if (result.isVideo) {
      await sock.sendMessage(m.chat, {
        video: { url: result.mediaUrl },
        caption: `📌 *Pinterest Video*${footer()}`,
      }, { quoted: m });
    } else {
      await sock.sendMessage(m.chat, {
        image: { url: result.mediaUrl },
        caption: `📌 *Pinterest Image*${footer()}`,
      }, { quoted: m });
    }
  } catch (err) {
    console.error("[PINTEREST GAGAL]", err.message);
    m.reply("❌ Gagal mengambil media dari Pinterest: " + err.message);
  }
};

handler.command = ["pinterest", "pin"];
handler.tags = ["Download"];
handler.help = ["pinterest <link>"];

module.exports = handler;
