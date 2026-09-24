// plugins/anime/samehome.js — .samehome, update anime terbaru dari Samehadaku
// (top 10 mingguan + update terbaru + movie), endpoint GET
// /anime/samehadaku/home dari api.nexray.eu.cc, gak butuh parameter.
const { nexrayJson, flattenToLines } = require("../../lib/nexrayClient");
const { processing, fail, footer } = require("../../lib/theme");

let handler = async (m, { sock }) => {
  const statusMsg = await sock.sendMessage(m.chat, { text: processing("Lagi ambil update anime terbaru...") }, { quoted: m });
  try {
    const json = await nexrayJson("/anime/samehadaku/home");
    const data = json.result ?? json.data ?? json;
    const lines = flattenToLines(data);
    if (!lines.length) {
      console.error("[SAMEHOME] Kosong:", JSON.stringify(json).slice(0, 300));
      return sock.sendMessage(m.chat, { text: fail("Data kosong/format gak dikenali. Detail ada di log server."), edit: statusMsg.key });
    }
    await sock.sendMessage(m.chat, { text: `📺 *Samehadaku - Update Terbaru*\n\n${lines.join("\n")}${footer()}`, edit: statusMsg.key });
  } catch (err) {
    console.error("[SAMEHOME GAGAL]", err?.message || err);
    try { await sock.sendMessage(m.chat, { text: fail("Gagal ambil data — API Nexray lagi down/error."), edit: statusMsg.key }); } catch {}
  }
};

handler.command = ["samehome"];
handler.help = ["samehome (update anime terbaru dari Samehadaku)"];
handler.tags = ["anime"];

module.exports = handler;
