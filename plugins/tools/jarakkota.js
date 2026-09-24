// plugins/tools/jarakkota.js — hitung jarak antar kota, pakai endpoint GET
// /faa/jarakkota?dari=...&ke=... dari api-faa.my.id. Format input: "kota
// asal|kota tujuan" (pisah pakai |).
//
// Skema respons udah kekonfirmasi lengkap dari user:
// {"result":{"dari":{"nama","lokasi","koordinat":{lat,lon}},"ke":{...sama...},
//  "jarak":"181.1 km","jarak_km":181.06,
//  "estimasi_waktu":{"motor","mobil","jalan_kaki"}}}
const { faaJson } = require("../../lib/faaClient");
const { usage, processing, fail } = require("../../lib/theme");

let handler = async (m, { sock, text, prefix, command }) => {
  const [dari, ke] = (text || "").split("|").map((s) => s?.trim()).filter(Boolean);
  if (!dari || !ke) {
    return m.reply(usage(`${prefix}${command} <kota asal>|<kota tujuan>`, `${prefix}${command} Jakarta|Bandung`));
  }

  const statusMsg = await sock.sendMessage(m.chat, { text: processing(`Ngitung jarak ${dari} ke ${ke}...`) }, { quoted: m });

  try {
    const json = await faaJson("/faa/jarakkota", { dari, ke });
    const r = json.result || json.data || json;

    // Kalau skema-nya sesuai yang udah dikonfirmasi (ada dari.nama & ke.nama),
    // format rapi. Kalau beda (endpoint berubah/nama field lain), fallback ke
    // dump generic biar tetep ada info yang keliatan, bukan kosong.
    let resultText;
    if (r?.dari?.nama && r?.ke?.nama) {
      const w = r.estimasi_waktu || {};
      const lines = [
        `📍 *Dari:* ${r.dari.nama} (${r.dari.lokasi || "-"})`,
        `📍 *Ke:* ${r.ke.nama} (${r.ke.lokasi || "-"})`,
        `📏 *Jarak:* ${r.jarak || (r.jarak_km ? `${r.jarak_km} km` : "-")}`,
        w.motor || w.mobil || w.jalan_kaki ? `⏱️ *Estimasi waktu:*` : null,
        w.motor ? `   🏍️ Motor: ${w.motor}` : null,
        w.mobil ? `   🚗 Mobil: ${w.mobil}` : null,
        w.jalan_kaki ? `   🚶 Jalan kaki: ${w.jalan_kaki}` : null,
      ].filter(Boolean);
      resultText = lines.join("\n");
    } else {
      // Fallback generic: dump semua field level-1, termasuk nested object
      // (di-flatten jadi "key.subkey: value") biar gak ada info yang ilang.
      const lines = [];
      const flatten = (obj, prefix2 = "") => {
        for (const [k, v] of Object.entries(obj || {})) {
          if (v && typeof v === "object" && !Array.isArray(v)) flatten(v, `${prefix2}${k}.`);
          else lines.push(`*${prefix2}${k}:* ${v}`);
        }
      };
      flatten(r);
      resultText = lines.join("\n") || JSON.stringify(r);
    }
    await sock.sendMessage(m.chat, { text: resultText, edit: statusMsg.key });
  } catch (err) {
    console.error("[JARAKKOTA GAGAL]", err?.message || err);
    try { await sock.sendMessage(m.chat, { text: fail("Gagal hitung jarak — cek nama kotanya, atau API FAA lagi down."), edit: statusMsg.key }); } catch {}
  }
};

handler.command = ["jarakkota"];
handler.help = ["jarakkota <kota asal>|<kota tujuan> (hitung jarak antar kota)"];
handler.tags = ["tools"];

module.exports = handler;
