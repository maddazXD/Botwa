// plugins/info-gempa.js
// FIX BUG: API lama (api-xemoz-official.my.id, wrapper gak jelas) udah kadaluwarsa.
// Diganti LANGSUNG ke sumber aslinya: data.bmkg.go.id — API resmi BMKG, gratis, gak
// butuh key/auth, udah dites live per 31 Jul 2026.
//
// 3 endpoint BMKG yang dipakai:
// - autogempa.json      → 1 gempa terbaru (object tunggal)       → .gempa
// - gempaterkini.json   → 15 gempa M5.0+ terakhir (array)        → .gempaterkini
// - gempadirasakan.json → 15 gempa yang dirasakan warga (array)  → .gempadirasakan
// Dua yang terakhir formatnya ARRAY (data.Infogempa.gempa = [...]), beda dari autogempa
// yang objek tunggal (data.Infogempa.gempa = {...}) — makanya ditangani terpisah di bawah,
// dan yang array dipaginate pakai lib/pagination.js biar bisa di-.next/.back.
const axios = require("axios");
const { startSession } = require("../../lib/pagination");
const { header, card, footer } = require("../../lib/theme");

const BASE = "https://data.bmkg.go.id/DataMKG/TEWS";

async function fetchBmkg(path) {
  const res = await axios.get(`${BASE}/${path}`, { timeout: 15000, validateStatus: () => true });
  console.log(`[GEMPA DEBUG] path: ${path}, status: ${res.status}`);
  if (res.status !== 200) throw new Error(`API balikin HTTP ${res.status}. Detail ada di log server.`);
  return res.data;
}

function formatGempaBlock(g, i) {
  return (
    `*${i + 1}. M${g.Magnitude || "-"} — ${g.Wilayah || "-"}*\n` +
    `📅 ${g.Tanggal || "-"}, ${g.Jam || "-"}\n` +
    `🔻 Kedalaman: ${g.Kedalaman || "-"} | 🌊 ${g.Potensi || "-"}`
  );
}

let handler = async (m, { sock, command }) => {
  await m.react("🌍");

  try {
    // ── .gempaterkini & .gempadirasakan → daftar, dipaginate ─────
    if (command === "gempaterkini" || command === "gempadirasakan") {
      const path = command === "gempaterkini" ? "gempaterkini.json" : "gempadirasakan.json";
      const data = await fetchBmkg(path);
      const list = data?.Infogempa?.gempa;
      if (!Array.isArray(list) || !list.length) throw new Error("Data gempa gak ditemukan di respons API. Detail ada di log server.");

      const title = command === "gempaterkini" ? "GEMPA TERKINI (M5.0+)" : "GEMPA DIRASAKAN";
      const blocks = list.map(formatGempaBlock);
      const text = startSession(m.chat, { title, emoji: "🌍", blocks });

      await m.react("✅");
      return m.reply(`_Sumber: BMKG (data.bmkg.go.id)_\n\n${text}`);
    }

    // ── .gempa / .infobmkg / .bmkg → gempa terbaru (single, dengan shakemap) ─────
    const data = await fetchBmkg("autogempa.json");
    const g = data?.Infogempa?.gempa;
    if (!g) throw new Error("Data gempa tidak ditemukan di respons API. Detail ada di log server.");

    const teks =
      `${header("Info Gempa Terkini", "🌍")}\n\n` +
      card("DETAIL GEMPA", [
        `📅 Tanggal   : *${g.Tanggal || "-"}*`,
        `⏰ Waktu     : *${g.Jam || "-"}*`,
        `📍 Lintang   : *${g.Lintang || "-"}*`,
        `📍 Bujur     : *${g.Bujur || "-"}*`,
        `💥 Magnitudo : *${g.Magnitude || "-"} SR*`,
        `🔻 Kedalaman : *${g.Kedalaman || "-"}*`,
        `📌 Wilayah   : *${g.Wilayah || "-"}*`,
        `🌊 Tsunami   : *${g.Potensi || "-"}*`,
      ], "📊") +
      `\n\n> _Data resmi BMKG (data.bmkg.go.id). Selalu waspada!_ 🙏` +
      footer();

    const shakemapUrl = g.Shakemap ? `${BASE}/${g.Shakemap}` : null;
    if (shakemapUrl) {
      const buf = await axios.get(shakemapUrl, { responseType: "arraybuffer", timeout: 10000 })
        .then(r => Buffer.from(r.data)).catch(() => null);
      if (buf) {
        await sock.sendMessage(m.chat, { image: buf, caption: teks }, { quoted: m });
        return await m.react("✅");
      }
    }

    await m.reply(teks);
    await m.react("✅");
  } catch (err) {
    console.error("[GEMPA GAGAL]", err?.response?.status, err?.message);
    await m.react("❌");
    m.reply("❌ Gagal mengambil info gempa: " + err.message);
  }
};

handler.command = ["gempa", "infobmkg", "bmkg", "gempaterkini", "gempadirasakan"];
handler.tags = ["info"];
handler.help = ["gempa", "gempaterkini", "gempadirasakan"];
module.exports = handler;
