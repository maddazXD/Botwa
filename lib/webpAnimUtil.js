// lib/webpAnimUtil.js
// ffmpeg versi standar TIDAK BISA baca file WebP animasi langsung (limitasi lama ffmpeg,
// lihat trac.ffmpeg.org/ticket/4907 — chunk ANIM/ANMF gak didukung decoder native-nya).
// Solusinya: bongkar dulu jadi frame-frame WebP statis pakai node-webpmux (udah jadi
// dependency proyek ini), baru tiap frame statis itu yang diproses ffmpeg satu-satu.
const WebP = require("node-webpmux");

async function loadWebpImage(filePath) {
  const img = new WebP.Image();
  await img.load(filePath);
  const frameCount = Array.isArray(img.frames) ? img.frames.length : 0;
  const isAnimated = frameCount > 1;
  return { img, isAnimated, frameCount };
}

module.exports = { loadWebpImage };
