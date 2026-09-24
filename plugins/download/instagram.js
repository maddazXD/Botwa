// plugins/download/instagram.js — download foto/video/reel/carousel Instagram,
// pakai endpoint resmi /api/instagram/download dari api.andaraz.com (lihat
// lib/andarazClient.js buat helper key/URL bareng fitur AI .hd/.txt2img/dll).
//
// Skema respons Andaraz gak fix/gak didokumentasiin lengkap. Dari API Explorer
// keliatan minimal ada field platform/shortcode/type, tapi field media (URL
// hasil download-nya) belum kelihatan di potongan yang dites — jadi parsing di
// bawah ini nyoba beberapa nama field umum (medias/media/url/download_url/dst),
// baik bentuk single object maupun array (carousel/slide banyak media).
//
// CATATAN: sempet dicoba nambahin ekstraksi musik buat post IG "Foto + Music"
// (fitur IG yang nempelin lagu terpisah ke post foto/carousel), tapi API
// Andaraz gak nyediain field musik sama sekali (dicek dari raw JSON respons
// langsung, bukan cuma salah tebak nama field). Provider gratis-tanpa-daftar
// lain (nexray/betabotz) juga gak ada yang nyediain endpoint ini — semua yang
// support (EnsembleData/SociaVault/Apify) berbayar & butuh daftar akun sendiri.
// Diputusin buat SKIP fitur ini, jadi cuma foto/video/carousel doang di sini.
const axios = require("axios");
const { andarazUrl, requireAndarazKey } = require("../../lib/andarazClient");
const { downloadAndReencodeVideo } = require("../../lib/videoReencode");
const { usage, processing, ok, fail } = require("../../lib/theme");

// Normalisasi berbagai kemungkinan bentuk respons jadi array flat
// [{ url, type }, ...] biar gampang diloop pas ngirim ke WA.
function extractInstagramMedia(json) {
  const root = json.result ?? json.data ?? json;

  const items = Array.isArray(root)
    ? root
    : Array.isArray(root.medias)
    ? root.medias
    : Array.isArray(root.media)
    ? root.media
    : Array.isArray(root.results)
    ? root.results
    : [root]; // single object (foto/video tunggal)

  return items
    .map((it) => {
      if (typeof it === "string") return { url: it, type: root.type };
      const url = it.url || it.download_url || it.downloadUrl || it.link || it.video_url || it.image_url;
      const type = it.type || (it.video_url ? "video" : it.image_url ? "image" : root.type);
      return url ? { url, type } : null;
    })
    .filter(Boolean);
}

let handler = async (m, { sock, text, prefix, command }) => {
  const link = (text || "").trim();
  if (!link || !/instagram\.com/.test(link)) {
    return m.reply(
      usage(`${prefix}${command} <link instagram>`, `${prefix}${command} https://www.instagram.com/reel/xxxxx/`)
    );
  }

  try {
    requireAndarazKey();
  } catch (err) {
    return m.reply(fail(err.message));
  }

  const statusMsg = await sock.sendMessage(m.chat, { text: processing("Lagi ambil media dari Instagram...") }, { quoted: m });

  try {
    const res = await axios.get(andarazUrl("/api/instagram/download", { url: link }), {
      validateStatus: () => true,
      timeout: 60000,
    });

    if (res.status !== 200) {
      console.error("[IGDL GAGAL]", res.status, JSON.stringify(res.data)?.slice(0, 300));
      return sock.sendMessage(m.chat, { text: fail(`Gagal ambil data dari API Instagram (HTTP ${res.status}). Cek link-nya, atau postnya mungkin private.`), edit: statusMsg.key });
    }

    const medias = extractInstagramMedia(res.data);

    if (!medias.length) {
      console.error("[IGDL GAGAL] Field media gak ketemu:", JSON.stringify(res.data)?.slice(0, 300));
      return sock.sendMessage(m.chat, { text: fail("API gak ngasih link media yang bisa dikenali. Detail ada di log server."), edit: statusMsg.key });
    }

    await sock.sendMessage(
      m.chat,
      { text: ok(medias.length > 1 ? `Ketemu ${medias.length} media (carousel), lagi dikirim...` : "Ketemu, lagi dikirim..."), edit: statusMsg.key }
    );

    for (let i = 0; i < medias.length; i++) {
      const { url, type } = medias[i];
      try {
        // FIX BUG: sebelumnya deteksi video CUMA lewat `type === "video"`.
        // Kalau API gak ngasih field `type` sama sekali (paling umum — banyak
        // API scraper cuma balikin `url` mentah tanpa metadata tipe), `type`
        // jadi undefined, jadi VIDEO REEL PUN ikut ke jalur `else` (dikirim
        // sebagai image) — buffer video dipaksa jadi gambar, gagal total /
        // corrupt. Sekarang fallback dua lapis: cek ekstensi di URL dulu
        // (paling murah, gak perlu request tambahan), baru kalau ekstensi
        // juga ambigu (mis. gak ada ekstensi / query string doang) fallback
        // ke Content-Type header lewat HEAD request ke URL medianya.
        let resolvedType = type;
        if (resolvedType !== "video" && resolvedType !== "image") {
          const urlPath = url.split("?")[0].toLowerCase();
          if (/\.(mp4|mov|m4v|webm)$/.test(urlPath)) resolvedType = "video";
          else if (/\.(jpg|jpeg|png|webp|gif)$/.test(urlPath)) resolvedType = "image";
        }
        if (resolvedType !== "video" && resolvedType !== "image") {
          try {
            const head = await axios.head(url, { timeout: 15000 });
            const ct = head.headers["content-type"] || "";
            if (ct.startsWith("video/")) resolvedType = "video";
            else if (ct.startsWith("image/")) resolvedType = "image";
          } catch {
            // HEAD gagal (server gak dukung/di-block) — biarin resolvedType
            // apa adanya, nanti fallback default di bawah (anggap image,
            // paling umum buat post non-carousel-video).
          }
        }

        if (resolvedType === "video") {
          const { buffer } = await downloadAndReencodeVideo(url, "instagram");
          await sock.sendMessage(m.chat, { video: buffer }, { quoted: m });
        } else {
          const imgRes = await axios.get(url, { responseType: "arraybuffer", timeout: 60000 });
          await sock.sendMessage(m.chat, { image: Buffer.from(imgRes.data) }, { quoted: m });
        }
      } catch (e) {
        console.error(`[IGDL GAGAL] media ke-${i + 1}:`, e.message);
      }
    }
  } catch (err) {
    console.error("[IGDL GAGAL]", err?.response?.data ? JSON.stringify(err.response.data).slice(0, 300) : err?.message);
    try { await sock.sendMessage(m.chat, { text: fail("Terjadi error saat memproses link Instagram. Coba lagi nanti."), edit: statusMsg.key }); } catch {}
  }
};

handler.command = ["instagram", "ig", "igdl"];
handler.help = ["instagram <link> (download foto/video/reel/carousel Instagram)"];
handler.tags = ["Download"];

module.exports = handler;
