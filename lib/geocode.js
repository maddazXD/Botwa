// lib/geocode.js — ubah nama kota jadi koordinat (lat/lon), dipakai bareng oleh .cuaca
// dan .jadwalsholat. Pakai Open-Meteo Geocoding API: publik, gratis, gak butuh API key,
// dan gak ada limit harian yang bikin was-was kayak API pihak ketiga kemarin-kemarin.
const axios = require("axios");

function stripDiacritics(str) {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

// FIX BUG: percobaan pertama nyoba nebak "kandidat paling Indonesia" dari hasil
// pencarian GLOBAL (count:10) — ternyata gak cukup, soalnya kalau kota di
// Indonesia yang dimaksud kebetulan gak masuk top-10 hasil global (misal
// "Bali" versi Indonesia keindeks sebagai daerah administratif, bukan "kota",
// jadi kalah rank sama "Bali" versi kota kecil di negara lain), dia ttp gak
// pernah kepilih sama sekali.
//
// Sekarang pakai parameter RESMI dari Open-Meteo: `countryCode` — ini nge-filter
// di SISI SERVER mereka (search khusus di dalam negara itu aja), jadi dijamin akurat,
// bukan nebak-nebak dari hasil global lagi. Caranya:
//   1. Search KHUSUS di Indonesia dulu (countryCode: "ID"). Kalau ketemu, langsung
//      pakai itu — gak peduli ada tempat senama di negara lain atau nggak.
//   2. Baru kalau BENERAN gak ada di Indonesia, search global (buat kota luar negeri
//      kayak "Tokyo", "Paris", dst).
// Kecuali kalau orangnya emang udah nulis qualifier sendiri (ada koma, misal
// "Bali, India" atau "Paris, France") — itu tandanya dia udah spesifik milih sendiri,
// jadi gak usah dipaksa ke Indonesia, langsung search global apa adanya.
async function geocodeCity(cityName) {
  const hasExplicitQualifier = cityName.includes(",");

  if (!hasExplicitQualifier) {
    const idResult = await searchOnce(cityName, "ID");
    if (idResult) return idResult;
  }

  return await searchOnce(cityName, null);
}

async function searchOnce(cityName, countryCode) {
  const params = { name: cityName, count: 10, language: "id", format: "json" };
  if (countryCode) params.countryCode = countryCode;

  const res = await axios.get("https://geocoding-api.open-meteo.com/v1/search", {
    params,
    timeout: 10000,
  });
  const results = res.data?.results;
  if (!results || !results.length) return null;

  // Di antara hasil yang udah dipastikan senegara (atau global kalau gak ada
  // filter negara), tetep utamain yang namanya PERSIS sama kayak yang diketik,
  // baru di antara itu pilih yang populasinya paling gede.
  const query = stripDiacritics(cityName.trim().toLowerCase());
  const exactMatches = results.filter((r) => stripDiacritics((r.name || "").toLowerCase()) === query);
  const candidates = exactMatches.length ? exactMatches : results;

  candidates.sort((a, b) => (b.population || 0) - (a.population || 0));
  const result = candidates[0];

  return {
    name: result.name,
    country: result.country || "",
    countryCode: result.country_code || "",
    admin1: result.admin1 || "",
    latitude: result.latitude,
    longitude: result.longitude,
    timezone: result.timezone || "auto",
  };
}

module.exports = { geocodeCity };
