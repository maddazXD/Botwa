// plugins/tools/maker-codesnap.js — Generate gambar snippet kode ala Carbon/CodeSnap
const axios = require("axios");
const { footer } = require("../../lib/theme");

let handler = async (m, { sock, text }) => {
  if (!text) return m.reply(`*Contoh:*\n${m.cmd} console.log("hello world")`);

  try {
    const url = `https://api-faa.my.id/faa/codesnap?text=${encodeURIComponent(text)}`;
    const res = await axios.get(url, { responseType: "arraybuffer", validateStatus: () => true });
    if (res.status !== 200) return m.reply("❌ Gagal membuat codesnap.");

    await sock.sendMessage(m.chat, { image: Buffer.from(res.data), caption: "✅" + footer() }, { quoted: m });
  } catch (err) {
    console.error("[CODESNAP GAGAL]", err.message);
    m.reply("❌ Gagal membuat codesnap.");
  }
};

handler.command = ["codesnap"];
handler.tags = ["tools"];
handler.help = ["codesnap <code>"];

module.exports = handler;
