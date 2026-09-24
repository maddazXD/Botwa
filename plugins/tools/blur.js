// plugins/tools/blur.js — Blur gambar (reply/kirim gambar)
const axios = require("axios");
const FormData = require("form-data");
const { getMediaSource } = require("../../lib/mediaHelper");
const { footer } = require("../../lib/theme");

let handler = async (m, { sock }) => {
  const source = getMediaSource(m);
  if (!source || source.mtype !== "imageMessage") {
    return m.reply(`Reply/kirim gambar dengan caption\n\nContoh:\n${m.cmd}`);
  }

  await m.react("🌫️");

  try {
    const media = await source.download();
    const form = new FormData();
    form.append("files[]", media, "image.jpg");
    const res = await axios.post("https://uguu.se/upload.php", form, { headers: form.getHeaders() });
    const url = res.data.files[0].url;

    const api = `https://api.popcat.xyz/v2/blur?image=${encodeURIComponent(url)}`;
    const { data } = await axios.get(api, { responseType: "arraybuffer" });
    await sock.sendMessage(m.chat, { image: Buffer.from(data), caption: "🌫️ Blur done" + footer() }, { quoted: m });
  } catch (e) {
    console.error("[BLUR GAGAL]", e.message);
    m.reply("❌ Gagal blur gambar.");
  }
};

handler.command = ["blur"];
handler.tags = ["tools"];
handler.help = ["blur (reply gambar)"];

module.exports = handler;
