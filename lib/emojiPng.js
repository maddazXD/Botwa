// lib/emojiPng.js
// Download & cache PNG per-emoji dari Google Noto Emoji.
// Ini satu-satunya cara dapetin emoji BERWARNA di pipeline ffmpeg —
// drawtext crash buat font warna, libass (ass filter) cuma bisa outline.
// Solusinya: download PNG 72px tiap emoji (cache lokal), lalu overlay ke
// frame pakai filter overlay di filter_complex.

const https = require("https");
const http  = require("http");
const fs    = require("fs");
const path  = require("path");

const CACHE_DIR  = path.join(__dirname, "../assets/emoji-cache");
const NOTO_SIZE  = 72; // px — tersedia: 32, 72, 128, 512
const NOTO_BASE  = `https://raw.githubusercontent.com/googlefonts/noto-emoji/main/png/${NOTO_SIZE}`;

// Konversi satu karakter emoji ke nama file noto-emoji.
// Aturan: hex tiap codepoint disambung "_", FE0F (variation selector-16)
// di-drop, ZWJ (200D) tetap dipertahankan.
function emojiToFilename(char) {
  const codepoints = [...char]            // spread → array karakter, sadar surrogate pair
    .map(c => c.codePointAt(0))
    .filter(cp => cp !== 0xFE0F)          // buang variation selector-16
    .map(cp => cp.toString(16).padStart(4, "0"));
  return `emoji_u${codepoints.join("_")}.png`;
}

function _download(url, destPath, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    if (redirectCount > 5) return reject(new Error("Too many redirects"));
    const tmp = destPath + ".tmp";
    const file = fs.createWriteStream(tmp);
    const client = url.startsWith("https") ? https : http;

    client.get(url, { timeout: 15_000 }, (res) => {
      // Ikuti redirect
      if ([301, 302, 307, 308].includes(res.statusCode) && res.headers.location) {
        file.destroy();
        try { fs.unlinkSync(tmp); } catch {}
        return _download(
          new URL(res.headers.location, url).toString(),
          destPath,
          redirectCount + 1
        ).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        file.destroy();
        try { fs.unlinkSync(tmp); } catch {}
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      res.pipe(file);
      file.on("finish", () => {
        file.close();
        try { fs.renameSync(tmp, destPath); } catch {}
        resolve();
      });
      file.on("error", (e) => {
        try { fs.unlinkSync(tmp); } catch {}
        reject(e);
      });
    }).on("error", (e) => {
      try { fs.unlinkSync(tmp); } catch {}
      reject(e);
    });
  });
}

// Kembalikan path lokal ke PNG emoji, download dulu kalau belum ada di cache.
// Return null kalau emoji tidak ada di set noto-emoji (emoji tak dikenal, dll).
async function getEmojiPngPath(char) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  const filename  = emojiToFilename(char);
  const cachePath = path.join(CACHE_DIR, filename);

  if (fs.existsSync(cachePath)) return cachePath;

  try {
    await _download(`${NOTO_BASE}/${filename}`, cachePath);
    // Sanity-check: file PNG minimal beberapa ratus byte
    if (fs.statSync(cachePath).size < 200) {
      fs.unlinkSync(cachePath);
      return null;
    }
    return cachePath;
  } catch {
    try { fs.unlinkSync(cachePath); } catch {}
    return null;
  }
}

module.exports = { getEmojiPngPath, emojiToFilename };
