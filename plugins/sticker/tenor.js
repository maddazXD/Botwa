// plugins/sticker/tenor.js — Cari & kirim sticker dari Tenor
const axios = require("axios");
const { faaUrl } = require("../../lib/faaClient");

let handler = async (m, { sock, text }) => {
  await m.react("✨");
  if (!text) return m.reply(`*Contoh:* ${m.cmd} Ryo Yamada`);

  try {
    const { data } = await axios.get(faaUrl("/faa/stickerly", { q: text }));
    const results = data?.results?.slice(0, 5);
    if (!results?.length) return m.reply("Sticker tidak ditemukan.");

    for (const i of results) {
      try {
        const img = await axios.get(i.url, { responseType: "arraybuffer" });
        await sock.sendSticker(m.chat, Buffer.from(img.data), m, { packname: i.title || "MaddazXD", author: i.creator || "MaddazXD" });
      } catch {}
    }
  } catch (e) {
    console.error("[TENOR GAGAL]", e.message);
    m.reply("❌ Gagal mencari sticker.");
  }
};

handler.command = ["tenor"];
handler.tags = ["sticker"];
handler.help = ["tenor <kata kunci>"];

module.exports = handler;
