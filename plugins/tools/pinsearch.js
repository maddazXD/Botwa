// plugins/tools/pinsearch.js — cari gambar di Pinterest, pakai endpoint GET
// /faa/pinterest?q=... dari api-faa.my.id. Skema respons udah kekonfirmasi:
// {"result":["https://...jpg","https://...png", ...]} — array URL string flat,
// bisa belasan item. Default kirim 10, bisa diatur user lewat "query|jumlah".
const axios = require("axios");
const { faaJson, findHttpUrlDeep } = require("../../lib/faaClient");
const { usage, processing, ok, fail } = require("../../lib/theme");

const DEFAULT_RESULTS = 10;
const MAX_RESULTS = 20; // cap keras biar gak spam kebanyakan ke chat

let handler = async (m, { sock, text, prefix, command }) => {
  const parts = (text || "").split("|").map((s) => s?.trim());
  const query = parts[0];
  const requested = parseInt(parts[1], 10);
  const limit = Math.min(Number.isFinite(requested) && requested > 0 ? requested : DEFAULT_RESULTS, MAX_RESULTS);

  if (!query) {
    return m.reply(
      usage(`${prefix}${command} <kata kunci>|<jumlah opsional, maks ${MAX_RESULTS}>`, `${prefix}${command} anime wallpaper aesthetic|15`)
    );
  }

  const statusMsg = await sock.sendMessage(m.chat, { text: processing(`Nyari "${query}" di Pinterest...`) }, { quoted: m });

  try {
    const json = await faaJson("/faa/pinterest", { q: query });
    const root = json.result ?? json.data ?? json;
    const items = Array.isArray(root)
      ? root
      : Array.isArray(root.data)
      ? root.data
      : Array.isArray(root.images)
      ? root.images
      : Array.isArray(root.pins)
      ? root.pins
      : [];

    const urls = items
      .map((it) => (typeof it === "string" ? it : findHttpUrlDeep(it)))
      .filter(Boolean)
      .slice(0, limit);

    if (!urls.length) {
      console.error("[PINSEARCH] Gak ketemu URL gambar:", JSON.stringify(json).slice(0, 300));
      return sock.sendMessage(m.chat, { text: fail("Gak ketemu hasil (atau field-nya gak dikenali). Detail ada di log server."), edit: statusMsg.key });
    }

    await sock.sendMessage(m.chat, { text: ok(`Ketemu ${urls.length} hasil, lagi dikirim...`), edit: statusMsg.key });

    for (let i = 0; i < urls.length; i++) {
      try {
        const imgRes = await axios.get(urls[i], { responseType: "arraybuffer", timeout: 30000 });
        await sock.sendMessage(m.chat, { image: Buffer.from(imgRes.data) }, { quoted: m });
      } catch (e) {
        console.error(`[PINSEARCH] gagal kirim gambar ke-${i + 1}:`, e.message);
      }
    }
  } catch (err) {
    console.error("[PINSEARCH GAGAL]", err?.message || err);
    try { await sock.sendMessage(m.chat, { text: fail("Gagal cari di Pinterest — API FAA lagi down/error. Coba lagi nanti."), edit: statusMsg.key }); } catch {}
  }
};

handler.command = ["pinsearch", "pinterest"];
handler.help = [`pinsearch <kata kunci>|<jumlah opsional> (cari gambar di Pinterest, default ${DEFAULT_RESULTS})`];
handler.tags = ["tools"];

module.exports = handler;
