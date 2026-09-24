// plugins/ai/jadihitam.js — ubah foto pakai filter "hitam", pakai endpoint
// GET /faa/tohitam?url=... dari api-faa.my.id (sebelumnya Andaraz).
const { getMediaSource } = require("../../lib/mediaHelper");
const { uploadImageBuffer } = require("../../lib/screaper");
const { faaImageTransform } = require("../../lib/faaClient");
const { usage, processing, ok, fail, progressBar } = require("../../lib/theme");

let handler = async (m, { sock, prefix, command }) => {
  const source = getMediaSource(m);
  if (!source || source.mtype !== "imageMessage") {
    return m.reply(usage(`Reply FOTO, terus ketik ${prefix}${command}`, `${prefix}${command}`));
  }

  const label = "hytamhin Waifu lu njir!!!...";
  const statusMsg = await sock.sendMessage(m.chat, { text: processing(label) }, { quoted: m });

  try {
    const buffer = await source.download();
    let lastPercent = -1;
    const imageBuffer = await faaImageTransform(uploadImageBuffer, buffer, "/faa/tohitam", {}, "url", {
      onProgress: async (percent) => {
        if (percent === lastPercent || percent >= 100) return;
        lastPercent = percent;
        try { await sock.sendMessage(m.chat, { text: processing(`${label}\n${progressBar(percent)}`), edit: statusMsg.key }); } catch {}
      },
    });
    await sock.sendMessage(m.chat, { text: ok("Nih dah hytam."), edit: statusMsg.key });
    await sock.sendMessage(m.chat, { image: imageBuffer }, { quoted: m });
  } catch (err) {
    console.error("[JADIHITAM GAGAL]", err?.message || err);
    try { await sock.sendMessage(m.chat, { text: fail("Njir. Server pusatnya lagi down"), edit: statusMsg.key }); } catch {}
  }
};

handler.command = ["hytamkan", "hitamkan", "jadhitam"];
handler.help = ["hytamkan (reply foto — itemin muka lu ini"];
handler.tags = ["ai"];

module.exports = handler;
