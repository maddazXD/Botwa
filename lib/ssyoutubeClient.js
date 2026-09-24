// lib/ssyoutubeClient.js — scraper buat ssyoutube.com (diporting & disesuaikan
// dari project bot lain punya user, awalnya di src/scraper/yt.js).
//
// PENTING beda dari lib/ytmp3mobiClient.js: itu manggil d.ymcdn.org, PROVIDER
// YANG SAMA kayak yang dipakai btch-downloader (c.ymcdn.org) — jadi kalau
// ymcdn.org lagi down/limit, DUA-DUANYA collapse bareng. ssyoutube.com ini
// backend yang BENERAN independen/beda perusahaan.
//
// CATATAN JUJUR: ini pakai "signature" yang di-reverse-engineer dari request
// browser ke ssyoutube.com (SALT & sebagian TS di-hardcode). Skema kayak gini
// bisa berhenti kerja kapan aja kalau ssyoutube.com ganti cara sign mereka —
// gak ada garansi awet. Nilainya cuma sebagai lapisan tambahan yang genuinely
// independen dari ymcdn.org.
const axios = require("axios");
const crypto = require("crypto");
const qs = require("qs");

const CONFIG = {
  BASE_URL: "https://ssyoutube.com",
  API: { CONVERT: "/api/convert" },
  SECRETS: {
    SALT: "384d5028ee4a399f6cae0175025a1708aa924fc0ccb08be1aa359cd856dd1639",
    FIXED_TS: "1765962059039",
  },
  HEADERS: {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    Accept: "application/json, text/plain, */*",
    "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
    Origin: "https://ssyoutube.com",
    Referer: "https://ssyoutube.com/",
  },
};

function generateSignature(url, timestamp) {
  const rawString = url + timestamp + CONFIG.SECRETS.SALT;
  return crypto.createHash("sha256").update(rawString).digest("hex");
}

// Ambil daftar link download (macem-macem kualitas) buat 1 video YouTube.
async function ssyoutubeDownload(videoUrl) {
  if (!videoUrl || (!videoUrl.includes("youtube.com") && !videoUrl.includes("youtu.be"))) {
    throw new Error("URL tidak valid. Harap gunakan URL YouTube.");
  }

  const currentTs = Date.now().toString();
  const signature = generateSignature(videoUrl, currentTs);

  const payload = {
    sf_url: videoUrl,
    ts: currentTs,
    _ts: CONFIG.SECRETS.FIXED_TS,
    _tsc: "0",
    _s: signature,
  };

  const response = await axios.post(CONFIG.BASE_URL + CONFIG.API.CONVERT, qs.stringify(payload), {
    headers: CONFIG.HEADERS,
    timeout: 30000,
  });

  const data = response.data;
  if (!data || !data.url) {
    throw new Error("Gagal mengambil data dari ssyoutube.com (server mungkin memblokir request).");
  }

  const title = data.meta?.title || "Unknown";
  const items = Array.isArray(data.url) ? data.url : [];

  // Link video terbaik yang ADA audionya (biar gak perlu gabung video+audio terpisah)
  const videoItem =
    items.find((i) => !i.no_audio && i.audio !== true && /mp4/i.test(i.format || "")) ||
    items.find((i) => !i.no_audio);
  // Link audio-only kualitas terbaik (item terakhir biasanya paling bagus di data mereka,
  // tapi kita cari eksplisit yang audio:true biar gak ketuker)
  const audioItem = items.find((i) => i.audio === true);

  return {
    title,
    videoUrl: videoItem?.url || null,
    audioUrl: audioItem?.url || videoItem?.url || null,
  };
}

module.exports = { ssyoutubeDownload };
