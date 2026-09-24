// lib/ytdlpClient.js — helper buat manggil yt-dlp (via package "yt-dlp-exec",
// yang otomatis download binary yt-dlp resmi pas `npm install`, gak perlu
// install Python/yt-dlp manual di sistem).
//
// KENAPA INI ADA: btch-downloader itu library "scrape & tebak-tebak" skema
// YouTube yang gak sesering itu di-update. YouTube sering ganti cara
// signing/enkripsi URL video mereka, jadi library kayak btch-downloader gampang
// rusak (bisa berbulan-bulan sebelum di-patch maintainer-nya). yt-dlp beda —
// itu project yang di-maintain SANGAT aktif (rilis baru tiap kali YouTube
// berubah, kadang tiap minggu), jadi jauh lebih kecil kemungkinan rusak lama.
//
// CATATAN (dari histori project ini): yt-dlp + cookies.txt PERNAH dicoba dan
// dicabut karena gagal nembus video AGE-RESTRICTED. Itu masalah spesifik ke
// video age-restricted doang — buat video normal (yang jadi kasus mayoritas
// .ytmp3/.ytmp4), yt-dlp harusnya tetap jalan normal tanpa cookies sama sekali.
// Makanya di sini SENGAJA gak pakai cookies.txt lagi; ini cuma buat nolong
// kasus video normal yang gagal di btch-downloader.
const ytdlpExec = require("yt-dlp-exec");

// Ambil URL CDN langsung (bukan file-nya) buat 1 format tertentu. Hasilnya
// dipakai bareng lib/videoReencode.js punya sendiri sistem retry+reencode di
// plugins/download/youtube.js — jadi di sini cuma tugasnya "cariin link",
// bukan ikutan download filenya.
async function getYtdlpUrl(url, format) {
  const stdout = await ytdlpExec(url, {
    getUrl: true,
    format,
    noWarnings: true,
    noPlaylist: true,
    addHeader: ["referer:youtube.com"],
  });
  const link = String(stdout).trim().split("\n")[0];
  if (!link || !link.startsWith("http")) {
    throw new Error("yt-dlp gak ngasih URL valid.");
  }
  return link;
}

async function getYtdlpAudioUrl(url) {
  return getYtdlpUrl(url, "bestaudio/best");
}

async function getYtdlpVideoUrl(url) {
  return getYtdlpUrl(url, "best[ext=mp4]/best");
}

async function getYtdlpTitle(url) {
  try {
    const out = await ytdlpExec(url, {
      dumpSingleJson: true,
      noWarnings: true,
      noPlaylist: true,
      skipDownload: true,
    });
    const json = typeof out === "string" ? JSON.parse(out) : out;
    return json?.title || null;
  } catch {
    return null;
  }
}

module.exports = { getYtdlpAudioUrl, getYtdlpVideoUrl, getYtdlpTitle };
