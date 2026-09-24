// lib/cantarellaYtClient.js — diporting & disesuaikan dari lib/scrape/youtube.js
// punya bot lain user (CANTARELLA). Isinya 4 provider yang SEMUANYA beda
// backend dari yang udah ada di project ini (btch-downloader/ymcdn.org,
// ssyoutube.com, yt-dlp, ytmp3.mobi):
//   v1 -> ytdlpyton.nvlgroup.my.id
//   v2 -> app.ytdown.to (polling)
//   v3 -> p.savenow.to (polling)
//   v4 -> savetube.me (API terenkripsi AES, provider yang cukup establish di
//         komunitas bot WA Indo)
// ytdlAuto() nyoba v1 -> v3 -> v4 -> v2 berurutan, baru nyerah kalau semua gagal.
// Ini 1 fungsi tapi isinya udah 4x percobaan sendiri — makanya di youtube.js
// cukup dipasang 1x sebagai 1 lapisan aja.
const axios = require("axios");
const https = require("https");
const qs = require("querystring");
const crypto = require("crypto");

const agent = new https.Agent({ rejectUnauthorized: false });

const SaveNow = {
  _api: "https://p.savenow.to",
  _key: "dfcb6d76f2f6a9894gjkege8a4ab232222",
  poll: async (url, limit = 40) => {
    for (let i = 0; i < limit; i++) {
      try {
        const { data } = await axios.get(url, { httpsAgent: agent, timeout: 60000 });
        if (data.success === 1 && data.download_url) return data;
        if (data.success === -1) break;
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, 2500));
    }
    return null;
  },
};

const savetube = {
  api: {
    base: "https://media.savetube.me/api",
    cdn: "/random-cdn",
    info: "/v2/info",
    download: "/download",
  },
  headers: {
    accept: "*/*",
    "content-type": "application/json",
    origin: "https://yt.savetube.me",
    referer: "https://yt.savetube.me/",
    "user-agent": "Postify/1.0.0",
  },
  formatVideo: ["144", "240", "360", "480", "720", "1080", "1440", "2k", "3k", "4k", "5k", "8k"],
  formatAudio: ["mp3", "m4a", "webm", "aac", "flac", "opus", "ogg", "wav"],

  crypto: {
    hexToBuffer: (hexString) => Buffer.from(hexString.match(/.{1,2}/g).join(""), "hex"),
    decrypt: async (enc) => {
      const secretKey = "C5D58EF67A7584E4A29F6C35BBC4EB12";
      const data = Buffer.from(enc, "base64");
      const iv = data.slice(0, 16);
      const content = data.slice(16);
      const key = savetube.crypto.hexToBuffer(secretKey);
      const decipher = crypto.createDecipheriv("aes-128-cbc", key, iv);
      let decrypted = decipher.update(content);
      decrypted = Buffer.concat([decrypted, decipher.final()]);
      return JSON.parse(decrypted.toString());
    },
  },

  isUrl: (str) => {
    try {
      new URL(str);
      return true;
    } catch {
      return false;
    }
  },

  youtubeId: (url) => {
    if (!url) return null;
    const patterns = [
      /youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
      /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
      /youtube\.com\/v\/([a-zA-Z0-9_-]{11})/,
      /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
      /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    ];
    for (const p of patterns) {
      if (p.test(url)) return url.match(p)[1];
    }
    return null;
  },

  request: async (endpoint, data = {}, method = "post") => {
    try {
      const { data: response } = await axios({
        method,
        url: `${endpoint.startsWith("http") ? "" : savetube.api.base}${endpoint}`,
        data: method === "post" ? data : undefined,
        params: method === "get" ? data : undefined,
        headers: savetube.headers,
        timeout: 30000,
      });
      return { status: true, data: response };
    } catch (error) {
      return { status: false, error: error.message };
    }
  },

  getCDN: async () => {
    const response = await savetube.request(savetube.api.cdn, {}, "get");
    if (!response.status) return response;
    return { status: true, data: response.data.cdn };
  },

  download: async (link, format) => {
    if (!link || !savetube.isUrl(link)) return { status: false };
    const allFormats = [...savetube.formatVideo, ...savetube.formatAudio];
    if (!format || !allFormats.includes(format)) return { status: false };
    const id = savetube.youtubeId(link);
    if (!id) return { status: false };

    try {
      const cdnx = await savetube.getCDN();
      if (!cdnx.status) return cdnx;
      const cdn = cdnx.data;

      const result = await savetube.request(`https://${cdn}${savetube.api.info}`, {
        url: `https://www.youtube.com/watch?v=${id}`,
      });
      if (!result.status) return result;
      const decrypted = await savetube.crypto.decrypt(result.data.data);

      const dl = await savetube.request(`https://${cdn}${savetube.api.download}`, {
        id,
        downloadType: savetube.formatAudio.includes(format) ? "audio" : "video",
        quality: savetube.formatAudio.includes(format) ? "128" : format,
        key: decrypted.key,
      });

      return {
        status: true,
        title: decrypted.title || "YouTube Media",
        download_url: dl.data.data.downloadUrl,
      };
    } catch (error) {
      return { status: false };
    }
  },
};

async function ytdlv1(url, type) {
  try {
    const endpoint =
      type === "audio"
        ? `https://ytdlpyton.nvlgroup.my.id/download/audio?url=${encodeURIComponent(url)}&mode=url`
        : `https://ytdlpyton.nvlgroup.my.id/download/?url=${encodeURIComponent(url)}&resolution=${type}&mode=url`;
    const { data } = await axios.get(endpoint, { timeout: 60000 });
    if (!data || !data.download_url) return { status: false };
    return { title: data.title || "YouTube Media", download_url: data.download_url, status: true };
  } catch {
    return { status: false };
  }
}

async function ytdlv2(url, res) {
  try {
    const { data } = await axios.post("https://app.ytdown.to/proxy.php", qs.stringify({ url }), {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        Accept: "*/*",
        "X-Requested-With": "XMLHttpRequest",
        "User-Agent": "Mozilla/5.0",
        Referer: "https://app.ytdown.to/id12/",
      },
      timeout: 30000,
    });

    const api = data.api;
    if (!api || !api.mediaItems) return { status: false };

    let target;
    if (res === "audio" || res === "mp3") {
      target = api.mediaItems.find((v) => v.type === "Audio" && v.mediaQuality === "128K") || api.mediaItems.find((v) => v.type === "Audio");
    } else {
      target = api.mediaItems.find((v) => v.type === "Video" && v.mediaQuality === "HD") || api.mediaItems.find((v) => v.type === "Video");
    }
    if (!target) return { status: false };

    let download_url = null;
    for (let i = 0; i < 20; i++) {
      try {
        const { data: check } = await axios.get(target.mediaUrl, { headers: { "User-Agent": "Mozilla/5.0" }, timeout: 15000 });
        if (check.status === "completed") {
          download_url = check.fileUrl;
          break;
        }
      } catch {}
      await new Promise((r) => setTimeout(r, 3000));
    }
    if (!download_url) return { status: false };
    return { status: true, title: api.title, download_url };
  } catch {
    return { status: false };
  }
}

async function ytdlv3(url, res) {
  try {
    const format = res === "audio" ? "mp3" : res;
    const { data: init } = await axios.get(`${SaveNow._api}/ajax/download.php`, {
      params: { copyright: 0, format, url, api: SaveNow._key },
      httpsAgent: agent,
      timeout: 60000,
    });
    if (!init || !init.success || !init.progress_url) return { status: false };
    const result = await SaveNow.poll(init.progress_url);
    if (result && result.download_url) {
      return { status: true, title: init.info?.title || "YouTube Media", download_url: result.download_url };
    }
    return { status: false };
  } catch {
    return { status: false };
  }
}

async function ytdlv4(url, res) {
  try {
    const format = res === "audio" || res === "mp3" ? "mp3" : res;
    const data = await savetube.download(url, format);
    if (data && data.status && data.download_url) {
      return { status: true, title: data.title || "YouTube Media", download_url: data.download_url };
    }
    return { status: false };
  } catch {
    return { status: false };
  }
}

// res: "audio" buat mp3, atau kualitas video kayak "720"/"480"/dst buat video.
async function ytdlAuto(url, res) {
  let data = await ytdlv1(url, res);
  if (!data || !data.status || !data.download_url) data = await ytdlv3(url, res);
  if (!data || !data.status || !data.download_url) data = await ytdlv4(url, res);
  if (!data || !data.status || !data.download_url) data = await ytdlv2(url, res);
  return data;
}

module.exports = { ytdlv1, ytdlv2, ytdlv3, ytdlv4, ytdlAuto };
