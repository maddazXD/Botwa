// lib/videoReencode.js
// Banyak API downloader ngasih link CDN yang filenya gak "streaming-ready" (moov atom
// gak di depan) atau codec-nya gak konsisten H.264/AAC — WhatsApp bakal nolak muterin
// video kayak gitu walau proses upload/kirimnya sendiri sukses ("Video ini tidak
// tersedia karena ada masalah dengan file video"). Helper ini download videonya dulu,
// baru di-re-encode paksa ke format yang dijamin diterima WhatsApp.
const axios = require("axios");
const fs = require("fs");
const { exec } = require("child_process");
const { promisify } = require("util");
const execAsync = promisify(exec);

// Ambil durasi ASLI dari file media pakai ffprobe — dipakai buat caption/info,
// bukan percaya metadata "duration" dari API yang kadang gak akurat/gak sinkron
// sama file video/audio yang beneran dikirim.
async function getMediaDuration(filePath) {
  try {
    const { stdout } = await execAsync(
      `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`
    );
    const seconds = Math.round(parseFloat(stdout.trim()));
    if (!seconds || isNaN(seconds)) return null;
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  } catch {
    return null;
  }
}

async function downloadAndReencodeVideo(url, label = "video") {
  const videoRes = await axios.get(url, { responseType: "arraybuffer", timeout: 120000 });
  const rawBuffer = Buffer.from(videoRes.data);

  if (!fs.existsSync("./tmp")) fs.mkdirSync("./tmp", { recursive: true });
  const input = `./tmp/${label}_${Date.now()}_in`;
  const output = `./tmp/${label}_${Date.now()}_out.mp4`;
  fs.writeFileSync(input, rawBuffer);

  try {
    // FIX "stderr maxBuffer length exceeded": execAsync defaultnya cuma kasih
    // buffer 1MB buat stdout+stderr gabungan. Video kualitas tinggi/durasi
    // panjang bikin ffmpeg ngeluarin log progress (frame=.../fps=.../bitrate=...)
    // yang jauh lebih dari 1MB total teks, jadi meledak duluan sebelum encode
    // kelar. Dua-duanya dibenerin: -loglevel error (ffmpeg cuma ngeluarin log
    // kalau BENERAN error, gak nge-print progress terus-terusan) DAN maxBuffer
    // dinaikin jauh (50MB) buat jaga-jaga kalau tetep ada video yang errornya
    // sendiri verbose.
    await execAsync(
      `ffmpeg -y -hide_banner -loglevel error -i "${input}" -c:v libx264 -preset veryfast -crf 23 -c:a aac -b:a 128k -pix_fmt yuv420p -movflags +faststart "${output}"`,
      { maxBuffer: 1024 * 1024 * 50 }
    );
    const duration = await getMediaDuration(output);
    return { buffer: fs.readFileSync(output), duration };
  } finally {
    try { fs.unlinkSync(input); } catch {}
    try { fs.unlinkSync(output); } catch {}
  }
}

module.exports = { downloadAndReencodeVideo, getMediaDuration };
