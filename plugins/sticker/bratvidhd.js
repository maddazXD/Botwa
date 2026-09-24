// plugins/sticker/bratvidhd.js — Brat versi video resolusi tinggi, endpoint
// GET /maker/bratvidhd dari api.nexray.eu.cc. Sama kayak bratvid, hasilnya
// video — ditangani otomatis sama sock.sendSticker (deteksi video vs gambar
// lewat FileType, bukan nebak dari nama endpoint).
const { usage, fail } = require("../../lib/theme");
const { nexrayMediaSource } = require("../../lib/nexrayClient");

let handler = async (m, { sock, text }) => {
  if (!text) return m.reply(usage(`${m.cmd} <teks>`, `${m.cmd} Halo apa kabar`));

  try {
    const mediaSource = await nexrayMediaSource("/maker/bratvidhd", { text });
    await sock.sendSticker(m.chat, mediaSource, m, { packname: "👑 MaddazXD 👑" });
  } catch (err) {
    console.error("[BRATVIDHD GAGAL]", err?.message);
    m.reply(fail("Gagal membuat sticker bratvidhd: " + err.message));
  }
};

handler.help = "bratvidhd";
handler.command = ["bratvidhd"];
handler.tags = "sticker";

module.exports = handler;
