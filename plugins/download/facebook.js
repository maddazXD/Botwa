// plugins/download/facebook.js — Downloader video Facebook
//
// CATATAN: fitur download FOTO Facebook udah dicoba berkali-kali (scrape
// og:image langsung, decode HTML entity, ganti User-Agent/header,
// fbdown() dari btch-downloader) dan SEMUANYA masih gagal — baik karena
// CDN Facebook nolak, atau karena btch-downloader emang gak nyediain field
// foto yang bisa diandalkan. Daripada terus ngasih hasil yang salah/gagal
// diam-diam, sekarang begitu post-nya kedetect FOTO, bot langsung ngasih
// tau terus terang ke user bahwa fitur ini belum tersedia — bukan nyoba
// lagi dan gagal lagi. Video TETAP jalan seperti biasa (udah aman & stabil).
const axios = require("axios");
const { footer } = require("../../lib/theme");

// PENTING: "btch-downloader" di-require LAZY (di dalam fungsi, bukan di
// top-level file) dan dibungkus try/catch — pola yang sama persis dipakai
// di youtube.js. Alasannya: kalau require di top-level GAGAL (package
// belum ke-install/rusak), SELURUH file ini gagal ke-load dan command
// fb/facebook/fbdl hilang total dari menu. Dengan lazy require, command
// tetap muncul di menu; kalau btch-downloader bermasalah, otomatis
// fallback ke scrape manual di bawah.
function getFbdownFn() {
  try {
    return require("btch-downloader").fbdown;
  } catch (e) {
    console.error("[FACEBOOK] Gagal load package btch-downloader:", e.message);
    return null;
  }
}

function extractVideoUrl(result) {
  const data = result?.data ?? result?.result ?? result;
  if (!data) return null;
  if (typeof data.link === "string" && !String(data.type ?? "").toLowerCase().includes("image")) {
    return data.link;
  }
  if (Array.isArray(data.downloads) && data.downloads.length) {
    return data.downloads.find(d => d.quality === "HD")?.downloadUrl ?? data.downloads[0]?.downloadUrl ?? data.downloads[0]?.url;
  }
  if (typeof data.url === "string") return data.url;
  return null;
}

// ── Fallback: scrape manual fbdownloader.to (video-only), dipakai kalau
// fbdown() gagal/package gak ke-load ───────────────────────────────────

async function getToken() {
  const url = "https://fbdownloader.to/id";
  const { data: html } = await axios.get(url, {
    headers: { "User-Agent": "Mozilla/5.0", "Accept-Language": "id-ID,id;q=0.9" },
  });
  const match = html.match(/k_exp="(.*?)".*?k_token="(.*?)"/s);
  if (!match) throw new Error("Token tidak ditemukan (halaman fbdownloader.to mungkin berubah)");
  return { k_exp: match[1], k_token: match[2] };
}

async function fbDownloaderScrape(fbUrl) {
  const { k_exp, k_token } = await getToken();
  const payload = new URLSearchParams({ k_exp, k_token, p: "home", q: fbUrl, lang: "id", v: "v2", W: "" });

  const { data } = await axios.post("https://fbdownloader.to/api/ajaxSearch", payload, {
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "User-Agent": "Mozilla/5.0",
      "X-Requested-With": "XMLHttpRequest",
      Origin: "https://fbdownloader.to",
      Referer: "https://fbdownloader.to/id",
    },
  });

  if (!data || !data.data) throw new Error("Gagal mengambil data video dari Facebook");

  const html = data.data;
  const results = [];
  const rowRegex = /<td class="video-quality">(.*?)<\/td>[\s\S]*?(?:href="(.*?)"|data-videourl="(.*?)")/g;
  let m2;
  while ((m2 = rowRegex.exec(html)) !== null) {
    const quality = m2[1].trim();
    const url = m2[2] || m2[3];
    if (quality && url) results.push({ quality, url });
  }
  return results;
}

function decodeHtmlEntities(str) {
  return str
    .replace(/&quot;/g, '"')
    .replace(/&#039;|&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(parseInt(code, 10)));
}

// Dipakai buat dua hal: (1) deteksi apakah post ini FOTO, supaya bisa
// langsung kasih pesan "belum didukung" tanpa nyoba download yang bakal
// gagal juga; (2) ambil caption asli post-nya (og:description) buat
// disertain bareng video.
async function detectPostType(fbUrl) {
  const { data: html } = await axios.get(fbUrl, {
    headers: {
      "User-Agent": "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
      "Accept-Language": "id-ID,id;q=0.9,en;q=0.8",
    },
    maxRedirects: 5,
    timeout: 20000,
  });

  const ogType  = html.match(/<meta[^>]+property=["']og:type["'][^>]+content=["']([^"']+)["']/i)?.[1];
  const ogImageRaw = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)?.[1];
  const ogVideoRaw = html.match(/<meta[^>]+property=["']og:video[^"']*["'][^>]+content=["']([^"']+)["']/i)?.[1];
  const ogImage = ogImageRaw ? decodeHtmlEntities(ogImageRaw) : null;
  const ogVideo = ogVideoRaw ? decodeHtmlEntities(ogVideoRaw) : null;
  // FIX BUG: caption (og:description) sempat kehapus pas file ini
  // disederhanakan buat nonaktifin fitur foto — padahal fungsi ini masih
  // dipanggil buat video juga, jadi captionnya harusnya tetap diambil.
  const ogDescRaw = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']*)["']/i)?.[1];
  const ogDescription = ogDescRaw ? decodeHtmlEntities(ogDescRaw) : null;

  return { ogType, ogImage, ogVideo, ogDescription };
}

// ── Handler utama ──────────────────────────────────────────────────────

// FIX SSRF (CWE-918): sebelumnya validasi cuma /facebook\.com|fb\.watch/.test(text)
// TANPA anchor — sama kayak bug yang ketemu di mediafire.js, ini cuma
// ngecek "ada substring facebook.com di suatu tempat", padahal yang
// di-fetch (axios.get di detectPostType) itu TEKS MENTAH UTUH dari user.
// Payload kayak "http://169.254.169.254/?x=facebook.com" bisa lolos
// validasi tapi beneran fetch ke internal/cloud-metadata endpoint. Sekarang
// divalidasi pake URL parser asli yang ngecek hostname SELURUH URL secara
// ketat, bukan cuma nyari substring.
const FB_HOSTS = ["facebook.com", "www.facebook.com", "m.facebook.com", "web.facebook.com", "mbasic.facebook.com", "fb.watch"];
function extractSafeFacebookUrl(rawText) {
  let parsed;
  try {
    parsed = new URL(rawText.trim());
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
  if (!FB_HOSTS.includes(parsed.hostname)) return null;
  return parsed.href;
}

let handler = async (m, { sock, text }) => {
  const link = text ? extractSafeFacebookUrl(text) : null;
  if (!link) {
    return m.reply(`*Contoh:*\n${m.cmd} https://facebook.com/...`);
  }

  // Cek dulu ini post foto atau bukan, SEBELUM proses apa pun.
  // FIX BUG: sebelumnya kalau detectPostType() GAGAL/exception (network,
  // Facebook nolak request, dst), kode DIAM-DIAM lanjut anggap ini video
  // dan proses ke fbDownloaderScrape() — padahal fbDownloaderScrape() itu
  // API VIDEO-ONLY yang, kalau link-nya sebenernya FOTO, bakal ngasih
  // video REKOMENDASI ACAK yang gak nyambung sama sekali (persis masalah
  // paling awal yang udah kita perbaiki sebelumnya, ternyata balik lagi
  // karena kegagalan deteksi di-treat sebagai "aman, lanjut aja"). Sekarang
  // kalau deteksi gagal, JANGAN asumsikan aman — retry sekali, dan kalau
  // masih gagal juga, kasih tau user terus terang gagal deteksi daripada
  // ambil risiko ngasih video yang salah.
  let postInfo = null;
  let detectError = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      postInfo = await detectPostType(link);
      detectError = null;
      break;
    } catch (e) {
      detectError = e;
      console.error(`[FACEBOOK] Gagal deteksi tipe post (percobaan ${attempt + 1}/2):`, e.message);
    }
  }

  if (!postInfo) {
    return m.reply(
      "❌ Gagal memeriksa link Facebook ini (server Facebook tidak merespons dengan benar). Coba lagi beberapa saat, atau pastikan link-nya benar dan post-nya publik."
    );
  }

  // DEBUG: log nilai og: mentah biar kalau deteksi masih salah lagi, kita
  // punya data pasti buat diagnosa — bukan nebak-nebak lagi dari luar.
  console.log("[FACEBOOK DEBUG] postInfo:", JSON.stringify(postInfo));

  // FIX BUG: og:type TERBUKTI SELALU "video.other" buat SEMUA jenis post
  // link "/share/p/..." (dikonfirmasi dari log debug: post yang ISINYA
  // FOTO tetap dapet og:type "video.other") — jadi og:type BUKAN sinyal
  // yang valid sama sekali buat platform ini, harus dibuang total dari
  // logika deteksi. og:video juga gak reliable (kadang ada utk yang
  // ternyata foto, kadang gak ada utk yang ternyata video).
  //
  // Sinyal yang TERBUKTI konsisten: domain og:image-nya sendiri. Facebook
  // pakai domain KHUSUS "lookaside.fbsbx.com/lookaside/crawler/media/"
  // buat nyajiin thumbnail FOTO ke crawler (dikonfirmasi dari referensi
  // publik: URL pola ini selalu dipasangkan sama facebook.com/photo.php?
  // fbid=... di banyak kasus nyata) — beda dari video yang thumbnail-nya
  // biasanya di domain scontent-*.fbcdn.net langsung. Kalau ogImage
  // domainnya lookaside.fbsbx.com, ini FOTO.
  const isLookasideCrawlerMedia = /lookaside\.fbsbx\.com\/lookaside\/crawler\/media/i.test(postInfo.ogImage ?? "");
  const looksLikePhoto = isLookasideCrawlerMedia;
  if (looksLikePhoto) {
    return m.reply("Maaf kak, fitur untuk unduh foto/image dari Facebook belum tersedia. Saat ini bot hanya bisa mengunduh video Facebook 🙏");
  }

  // Caption asli post-nya, biar ikut ditampilkan bareng videonya.
  const postCaption = postInfo.ogDescription ? `${postInfo.ogDescription}\n\n` : "";

  await m.reply("⏳ Diproses dulu ya...");

  // ── Jalur 1 (UTAMA): btch-downloader punya fbdown() ────────────────
  try {
    const fbdown = getFbdownFn();
    if (fbdown) {
      const result = await fbdown(link);
      if (result && result.status !== false) {
        const videoUrl = extractVideoUrl(result);
        if (videoUrl) {
          const videoRes = await axios.get(videoUrl, { responseType: "arraybuffer", timeout: 120000 });
          await sock.sendMessage(m.chat, {
            video: Buffer.from(videoRes.data),
            caption: `${postCaption}📥 *Facebook Downloader*` + footer(),
          }, { quoted: m });
          return;
        }
      }
      console.error("[FACEBOOK] fbdown() gak ngasih hasil video, coba jalur fallback.");
    }
  } catch (e) {
    console.error("[FACEBOOK] fbdown() error, coba jalur fallback:", e.message);
  }

  // ── Jalur 2 (FALLBACK): scrape manual fbdownloader.to ──────────────
  try {
    const results = await fbDownloaderScrape(link);
    if (!results.length) return m.reply("❌ Video tidak ditemukan.");

    const best = results[0];
    const videoRes = await axios.get(best.url, { responseType: "arraybuffer", timeout: 120000 });

    await sock.sendMessage(m.chat, {
      video: Buffer.from(videoRes.data),
      caption: `${postCaption}📥 *Facebook Downloader*\nKualitas: ${best.quality}` + footer(),
    }, { quoted: m });
  } catch (err) {
    console.error("[FACEBOOK GAGAL]", err.message);
    m.reply("❌ Gagal mengunduh video: " + err.message);
  }
};

handler.command = ["fb", "facebook", "fbdl"];
handler.tags = ["Download"];
handler.help = ["facebook <link>"];

module.exports = handler;
