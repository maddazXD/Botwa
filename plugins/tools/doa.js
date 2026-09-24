// plugins/tools/doa.js — Cari kumpulan doa harian
const { faaJson } = require("../../lib/faaClient");

let handler = async (m, { text }) => {
  await m.react("✨");
  if (!text) return m.reply("*Contoh:* .doa makan");

  try {
    const json = await faaJson("/faa/doa", { q: text });
    if (!json.status || !json.data?.length) return m.reply("Tidak ditemukan.");

    const hasil = json.data.map((d) => `${d.doa}\n\n${d.ayat}\n\n${d.latin}\n\n${d.artinya}`.trim()).join("\n\n");
    m.reply(hasil);
  } catch (e) {
    console.error("[DOA GAGAL]", e.message);
    m.reply("❌ Gagal mengambil doa.");
  }
};

handler.command = ["doa"];
handler.tags = ["internet"];
handler.help = ["doa <kata kunci>"];

module.exports = handler;
