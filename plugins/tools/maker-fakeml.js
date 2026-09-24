// plugins/tools/maker-fakeml.js — Generate gambar fake profil Mobile Legends
// (avatar di-upload sementara ke uguu.se, dipakai API canvas fakeml)
const axios = require("axios");
const FormData = require("form-data");
const { getMediaSource } = require("../../lib/mediaHelper");
const { footer } = require("../../lib/theme");

async function uguu(buffer) {
  const form = new FormData();
  form.append("files[]", buffer, "avatar.jpg");
  const { data } = await axios.post("https://uguu.se/upload", form, { headers: form.getHeaders() });
  return data.files[0].url;
}

let handler = async (m, { sock, text, command }) => {
  if (!text) return m.reply(`ℹ️ Cara pakai:\nReply foto lalu ketik:\n${m.cmd} Bahlil`);

  const source = getMediaSource(m);
  if (!source || source.mtype !== "imageMessage") return m.reply("Reply fotonya dulu buat dijadiin avatar.");

  await m.reply("⏳ Memproses...");

  try {
    const buffer = await source.download();
    const avatarUrl = await uguu(buffer);
    await new Promise((r) => setTimeout(r, 1200));

    const apiUrl = `https://api.apocalypse.web.id/canvas/fakeml?avatar=${encodeURIComponent(avatarUrl)}&nickname=${encodeURIComponent(text)}`;
    const res = await axios.get(apiUrl, { responseType: "arraybuffer", headers: { Accept: "image/*" }, timeout: 20000 });

    if (!res.headers["content-type"]?.startsWith("image/")) throw new Error("Respons API bukan gambar");

    await sock.sendMessage(m.chat, { image: Buffer.from(res.data), caption: "✨ Done" + footer() }, { quoted: m });
  } catch (err) {
    console.error("[FAKEML GAGAL]", err.message);
    m.reply("❌ Gagal membuat fake ML.");
  }
};

handler.command = ["fakeml"];
handler.tags = ["tools"];
handler.help = ["fakeml <nickname> (reply foto)"];

module.exports = handler;
