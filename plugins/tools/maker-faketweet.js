// plugins/tools/maker-faketweet.js — Generate gambar fake tweet (pakai API luar, ringan)
const axios = require("axios");
const { footer } = require("../../lib/theme");

const DELINE_BASE = "https://api.deline.web.id";

let handler = async (m, { sock, text, command }) => {
  if (!text) {
    return m.reply(`Contoh:\n${m.cmd} name|username|comment|verified\n\nContoh:\n${m.cmd} hilman|anu|halo hilman|true`);
  }

  let [name, username, comment, verified] = text.split("|");
  if (!name || !username || !comment) {
    return m.reply(`Format salah!\n${m.cmd} name|username|comment|verified`);
  }
  verified = (verified || "false").trim().toLowerCase();

  const avatar = await sock.profilePictureUrl(m.sender, "image").catch(() => `${DELINE_BASE}/Eu3BVf3K4x.jpg`);

  const url = `${DELINE_BASE}/maker/faketweet?name=${encodeURIComponent(name.trim())}&username=${encodeURIComponent(username.trim())}&comment=${encodeURIComponent(comment.trim())}&avatar=${encodeURIComponent(avatar)}&verified=${verified}`;

  try {
    const { data } = await axios.get(url, { responseType: "arraybuffer" });
    await sock.sendMessage(m.chat, { image: Buffer.from(data), caption: "✅ Fake tweet jadi!" + footer() }, { quoted: m });
  } catch (err) {
    console.error("[FAKETWEET GAGAL]", err.message);
    m.reply("❌ Gagal membuat fake tweet.");
  }
};

handler.command = ["faketweet"];
handler.tags = ["tools"];
handler.help = ["faketweet <name>|<username>|<comment>|<verified>"];

module.exports = handler;
