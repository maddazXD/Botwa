// plugins/fun/tafsirmimpi.js — Tafsir mimpi
const { faaJson } = require("../../lib/faaClient");

let handler = async (m, { text }) => {
  await m.react("✨");
  if (!text) return m.reply(`Contoh: ${m.cmd} Senang`);

  try {
    const json = await faaJson("/faa/tafsir-mimpi", { mimpi: text });
    if (!json.status) throw new Error("API error");
    m.reply(`Tafsir mimpi: *${json.mimpi}*\n\n${json.result}`);
  } catch (e) {
    console.error("[TAFSIRMIMPI GAGAL]", e.message);
    m.reply("⚠️ Gagal mengambil tafsir mimpi.");
  }
};

handler.command = ["tafsirmimpi", "mimpi2"];
handler.tags = ["fun"];
handler.help = ["tafsirmimpi <kata>"];

module.exports = handler;
