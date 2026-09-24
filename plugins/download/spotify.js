// plugins/download/spotify.js — Cari & download lagu Spotify (mp3)
//
// REFACTOR (sebelumnya manggil api.zenzxz.my.id buat search & download
// sekaligus — API pihak ketiga gak resmi/satu provider doang, gak ada
// fallback, jadi kalau providernya mati/ganti skema fitur ini langsung total
// error). Spotify sendiri DRM-protect audio aslinya, jadi gak ada cara resmi
// buat "download langsung dari Spotify" tanpa langganan mereka. Pendekatan
// yang lebih stabil dipakai di sini:
//   1. METADATA (judul, cover) diambil dari open.spotify.com/oembed — endpoint
//      PUBLIK RESMI Spotify sendiri, gak butuh apikey, jarang berubah.
//   2. AUDIO dicari & didownload lewat jalur yang SAMA kayak .ytmp3
//      (btch-downloader, lihat plugins/download/youtube.js) — jadi cuma numpang
//      di 1 titik kegagalan yang udah ada, bukan nambah API abal-abal baru.
const axios = require("axios");
const ytHandler = require("./youtube");

async function getSpotifyMeta(link) {
  const res = await axios.get(
    `https://open.spotify.com/oembed?url=${encodeURIComponent(link)}`,
    { timeout: 15000 }
  );
  return res.data; // { title, thumbnail_url, ... }
}

let handler = async (m, { sock, text }) => {
  if (!text) {
    return m.reply(`*Contoh:*\n${m.cmd} swim chase atlantic\n${m.cmd} https://open.spotify.com/track/xxxx`);
  }

  await m.reply("⏳ Sedang mencari & memproses lagu...");

  try {
    let query = text.trim();
    let meta = null;

    if (query.includes("spotify.com")) {
      meta = await getSpotifyMeta(query).catch(() => null);
      if (!meta?.title) {
        return m.reply("❌ Link Spotify gak valid, atau lagunya private/gak ketemu.");
      }
      query = meta.title;
    }

    const dl = await ytHandler.fetchYtmp3ByQuery(query);
    if (!dl) {
      return m.reply("❌ Lagu tidak ditemukan.");
    }

    await sock.sendMessage(m.chat, {
      audio: dl.buffer,
      mimetype: "audio/mpeg",
      fileName: `${dl.title || query}.mp3`,
      contextInfo: meta
        ? {
            externalAdReply: {
              title: meta.title,
              body: "Spotify",
              thumbnailUrl: meta.thumbnail_url,
              sourceUrl: text.trim(),
              mediaType: 1,
              renderLargerThumbnail: true,
            },
          }
        : undefined,
    }, { quoted: m });
  } catch (err) {
    console.error("[SPOTIFY GAGAL]", err.message);
    m.reply("❌ Gagal mengambil atau mendownload lagu: " + err.message);
  }
};

handler.command = ["spotify"];
handler.tags = ["Download"];
handler.help = ["spotify <judul/link>"];

module.exports = handler;
