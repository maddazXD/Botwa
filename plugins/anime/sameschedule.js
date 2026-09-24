// plugins/anime/sameschedule.js — .sameschedule, jadwal rilis anime mingguan
// (Senin-Minggu), endpoint GET /anime/samehadaku/schedule dari
// api.nexray.eu.cc, gak butuh parameter.
const { nexrayJson, flattenToLines } = require("../../lib/nexrayClient");
const { processing, fail, footer } = require("../../lib/theme");

let handler = async (m, { sock }) => {
  const statusMsg = await sock.sendMessage(m.chat, { text: processing("Lagi ambil jadwal rilis anime...") }, { quoted: m });
  try {
    const json = await nexrayJson("/anime/samehadaku/schedule");
    const data = json.result ?? json.data ?? json;
    const lines = flattenToLines(data);
    if (!lines.length) {
      console.error("[SAMESCHEDULE] Kosong:", JSON.stringify(json).slice(0, 300));
      return sock.sendMessage(m.chat, { text: fail("Data kosong/format gak dikenali. Detail ada di log server."), edit: statusMsg.key });
    }
    await sock.sendMessage(m.chat, { text: `🗓️ *Jadwal Rilis Anime - Samehadaku*\n\n${lines.join("\n")}${footer()}`, edit: statusMsg.key });
  } catch (err) {
    console.error("[SAMESCHEDULE GAGAL]", err?.message || err);
    try { await sock.sendMessage(m.chat, { text: fail("Gagal ambil jadwal — API Nexray lagi down/error."), edit: statusMsg.key }); } catch {}
  }
};

handler.command = ["sameschedule"];
handler.help = ["sameschedule (jadwal rilis anime mingguan)"];
handler.tags = ["anime"];

module.exports = handler;
