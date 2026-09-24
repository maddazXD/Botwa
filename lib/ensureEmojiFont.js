// lib/ensureEmojiFont.js
// Dipanggil sekali di startup index.js — pastiin ada font emoji di server.
// Urutan prioritas:
//   1. Font monokrom sistem  (Symbola / NotoEmoji-Regular)
//   2. Font warna sistem     (NotoColorEmoji)
//   3. Font warna lokal      (assets/fonts/NotoColorEmoji.ttf)      ← auto-download ke sini
// Kalau 1 & 2 gak ada, font di-download otomatis dari GitHub Noto Emoji
// release ke folder assets/fonts/ supaya getColorEmojiFont() bisa ketemu.

const fs   = require("fs");
const path = require("path");
const https = require("https");

// Mirror download — urutan dicoba satu per satu sampai ada yang berhasil.
// Semua mengarah ke binary NotoColorEmoji.ttf yang sama.
const DOWNLOAD_URLS = [
  "https://github.com/googlefonts/noto-emoji/raw/main/fonts/NotoColorEmoji.ttf",
  "https://github.com/googlefonts/noto-emoji/raw/refs/heads/main/fonts/NotoColorEmoji.ttf",
  "https://raw.githubusercontent.com/googlefonts/noto-emoji/main/fonts/NotoColorEmoji.ttf",
];

const LOCAL_FONT_PATH = path.join(__dirname, "../assets/fonts/NotoColorEmoji.ttf");

// Cek apakah SALAH SATU font emoji sudah tersedia (sistem atau lokal).
function emojiAlreadyAvailable() {
  const systemFonts = [
    // monokrom (paling bagus buat drawtext)
    "/usr/share/fonts/truetype/ancient-scripts/Symbola_hint.ttf",
    "/usr/share/fonts/truetype/ttf-symbola/Symbola.ttf",
    "/usr/share/fonts/truetype/symbola/Symbola.ttf",
    "/usr/share/fonts/truetype/symbola/Symbola_hint.ttf",
    "/usr/share/fonts/noto/NotoEmoji-Regular.ttf",
    "/usr/share/fonts/truetype/noto/NotoEmoji-Regular.ttf",
    "/usr/share/fonts/truetype/noto-emoji/NotoEmoji-Regular.ttf",
    // warna
    "/usr/share/fonts/truetype/noto/NotoColorEmoji.ttf",
    "/usr/share/fonts/noto/NotoColorEmoji.ttf",
    "/usr/share/fonts/googlefonts/NotoColorEmoji.ttf",
    "/usr/share/fonts/truetype/noto-color-emoji/NotoColorEmoji.ttf",
  ];
  return systemFonts.some(p => fs.existsSync(p)) || fs.existsSync(LOCAL_FONT_PATH);
}

function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const tmp = destPath + ".tmp";
    const file = fs.createWriteStream(tmp);

    const doRequest = (targetUrl) => {
      https.get(targetUrl, { timeout: 30_000 }, (res) => {
        // Ikuti redirect (301/302/307)
        if ([301, 302, 307, 308].includes(res.statusCode) && res.headers.location) {
          file.destroy();
          fs.unlink(tmp, () => {});
          const redirected = new URL(res.headers.location, targetUrl).toString();
          const newFile = fs.createWriteStream(tmp);
          https.get(redirected, { timeout: 60_000 }, (res2) => {
            if (res2.statusCode !== 200) return reject(new Error(`HTTP ${res2.statusCode} setelah redirect`));
            res2.pipe(newFile);
            newFile.on("finish", () => {
              newFile.close();
              fs.renameSync(tmp, destPath);
              resolve();
            });
            newFile.on("error", (e) => { fs.unlink(tmp, () => {}); reject(e); });
          }).on("error", reject);
          return;
        }
        if (res.statusCode !== 200) {
          file.destroy();
          return reject(new Error(`HTTP ${res.statusCode}`));
        }
        res.pipe(file);
        file.on("finish", () => {
          file.close();
          fs.renameSync(tmp, destPath);
          resolve();
        });
        file.on("error", (e) => { fs.unlink(tmp, () => {}); reject(e); });
      }).on("error", (e) => { fs.unlink(tmp, () => {}); reject(e); });
    };

    doRequest(url);
  });
}

async function ensureEmojiFont(chalk) {
  if (emojiAlreadyAvailable()) return; // sudah ada, skip

  const log = (msg) => chalk
    ? console.log(chalk.yellow("[ensureEmojiFont]"), msg)
    : console.log("[ensureEmojiFont]", msg);

  log("Font emoji belum ditemukan di server. Auto-download NotoColorEmoji.ttf...");
  fs.mkdirSync(path.dirname(LOCAL_FONT_PATH), { recursive: true });

  for (const url of DOWNLOAD_URLS) {
    try {
      log(`Mencoba: ${url}`);
      await downloadFile(url, LOCAL_FONT_PATH);
      const size = fs.statSync(LOCAL_FONT_PATH).size;
      if (size < 100_000) {
        // File terlalu kecil — kemungkinan bukan binary font aslinya
        fs.unlinkSync(LOCAL_FONT_PATH);
        throw new Error(`Ukuran file mencurigakan: ${size} bytes`);
      }
      log(`✅ Berhasil download (${(size / 1024 / 1024).toFixed(1)} MB) → assets/fonts/NotoColorEmoji.ttf`);
      return;
    } catch (e) {
      log(`❌ Gagal (${e.message}), coba mirror berikutnya...`);
    }
  }

  log("⚠️  Semua mirror gagal. Emoji akan otomatis dicoba lagi di restart berikutnya.");
  log("   Atau install manual: apt install fonts-noto-color-emoji");
}

module.exports = { ensureEmojiFont };
