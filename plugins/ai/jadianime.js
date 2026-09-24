// plugins/ai/jadianime.js — ubah foto jadi gaya anime Jepang, pakai endpoint
// GET /faa/toanime?url=... dari api-faa.my.id (sebelumnya Andaraz).
const { getMediaSource } = require("../../lib/mediaHelper");
const { uploadImageBuffer } = require("../../lib/screaper");
const { faaImageTransform } = require("../../lib/faaClient");
const { usage, processing, ok, fail, progressBar } = require("../../lib/theme");

let handler = async (m, { sock, prefix, command }) => {
  const source = getMediaSource(m);
  if (!source || source.mtype !== "imageMessage") {
    return m.reply(usage(`Reply FOTO, terus ketik ${prefix}${command}`, `${prefix}${command}`));
  }

  const label = "Sabar ya nyuk kunyuk...";
  const statusMsg = await sock.sendMessage(m.chat, { text: processing(label) }, { quoted: m });

  try {
    const buffer = await source.download();
    let lastPercent = -1;
    const imageBuffer = await faaImageTransform(uploadImageBuffer, buffer, "/faa/toanime", {}, "url", {
      onProgress: async (percent) => {
        if (percent === lastPercent || percent >= 100) return;
        lastPercent = percent;
        try { await sock.sendMessage(m.chat, { text: processing(`${label}\n${progressBar(percent)}`), edit: statusMsg.key }); } catch {}
      },
    });
    await sock.sendMessage(m.chat, { text: ok("Nih bray...."), edit: statusMsg.key });
    await sock.sendMessage(m.chat, { image: imageBuffer }, { quoted: m });
  } catch (err) {
    console.error("[JADIANIME GAGAL]", err?.message || err);
    try { await sock.sendMessage(m.chat, { text: fail("Gara gara lu sih server nya down jadi gagal"), edit: statusMsg.key }); } catch {}
  }
};

handler.command = ["jadianime", "animein", "toanime"];
handler.help = ["jadianime (reply foto — ubah jadi gaya anime Jepang)"];
handler.tags = ["ai"];

module.exports = handler;
