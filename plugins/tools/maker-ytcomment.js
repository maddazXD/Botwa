// plugins/tools/maker-ytcomment.js — Generate gambar fake komentar YouTube
const axios = require("axios");
const { footer } = require("../../lib/theme");

const DELINE_BASE = "https://api.deline.web.id";

let handler = async (m, { sock, text }) => {
  if (!text) {
    return m.reply(`Contoh:\n${m.cmd} username|komentar\n\nContoh:\n${m.cmd} Hilman|Halo hilman`);
  }

  let [username, komentar] = text.split("|");
  if (!username || !komentar) return m.reply(`Format salah!\n${m.cmd} username|komentar`);

  const avatar = await sock.profilePictureUrl(m.sender, "image").catch(() => `${DELINE_BASE}/Eu3BVf3K4x.jpg`);
  const url = `${DELINE_BASE}/maker/ytcomment?text=${encodeURIComponent(komentar.trim())}&username=${encodeURIComponent(username.trim())}&avatar=${encodeURIComponent(avatar)}`;

  try {
    const { data } = await axios.get(url, { responseType: "arraybuffer" });
    await sock.sendMessage(m.chat, { image: Buffer.from(data), caption: "✅" + footer() }, { quoted: m });
  } catch (err) {
    console.error("[YTCOMMENT GAGAL]", err.message);
    m.reply("❌ Gagal membuat YouTube comment.");
  }
};

handler.command = ["ytcomment"];
handler.tags = ["tools"];
handler.help = ["ytcomment <username>|<komentar>"];

module.exports = handler;
