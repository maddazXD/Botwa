// plugins/ai/jadihitam2.js — versi Andaraz dari .hytamkan (versi FAA ada di
// plugins/ai/jadihitam.js). Endpoint GET /api/ai/jadi/hitam/create?url=...
// dari api.andaraz.com, butuh global.andarazApiKey (lihat lib/andarazClient.js).
const axios = require("axios");
const { getMediaSource } = require("../../lib/mediaHelper");
const { uploadImageBuffer } = require("../../lib/screaper");
const { andarazUrl, extractAndarazImage, requireAndarazKey } = require("../../lib/andarazClient");
const { usage, processing, ok, fail } = require("../../lib/theme");

let handler = async (m, { sock, prefix, command }) => {
  const source = getMediaSource(m);
  if (!source || source.mtype !== "imageMessage") {
    return m.reply(usage(`Reply FOTO, terus ketik ${prefix}${command}`, `${prefix}${command}`));
  }

  try {
    requireAndarazKey();
  } catch (err) {
    return m.reply(fail(err.message));
  }

  const statusMsg = await sock.sendMessage(m.chat, { text: processing("hytamhin Waifu lu njir (Andaraz)...") }, { quoted: m });

  try {
    const buffer = await source.download();
    const publicUrl = await uploadImageBuffer(buffer);
    if (!publicUrl) throw new Error("Gagal upload gambar ke hosting sementara buat diproses Andaraz.");

    const res = await axios.get(andarazUrl("/api/ai/jadi/hitam/create", { url: publicUrl }), {
      responseType: "arraybuffer",
      timeout: 120000,
    });
    const imageBuffer = await extractAndarazImage(res);
    await sock.sendMessage(m.chat, { text: ok("Nih dah hytam (Andaraz)."), edit: statusMsg.key });
    await sock.sendMessage(m.chat, { image: imageBuffer }, { quoted: m });
  } catch (err) {
    console.error("[JADIHITAM2 GAGAL]", err?.response?.data ? JSON.stringify(err.response.data).slice(0, 300) : err?.message);
    try { await sock.sendMessage(m.chat, { text: fail("Njir. Server Andaraz-nya lagi down/error."), edit: statusMsg.key }); } catch {}
  }
};

handler.command = ["hytamkan2", "hitamkan2", "jadhitam2"];
handler.help = ["hytamkan2 (reply foto — itemin muka lu, versi Andaraz)"];
handler.tags = ["ai"];

module.exports = handler;
