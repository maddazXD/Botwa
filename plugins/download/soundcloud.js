// plugins/download/soundcloud.js — Download audio dari SoundCloud
//
// VALIDASI URL: pola sama kayak mediafire.js/pinterest.js — URL parser asli,
// bukan regex substring (nutup celah SSRF yang sama).
//
// CARA KERJA: SoundCloud API publik (api-v2.soundcloud.com) butuh `client_id`
// buat semua request, TAPI client_id ini BUKAN rahasia — dia nempel di
// query-string tiap file JS yang di-load halaman web SoundCloud sendiri buat
// siapapun yang buka soundcloud.com (bisa dicek lewat DevTools browser).
// resolveClientId() di bawah ngambil id itu dengan cara yang sama: buka
// soundcloud.com, cari file JS utamanya, grep pola client_id dari situ.
// Di-cache di memory (CLIENT_ID_CACHE) karena id ini jarang ganti — biar
// gak perlu scrape ulang tiap kali ada yang minta download.
const axios = require("axios");
const { footer } = require("../../lib/theme");

function extractSafeSoundcloudUrl(rawText) {
  let parsed;
  try {
    parsed = new URL(rawText.trim());
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;

  const host = parsed.hostname.replace(/^www\./, "");
  const isMainDomain = host === "soundcloud.com";
  const isShortLink = host === "on.soundcloud.com";
  if (!isMainDomain && !isShortLink) return null;

  return parsed.href;
}

let CLIENT_ID_CACHE = null;
let CLIENT_ID_CACHED_AT = 0;
const CLIENT_ID_TTL_MS = 6 * 60 * 60 * 1000; // 6 jam — dianggap basi, di-refresh lagi

async function resolveClientId() {
  if (CLIENT_ID_CACHE && Date.now() - CLIENT_ID_CACHED_AT < CLIENT_ID_TTL_MS) {
    return CLIENT_ID_CACHE;
  }

  // FIX: header sebelumnya cuma User-Agent doang — beberapa CDN/WAF nolak
  // request yang keliatan bukan dari browser asli (gak ada Accept/
  // Accept-Language/dst) dan balikin halaman fallback "JavaScript is
  // disabled" yang gak punya <script src> sama sekali, bikin scriptUrls
  // selalu kosong. Header di-lengkapin biar lebih mirip request browser.
  const { data: homepage } = await axios.get("https://soundcloud.com/", {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
    },
    timeout: 15000,
  });

  // Regex diperlonggar: gak lagi ngunci ke domain a-v2.sndcdn.com doang
  // (SoundCloud kadang pindah versi CDN, mis. a-v2 -> a-v3 dst), dan terima
  // src pakai single ATAU double quote.
  const scriptUrls = [...homepage.matchAll(/src=["'](https:\/\/[a-z0-9.-]*sndcdn\.com\/[^"']+\.js)["']/gi)].map((m) => m[1]);
  if (!scriptUrls.length) throw new Error("Gagal menemukan aset SoundCloud (mungkin struktur situsnya berubah).");

  // client_id biasanya nempel di salah satu file JS terakhir (bundle utama) —
  // dicoba dari yang paling akhir dulu biar lebih cepat ketemu rata-rata.
  for (const scriptUrl of scriptUrls.reverse()) {
    try {
      const { data: js } = await axios.get(scriptUrl, { timeout: 15000 });
      // Diperlonggar juga: terima key "client_id" ATAU "clientId", spasi
      // bebas di sekitar ":"/"=", dan quote tunggal/ganda.
      const match = /client_?[iI]d\s*[:=]\s*["']([a-zA-Z0-9]{16,})["']/.exec(js);
      if (match) {
        CLIENT_ID_CACHE = match[1];
        CLIENT_ID_CACHED_AT = Date.now();
        return CLIENT_ID_CACHE;
      }
    } catch {
      // coba file JS berikutnya
    }
  }

  throw new Error("Gagal mengekstrak client_id SoundCloud (semua file JS bundle udah dicoba).");
}

async function resolveTrack(safeUrl) {
  let clientId = await resolveClientId();

  async function tryResolve(id) {
    return axios.get("https://api-v2.soundcloud.com/resolve", {
      params: { url: safeUrl, client_id: id },
      timeout: 15000,
      validateStatus: () => true, // biar bisa baca body error 401/403/404 manual
    });
  }

  let res = await tryResolve(clientId);

  // 401/403 dari endpoint ini biasanya artinya client_id yang di-scrape udah
  // gak valid (SoundCloud rotate client_id) — bukan berarti track/link-nya
  // salah. Coba refresh sekali (paksa scrape ulang, abaikan cache) sebelum
  // nyerah.
  if (res.status === 401 || res.status === 403) {
    CLIENT_ID_CACHE = null;
    clientId = await resolveClientId();
    res = await tryResolve(clientId);
  }

  if (res.status === 404) {
    throw new Error("Track tidak ditemukan (link mungkin salah/private/sudah dihapus).");
  }
  if (res.status !== 200) {
    throw new Error(`SoundCloud API mengembalikan status ${res.status} (client_id mungkin invalid).`);
  }

  const track = res.data;

  if (!track || track.kind !== "track") {
    throw new Error("Link ini bukan track SoundCloud yang valid (mungkin playlist/user, coba link track langsung).");
  }

  const transcodings = track.media?.transcodings || [];
  // Prioritas: progressive (file utuh, gampang) > hls (perlu digabung dari
  // segmen-segmen .m3u8, gak dipakai di sini biar simpel).
  const progressive = transcodings.find((t) => t.format?.protocol === "progressive");
  if (!progressive) {
    throw new Error("Track ini cuma tersedia dalam format streaming HLS, belum didukung.");
  }

  const { data: streamInfo } = await axios.get(progressive.url, {
    params: { client_id: clientId },
    timeout: 15000,
  });
  if (!streamInfo?.url) throw new Error("Gagal mendapatkan link audio dari SoundCloud.");

  return {
    title: track.title || "Unknown",
    artist: track.user?.username || "-",
    artwork: track.artwork_url,
    streamUrl: streamInfo.url,
  };
}

let handler = async (m, { sock, text }) => {
  if (!text) {
    return m.reply(`*Contoh:*\n${m.cmd} https://soundcloud.com/artist/nama-track`);
  }

  const safeUrl = extractSafeSoundcloudUrl(text);
  if (!safeUrl) {
    return m.reply("❌ Link tidak valid! Pastikan link SoundCloud (soundcloud.com/... atau on.soundcloud.com/...) benar.");
  }

  await m.reply("⏳ Diproses dulu ya...");

  try {
    const track = await resolveTrack(safeUrl);
    const audioRes = await axios.get(track.streamUrl, { responseType: "arraybuffer", timeout: 60000 });

    await sock.sendMessage(m.chat, {
      audio: Buffer.from(audioRes.data),
      mimetype: "audio/mpeg",
      fileName: `${track.title}.mp3`,
      contextInfo: track.artwork
        ? {
            externalAdReply: {
              title: track.title,
              body: track.artist,
              thumbnailUrl: track.artwork,
              sourceUrl: text.trim(),
              mediaType: 1,
              renderLargerThumbnail: true,
            },
          }
        : undefined,
    }, { quoted: m });
  } catch (err) {
    console.error("[SOUNDCLOUD GAGAL]", err.message);
    m.reply("❌ Gagal mengambil atau mendownload track: " + err.message);
  }
};

handler.command = ["soundcloud", "sc"];
handler.tags = ["Download"];
handler.help = ["soundcloud <link>"];

module.exports = handler;
