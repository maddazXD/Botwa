// plugins/anime/samestream.js — .samestream <nomor episode dari samedetail,
// atau URL episode langsung>. Link streaming + opsi download episode,
// endpoint GET /anime/samehadaku/stream?url=... dari api.nexray.eu.cc.
const { nexrayJson, flattenToLines } = require("../../lib/nexrayClient");
const { resolveRef } = require("../../lib/samehadakuCache");
const { usage, processing, fail, footer } = require("../../lib/theme");

let handler = async (m, { sock, text, prefix, command }) => {
  const ref = (text || "").trim();
  if (!ref) {
    return m.reply(usage(`${prefix}${command} <nomor dari .samedetail, atau URL episode>`, `${prefix}${command} 1`));
  }

  const resolved = resolveRef(m.sender, ref);
  if (!resolved) {
    return m.reply(fail(`Nomor "${ref}" gak ketemu di daftar episode terakhir (mungkin udah kadaluarsa >15 menit). Coba .samedetail lagi dulu, atau kirim URL episode-nya langsung.`));
  }

  const statusMsg = await sock.sendMessage(m.chat, { text: processing(`Lagi ambil link streaming: ${resolved.label}...`) }, { quoted: m });

  try {
    const json = await nexrayJson("/anime/samehadaku/stream", { url: resolved.url });
    const data = json.result ?? json.data ?? json;
    const lines = flattenToLines(data);
    if (!lines.length) {
      console.error("[SAMESTREAM] Kosong:", JSON.stringify(json).slice(0, 300));
      return sock.sendMessage(m.chat, { text: fail("Data kosong/format gak dikenali. Detail ada di log server."), edit: statusMsg.key });
    }
    await sock.sendMessage(m.chat, {
      text: `▶️ *${resolved.label}*\n\n${lines.join("\n")}${footer()}`,
      edit: statusMsg.key,
    });
  } catch (err) {
    console.error("[SAMESTREAM GAGAL]", err?.message || err);
    try { await sock.sendMessage(m.chat, { text: fail("Gagal ambil link streaming — API Nexray lagi down/error."), edit: statusMsg.key }); } catch {}
  }
};

handler.command = ["samestream"];
handler.help = ["samestream <nomor/URL> (link streaming & download episode)"];
handler.tags = ["anime"];

module.exports = handler;
