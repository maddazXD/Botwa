// plugins/ai/editimg2.js — edit foto pakai model "nano-banana" (alternatif dari
// .editimg), pakai endpoint GET /faa/nano-banana?url=...&prompt=... dari
// api-faa.my.id.
const { getMediaSource } = require("../../lib/mediaHelper");
const { uploadImageBuffer } = require("../../lib/screaper");
const { faaImageTransform } = require("../../lib/faaClient");
const { usage, processing, ok, fail, progressBar } = require("../../lib/theme");

let handler = async (m, { sock, text, prefix, command }) => {
  const source = getMediaSource(m);
  const prompt = (text || "").trim();
  if (!source || source.mtype !== "imageMessage" || !prompt) {
    return m.reply(
      usage(`Reply FOTO, terus ketik ${prefix}${command} <instruksi edit>`, `${prefix}${command} ganti baju jadi merah`)
    );
  }

  const label = `Lagi ngedit foto (nano-banana): "${prompt}"...`;
  const statusMsg = await sock.sendMessage(m.chat, { text: processing(label) }, { quoted: m });

  try {
    const buffer = await source.download();
    let lastPercent = -1;
    const imageBuffer = await faaImageTransform(uploadImageBuffer, buffer, "/faa/nano-banana", { prompt }, "url", {
      onProgress: async (percent) => {
        if (percent === lastPercent || percent >= 100) return;
        lastPercent = percent;
        try { await sock.sendMessage(m.chat, { text: processing(`${label}\n${progressBar(percent)}`), edit: statusMsg.key }); } catch {}
      },
    });
    await sock.sendMessage(m.chat, { text: ok("Selesai diedit!"), edit: statusMsg.key });
    await sock.sendMessage(m.chat, { image: imageBuffer }, { quoted: m });
  } catch (err) {
    console.error("[EDITIMG2 GAGAL]", err?.message || err);
    try { await sock.sendMessage(m.chat, { text: fail("Gagal edit foto — API FAA lagi down/error. Coba lagi nanti."), edit: statusMsg.key }); } catch {}
  }
};

handler.command = ["editimg2", "nanobanana"];
handler.help = ["editimg2 <instruksi> (reply foto — edit foto pakai model nano-banana)"];
handler.tags = ["ai"];

module.exports = handler;
