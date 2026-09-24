// plugins/anime/samesearch.js — .samesearch <keyword>, cari anime di
// Samehadaku, endpoint GET /anime/samehadaku/search?q=... dari
// api.nexray.eu.cc. Hasilnya di-cache per-nomor (lib/samehadakuCache.js)
// biar bisa langsung dilanjutin ke .samedetail <nomor> tanpa copas URL.
const { nexrayJson, findHttpUrlDeep } = require("../../lib/nexrayClient");
const { setCache } = require("../../lib/samehadakuCache");
const { usage, processing, fail, footer } = require("../../lib/theme");

function pickTitle(item) {
  return item?.title || item?.judul || item?.name || item?.anime_name || "Tanpa judul";
}
function pickUrl(item) {
  return item?.url || item?.link || item?.href || findHttpUrlDeep(item);
}
// Skema hasil search gak dikonfirmasi persis, jadi dicoba beberapa
// kemungkinan bentuk array (langsung, atau nested di beberapa nama field).
function extractItems(json) {
  const root = json.result ?? json.data ?? json;
  if (Array.isArray(root)) return root;
  for (const key of ["anime", "animeList", "results", "data", "list"]) {
    if (Array.isArray(root?.[key])) return root[key];
  }
  return [];
}

let handler = async (m, { sock, text, prefix, command }) => {
  const query = (text || "").trim();
  if (!query) {
    return m.reply(usage(`${prefix}${command} <judul anime>`, `${prefix}${command} naruto`));
  }

  const statusMsg = await sock.sendMessage(m.chat, { text: processing(`Nyari "${query}" di Samehadaku...`) }, { quoted: m });

  try {
    const json = await nexrayJson("/anime/samehadaku/search", { q: query });
    const rawItems = extractItems(json);
    const items = rawItems.map((it) => ({ label: pickTitle(it), url: pickUrl(it), raw: it })).filter((it) => it.url);

    if (!items.length) {
      console.error("[SAMESEARCH] Gak ketemu item:", JSON.stringify(json).slice(0, 300));
      return sock.sendMessage(m.chat, { text: fail(`Gak ketemu hasil buat "${query}" (atau format respons gak dikenali).`), edit: statusMsg.key });
    }

    setCache(m.sender, items);
    const lines = items.map((it, i) => `${i + 1}. ${it.label}`).join("\n");
    await sock.sendMessage(m.chat, {
      text: `🔍 *Hasil pencarian "${query}"*\n\n${lines}\n\nKetik *${prefix}samedetail <nomor>* buat liat detailnya.${footer()}`,
      edit: statusMsg.key,
    });
  } catch (err) {
    console.error("[SAMESEARCH GAGAL]", err?.message || err);
    try { await sock.sendMessage(m.chat, { text: fail("Gagal cari anime — API Nexray lagi down/error."), edit: statusMsg.key }); } catch {}
  }
};

handler.command = ["samesearch"];
handler.help = ["samesearch <judul> (cari anime di Samehadaku)"];
handler.tags = ["anime"];

module.exports = handler;
