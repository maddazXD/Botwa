// plugins/ai/tojepang.js — versi lain ubah foto gaya Jepang (endpoint beda dari
// .japan), pakai endpoint GET /faa/tojepang?url=... dari api-faa.my.id.
const { getMediaSource } = require("../../lib/mediaHelper");
const { uploadImageBuffer } = require("../../lib/screaper");
const { faaImageTransform } = require("../../lib/faaClient");
const { usage, processing, ok, fail, progressBar } = require("../../lib/theme");

let handler = async (m, { sock, prefix, command }) => {
  const source = getMediaSource(m);
  if (!source || source.mtype !== "imageMessage") {
    return m.reply(usage(`Reply FOTO, terus ketik ${prefix}${command}`, `${prefix}${command}`));
  }

  const label = "Lagi diubah gaya Jepang (v2)...";
  const statusMsg = await sock.sendMessage(m.chat, { text: processing(label) }, { quoted: m });

  try {
    const buffer = await source.download();
    let lastPercent = -1;
    const imageBuffer = await faaImageTransform(uploadImageBuffer, buffer, "/faa/tojepang", {}, "url", {
      onProgress: async (percent) => {
        if (percent === lastPercent || percent >= 100) return;
        lastPercent = percent;
        try { await sock.sendMessage(m.chat, { text: processing(`${label}\n${progressBar(percent)}`), edit: statusMsg.key }); } catch {}
      },
    });
    await sock.sendMessage(m.chat, { text: ok("Selesai!"), edit: statusMsg.key });
    await sock.sendMessage(m.chat, { image: imageBuffer }, { quoted: m });
  } catch (err) {
    console.error("[JAPAN2 GAGAL]", err?.message || err);
    try { await sock.sendMessage(m.chat, { text: fail("Gagal — API FAA lagi down/error. Coba lagi nanti."), edit: statusMsg.key }); } catch {}
  }
};

handler.command = ["japan2"];
handler.help = ["japan2 (reply foto — ubah gaya Jepang, versi 2)"];
handler.tags = ["ai"];

module.exports = handler;
