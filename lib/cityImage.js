// lib/cityImage.js — Ambil foto ASLI kota (landmark/skyline) dari Wikipedia buat
// dipakai sebagai gambar header laporan cuaca, biar gambarnya beneran nyerminin
// kota yang dicari (bukan cuma kartu warna polos). Pakai Wikipedia API resmi:
// publik, gratis, gak butuh API key.
//
// FIX BUG: versi sebelumnya nyari gambar berdasarkan NAMA (exact-title / text
// search) — ternyata gak reliable buat nama daerah yang KEBETULAN juga kata
// umum dalam Bahasa Indonesia. Contoh nyata: ".cuaca kuningan" nyasar ke
// artikel/foto "kuningan" (logam brass), bukan Kabupaten Kuningan di Jawa
// Barat — soalnya "kuningan" ya emang beneran kata buat nama logam itu.
// Masalah kayak gini bakal kejadian lagi buat nama daerah lain yang juga kata
// umum (Batu, Solo/"sendirian", dll), gak peduli sepinter apa cara nebak
// judul artikelnya.
//
// Solusinya: karena kita UDAH PUNYA koordinat GPS pasti dari geocoding
// (lib/geocode.js), cari artikel Wikipedia lewat GEOSEARCH — nyari artikel
// yang PALING DEKAT secara lokasi ke titik itu (radius 10km), bukan nebak
// dari teks/nama sama sekali. Ini gak mungkin nyasar ke topik yang gak
// nyambung soalnya jaraknya emang dihitung dari koordinat asli si kota,
// gak peduli nama kotanya kebetulan sama kayak kata lain.
//
// Di antara artikel-artikel terdekat itu, diprioritaskan yang JUDULNYA
// paling cocok sama nama kotanya (biar dapet halaman kota itu sendiri kalau
// ada), baru kalau gak ada yang cocok persis, ambil yang paling deket lokasi
// dan punya foto yang layak.
const axios = require("axios");

const HEADERS = { "User-Agent": "MaddazXD-WhatsAppBot/1.0 (+fitur laporan cuaca; kontak: pemilik bot)" };
const MIN_WIDTH = 250; // di bawah ini kemungkinan cuma logo/ikon kecil, bukan foto landmark
const GEOSEARCH_RADIUS_M = 10000; // 10km, batas maksimal yang diizinkan API geosearch Wikipedia

function stripDiacritics(str) {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

// FIX BUG LANJUTAN: percobaan pertama pake title.includes(query) doang — ternyata
// masih ketipu juga! "Kuningan (logam)" TETAP mengandung substring "kuningan", jadi
// masih keanggep "cocok" sama kayak "Kabupaten Kuningan", dan karena yang (logam)
// itu kebetulan jaraknya lebih deket di data geosearch, dia yang menang duluan.
// Sekarang pencocokannya diperketat:
//   - Judul yang ada tanda kurung "(...)" DITOLAK — di Wikipedia Indonesia, tanda
//     kurung di judul biasanya nandain disambiguasi/topik LAIN yang kebetulan nama
//     sama (kayak "(logam)", "(disambiguasi)", "(film)"), bukan artikel utama tempatnya.
//   - Judulnya harus DIAWALI nama kotanya persis, atau diawali prefix administratif
//     umum ("Kabupaten ", "Kota ", "Kecamatan ", dst) + nama kotanya — bukan asal
//     "mengandung" kata itu di posisi manapun.
const ADMIN_PREFIXES = ["kabupaten ", "kota ", "kecamatan ", "provinsi ", "pulau ", "kepulauan "];

function isLikelyPlaceTitle(title, query) {
  if (!title || /\(/.test(title)) return false;
  const t = stripDiacritics(title.toLowerCase());
  if (t === query || t.startsWith(query)) return true;
  return ADMIN_PREFIXES.some((p) => t.startsWith(p + query));
}

function pickValidThumb(page) {
  const thumb = page?.thumbnail;
  if (!thumb?.source) return null;
  if (thumb.width && thumb.width < MIN_WIDTH) return null;
  return thumb.source;
}

// Strategi UTAMA: cari artikel Wikipedia terdekat dari koordinat GPS si kota.
async function fetchByGeosearch(lang, lat, lon, cityName) {
  try {
    const res = await axios.get(`https://${lang}.wikipedia.org/w/api.php`, {
      params: {
        action: "query",
        generator: "geosearch",
        ggscoord: `${lat}|${lon}`,
        ggsradius: GEOSEARCH_RADIUS_M,
        ggslimit: 10,
        prop: "pageimages",
        piprop: "thumbnail",
        pithumbsize: 1280,
        format: "json",
      },
      timeout: 8000,
      headers: HEADERS,
    });
    const pages = res.data?.query?.pages;
    if (!pages) return null;

    const sorted = Object.values(pages).sort((a, b) => (a.dist || 0) - (b.dist || 0));
    const query = stripDiacritics(cityName.trim().toLowerCase());

    // 1) Prioritas: artikel yang judulnya beneran cocok sama nama kotanya
    //    (misal ada "Kabupaten Kuningan" di antara hasil terdekat) DAN punya foto layak.
    for (const page of sorted) {
      if (isLikelyPlaceTitle(page.title, query) && pickValidThumb(page)) return pickValidThumb(page);
    }
    // 2) Kalau gak ada yang judulnya cocok, ambil aja yang PALING DEKAT lokasinya
    //    dan punya foto layak (tetep dijamin relevan secara geografis).
    for (const page of sorted) {
      const thumb = pickValidThumb(page);
      if (thumb) return thumb;
    }
    return null;
  } catch (e) {
    return null;
  }
}

// Fallback CADANGAN kalau geosearch gak ketemu apa-apa sama sekali (misal
// daerah yang belum ke-geotag di Wikipedia) — balik ke cara lama (nebak dari
// judul/nama), lebih baik dapet gambar yang mungkin kurang pas daripada gak
// ada gambar identik sama sekali.
async function fetchByExactTitle(lang, title) {
  try {
    const res = await axios.get(`https://${lang}.wikipedia.org/w/api.php`, {
      params: {
        action: "query", titles: title, redirects: 1,
        prop: "pageimages", piprop: "thumbnail", pithumbsize: 1280, format: "json",
      },
      timeout: 8000, headers: HEADERS,
    });
    const pages = res.data?.query?.pages;
    if (!pages) return null;
    return pickValidThumb(Object.values(pages)[0]);
  } catch (e) {
    return null;
  }
}

async function findThumbUrl(cityName, admin1, countryName, latitude, longitude) {
  if (latitude != null && longitude != null) {
    for (const lang of ["id", "en"]) {
      const url = await fetchByGeosearch(lang, latitude, longitude, cityName);
      if (url) return url;
    }
  }
  for (const lang of ["id", "en"]) {
    const url = await fetchByExactTitle(lang, cityName);
    if (url) return url;
  }
  return null;
}

async function getCityImageBuffer(cityName, admin1, countryName, latitude, longitude) {
  const url = await findThumbUrl(cityName, admin1, countryName, latitude, longitude);
  if (!url) return null;

  try {
    const res = await axios.get(url, { responseType: "arraybuffer", timeout: 10000, headers: HEADERS });
    return Buffer.from(res.data);
  } catch (e) {
    return null;
  }
}

module.exports = { getCityImageBuffer };
