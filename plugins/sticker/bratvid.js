// plugins/sticker/bratvid.js — Brat versi video/animasi, endpoint GET
// /maker/bratvid dari api.nexray.eu.cc. Hasilnya kemungkinan video (bukan
// gambar diam) — sock.sendSticker udah otomatis deteksi ini lewat FileType
// dan pakai pipeline videoToWebp, jadi gak perlu ditangani beda di sini.
const { usage, fail } = require("../../lib/theme");
const { nexrayMediaSource } = require("../../lib/nexrayClient");

let handler = async (m, { sock, text }) => {
  if (!text) return m.reply(usage(`${m.cmd} <teks>`, `${m.cmd} Halo apa kabar`));

  try {
    const mediaSource = await nexrayMediaSource("/maker/bratvid", { text });
    await sock.sendSticker(m.chat, mediaSource, m, { packname: "👑 MaddazXD 👑" });
  } catch (err) {
    console.error("[BRATVID GAGAL]", err?.message);
    m.reply(fail("Gagal membuat sticker bratvid: " + err.message));
  }
};

handler.help = "bratvid";
handler.command = ["bratvid"];
handler.tags = "sticker";

module.exports = handler;
