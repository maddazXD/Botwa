// lib/ytmp3mobiClient.js — scraper buat endpoint internal ytmp3.mobi
// (diporting & disesuaikan dari project bot lain punya user, awalnya di
// src/scraper/ytdl.js). Ini beda TEKNIK dari btch-downloader/yt-dlp yang udah
// ada: dia manggil converter publik (ytmp3.mobi) yang PROSES CONVERT-nya di
// server MEREKA, terus kasih link hasil convert yang dihosting di CDN mereka
// sendiri (bukan link video.googlevideo.com langsung dari YouTube yang gampang
// ke-expired/berubah skema signing-nya). Kelemahannya: proses convert di sisi
// mereka butuh nunggu (polling progress), jadi lebih lambat dari 2 sumber lain.
//
// CATATAN JUJUR: ini tetep "scrape endpoint internal situs publik", sama
// riskan-nya kayak btch-downloader dalam artian bisa berubah/mati kapan aja
// kalau ytmp3.mobi ganti skema. Nilainya di sini murni buat DIVERSIFIKASI
// sumber — teknik & provider-nya beda, jadi kalau salah satu server yang
// dituju sumber lain lagi down/diblokir, kemungkinan ini masih hidup.
const axios = require("axios");

async function convertViaYtmp3Mobi(videoUrl, format = "mp3") {
  const normalizedFormat = String(format).toLowerCase() === "mp4" ? "mp4" : "mp3";

  const idMatch = String(videoUrl || "").match(
    /(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/
  );
  const videoId = idMatch?.[1];
  if (!videoId) throw new Error("URL YouTube gak valid/gak ketemu video ID-nya.");

  const client = axios.create({
    timeout: 60000,
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36",
      Referer: "https://id.ytmp3.mobi/",
    },
  });

  const { data: init } = await client.get("https://d.ymcdn.org/api/v1/init", {
    params: { p: "y", 23: "1llum1n471", _: Math.random() },
  });
  if (!init?.convertURL) throw new Error("Gagal menginisialisasi server ytmp3.mobi.");

  const { data: convert } = await client.get(init.convertURL, {
    params: { v: videoId, f: normalizedFormat, _: Math.random() },
  });
  if (!convert?.progressURL || !convert?.downloadURL) {
    throw new Error("Gagal mendapatkan data konversi dari ytmp3.mobi.");
  }

  let progress = 0;
  let title = convert.title || "";
  let attempts = 0;
  const maxAttempts = 20; // ~20 x 250ms-an, dibatasi biar gak nunggu selamanya

  while (progress < 3 && attempts < maxAttempts) {
    const { data } = await client.get(convert.progressURL);
    if ((data?.error || 0) > 0) throw new Error(`Error dari server ytmp3.mobi: ${data.error}`);
    progress = Number(data?.progress || 0);
    title = data?.title || title;
    if (progress < 3) {
      attempts += 1;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }

  if (attempts >= maxAttempts && progress < 3) {
    throw new Error("Timeout nunggu proses konversi ytmp3.mobi.");
  }

  return { title, downloadUrl: convert.downloadURL };
}

module.exports = { convertViaYtmp3Mobi };
