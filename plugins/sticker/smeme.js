// plugins/sticker/smeme.js
//
// v2 — full lokal, gak ada watermark, emoji rata tengah bareng teks.
//
// Kenapa ganti dari versi memegen.link (v1)?
//  - memegen.link nempelin watermark "Memegen.link" di pojok gambar, gak ada
//    opsi buat matiin di API publiknya.
//  - Teks & emoji dirender oleh server mereka, jadi kita gak punya kontrol
//    atas kalkulasi lebar teks+emoji → hasilnya cuma teks yang ke-center,
//    emoji-nya nempel di ujung kayak ditambahin belakangan.
//
// Solusi v2: gambar sendiri teks+emoji-nya secara LOKAL pakai @napi-rs/canvas
// (udah jadi dependency project ini, gak nambah instalasi apa-apa). Satu
// baris teks dipecah jadi segmen teks-polos & segmen-emoji, lalu digambar
// BERURUTAN di satu canvas context yang sama sambil ngukur lebar tiap
// segmen (ctx.measureText utk teks, fontSize utk emoji) — jadi total lebar
// barisnya akurat dan bisa di-center sebagai SATU KESATUAN, bukan teks
// duluan baru emoji ditempel belakangan.
//
//  - Gambar & stiker statis → background + teks digambar di satu canvas,
//    langsung export PNG final.
//  - Video & stiker animasi → teks+emoji digambar sekali sebagai lapisan
//    PNG transparan, lalu di-overlay ke tiap frame video pakai ffmpeg
//    (satu overlay input aja, jauh lebih simpel & gak gampang bug
//    dibanding versi lama yang overlay PNG per-emoji satu-satu).
//
// Output akhir tetap lewat lib/sticker.js (imageToWebp / videoToWebp +
// addExif) biar ukuran/pad 512x512 & watermark PACKNAME kita sendiri
// konsisten dengan .sticker & .brat.

const fs = require("fs");
const { exec } = require("child_process");
const { promisify } = require("util");
const execAsync = promisify(exec);
const { createCanvas, loadImage, GlobalFonts } = require("@napi-rs/canvas");

const { getMediaSource } = require("../../lib/mediaHelper");
const { loadWebpImage } = require("../../lib/webpAnimUtil");
const { getMemeFont, getColorEmojiFont, hasEmoji, wrapMemeText } = require("../../lib/memeText");
const { imageToWebp, videoToWebp, addExif } = require("../../lib/sticker");
const { usage, processing, fail, warn } = require("../../lib/theme");

const WM_PACKNAME = "👑 MaddazXD 👑";
const MAX_STICKER_BYTES = 500 * 1024;
const CANVAS_SIZE = 512;
const FONT_SIZE = 46;

// ── Setup font (sekali aja per proses) ──────────────────────────────────────
// Font teks & font emoji WARNA (NotoColorEmoji.ttf) dua-duanya diregister
// dari file LOKAL (assets/fonts/ atau path sistem) — gak ada request
// internet sama sekali di sini, jadi gak akan gagal gara-gara server bot
// gak bisa akses internet/GitHub.
let fontFamily = "sans-serif";
let emojiFontFamily = null;
let fontReady = false;
function ensureFontRegistered() {
  if (fontReady) return;
  fontReady = true;
  try {
    const fontPath = getMemeFont();
    if (fontPath) {
      GlobalFonts.registerFromPath(fontPath, "SmemeFont");
      fontFamily = "SmemeFont";
    }
  } catch (e) {
    console.log("[SMEME] Gagal register font teks custom, pakai fallback sans-serif:", e.message);
  }
  try {
    const emojiFont = getColorEmojiFont();
    if (emojiFont) {
      GlobalFonts.registerFromPath(emojiFont.path, "SmemeEmojiFont");
      emojiFontFamily = "SmemeEmojiFont";
    } else {
      console.log("[SMEME] Font emoji lokal gak ketemu — emoji bakal dilewatin (spasinya tetep dijaga).");
    }
  } catch (e) {
    console.log("[SMEME] Gagal register font emoji:", e.message);
  }
}

// Font berbeda dipakai buat teks biasa vs emoji — dipanggil sebelum measure
// MAUPUN sebelum draw per segmen, biar lebar yang diukur = lebar yang
// digambar (kalau beda, hasilnya bisa geser/numpuk).
function setSegmentFont(ctx, type, fontSize) {
  if (type === "emoji" && emojiFontFamily) {
    ctx.font = `${fontSize}px ${emojiFontFamily}`;
  } else {
    ctx.font = `bold ${fontSize}px ${fontFamily}`;
  }
}

// ── Pecah satu baris jadi segmen teks-polos & segmen-emoji berurutan ───────
function splitSegments(line) {
  const segments = [];
  let buf = "";
  for (const ch of line) {
    if (hasEmoji(ch)) {
      if (buf) { segments.push({ type: "text", value: buf }); buf = ""; }
      segments.push({ type: "emoji", value: ch });
    } else {
      buf += ch;
    }
  }
  if (buf) segments.push({ type: "text", value: buf });
  return segments;
}

function measureSegments(ctx, segments, fontSize) {
  let total = 0;
  for (const seg of segments) {
    setSegmentFont(ctx, seg.type, fontSize);
    const w = ctx.measureText(seg.value).width;
    total += w > 0 ? w : fontSize; // fallback kalau glyph gak kebaca lebarnya
  }
  return total;
}

// Gambar satu baris (teks+emoji campur) mulai dari (startX, y), y = sisi ATAS baris.
// Karena teks & emoji digambar pakai cursorX yang sama-sama nambah dari SATU
// titik start yang udah dihitung dari total lebar gabungan, keduanya otomatis
// nyambung rata tengah sebagai satu unit.
function drawLine(ctx, segments, startX, y, fontSize) {
  let cursorX = startX;
  const baselineY = y + fontSize * 0.85;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.lineJoin = "round";
  ctx.miterLimit = 2;

  for (const seg of segments) {
    setSegmentFont(ctx, seg.type, fontSize);
    if (seg.type === "text") {
      ctx.lineWidth = Math.max(2, Math.round(fontSize / 7));
      ctx.strokeStyle = "black";
      ctx.fillStyle = "white";
      ctx.strokeText(seg.value, cursorX, baselineY);
      ctx.fillText(seg.value, cursorX, baselineY);
      cursorX += ctx.measureText(seg.value).width;
    } else if (emojiFontFamily) {
      // Font warna (CBDT/COLR) udah bawa warnanya sendiri — gak perlu fillStyle/stroke.
      ctx.fillText(seg.value, cursorX, baselineY);
      const w = ctx.measureText(seg.value).width;
      cursorX += w > 0 ? w : fontSize;
    } else {
      // Font emoji lokal gak ketemu sama sekali → emoji dilewatin, tapi
      // spasinya tetep dijaga biar teks lain gak keliatan aneh nyambungnya.
      cursorX += fontSize;
    }
  }
}

// Gambar satu blok teks (top nempel atas, bottom nempel bawah) ke ctx yang dikasih.
function drawMemeTextBlock(ctx, raw, fontSize, size, isTop) {
  if (!raw) return;
  const wrapped = wrapMemeText(raw.toUpperCase(), fontSize, size);
  const lineHeight = fontSize * 1.25;
  const totalHeight = wrapped.length * lineHeight;
  const margin = 18;
  const startY = isTop ? margin : Math.max(margin, size - totalHeight - margin);

  for (let i = 0; i < wrapped.length; i++) {
    const segments = splitSegments(wrapped[i]);
    const lineWidth = measureSegments(ctx, segments, fontSize);
    const startX = Math.max(0, (size - lineWidth) / 2);
    const y = startY + i * lineHeight;
    drawLine(ctx, segments, startX, y, fontSize);
  }
}

// ── Jalur gambar/stiker statis: background + teks di satu canvas ───────────
async function renderStaticMeme(buffer, top, bottom) {
  ensureFontRegistered();
  const canvas = createCanvas(CANVAS_SIZE, CANVAS_SIZE);
  const ctx = canvas.getContext("2d");

  const img = await loadImage(buffer);
  const scale = Math.min(CANVAS_SIZE / img.width, CANVAS_SIZE / img.height);
  const drawW = Math.round(img.width * scale);
  const drawH = Math.round(img.height * scale);
  const dx = Math.round((CANVAS_SIZE - drawW) / 2);
  const dy = Math.round((CANVAS_SIZE - drawH) / 2);
  ctx.drawImage(img, dx, dy, drawW, drawH);

  drawMemeTextBlock(ctx, top, FONT_SIZE, CANVAS_SIZE, true);
  drawMemeTextBlock(ctx, bottom, FONT_SIZE, CANVAS_SIZE, false);

  return canvas.toBuffer("image/png");
}

// ── Lapisan teks transparan (buat di-overlay ke video) ──────────────────────
async function buildTextOverlayPng(top, bottom) {
  ensureFontRegistered();
  const canvas = createCanvas(CANVAS_SIZE, CANVAS_SIZE);
  const ctx = canvas.getContext("2d");
  drawMemeTextBlock(ctx, top, FONT_SIZE, CANVAS_SIZE, true);
  drawMemeTextBlock(ctx, bottom, FONT_SIZE, CANVAS_SIZE, false);
  return canvas.toBuffer("image/png");
}

// ── Jalur video/stiker animasi: overlay lapisan teks di atas ke video ──────
async function renderVideoMeme(inputPath, top, bottom, workDir) {
  const overlayPath = `${workDir}/text_overlay.png`;
  fs.writeFileSync(overlayPath, await buildTextOverlayPng(top, bottom));

  const output = `${workDir}/meme_out.mp4`;
  const filterComplex =
    `[0:v]scale=${CANVAS_SIZE}:${CANVAS_SIZE}:force_original_aspect_ratio=decrease,` +
    `pad=${CANVAS_SIZE}:${CANVAS_SIZE}:(ow-iw)/2:(oh-ih)/2:color=black,fps=15[base];` +
    `[base][1:v]overlay=0:0[out]`;
  const cmd =
    `ffmpeg -y -hide_banner -loglevel error -i "${inputPath}" -i "${overlayPath}" -t 6 ` +
    `-filter_complex "${filterComplex}" -map "[out]" -an -c:v libx264 -preset veryfast -crf 23 -pix_fmt yuv420p "${output}"`;
  await execAsync(cmd, { maxBuffer: 1024 * 1024 * 50 });
  return fs.readFileSync(output);
}

let handler = async (m, { sock, text, prefix, command }) => {
  const source = getMediaSource(m);
  if (!source || !/imageMessage|videoMessage|stickerMessage/.test(source.mtype)) {
    return m.reply(usage(`Reply/kirim gambar, video, atau stiker, terus ketik ${prefix}${command} atas|bawah`, `${prefix}${command} HAI SEMUA|SELAMAT PAGI`));
  }

  if (!text.includes("|")) {
    return m.reply(usage(`Pisahin teks atas & bawah pakai "|"`, `${prefix}${command} atas|bawah\n\nKalau cuma mau teks atas aja, tetep kasih "|" di belakangnya:\n${prefix}${command} atas|`));
  }

  const [topRaw, bottomRaw] = text.split("|").map((s) => s.trim());
  if (!topRaw && !bottomRaw) return m.reply(usage(`Teksnya kosong dong`, `${prefix}${command} atas|bawah`));

  await m.reply(processing());
  const buffer = await source.download();

  if (!fs.existsSync("./tmp")) fs.mkdirSync("./tmp", { recursive: true });
  const workDir = `./tmp/smeme_${Date.now()}`;
  fs.mkdirSync(workDir);
  const cleanup = () => { try { fs.rmSync(workDir, { recursive: true, force: true }); } catch {} };

  try {
    const isVideo = source.mtype === "videoMessage";
    let stickerBuffer;

    if (source.mtype === "stickerMessage") {
      const stickerPath = `${workDir}/sticker_in.webp`;
      fs.writeFileSync(stickerPath, buffer);
      const { img, isAnimated } = await loadWebpImage(stickerPath);

      if (!isAnimated) {
        const memePng = await renderStaticMeme(buffer, topRaw, bottomRaw);
        const webp = await imageToWebp(memePng);
        stickerBuffer = await addExif(webp, WM_PACKNAME, "");
      } else {
        // Bongkar stiker animasi jadi frame, satukan jadi mp4, baru di-overlay teks.
        await img.demux({ path: workDir, prefix: "frame" });
        const lines = [];
        img.frames.forEach((frame, i) => {
          const durSec = Math.max(frame.delay || 100, 20) / 1000;
          lines.push(`file 'frame_${i}.webp'`);
          lines.push(`duration ${durSec}`);
        });
        lines.push(`file 'frame_${img.frames.length - 1}.webp'`);
        fs.writeFileSync(`${workDir}/list.txt`, lines.join("\n"));
        const rawMp4 = `${workDir}/sticker_anim.mp4`;
        await execAsync(
          `ffmpeg -y -hide_banner -loglevel error -f concat -safe 0 -i list.txt -vsync vfr -pix_fmt yuv420p -c:v libx264 -preset veryfast -crf 23 -vf "scale=trunc(iw/2)*2:trunc(ih/2)*2" -movflags +faststart sticker_anim.mp4`,
          { cwd: workDir, maxBuffer: 1024 * 1024 * 50 }
        );
        const memeMp4 = await renderVideoMeme(rawMp4, topRaw, bottomRaw, workDir);
        const webp = await videoToWebp(memeMp4);
        stickerBuffer = await addExif(webp, WM_PACKNAME, "");
      }
    } else if (isVideo) {
      const inputPath = `${workDir}/input.mp4`;
      fs.writeFileSync(inputPath, buffer);
      const memeMp4 = await renderVideoMeme(inputPath, topRaw, bottomRaw, workDir);
      const webp = await videoToWebp(memeMp4);
      stickerBuffer = await addExif(webp, WM_PACKNAME, "");
    } else {
      const memePng = await renderStaticMeme(buffer, topRaw, bottomRaw);
      const webp = await imageToWebp(memePng);
      stickerBuffer = await addExif(webp, WM_PACKNAME, "");
    }

    await sock.sendMessage(m.chat, { sticker: stickerBuffer }, { quoted: m });

    if (stickerBuffer.length > MAX_STICKER_BYTES) {
      await m.reply(warn(`Ukuran stikernya ${(stickerBuffer.length / 1024).toFixed(0)}KB (idealnya di bawah 500KB), mungkin gagal muncul di sebagian HP.`));
    }
  } catch (err) {
    console.error("[SMEME GAGAL]", err?.stderr || err?.message || err);
    return m.reply(fail("Gagal membuat meme sticker. Cek lagi teksnya atau coba media lain."));
  } finally {
    cleanup();
  }
};

handler.command = ["smeme", "meme", "stickermeme"];
handler.help    = ["smeme <atas|bawah>"];
handler.tags    = ["sticker"];

module.exports = handler;
