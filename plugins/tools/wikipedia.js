// plugins/tools/wikipedia.js — Cari artikel Wikipedia
const { faaJson } = require("../../lib/faaClient");

let handler = async (m, { text }) => {
  if (!text) return m.reply("Masukkan kata kunci");

  try {
    const data = await faaJson("/faa/Wikipedia-search", { q: text });
    if (!data?.result?.status) return m.reply("Tidak ditemukan");

    const r = data.result;
    let hasil = `📚 *WIKIPEDIA*\n\n📌 *Judul:* ${r.title}\n🔗 *Link:* ${r.url}\n\n📝 *Ringkasan:*\n${r.summary.trim()}`;
    if (r.search_results?.length) {
      hasil += `\n\n🔍 *Hasil Terkait:*`;
      r.search_results.slice(0, 3).forEach((v, i) => { hasil += `\n${i + 1}. ${v.title}\n   ${v.snippet}`; });
    }
    m.reply(hasil);
  } catch (e) {
    console.error("[WIKIPEDIA GAGAL]", e.message);
    m.reply("❌ Gagal mengambil data Wikipedia.");
  }
};

handler.command = ["wiki", "wikipedia", "wikiid"];
handler.tags = ["internet"];
handler.help = ["wiki <kata kunci>"];

module.exports = handler;
