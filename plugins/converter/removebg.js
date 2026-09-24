// plugins/converter/removebg.js
const axios = require("axios");
const FormData = require("form-data");
const { getMediaSource } = require("../../lib/mediaHelper");
const { usage, processing, fail } = require("../../lib/theme");

let handler = async (m, { sock, prefix, command }) => {
  const source = getMediaSource(m);
  if (!source || source.mtype !== "imageMessage") {
    return m.reply(usage(`Reply foto yang mau dihapus background-nya, terus ketik ${prefix}${command}`));
  }

  if (!global.removebgApiKey) {
    return m.reply(fail("Fitur ini belum aktif — kunci API remove.bg belum di-set di config.js (global.removebgApiKey)."));
  }

  await m.reply(processing("Lagi diproses AI-nya..."));
  const buffer = await source.download();

  try {
    const form = new FormData();
    form.append("image_file", buffer, "image.jpg");
    const res = await axios.post("https://api.remove.bg/v1.0/removebg", form, {
      headers: { ...form.getHeaders(), "X-Api-Key": global.removebgApiKey },
      responseType: "arraybuffer",
    });
    await sock.sendMessage(m.chat, { image: Buffer.from(res.data), caption: "✅ Nih, udah bersih!" }, { quoted: m });
  } catch (err) {
    console.error("[REMOVEBG GAGAL]", err?.response?.data?.toString?.() || err?.message || err);
    return m.reply(fail("Gagal, kemungkinan limit API-nya udah habis."));
  }
};

handler.command = ["rbg", "removebg"];
handler.help = ["rbg"];
handler.tags = ["converter"];

module.exports = handler;
