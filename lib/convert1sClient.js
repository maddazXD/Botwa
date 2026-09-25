// lib/convert1sClient.js — scraper buat hub.convert1s.com (backend dari
// media.ytmp3.gg), diporting dari source Nimiyo Downloader (src/app.js,
// fungsi resolving "ytmp3gg_resolve").
//
// CARA KERJA: POST ke hub.convert1s.com/api/download dengan payload JSON
// (url YouTube + format/quality yang diinginkan) -> server balikin
// `statusUrl` -> di-poll berkala sampai status "completed" -> ambil
// `downloadUrl` dari hasil poll.
//
// CATATAN: sama seperti ytmp3mobiClient.js — ini scrape endpoint internal
// situs publik, bukan API resmi/stabil. Ditambahkan sebagai FALLBACK
// TAMBAHAN (provider beda dari ytmp3.mobi), bukan pengganti, biar kalau
// satu provider down yang lain masih bisa jalan.
const axios = require("axios");

const HEADERS = {
  Origin: "https://media.ytmp3.gg",
  Referer: "https://media.ytmp3.gg/",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
  "Content-Type": "application/json",
};

async function convertViaConvert1s(videoUrl, format = "mp3") {
  const normalizedFormat = String(format).toLowerCase() === "mp4" ? "mp4" : "mp3";
  const client = axios.create({ timeout: 20000, headers: HEADERS });

  const { data: conv } = await client.post("https://hub.convert1s.com/api/download", {
    url: videoUrl,
    os: "macos",
    output: {
      type: normalizedFormat === "mp4" ? "video" : "audio",
      format: normalizedFormat,
      quality: normalizedFormat === "mp4" ? "720" : "128",
    },
    audio: { bitrate: "128k" },
  });

  if (!conv || conv.error || !conv.statusUrl) {
    throw new Error(conv?.message || conv?.error || "Gagal memulai konversi di convert1s.com.");
  }

  let resolvedUrl = null;
  let title = conv.title || "";
  let attempts = 0;
  const maxAttempts = 30; // ~30 x 1.5s = 45 detik maksimal nunggu polling

  while (!resolvedUrl && attempts < maxAttempts) {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    const { data: poll } = await client.get(conv.statusUrl);
    attempts += 1;

    if (poll?.title) title = poll.title;
    if (poll?.status === "completed" && poll?.downloadUrl) {
      resolvedUrl = poll.downloadUrl;
      break;
    }
    if (poll?.status === "error" || poll?.status === "failed") {
      throw new Error(poll?.message || "convert1s.com melaporkan konversi gagal.");
    }
  }

  if (!resolvedUrl) {
    throw new Error("Timeout nunggu proses konversi convert1s.com.");
  }

  return { title, downloadUrl: resolvedUrl };
}

module.exports = { convertViaConvert1s };
