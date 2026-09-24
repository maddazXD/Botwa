// plugins/anime/samedetail.js — .samedetail <nomor dari samesearch/samelist,
// atau URL langsung>. Detail anime (sinopsis, genre, status, daftar episode),
// endpoint GET /anime/samehadaku/detail?url=... dari api.nexray.eu.cc.
// Daftar EPISODE-nya di-cache ulang (nimpa cache search/list sebelumnya) biar
// bisa dilanjutin ke .samestream <nomor episode>.
const { nexrayJson, findHttpUrlDeep, flattenToLines } = require("../../lib/nexrayClient");
const { resolveRef, setCache } = require("../../lib/samehadakuCache");
const { usage, processing, fail, footer } = require("../../lib/theme");

const EPISODE_ARRAY_KEYS = ["episode_list", "episodeList", "episodes", "eps", "list_episode", "daftar_episode"];

function findEpisodes(obj) {
  for (const key of EPISODE_ARRAY_KEYS) {
    if (Array.isArray(obj?.[key])) return obj[key];
  }
  // Fallback: cari array pertama yang isinya object ber-URL (kemungkinan itu
  // daftar episode meski nama field-nya beda dari yang ditebak di atas).
  for (const v of Object.values(obj || {})) {
    if (Array.isArray(v) && v.length && typeof v[0] === "object" && (v[0].url || v[0].link || findHttpUrlDeep(v[0]))) {
      return v;
    }
  }
  return null;
}
function pickEpTitle(ep, i) {
  return ep?.title || ep?.episode || ep?.name || `Episode ${ep?.episode_number || ep?.number || i + 1}`;
}
function pickEpUrl(ep) {
  return ep?.url || ep?.link || ep?.href || findHttpUrlDeep(ep);
}

let handler = async (m, { sock, text, prefix, command }) => {
  const ref = (text || "").trim();
  if (!ref) {
    return m.reply(usage(`${prefix}${command} <nomor dari .samesearch/.samelist, atau URL>`, `${prefix}${command} 1`));
  }

  const resolved = resolveRef(m.sender, ref);
  if (!resolved) {
    return m.reply(fail(`Nomor "${ref}" gak ketemu di daftar terakhir (mungkin udah kadaluarsa >15 menit). Coba .samesearch/.samelist lagi dulu, atau kirim URL-nya langsung.`));
  }

  const statusMsg = await sock.sendMessage(m.chat, { text: processing(`Lagi ambil detail: ${resolved.label}...`) }, { quoted: m });

  try {
    const json = await nexrayJson("/anime/samehadaku/detail", { url: resolved.url });
    const data = json.result ?? json.data ?? json;

    const episodesRaw = findEpisodes(data);
    let episodeText = "";
    if (episodesRaw && episodesRaw.length) {
      const episodes = episodesRaw.map((ep, i) => ({ label: pickEpTitle(ep, i), url: pickEpUrl(ep), raw: ep })).filter((e) => e.url);
      if (episodes.length) {
        setCache(m.sender, episodes);
        const epLines = episodes.slice(0, 30).map((e, i) => `${i + 1}. ${e.label}`).join("\n");
        episodeText = `\n\n📼 *Daftar Episode:*\n${epLines}${episodes.length > 30 ? `\n...+${episodes.length - 30} episode lainnya` : ""}\n\nKetik *${prefix}samestream <nomor>* buat dapetin link streaming-nya.`;
      }
    }

    // Info umum di-flatten generic (skip field episode list-nya biar gak dobel
    // sama yang udah ditampilin rapi di atas).
    const infoObj = { ...data };
    for (const key of EPISODE_ARRAY_KEYS) delete infoObj[key];
    const infoLines = flattenToLines(infoObj).slice(0, 20);

    await sock.sendMessage(m.chat, {
      text: `📖 *${resolved.label}*\n\n${infoLines.join("\n")}${episodeText}${footer()}`,
      edit: statusMsg.key,
    });
  } catch (err) {
    console.error("[SAMEDETAIL GAGAL]", err?.message || err);
    try { await sock.sendMessage(m.chat, { text: fail("Gagal ambil detail — API Nexray lagi down/error."), edit: statusMsg.key }); } catch {}
  }
};

handler.command = ["samedetail"];
handler.help = ["samedetail <nomor/URL> (detail anime + daftar episode)"];
handler.tags = ["anime"];

module.exports = handler;
