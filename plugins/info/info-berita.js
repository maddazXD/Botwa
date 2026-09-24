// plugins/info-berita.js — Berita Terkini
// FIX BUG: API wrapper pihak ketiga (xemoz, lalu berita-indo-api-next.vercel.app) berturut-
// turut kadaluwarsa/404. Diganti total: ambil LANGSUNG dari RSS resmi tiap media, bukan lewat
// wrapper siapapun. RSS lebih tahan lama karena itu infrastruktur resmi medianya sendiri,
// sudah dicross-check per 31 Jul 2026 (Detik & Kompas sempat matiin RSS-nya di 2020, tapi
// Detik sudah aktifin lagi dengan URL baru; Kompas kita skip karena butuh apikey pribadi).
const axios = require("axios");
const cheerio = require("cheerio");
const { startSession } = require("../../lib/pagination");
const { fail } = require("../../lib/theme");

// CATATAN KOMPAS: sengaja TETAP gak dimasukin. Satu-satunya "RSS" Kompas yang ketemu di
// internet butuh apikey pribadi milik orang lain (bukan punya kita, gak etis dipakai), dan
// endpoint publiknya nge-block automated access (robots.txt disallow). Daripada masukin
// sumber yang riskan tiba-tiba diblokir/disalahgunakan, mending di-skip.
const NEWS_SOURCES = {
  cnn: { url: "https://www.cnnindonesia.com/nasional/rss", name: "CNN Indonesia", emoji: "📰" },
  cnbc: { url: "https://www.cnbcindonesia.com/news/rss", name: "CNBC Indonesia", emoji: "📰" },
  detik: { url: "https://news.detik.com/berita/rss", name: "Detik News", emoji: "📰" },
  republika: { url: "https://www.republika.co.id/rss/nasional/", name: "Republika", emoji: "📰" },
  tribun: { url: "https://www.tribunnews.com/rss", name: "Tribun News", emoji: "📰" },
  antara: { url: "https://www.antaranews.com/rss/top-news.xml", name: "ANTARA News", emoji: "📰" },
  // CATATAN: Suara.com & Merdeka.com SENGAJA dihapus lagi. Udah dicoba beberapa kombinasi
  // URL RSS yang pernah didokumentasikan (suara.com/rss, /feed, /rss/news, merdeka.com/feed/,
  // feed.merdeka.com) — semuanya konsisten 404/gak valid. Kelihatannya dua situs ini udah
  // beneran matiin RSS-nya (bukan cuma pindah alamat), jadi daripada dipaksain nebak URL
  // yang gampang berubah lagi, mending di-skip kayak Kompas.
  liputan6: { url: "https://feed.liputan6.com/rss/news", name: "Liputan6", emoji: "📰" },
  tempo: { url: "http://rss.tempo.co/nasional", name: "Tempo Nasional", emoji: "📰" },
};

async function fetchNews(sourceKey) {
  const src = NEWS_SOURCES[sourceKey];
  const res = await axios.get(src.url, {
    timeout: 15000,
    validateStatus: () => true,
    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
  });
  console.log(`[BERITA DEBUG] source: ${sourceKey}, status: ${res.status}, content-type: ${res.headers["content-type"]}`);

  if (res.status !== 200) throw new Error(`RSS balikin HTTP ${res.status}. Detail ada di log server.`);

  const $ = cheerio.load(res.data, { xmlMode: true });
  const items = [];
  $("item").each((_, el) => {
    const $el = $(el);
    items.push({
      title: $el.find("title").first().text().trim(),
      link: $el.find("link").first().text().trim(),
      description: $el.find("description").first().text().replace(/<[^>]+>/g, "").trim(),
    });
  });

  if (!items.length) throw new Error("Gak nemu <item> di RSS-nya (mungkin format berubah). Detail ada di log server.");
  return items;
}

let handler = async (m, { command }) => {
  let source = command === "berita" ? "cnn" : command;
  if (!NEWS_SOURCES[source]) return m.reply(fail("Sumber berita tidak valid."));

  await m.react("🕕");

  try {
    const articles = await fetchNews(source);
    const src = NEWS_SOURCES[source];

    const blocks = articles.map((a, i) => {
      let block = `*${i + 1}. ${a.title || "-"}*\n`;
      if (a.description) block += `${a.description.slice(0, 150)}...\n`;
      block += `🔗 ${a.link || "-"}`;
      return block;
    });

    const text = startSession(m.chat, {
      title: `${src.name.toUpperCase()} — Berita Terkini`,
      emoji: src.emoji,
      blocks,
    });

    await m.react("📰");
    return m.reply(text);
  } catch (e) {
    console.error("[BERITA GAGAL]", e?.response?.status, e?.message);
    await m.react("☢");
    return m.reply(fail("Gagal ambil berita: " + e.message));
  }
};

handler.command = ["berita", "cnn", "cnbc", "detik", "republika", "tribun", "antara", "liputan6", "tempo"];
handler.tags = ["info"];
handler.help = ["berita", "cnn", "cnbc", "detik", "republika", "tribun", "antara", "liputan6", "tempo"];
module.exports = handler;
