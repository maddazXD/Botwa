// plugins/tools/kbbi.js — Cari arti kata di KBBI
const { faaJson } = require("../../lib/faaClient");

let handler = async (m, { text }) => {
  await m.react("✨");
  if (!text) return m.reply("*Contoh:* .kbbi Anu");

  try {
    const json = await faaJson("/faa/kbbi", { q: text });
    if (!json.status || !json.result) return m.reply("Tidak ditemukan.");
    m.reply(`${json.result.kata}\n\n${json.result.keterangan}`.trim());
  } catch (e) {
    console.error("[KBBI GAGAL]", e.message);
    m.reply("❌ Gagal mengambil data KBBI.");
  }
};

handler.command = ["kbbi"];
handler.tags = ["internet"];
handler.help = ["kbbi <kata>"];

module.exports = handler;
