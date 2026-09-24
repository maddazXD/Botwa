// plugins/tools/jadwalsholat.js — jadwal sholat berdasarkan kota, pakai Aladhan API
// (API publik yang umum dipakai buat jadwal sholat, gratis, gak butuh API key).
// Metode perhitungan pakai kode 20 = Kementerian Agama Republik Indonesia.
const axios = require("axios");
const moment = require("moment-timezone");
const { geocodeCity } = require("../../lib/geocode");
const { usage, card, fail } = require("../../lib/theme");

let handler = async (m, { text, prefix, command }) => {
  const city = text?.trim();
  if (!city) return m.reply(usage(`${prefix}${command} <nama kota>`, `${prefix}${command} Bandung`));

  try {
    const loc = await geocodeCity(city);
    if (!loc) return m.reply(fail(`Kota "${city}" gak ketemu, coba nama lain/lebih spesifik.`));

    const today = moment().format("DD-MM-YYYY");
    const res = await axios.get(`https://api.aladhan.com/v1/timings/${today}`, {
      params: { latitude: loc.latitude, longitude: loc.longitude, method: 20 },
      timeout: 10000,
    });

    const t = res.data?.data?.timings;
    if (!t) return m.reply(fail("Gagal mengambil jadwal sholat."));

    const lokasiLabel = [loc.name, loc.admin1, loc.country].filter(Boolean).join(", ");
    const lines = [
      `Subuh: ${t.Fajr}`,
      `Terbit: ${t.Sunrise}`,
      `Dzuhur: ${t.Dhuhr}`,
      `Ashar: ${t.Asr}`,
      `Maghrib: ${t.Maghrib}`,
      `Isya: ${t.Isha}`,
    ];
    m.reply(card(`Jadwal Sholat ${lokasiLabel} (${today})`, lines, "🕌"));
  } catch (err) {
    console.error("[JADWALSHOLAT GAGAL]", err?.message || err);
    m.reply(fail("Gagal mengambil jadwal sholat, coba lagi."));
  }
};

handler.command = ["jadwalsholat", "sholat", "sholatjadwal"];
handler.help = ["jadwalsholat <kota>"];
handler.tags = ["tools"];

module.exports = handler;
