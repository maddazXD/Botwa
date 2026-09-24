// plugins/anime/samelist.js — .samelist [halaman], daftar semua anime
// Samehadaku (dipaginasi), endpoint GET /anime/samehadaku/page?page=...
// dari api.nexray.eu.cc. Hasilnya di-cache per-nomor sama kayak .samesearch,
// bisa dilanjutin ke .samedetail <nomor>.
const { nexrayJson, findHttpUrlDeep } = require("../../lib/nexrayClient");
const { setCache } = require("../../lib/samehadakuCache");
const { processing, fail, footer } = require("../../lib/theme");

function pickTitle(item) {
  return item?.title || item?.judul || item?.name || item?.anime_name || "Tanpa judul";
}
function pickUrl(item) {
  return item?.url || item?.link || item?.href || findHttpUrlDeep(item);
}
function extractItems(json) {
  const root = json.result ?? json.data ?? json;
  if (Array.isArray(root)) return root;
  for (const key of ["anime", "animeList", "results", "data", "list"]) {
    if (Array.isArray(root?.[key])) return root[key];
  }
  return [];
}

let handler = async (m, { sock, text, prefix }) => {
  const page = parseInt((text || "1").trim(), 10) || 1;
  const statusMsg = await sock.sendMessage(m.chat, { text: processing(`Lagi ambil daftar anime halaman ${page}...`) }, { quoted: m });

  try {
    const json = await nexrayJson("/anime/samehadaku/page", { page });
    const rawItems = extractItems(json);
    const items = rawItems.map((it) => ({ label: pickTitle(it), url: pickUrl(it), raw: it })).filter((it) => it.url);

    if (!items.length) {
      console.error("[SAMELIST] Gak ketemu item:", JSON.stringify(json).slice(0, 300));
      return sock.sendMessage(m.chat, { text: fail(`Halaman ${page} kosong (atau format respons gak dikenali).`), edit: statusMsg.key });
    }

    setCache(m.sender, items);
    const lines = items.map((it, i) => `${i + 1}. ${it.label}`).join("\n");
    await sock.sendMessage(m.chat, {
      text: `📃 *Daftar Anime - Halaman ${page}*\n\n${lines}\n\nKetik *${prefix}samedetail <nomor>* buat liat detailnya, atau *${prefix}samelist ${page + 1}* buat halaman berikutnya.${footer()}`,
      edit: statusMsg.key,
    });
  } catch (err) {
    console.error("[SAMELIST GAGAL]", err?.message || err);
    try { await sock.sendMessage(m.chat, { text: fail("Gagal ambil daftar anime — API Nexray lagi down/error."), edit: statusMsg.key }); } catch {}
  }
};

handler.command = ["samelist"];
handler.help = ["samelist [halaman] (daftar semua anime di Samehadaku)"];
handler.tags = ["anime"];

module.exports = handler;
