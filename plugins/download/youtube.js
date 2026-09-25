// plugins/download/youtube.js
// Urutan sumber (dari yang paling cepat/gratis ke yang butuh apikey):
//   1. btch-downloader (package original/bawaan project, GRATIS, gak butuh apikey)
//   2. Kalau (1) gagal -> fallback ke API BetaBotz (api.betabotz.eu.org, pakai apikey)
// Habis itu SELESAI — gak ada percobaan ketiga (yt-dlp + cookies.txt sudah
// DICABUT dari file ini). Alasan dicabut: cookies.txt yang ada gak pernah
// berhasil nembus video age-restricted (selalu gagal di semua client
// android/tv_embedded/web_embedded — lihat log server), jadi cuma nambah
// waktu tunggu member tanpa nolong sama sekali. lib/ytdlpClient.js jadi gak
// dipakai lagi di project ini (aman dihapus manual kalau mau beres-beres).
//
// Juga SENGAJA GAK ADA RETRY di kedua sumber (btch-downloader maupun BetaBotz):
// kalau salah satu gagal, langsung lanjut/nyerah, gak diulang-ulang — biar
// respons ke member tetap cepat & gak nunggu lama-lama pas salah satu sumber
// lagi bermasalah.
const axios = require("axios");
const fs = require("fs");
const { exec } = require("child_process");
const { promisify } = require("util");
const execAsync = promisify(exec);
const { getMediaDuration } = require("../../lib/videoReencode");
const { footer } = require("../../lib/theme");
const { fetchBetabotzDownload } = require("../../lib/betabotzClient");
const { getYtdlpAudioUrl, getYtdlpVideoUrl, getYtdlpTitle } = require("../../lib/ytdlpClient");
const { convertViaYtmp3Mobi } = require("../../lib/ytmp3mobiClient");
const { convertViaConvert1s } = require("../../lib/convert1sClient");
const { ssyoutubeDownload } = require("../../lib/ssyoutubeClient");
const { ytdlAuto } = require("../../lib/cantarellaYtClient");

// PENTING: "btch-downloader" di-require LAZY (di dalam fungsi, bukan di top-level
// file) dan dibungkus try/catch, biar kalau package ini gagal ke-load, cuma
// command yang butuh dia yang gagal — bukan seluruh file (termasuk .yts) ikut
// hilang dari menu.
function getYoutubeFn() {
  try {
    return require("btch-downloader").youtube;
  } catch (e) {
    console.error("[YT] Gagal load package btch-downloader:", e.message);
    return null;
  }
}

async function ytSearch(query) {
  const yt = require("yt-search");
  const r = await yt(query);
  return r.videos.slice(0, 5);
}

// Field asli dari btch-downloader: { id, title, size, quality, thumb, link, size_mp3, mp3 }
// -> link VIDEO ada di field `link`, audio di field `mp3`. Satu kali percobaan,
// gak ada retry (lihat catatan di atas soal kenapa retry dibuang).
async function fetchYtInfoOriginal(url) {
  const youtube = getYoutubeFn();
  if (!youtube) return null;

  try {
    const result = await youtube(url);
    console.log(`[YT] hasil btch-downloader buat url=${url}:`, JSON.stringify(result)?.slice(0, 500));
    if (!result || result.status === false) return null;
    return result;
  } catch (e) {
    console.error(`[YT] btch-downloader error buat url=${url}:`, e.message);
    return null;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// CDN video.googlevideo.com kadang balikin 502/503 sesaat (bukan link-nya yang
// mati, cuma server Google lagi hiccup) — di-retry beberapa kali sebelum bener-
// bener nyerah, biar gak langsung error padahal cuma gangguan sesaat.
async function fetchWithRetry(sourceUrl, { retries = 3, delayMs = 1000 } = {}) {
  let lastErr;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await axios.get(sourceUrl, {
        responseType: "arraybuffer",
        timeout: 120000,
        headers: { "User-Agent": "Mozilla/5.0" },
      });
    } catch (e) {
      lastErr = e;
      const status = e.response?.status;
      // Cuma retry buat error yang emang layak dicoba ulang (transient).
      // Kalau 403/404 dsb, gak usah diulang karena link-nya emang gak valid.
      if (![502, 503, 504].includes(status) && e.code !== "ECONNABORTED" && e.code !== "ETIMEDOUT") {
        throw e;
      }
      console.error(`[YT] Percobaan ${attempt}/${retries} gagal (${status || e.code}), retry...`);
      if (attempt < retries) await sleep(delayMs * attempt);
    }
  }
  throw lastErr;
}

async function downloadAndConvertAudio(sourceUrl, title) {
  const audioRes = await fetchWithRetry(sourceUrl);
  const rawBuffer = Buffer.from(audioRes.data);

  if (!fs.existsSync("./tmp")) fs.mkdirSync("./tmp", { recursive: true });
  const input = `./tmp/ytmp3_${Date.now()}_in`;
  const output = `./tmp/ytmp3_${Date.now()}_out.mp3`;
  fs.writeFileSync(input, rawBuffer);

  try {
    await execAsync(`ffmpeg -y -hide_banner -loglevel error -i "${input}" -vn -acodec libmp3lame -q:a 2 "${output}"`, { maxBuffer: 1024 * 1024 * 50 });
    const finalBuffer = fs.readFileSync(output);
    const realDuration = await getMediaDuration(output);
    return { title: title || "Unknown", duration: realDuration || "-", buffer: finalBuffer };
  } finally {
    try { fs.unlinkSync(input); } catch {}
    try { fs.unlinkSync(output); } catch {}
  }
}

async function downloadAndConvertVideo(sourceUrl, title) {
  // FIX BUG (pola yang sama kayak fitur download lain): file dari CDN sumbernya kadang
  // gak "streaming-ready" (moov atom gak di depan) atau codec-nya gak seragam H.264/AAC,
  // jadi WA nolak muterin walau upload-nya sendiri sukses. Di-download dulu lalu
  // di-re-encode paksa ke H.264/AAC + faststart biar dijamin bisa diputer di WA.
  const videoRes = await fetchWithRetry(sourceUrl);
  const rawBuffer = Buffer.from(videoRes.data);

  if (!fs.existsSync("./tmp")) fs.mkdirSync("./tmp", { recursive: true });
  const input = `./tmp/ytmp4_${Date.now()}_in`;
  const output = `./tmp/ytmp4_${Date.now()}_out.mp4`;
  fs.writeFileSync(input, rawBuffer);

  try {
    await execAsync(`ffmpeg -y -hide_banner -loglevel error -i "${input}" -c:v libx264 -preset veryfast -crf 23 -c:a aac -b:a 128k -pix_fmt yuv420p -movflags +faststart "${output}"`, { maxBuffer: 1024 * 1024 * 50 });
    const finalBuffer = fs.readFileSync(output);
    const realDuration = await getMediaDuration(output);
    return { title: title || "Unknown", duration: realDuration || "-", buffer: finalBuffer };
  } finally {
    try { fs.unlinkSync(input); } catch {}
    try { fs.unlinkSync(output); } catch {}
  }
}

async function fetchYtmp3(url) {
  // Fallback chain — dicoba berurutan, lanjut ke provider berikutnya kalau
  // yang sebelumnya gagal/timeout. Urutan disusun dari yang paling cepat/
  // reliable ke yang paling lambat, biar rata-rata request tetap cepat.
  // yt-dlp (dulu ada di sini) SENGAJA TETAP DI-SKIP: binary-nya gak
  // ke-install di container ini (butuh Python, di-skip lewat .npmrc
  // ignore-scripts) — bakal selalu gagal kalau diaktifin di sini.

  // 1) ytmp3.mobi
  try {
    const result = await convertViaYtmp3Mobi(url, "mp3");
    console.log(`[YTMP3] ytmp3.mobi dapet URL buat url=${url}`);
    return await downloadAndConvertAudio(result.downloadUrl, result.title);
  } catch (e) {
    console.error(`[YTMP3] ytmp3.mobi error buat url=${url}:`, e.message);
  }

  // 2) convert1s.com / ytmp3.gg — provider beda, diporting dari Nimiyo Downloader
  try {
    const result = await convertViaConvert1s(url, "mp3");
    console.log(`[YTMP3] convert1s.com dapet URL buat url=${url}`);
    return await downloadAndConvertAudio(result.downloadUrl, result.title);
  } catch (e) {
    console.error(`[YTMP3] convert1s.com error buat url=${url}:`, e.message);
  }

  // 3) btch-downloader (gratis, gak butuh apikey; backend: ymcdn.org)
  try {
    const original = await fetchYtInfoOriginal(url);
    if (original?.mp3) {
      return await downloadAndConvertAudio(original.mp3, original.title);
    }
  } catch (e) {
    console.error(`[YTMP3] btch-downloader error buat url=${url}:`, e.message);
  }

  // 4) ssyoutube.com (gratis, gak butuh apikey)
  try {
    const result = await ssyoutubeDownload(url);
    if (result.audioUrl) {
      console.log(`[YTMP3] ssyoutube.com (fallback) dapet URL buat url=${url}`);
      return await downloadAndConvertAudio(result.audioUrl, result.title);
    }
  } catch (e) {
    console.error(`[YTMP3] ssyoutube.com (fallback) error buat url=${url}:`, e.message);
  }

  // 5) Cantarella multi-provider (ytdlpyton/ytdown.to/savenow/savetube.me) —
  //    PALING LAMBAT: beberapa backend berurutan, ditaruh paling akhir
  //    (sebelum BetaBotz) biar gak nunggu lama kalau provider cepat di atas
  //    udah berhasil duluan.
  try {
    const result = await ytdlAuto(url, "audio");
    if (result?.status && result?.download_url) {
      console.log(`[YTMP3] Cantarella multi-provider (fallback) dapet URL buat url=${url}`);
      return await downloadAndConvertAudio(result.download_url, result.title);
    }
  } catch (e) {
    console.error(`[YTMP3] Cantarella multi-provider (fallback) error buat url=${url}:`, e.message);
  }

  // 6) BetaBotz (apikey) — fallback terakhir sebelum nyerah total.
  try {
    const result = await fetchBetabotzDownload("/api/download/ytmp3", url);
    console.log(`[YTMP3] hasil BetaBotz (fallback) buat url=${url}:`, JSON.stringify(result)?.slice(0, 500));
    if (result?.mp3) {
      return downloadAndConvertAudio(result.mp3, result.title);
    }
  } catch (e) {
    console.error(`[YTMP3] BetaBotz (fallback) error buat url=${url}:`, e.message);
  }

  console.error(`[YTMP3 GAGAL] semua sumber gagal buat url=${url}`);
  throw new Error("Video ini gak bisa diproses lewat semua sumber yang tersedia (kemungkinan age-restricted/private/region-locked).");
}

async function fetchYtmp4(url) {
  // Fallback chain — sama pola/urutan kayak fetchYtmp3 di atas. yt-dlp
  // SENGAJA TETAP DI-SKIP (lihat catatan di fetchYtmp3).

  // 1) ytmp3.mobi (mode mp4)
  try {
    const result = await convertViaYtmp3Mobi(url, "mp4");
    console.log(`[YTMP4] ytmp3.mobi dapet URL buat url=${url}`);
    return await downloadAndConvertVideo(result.downloadUrl, result.title);
  } catch (e) {
    console.error(`[YTMP4] ytmp3.mobi error buat url=${url}:`, e.message);
  }

  // 2) convert1s.com / ytmp3.gg — provider beda, diporting dari Nimiyo Downloader
  try {
    const result = await convertViaConvert1s(url, "mp4");
    console.log(`[YTMP4] convert1s.com dapet URL buat url=${url}`);
    return await downloadAndConvertVideo(result.downloadUrl, result.title);
  } catch (e) {
    console.error(`[YTMP4] convert1s.com error buat url=${url}:`, e.message);
  }

  // 3) btch-downloader (gratis, gak butuh apikey; backend: ymcdn.org)
  try {
    const original = await fetchYtInfoOriginal(url);
    if (original?.link) {
      return await downloadAndConvertVideo(original.link, original.title);
    }
  } catch (e) {
    console.error(`[YTMP4] btch-downloader error buat url=${url}:`, e.message);
  }

  // 4) ssyoutube.com (gratis, gak butuh apikey)
  try {
    const result = await ssyoutubeDownload(url);
    if (result.videoUrl) {
      console.log(`[YTMP4] ssyoutube.com (fallback) dapet URL buat url=${url}`);
      return await downloadAndConvertVideo(result.videoUrl, result.title);
    }
  } catch (e) {
    console.error(`[YTMP4] ssyoutube.com (fallback) error buat url=${url}:`, e.message);
  }

  // 5) Cantarella multi-provider — PALING LAMBAT (lihat catatan di fetchYtmp3).
  try {
    const result = await ytdlAuto(url, "720");
    if (result?.status && result?.download_url) {
      console.log(`[YTMP4] Cantarella multi-provider (fallback) dapet URL buat url=${url}`);
      return await downloadAndConvertVideo(result.download_url, result.title);
    }
  } catch (e) {
    console.error(`[YTMP4] Cantarella multi-provider (fallback) error buat url=${url}:`, e.message);
  }

  // 6) BetaBotz (apikey) — fallback terakhir sebelum nyerah total.
  try {
    const result = await fetchBetabotzDownload("/api/download/ytmp4", url);
    console.log(`[YTMP4] hasil BetaBotz (fallback) buat url=${url}:`, JSON.stringify(result)?.slice(0, 500));
    if (result?.mp4) {
      return downloadAndConvertVideo(result.mp4, result.title);
    }
  } catch (e) {
    console.error(`[YTMP4] BetaBotz (fallback) error buat url=${url}:`, e.message);
  }

  console.error(`[YTMP4 GAGAL] semua sumber gagal buat url=${url}`);
  throw new Error("Video ini gak bisa diproses lewat semua sumber yang tersedia (kemungkinan age-restricted/private/region-locked).");
}

let handler = async (m, { sock, text, command }) => {
  if (!text) return m.reply(`*Contoh:*\n${m.cmd} <judul/url>`);

  const isUrl = /youtu(be\.com|\.be)/.test(text);

  if (command === "yts") {
    await m.reply("🔍 Mencari di YouTube...");
    const results = await ytSearch(text).catch(() => []);
    if (!results.length) return m.reply("❌ Tidak ada hasil ditemukan.");

    let teks = `🎬 *Hasil Pencarian YouTube*\n\n`;
    results.forEach((v, i) => {
      teks += `${i + 1}. *${v.title}*\n`;
      teks += `   ⏱ Durasi: ${v.timestamp} | 👁 ${v.views?.toLocaleString("id-ID")} views\n`;
      teks += `   🔗 ${v.url}\n\n`;
    });
    return m.reply(teks);
  }

  const isAudioCmd = command === "ytmp3" || command === "yta";
  if (command === "ytdl") {
    await m.reply(`⏳ Sedang memproses *Video*... (pakai .ytmp3 kalau mau audio)`);
  } else {
    await m.reply(`⏳ Sedang memproses *${isAudioCmd ? "Audio" : "Video"}*...`);
  }

  let url = text;
  if (!isUrl) {
    const results = await ytSearch(text).catch(() => []);
    if (!results.length) return m.reply("❌ Lagu/video tidak ditemukan.");
    url = results[0].url;
  }

  try {
    if (isAudioCmd) {
      const dl = await fetchYtmp3(url);
      await sock.sendMessage(m.chat, {
        audio: dl.buffer,
        mimetype: "audio/mpeg",
        fileName: `${dl.title}.mp3`,
      }, { quoted: m });
    } else {
      const dl = await fetchYtmp4(url);
      await sock.sendMessage(m.chat, {
        video: dl.buffer,
        caption: `🎬 *${dl.title}*\n⏱ Durasi: ${dl.duration}${footer()}`,
      }, { quoted: m });
    }
  } catch (err) {
    m.reply("❌ Gagal download: " + err.message);
  }
};

handler.command = ["ytmp3", "ytmp4", "yta", "ytv", "yts", "ytdl"];
handler.tags = ["Download"];
handler.help = ["ytmp3 <judul/url>", "ytmp4 <judul/url>", "yts <judul>"];

// Diexport sebagai properti di handler (bukan named export terpisah) biar gak
// ganggu cara plugin loader require file ini (dia expect default export =
// handler function, dengan .command/.tags/.help nempel di situ). Dipakai oleh
// plugins/download/spotify.js biar gak perlu duplikat logic search+download+
// reencode audio dari nol.
async function fetchYtmp3ByQuery(query) {
  const results = await ytSearch(query).catch(() => []);
  if (!results.length) return null;
  return fetchYtmp3(results[0].url);
}
handler.fetchYtmp3ByQuery = fetchYtmp3ByQuery;

module.exports = handler;
