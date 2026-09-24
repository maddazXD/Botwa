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

async function resolvePinterest(safeUrl) {
  // PENTING: safeUrl WAJIB udah lolos extractSafePinterestUrl() di pemanggil
  // (sama pola dengan mediafire.js) — fungsi ini gak validasi ulang.
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
    // Situs ini kasih beberapa tombol download (biasanya beda resolusi buat
    // gambar, atau video+thumbnail buat pin video) — dikumpulin semua,
    // handler yang milih mana yang dipakai (video diprioritaskan).
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
