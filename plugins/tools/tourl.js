// plugins/tools/tourl.js — Upload media (reply) dan dapetin link URL-nya
//
// CATATAN (Agustus 2026): sebelumnya pakai pone.rs — TAPI ternyata pone.rs
// punya proteksi anti-bot yang nolak request server-to-server (link-nya
// kebuka normal di browser/WA, tapi kalau di-fetch dari server lain kena
// block). Ini ketauan pas dites nyambungin sama .vai/autoai (AI-nya gagal
// "liat" gambar dari link pone.rs). Sekarang dialihin ke lib/screaper.js
// (CatBox, fallback GoFile) yang emang didesain buat ngelewatin filter
// anti-bot kayak gini — host yang sama dipakai .qrcode, .setthumbnail, dan
// upload gambar di .vai/autoai (skarang .vai/autoai pindah ke jalur beda
// total buat gambar — lihat lib/geminiVision.js, kirim bytes langsung ke
// Gemini API asli, gak lewat upload-ke-hosting lagi).
const { uploadImageBuffer } = require("../../lib/screaper");
const { getMediaSource } = require("../../lib/mediaHelper");

let handler = async (m) => {
  const source = getMediaSource(m);
  if (!source) {
    return m.reply(`🌸 *TO URL*\n\nReply/kirim media dengan caption:\n*${m.cmd}*\n\nSupport: image, video, audio, sticker, document, pdf, dll.`);
  }

  await m.reply("⏳ Mengupload...");

  try {
    const buffer = await source.download();
    if (!buffer?.length) return m.reply("❌ Gagal download media, buffer kosong.");

    const url = await uploadImageBuffer(buffer);
    if (!url) return m.reply("❌ *Upload gagal!*\n\nCatBox & GoFile dua-duanya gagal, coba lagi nanti.");

    m.reply(`乂 *TO URL*\n\n✅ *Status:* Success\n\n🔗 *URL:*\n${url}`);
  } catch (e) {
    console.error("[TOURL GAGAL]", e.message);
    m.reply(`❌ Error: ${e.message}`);
  }
};

handler.command = ["tourl", "tolink"];
handler.tags = ["tools"];
handler.help = ["tourl (reply media)"];

module.exports = handler;
