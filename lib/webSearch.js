// lib/webSearch.js — Search internet BENERAN (bukan cuma nebak dari data
// training AI) buat dikasih ke plugin AI kayak .gemini, biar bisa jawab
// pertanyaan yang butuh info TERKINI (berita, kejadian terbaru, dst).
//
// Gratis, GAK BUTUH API key — caranya scraping halaman hasil pencarian
// DuckDuckGo versi HTML (https://html.duckduckgo.com/html/), yang emang
// didesain buat browser tanpa JS jadi gampang di-parse.
//
// CATATAN JUJUR: ini scraping, bukan API resmi — kalau DuckDuckGo ubah
// struktur HTML halaman itu di masa depan, fungsi ini bisa berhenti kerja dan
// perlu disesuaikan lagi (selector class-nya diganti). Ini trade-off wajar
// buat pendekatan "gratis tanpa API key"; kalau nanti pengen yang lebih stabil,
// alternatifnya pakai API search berbayar/API-key (Serper.dev, Bing Search API,
// dst) — tinggal ganti isi searchWeb() ini aja, pemanggil-pemanggilnya gak perlu diubah.
const axios = require("axios");
const cheerio = require("cheerio");

/**
 * @param {string} query kata kunci pencarian
 * @param {number} limit maksimal hasil yang diambil
 * @returns {Promise<{title:string, snippet:string, url:string}[]>}
 */
async function searchWeb(query, limit = 4) {
  const { data: html } = await axios.get("https://html.duckduckgo.com/html/", {
    params: { q: query },
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    },
    timeout: 10000,
  });

  const $ = cheerio.load(html);
  const results = [];
  $(".result").each((_, el) => {
    if (results.length >= limit) return;
    const title = $(el).find(".result__title").text().trim();
    const snippet = $(el).find(".result__snippet").text().trim();
    const url = $(el).find(".result__url").text().trim();
    if (title && snippet) results.push({ title, snippet, url });
  });
  return results;
}

// Heuristik sederhana: nebak apakah sebuah pertanyaan KEMUNGKINAN butuh info
// terkini/real-time (bukan pengetahuan umum yang gak berubah-ubah). Dipakai
// biar gak searching internet buat SETIAP pertanyaan (lambat + gak perlu buat
// pertanyaan kayak "jelasin apa itu OOP"), cuma buat yang keliatan butuh.
const LIVE_INFO_PATTERN = new RegExp(
  [
    "sekarang", "saat ini", "hari ini", "terkini", "terbaru", "terupdate",
    "tahun berapa", "jam berapa", "tanggal berapa", "hari apa",
    "kurs", "harga (emas|dollar|bitcoin|saham)", "skor", "hasil pertandingan",
    "siapa (presiden|ketua|ceo|gubernur|menteri)", "berita", "viral",
  ].join("|"),
  "i"
);

function looksLikeNeedsLiveInfo(text) {
  return LIVE_INFO_PATTERN.test(text);
}

module.exports = { searchWeb, looksLikeNeedsLiveInfo };
