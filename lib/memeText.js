// lib/memeText.js
const fs = require("fs");

function getMemeFont() {
  const candidates = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
    "/usr/share/fonts/truetype/liberation2/LiberationSans-Bold.ttf",
    "/usr/share/fonts/truetype/freefont/FreeSansBold.ttf",
    "/usr/share/fonts/truetype/msttcorefonts/Impact.ttf",
    "/usr/share/fonts/truetype/msttcorefonts/Arial_Bold.ttf",
  ];
  return candidates.find((p) => fs.existsSync(p)) || null;
}

// FIX BUG: font-font di atas cuma font teks biasa, gak ada glyph emoji sama
// sekali. ffmpeg drawtext bakal SKIP karakter yang gak ada glyph-nya di font
// itu (bukan error, emoji-nya cuma raib gitu aja). Makanya butuh font khusus
// emoji sebagai lapisan terpisah — pakai font MONOKROM (Symbola / Noto Emoji),
// BUKAN Noto Color Emoji, karena drawtext/libfreetype gak bisa render glyph
// warna (bitmap/COLR) dengan benar, hasilnya kotak kosong/blur.
function getEmojiFont() {
  const candidates = [
    "/usr/share/fonts/truetype/ancient-scripts/Symbola_hint.ttf",
    "/usr/share/fonts/truetype/ttf-symbola/Symbola.ttf",
    "/usr/share/fonts/truetype/symbola/Symbola.ttf",
    "/usr/share/fonts/truetype/symbola/Symbola_hint.ttf",
    "/usr/share/fonts/noto/NotoEmoji-Regular.ttf",
    "/usr/share/fonts/truetype/noto/NotoEmoji-Regular.ttf",
    "/usr/share/fonts/truetype/noto-emoji/NotoEmoji-Regular.ttf",
  ];
  return candidates.find((p) => fs.existsSync(p)) || null;
}

// FIX BUG: kalau font monokrom di atas gak ke-install (kasus paling umum di
// server, soalnya default-nya biasanya cuma ada Noto Color Emoji), dulu emoji
// langsung di-drop diam-diam. Sekarang dicoba dulu font warna ini lewat filter
// "ass" (libass) di smeme.js — BUKAN drawtext, karena drawtext/libfreetype
// gak sanggup buka glyph warna sama sekali (ffmpeg error "invalid library
// handle"). libass bisa render glyph-nya (walau jadi outline, bukan
// full-color), jadi minimal emoji-nya kelihatan daripada raib.
function getColorEmojiFont() {
  const candidates = [
    { path: "/usr/share/fonts/truetype/noto/NotoColorEmoji.ttf", family: "Noto Color Emoji" },
    { path: "/usr/share/fonts/noto/NotoColorEmoji.ttf", family: "Noto Color Emoji" },
    { path: "/usr/share/fonts/googlefonts/NotoColorEmoji.ttf", family: "Noto Color Emoji" },
    { path: "/usr/share/fonts/truetype/noto-color-emoji/NotoColorEmoji.ttf", family: "Noto Color Emoji" },
    // fallback lokal — auto-download ke sini oleh lib/ensureEmojiFont.js saat startup
    { path: require("path").join(__dirname, "../assets/fonts/NotoColorEmoji.ttf"), family: "Noto Color Emoji" },
  ];
  return candidates.find((c) => fs.existsSync(c.path)) || null;
}

// Regex kasar buat nangkep sebagian besar range emoji Unicode (termasuk
// emoji modifier/ZWJ sequence dasar). Gak 100% lengkap tapi nutup mayoritas
// emoji yang orang beneran pakai sehari-hari.
const EMOJI_REGEX = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}]/gu;

function hasEmoji(text) {
  EMOJI_REGEX.lastIndex = 0;
  return EMOJI_REGEX.test(text);
}

// Pisahin satu baris jadi dua versi dengan panjang karakter SAMA PERSIS
// (biar posisi tiap karakter pas nyambung pas di-overlay): versi "main"
// (emoji diganti spasi, buat di-render pake font meme biasa) dan versi
// "emoji" (selain emoji diganti spasi, buat di-render pake font emoji).
function splitEmojiLayer(text) {
  EMOJI_REGEX.lastIndex = 0;
  let main = "";
  let emoji = "";
  for (const ch of text) {
    if (ch === "\n") {
      main += "\n";
      emoji += "\n";
      continue;
    }
    if (EMOJI_REGEX.test(ch)) {
      main += " ";
      emoji += ch;
    } else {
      main += ch;
      emoji += " ";
    }
    EMOJI_REGEX.lastIndex = 0;
  }
  return { main, emoji };
}

function wrapMemeText(text, fontSize, canvasWidth = 512) {
  const maxCharsPerLine = Math.max(6, Math.floor((canvasWidth * 0.92) / (fontSize * 0.6)));
  const words = text.trim().split(/\s+/);
  const lines = [];
  let current = "";
  for (const word of words) {
    // Kata tunggal yang lebih panjang dari satu baris (misal ditulis tanpa
    // spasi sama sekali) gak akan pernah muat, mau segimana pun "current"
    // di-flush. Makanya kata sepanjang itu dipotong paksa per-chunk dulu
    // sebelum diproses kaya kata biasa, biar gak "kabur" keluar kotak.
    if (word.length > maxCharsPerLine) {
      if (current) {
        lines.push(current);
        current = "";
      }
      for (let i = 0; i < word.length; i += maxCharsPerLine) {
        const chunk = word.slice(i, i + maxCharsPerLine);
        if (i + maxCharsPerLine < word.length) {
          lines.push(chunk);
        } else {
          current = chunk; // sisa terakhir, biarin nyambung sama kata berikutnya kalau muat
        }
      }
      continue;
    }

    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxCharsPerLine && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

// Ngukur lebar & tinggi ASLI (dalam pixel) dari teks yang bakal dirender
// ffmpeg, dengan cara benar-benar merender teksnya (bukan nebak pake rumus
// rata-rata lebar karakter kayak wrapMemeText di atas — itu penyebab bug
// teks kadang kepotong/keluar kotak, karena hurufnya kapital+tebal jadi
// lebih lebar dari perkiraan). Render dibuang setelah pixel bounding-box-nya
// dibaca lewat filter cropdetect (teks putih di kanvas hitam, cropdetect
// nyari batas konten non-hitam).
async function measureTextBlock(execAsync, fontFile, lines, fontSize, lineSpacing, canvasW, canvasH) {
  const fs = require("fs");
  const dir = require("path").join(require("os").tmpdir(), `memetext_measure_${Date.now()}_${Math.random().toString(36).slice(2)}`);
  fs.mkdirSync(dir, { recursive: true });
  const textFile = require("path").join(dir, "text.txt");
  fs.writeFileSync(textFile, lines.join("\n"));
  const filter = `drawtext=${fontFile ? `fontfile='${fontFile}':` : ""}textfile='${textFile}':fontcolor=white:fontsize=${fontSize}:x=20:y=20:line_spacing=${lineSpacing},cropdetect=limit=24:round=2:reset=1:skip=0`;
  let stderrOut = "";
  try {
    const res = await execAsync(
      `ffmpeg -loglevel 48 -f lavfi -i "color=c=black:s=${canvasW}x${canvasH}:d=1" -vf "${filter}" -frames:v 1 -f null -`,
      { maxBuffer: 1024 * 1024 * 20 }
    );
    stderrOut = res.stderr || "";
  } catch (err) {
    stderrOut = err.stderr || "";
  } finally {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
  }
  const matches = [...stderrOut.matchAll(/x1:(\d+) x2:(\d+) y1:(\d+) y2:(\d+)/g)];
  if (!matches.length) return null;
  const [, x1, x2, y1, y2] = matches[matches.length - 1].map(Number);
  const width = x2 - x1 + 1;
  const height = y2 - y1 + 1;

  // FIX BUG: filter cropdetect ffmpeg ternyata bisa ngasih bounding box KEBALIK
  // (x1 deket lebar penuh kanvas, x2 malah 0) buat kanvas di atas lebar tertentu
  // — ini bug di cropdetect-nya sendiri (kejadian di ffmpeg 6.1.1), dan ambang
  // batas lebarnya gak konsisten/gak bisa ditebak (beda ffmpeg build bisa beda
  // angka). Daripada nebak "kanvas aman berapa", di sini hasilnya divalidasi:
  // kalau ukurannya gak masuk akal (negatif atau lebih gede dari kanvasnya
  // sendiri), anggap pengukuran gagal (null) — pemanggil (fitMemeText & smeme.js)
  // udah didesain buat fallback ke perkiraan biasa kalau ini null.
  if (width <= 0 || height <= 0 || width > canvasW || height > canvasH) return null;

  return { width, height };
}

// Nyari fontSize + wrapping paling gede yang DIJAMIN muat di dalam kotak
// (boxW x boxH), pake pengukuran asli (measureTextBlock) buat verifikasi
// tiap percobaan — bukan cuma ngandelin rumus perkiraan di wrapMemeText.
// execAsync di-inject dari pemanggil (biar gak nambah dependency child_process
// baru di sini / gampang di-mock pas testing).
async function fitMemeText(execAsync, fontFile, text, boxW, boxH, opts = {}) {
  const startSize = opts.startSize || 40;
  const minSize = opts.minSize || 10;
  const step = opts.step || 2;
  const lineSpacing = opts.lineSpacing || 6;
  const canvasW = Math.max(boxW * 3, 400);
  const canvasH = Math.max(boxH * 3, 400);

  let fontSize = startSize;
  let lines = wrapMemeText(text, fontSize, boxW);
  let lastGood = null;

  for (; fontSize >= minSize; fontSize -= step) {
    lines = wrapMemeText(text, fontSize, boxW);
    const measured = await measureTextBlock(execAsync, fontFile, lines, fontSize, lineSpacing, canvasW, canvasH);
    if (measured && measured.width <= boxW && measured.height <= boxH) {
      lastGood = { fontSize, lines, measured };
      break;
    }
  }

  // Kalau sampe font paling kecil pun masih ke-detect kegedean (teks
  // ekstrem panjang), tetep pake hasil terakhir (fontSize minimum) daripada
  // gagal total — minimal udah paling kecil yang dicoba.
  if (!lastGood) {
    lines = wrapMemeText(text, minSize, boxW);
    lastGood = { fontSize: minSize, lines, measured: null };
  }

  return lastGood;
}

function stripEmoji(text) {
  EMOJI_REGEX.lastIndex = 0;
  return text.replace(EMOJI_REGEX, "").replace(/\s{2,}/g, " ").trim();
}

module.exports = { getMemeFont, getEmojiFont, getColorEmojiFont, hasEmoji, splitEmojiLayer, stripEmoji, wrapMemeText, measureTextBlock, fitMemeText };
