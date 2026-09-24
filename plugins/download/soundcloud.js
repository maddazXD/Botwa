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

  const { data: homepage } = await axios.get("https://soundcloud.com/", {
    headers: { "User-Agent": "Mozilla/5.0" },
    timeout: 15000,
  });

  const scriptUrls = [...homepage.matchAll(/src="(https:\/\/a-v2\.sndcdn\.com\/assets\/[^"]+\.js)"/g)].map((m) => m[1]);
  if (!scriptUrls.length) throw new Error("Gagal menemukan aset SoundCloud (mungkin struktur situsnya berubah).");

  // client_id biasanya nempel di salah satu file JS terakhir (bundle utama) —
  // dicoba dari yang paling akhir dulu biar lebih cepat ketemu rata-rata.
  for (const scriptUrl of scriptUrls.reverse()) {
    try {
      const { data: js } = await axios.get(scriptUrl, { timeout: 15000 });
      const match = /client_id\s*[:=]\s*"([a-zA-Z0-9]+)"/.exec(js);
      if (match) {
        CLIENT_ID_CACHE = match[1];
        CLIENT_ID_CACHED_AT = Date.now();
        return CLIENT_ID_CACHE;
      }
    } catch {
      // coba file JS berikutnya
    }
  }

  throw new Error("Gagal mengekstrak client_id SoundCloud.");
}

async function resolveTrack(safeUrl) {
  const clientId = await resolveClientId();

  const { data: track } = await axios.get("https://api-v2.soundcloud.com/resolve", {
    params: { url: safeUrl, client_id: clientId },
    timeout: 15000,
  });

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
