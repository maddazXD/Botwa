// plugins/converter/toeffects.js — Kumpulan efek ubah gaya foto (botak, chibi,
// figura, hijab, kacamata, dll), satu plugin buat banyak command sekaligus,
// pakai endpoint GET /faa/<command>?url=... dari api-faa.my.id (nama endpoint-nya
// sama persis dengan nama commandnya). Command yang efeknya udah ada plugin
// tersendiri (tojapanese, tojepang, toreal, tomirror, toghibli/.ghibli) sengaja
// TIDAK dimasukkan di sini biar gak dobel.
const { getMediaSource } = require("../../lib/mediaHelper");
const { uploadImageBuffer } = require("../../lib/screaper");
const { faaImageTransform } = require("../../lib/faaClient");
const { usage, processing, ok, fail, progressBar } = require("../../lib/theme");

const EFFECT_LIST = [
  "tobotak", "tochibi", "tofunk", "tofigura", "tofigurav2", "tofigurav3",
  "tohijab", "tokacamata", "tokamboja", "tolego", "toliquor", "tomaid",
  "tomoai", "tomonyet", "topacar", "topeci", "topiramida", "toputih",
  "toroblox", "toroh", "totato", "totua", "toviking", "tozombie",
  "tounderground", "tohitam",
];

let handler = async (m, { sock, prefix, command }) => {
  const source = getMediaSource(m);
  if (!source || source.mtype !== "imageMessage") {
    const list = EFFECT_LIST.map((v) => `.${v}`).join("\n");
    return m.reply(`✨ *AI IMAGE CONVERTER*\n\nReply gambar dengan caption salah satu command berikut:\n\n${list}`);
  }

  const label = `Lagi memproses efek ${command}...`;
  const statusMsg = await sock.sendMessage(m.chat, { text: processing(label) }, { quoted: m });

  try {
    const buffer = await source.download();
    let lastPercent = -1;
    const imageBuffer = await faaImageTransform(uploadImageBuffer, buffer, `/faa/${command}`, {}, "url", {
      onProgress: async (percent) => {
        if (percent === lastPercent || percent >= 100) return;
        lastPercent = percent;
        try { await sock.sendMessage(m.chat, { text: processing(`${label}\n${progressBar(percent)}`), edit: statusMsg.key }); } catch {}
      },
    });
    await sock.sendMessage(m.chat, { text: ok("Selesai!"), edit: statusMsg.key });
    await sock.sendMessage(m.chat, { image: imageBuffer }, { quoted: m });
  } catch (err) {
    console.error(`[${command.toUpperCase()} GAGAL]`, err?.message || err);
    try { await sock.sendMessage(m.chat, { text: fail("Gagal — API FAA lagi down/error. Coba lagi nanti."), edit: statusMsg.key }); } catch {}
  }
};

handler.command = EFFECT_LIST;
handler.help = EFFECT_LIST.map((v) => `${v} (reply foto)`);
handler.tags = ["converter"];

module.exports = handler;
