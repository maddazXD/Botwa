// plugins/tools/lirik.js — cari lirik lagu, pakai endpoint GET /faa/lyrics?q=...
// dari api-faa.my.id. Skema field hasil gak fix (judul/artis/lirik bisa beda
// nama field), jadi dicoba beberapa kemungkinan umum sebelum fallback ke dump
// mentah object hasil.
const { faaUrl, retryFetch } = require("../../lib/faaClient");
const { usage, processing, fail, footer } = require("../../lib/theme");

let handler = async (m, { sock, text, prefix, command }) => {
  const query = (text || "").trim();
  if (!query) {
    return m.reply(usage(`${prefix}${command} <judul lagu - artis>`, `${prefix}${command} Sial - Mahalini`));
  }

  const statusMsg = await sock.sendMessage(m.chat, { text: processing(`Nyari lirik "${query}"...`) }, { quoted: m });

  try {
    const res = await retryFetch(faaUrl("/faa/lyrics", { q: query }), {
      responseType: "arraybuffer",
      timeout: 60000,
      validateStatus: () => true,
    });
    const json = JSON.parse(Buffer.from(res.data).toString("utf8"));
    if (res.status !== 200 || json.status === false) {
      return sock.sendMessage(m.chat, { text: fail(`Lirik gak ketemu. ${json.message || ""}`.trim()), edit: statusMsg.key });
    }

    const r = json.result || json.data || json;
    const title = r.title || r.judul || query;
    const artist = r.artist || r.penyanyi || r.singer || "";
    const lyrics = r.lyrics || r.lirik || r.text || r.content || (typeof r === "string" ? r : null);

    if (!lyrics) {
      console.error("[LIRIK] Field lirik gak ketemu:", JSON.stringify(json).slice(0, 300));
      return sock.sendMessage(m.chat, { text: fail("API gak ngasih teks lirik yang bisa dikenali. Detail ada di log server."), edit: statusMsg.key });
    }

    await sock.sendMessage(m.chat, { text: `🎵 *${title}*${artist ? ` — ${artist}` : ""}\n\n${lyrics}${footer()}`, edit: statusMsg.key });
  } catch (err) {
    console.error("[LIRIK GAGAL]", err?.message || err);
    try { await sock.sendMessage(m.chat, { text: fail("Gagal ambil lirik — API FAA lagi down/error. Coba lagi nanti."), edit: statusMsg.key }); } catch {}
  }
};

handler.command = ["lirik", "lyrics"];
handler.help = ["lirik <judul - artis> (cari lirik lagu)"];
handler.tags = ["tools"];

module.exports = handler;
