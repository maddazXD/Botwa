// plugins/tools/aibypass.js — "humanize"/bypass deteksi AI buat teks, pakai
// endpoint GET /ai/bypass?text=... dari api.nexray.eu.cc.
const { nexrayJson, findTextResult } = require("../../lib/nexrayClient");
const { usage, processing, ok, fail, footer } = require("../../lib/theme");

let handler = async (m, { sock, text, prefix, command }) => {
  const input = (text || "").trim();
  if (!input) {
    return m.reply(usage(`${prefix}${command} <teks>`, `${prefix}${command} Artikel ini dibuat sepenuhnya oleh AI untuk membantu riset.`));
  }

  const statusMsg = await sock.sendMessage(m.chat, { text: processing("Lagi diproses biar gak kedeteksi AI...") }, { quoted: m });

  try {
    const json = await nexrayJson("/ai/bypass", { text: input });
    const result = findTextResult(json);
    if (!result) {
      console.error("[AIBYPASS] Field hasil gak ketemu:", JSON.stringify(json).slice(0, 300));
      return sock.sendMessage(m.chat, { text: fail("API gak ngasih hasil yang bisa dikenali. Detail ada di log server."), edit: statusMsg.key });
    }
    await sock.sendMessage(m.chat, { text: `${result}${footer()}`, edit: statusMsg.key });
  } catch (err) {
    console.error("[AIBYPASS GAGAL]", err?.message || err);
    try { await sock.sendMessage(m.chat, { text: fail("Gagal proses teks — API Nexray lagi down/error. Coba lagi nanti."), edit: statusMsg.key }); } catch {}
  }
};

handler.command = ["bypass", "aibypass"];
handler.help = ["bypass <teks> (humanize/bypass deteksi AI)"];
handler.tags = ["tools"];

module.exports = handler;
