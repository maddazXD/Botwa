// lib/betabotzClient.js — helper buat manggil api.betabotz.eu.org, dipakai
// SEBAGAI FALLBACK di fitur .ytmp3/.ytmp4 (sumber utamanya tetep btch-downloader
// yang gratis/tanpa apikey — lihat plugins/download/youtube.js). BetaBotz baru
// dipanggil kalau btch-downloader gagal.
//
// Endpoint (GET, query string):
//   /api/download/ytmp3?apikey=<key>&url=<url>
//   /api/download/ytmp4?apikey=<key>&url=<url>
// Skema respons:
//   {
//     "status": true,
//     "creator": "BetaBotz",
//     "result": {
//       "title": "...", "id": "...", "thumb": "...", "source": "...",
//       "duration": "322", "mp3": "https://.../download/...", "mp4": "https://...",
//       "error": null
//     }
//   }
//
// CATATAN: gak ada retry di sini (dulu sempet dicoba retry 1x pas timeout,
// tapi malah bikin user nunggu lebih lama kalau BetaBotz-nya emang lagi
// lambat/gagal — mending langsung nyerah & kasih tau, biar respons ke user
// tetep cepat). Timeout juga sengaja gak digedein-gedein amat, karena ini
// posisinya sekarang FALLBACK (dipanggil setelah btch-downloader gagal duluan),
// jadi kalau BetaBotz juga lambat, gak nambah lama-lama nunggunya.
const axios = require("axios");

const BETABOTZ_BASE = "https://api.betabotz.eu.org";
const DEFAULT_TIMEOUT = 45000;

function requireBetabotzKey() {
  if (!global.betabotzApiKey) {
    throw new Error("global.betabotzApiKey kosong di config.js.");
  }
  return global.betabotzApiKey;
}

function betabotzUrl(endpointPath, extraParams = {}) {
  const params = new URLSearchParams({ apikey: requireBetabotzKey(), ...extraParams });
  return `${BETABOTZ_BASE}${endpointPath}?${params.toString()}`;
}

// Manggil salah satu endpoint download (ytmp3/ytmp4) dan balikin result.result
// (title, mp3/mp4, duration, dst) kalau sukses. Ngelempar Error kalau gagal,
// SATU KALI PERCOBAAN DOANG (gak ada retry) biar responsif.
async function fetchBetabotzDownload(endpointPath, url, { timeout = DEFAULT_TIMEOUT } = {}) {
  const res = await axios.get(betabotzUrl(endpointPath, { url }), {
    timeout,
    validateStatus: () => true,
    headers: { "User-Agent": "Mozilla/5.0" },
  });

  if (res.status !== 200) {
    const bodyPreview = typeof res.data === "string" ? res.data.slice(0, 300) : JSON.stringify(res.data).slice(0, 300);
    throw new Error(`API BetaBotz gagal (HTTP ${res.status}): ${bodyPreview}`);
  }

  const json = res.data;
  if (!json || json.status !== true) {
    throw new Error(json?.result?.error || json?.message || "API BetaBotz gak balikin status sukses.");
  }

  const result = json.result;
  if (!result || result.error) {
    throw new Error(result?.error || "API BetaBotz gak ngasih hasil (result kosong).");
  }

  return result;
}

module.exports = { betabotzUrl, fetchBetabotzDownload, requireBetabotzKey };
