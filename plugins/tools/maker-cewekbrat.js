// plugins/tools/maker-cewekbrat.js — Generate gambar "cewek brat" bertuliskan teks
const axios = require("axios");
const { footer } = require("../../lib/theme");

const DELINE_BASE = "https://api.deline.web.id";

let handler = async (m, { sock, text }) => {
  if (!text) return m.reply(`Contoh:\n${m.cmd} Halo hilman`);

  const url = `${DELINE_BASE}/maker/cewekbrat?text=${encodeURIComponent(text)}`;

  try {
    const { data } = await axios.get(url, { responseType: "arraybuffer" });
    await sock.sendMessage(m.chat, { image: Buffer.from(data), caption: "✅" + footer() }, { quoted: m });
  } catch (err) {
    console.error("[CEWEKBRAT GAGAL]", err.message);
    m.reply("❌ Gagal membuat gambar cewek brat.");
  }
};

handler.command = ["cewekbrat"];
handler.tags = ["tools"];
handler.help = ["cewekbrat <teks>"];

module.exports = handler;
