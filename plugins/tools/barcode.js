// plugins/tools/barcode.js — Generate gambar barcode dari teks/angka
const axios = require("axios");
const { footer } = require("../../lib/theme");

let handler = async (m, { sock, text }) => {
  if (!text) return m.reply(`*Contoh:*\n${m.cmd} 8991234567890`);

  try {
    const url = `https://barcodeapi.org/api/128/${encodeURIComponent(text)}`;
    const { data } = await axios.get(url, { responseType: "arraybuffer" });
    await sock.sendMessage(m.chat, { image: Buffer.from(data), caption: `📦 Barcode:\n${text}` + footer() }, { quoted: m });
  } catch (err) {
    console.error("[BARCODE GAGAL]", err.message);
    m.reply("❌ Gagal membuat barcode.");
  }
};

handler.command = ["barcode"];
handler.tags = ["tools"];
handler.help = ["barcode <teks/angka>"];

module.exports = handler;
