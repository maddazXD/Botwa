// plugins/tools/translateimg.js — Translate TULISAN DI DALAM FOTO (bukan cuma
// baca teksnya kayak .ocr, tapi beneran GAMBAR ULANG foto-nya: tulisan asing
// dihapus/ditutup, terus diganti tulisan Bahasa Indonesia di posisi yang sama).
//
// Kenapa gak pakai API FAA yang dipakai .ocr (lib/faaClient.js)? Karena API itu
// cuma balikin TEKS POLOS, gak ada info POSISI/koordinat tiap baris tulisan di
// foto — padahal buat nutup+gambar-ulang, posisi persis itu WAJIB ada. Makanya
// di sini OCR-nya jalan LOKAL pakai tesseract.js (udah ada di package.json),
// yang emang ngasih bounding box (x0,y0,x1,y1) per baris teks.
//
// Alurnya:
// 1) OCR lokal (tesseract.js) -> dapet tiap baris teks + posisi kotaknya di foto.
// 2) Tiap baris diterjemahin ke bahasa tujuan (default: id) pakai Google Translate
//    (endpoint gratis yang sama kayak plugins/tools/translate.js).
// 3) Foto digambar ulang pakai @napi-rs/canvas (udah dipakai di maker-quote.js):
//    - kotak tulisan asli DITUTUP pakai warna background di sekitarnya (disampling
//      dari pojok-pojok kotak, biar nyatu sama sekitarnya, bukan kotak putih polos).
//    - tulisan hasil terjemahan digambar di kotak yang sama, ukuran font
//      otomatis mengecil kalau ternyata kepanjangan buat muat di lebar kotaknya.
//
// KETERBATASAN YANG PERLU DIINGET (jujur, biar gak salah ekspektasi):
// - Akurasi OCR-nya tesseract.js LOKAL, bukan API OCR premium — buat foto yang
//   tulisannya jelas/kontras (meme, screenshot, komik/manga bersih) hasilnya
//   bagus, tapi buat tulisan hasil tulisan tangan/miring/nempel background
//   ramai bisa aja meleset atau kelewat.
// - Tesseract butuh tau SCRIPT tulisannya (huruf Latin vs Jepang vs Korea, dst)
//   biar bisa baca dengan benar — default di sini "eng" (cocok buat huruf latin:
//   Inggris/Indonesia/Spanyol/dll). Kalau foto tulisannya Jepang/Korea/dll,
//   kasih kode tesseract-nya di parameter kedua (lihat handler.help di bawah).
// - Font hasil gambar ulang pakai font standar (bukan niru font asli foto),
//   dan background yang ditutup itu WARNA POLOS hasil sampling — jadi kalau
//   background aslinya ramai/gradasi, hasil tutupannya keliatan agak flat.
const axios = require("axios");
const Tesseract = require("tesseract.js");
const { createCanvas, loadImage, GlobalFonts } = require("@napi-rs/canvas");
const { writeFile, mkdir } = require("node:fs/promises");
const { existsSync } = require("node:fs");
const { join } = require("node:path");
const { getMediaSource } = require("../../lib/mediaHelper");
const { usage, processing, ok, fail, footer } = require("../../lib/theme");

// Font sendiri (bukan ngandelin font sistem yang belum tentu ada) — dipakai
// bareng file font yang sama kayak maker-quote.js (kalau udah kedownload di
// situ, di sini tinggal kepake, gak download dobel).
const FONT_DIR = join(process.cwd(), "assets", "qc_maker", "fonts");
const FONT_PATH = join(FONT_DIR, "Inter-SemiBold.ttf");
const FONT_URL = "https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuFuYAZ9hiJ-Ek-_EeA.woff2";
let fontReady = false;
async function ensureFont() {
  if (fontReady) return;
  await mkdir(FONT_DIR, { recursive: true });
  if (!existsSync(FONT_PATH)) {
    const res = await axios.get(FONT_URL, { responseType: "arraybuffer", headers: { "User-Agent": "Mozilla/5.0" } });
    await writeFile(FONT_PATH, Buffer.from(res.data));
  }
  GlobalFonts.registerFromPath(FONT_PATH, "Inter");
  fontReady = true;
}

async function translateText(query, lang) {
  const url = new URL("https://translate.googleapis.com/translate_a/single");
  url.searchParams.append("client", "gtx");
  url.searchParams.append("sl", "auto");
  url.searchParams.append("dt", "t");
  url.searchParams.append("tl", lang);
  url.searchParams.append("q", query);
  const { data } = await axios.get(url.href);
  return data[0].map((item) => item[0]).join("");
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

const MAX_LINES = 25; // batas jumlah baris yang diproses, biar gak keterusan lama/berat kalau foto penuh tulisan

let handler = async (m, { sock, prefix, command, args }) => {
  const source = getMediaSource(m);
  if (!source || source.mtype !== "imageMessage") {
    return m.reply(usage(
      `Reply/kirim foto yang ada tulisan asingnya, terus ketik ${prefix}${command}\n\n` +
      `Paling akurat buat foto dengan teks jelas & background polos (meme, screenshot chat/dokumen). Kurang akurat buat gambar game/komik yang ramai elemen visual.`,
      `${prefix}${command} id  (id = bahasa tujuan, default Indonesia)`
    ));
  }

  const targetLang = (args[0] || "id").toLowerCase();
  const ocrLang = (args[1] || "eng").toLowerCase(); // kode BAHASA TESSERACT (eng/ind/jpn/kor/chi_sim/dst), BUKAN kode Google Translate

  const statusMsg = await sock.sendMessage(m.chat, { text: processing("Lagi baca tulisan di foto...") }, { quoted: m });

  try {
    const buffer = await source.download();
    await ensureFont();

    // FIX AKURASI: sebelumnya pakai Tesseract.recognize() default (mode
    // "fully automatic layout"), yang buat gambar RAMAI kayak screenshot game
    // (background bertekstur + karakter + tombol UI bulat) sering SALAH
    // nebak: tekstur/tombol dikira teks (halusinasi), sementara teks beneran
    // malah kelewat. Ganti ke worker manual + mode PSM "sparse text" (buat
    // baca teks yang posisinya nyebar/gak nyatu dalam satu blok rapi, lebih
    // cocok buat gambar kayak gini daripada mode default).
    const worker = await Tesseract.createWorker(ocrLang);
    await worker.setParameters({ tessedit_pageseg_mode: Tesseract.PSM.SPARSE_TEXT });
    const { data } = await worker.recognize(buffer);
    await worker.terminate();

    // FIX AKURASI: filter dipertajam biar hasil ngaco kayak "& 8" (tekstur
    // background yang ke-detect jadi teks) gak lolos:
    // - confidence dinaikin dari 35 -> 65 (35 itu KETERLALUAN longgar, banyak
    //   noise ikut lolos)
    // - minimal ada beberapa huruf beneran (bukan cuma simbol/angka acak)
    // - proporsi huruf di teksnya harus dominan (bukan campuran simbol aneh)
    // - tinggi kotaknya gak boleh kekecilan (kotak super tipis biasanya noise)
    const looksLikeRealText = (raw) => {
      const t = raw.trim();
      if (t.length < 3) return false;
      const letters = (t.match(/\p{L}/gu) || []).length;
      return letters >= 3 && letters / t.length >= 0.6;
    };
    const lines = (data.lines || [])
      .filter((l) => {
        if (!l.text || l.confidence < 65) return false;
        const h = (l.bbox?.y1 || 0) - (l.bbox?.y0 || 0);
        return h >= 10 && looksLikeRealText(l.text);
      })
      .slice(0, MAX_LINES);

    if (!lines.length) {
      return sock.sendMessage(m.chat, {
        text: fail(`Gak ada tulisan yang kebaca jelas di foto ini. Kalau tulisannya bukan huruf Latin (Jepang/Korea/dll), coba kasih kode bahasa tesseract-nya: *${prefix}${command} ${targetLang} jpn*\n\n` +
          `Catatan: fitur ini paling akurat buat foto teks yang jelas & background-nya polos (meme, screenshot chat/dokumen). Buat gambar game/komik yang ramai elemen visual, hasilnya bisa kurang akurat atau kelewat.`),
        edit: statusMsg.key,
      });
    }

    await sock.sendMessage(m.chat, { text: processing(`Nerjemahin ${lines.length} baris tulisan...`), edit: statusMsg.key });

    // Diterjemahin SATU-SATU (bukan digabung jadi satu request) biar urutan &
    // isi per-baris dijamin akurat — gabungan sering keacak/ke-mangling sama
    // Google Translate kalau isinya banyak baris pendek-pendek.
    const translated = [];
    for (const line of lines) {
      try {
        translated.push(await translateText(line.text.trim(), targetLang));
      } catch {
        translated.push(line.text.trim()); // gagal translate baris ini -> tampilin teks asli aja daripada kosong
      }
      await sleep(150); // jaga-jaga biar gak kena rate-limit Google Translate kalau barisnya banyak
    }

    const img = await loadImage(buffer);
    const canvas = createCanvas(img.width, img.height);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0);

    lines.forEach((line, i) => {
      const { x0, y0, x1, y1 } = line.bbox;
      const w = x1 - x0, h = y1 - y0;
      if (w <= 1 || h <= 1) return;

      // Sampling warna background dari 4 pojok kotak (biasanya bukan bagian
      // coretan huruf) buat nutup tulisan asli senada sama sekitarnya.
      const corners = [
        [x0, y0], [Math.max(x0, x1 - 1), y0],
        [x0, Math.max(y0, y1 - 1)], [Math.max(x0, x1 - 1), Math.max(y0, y1 - 1)],
      ];
      let r = 0, g = 0, b = 0;
      for (const [cx, cy] of corners) {
        const px = ctx.getImageData(Math.min(cx, img.width - 1), Math.min(cy, img.height - 1), 1, 1).data;
        r += px[0]; g += px[1]; b += px[2];
      }
      r = Math.round(r / corners.length); g = Math.round(g / corners.length); b = Math.round(b / corners.length);

      // Kotak penutup dikasih sedikit padding biar bener-bener nutup coretan
      // huruf yang meleber tipis di luar bounding box hasil OCR.
      const pad = Math.max(2, Math.round(h * 0.15));
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(x0 - pad, y0 - pad, w + pad * 2, h + pad * 2);

      const translatedText = (translated[i] || "").trim();
      if (!translatedText) return;

      // Warna teks kontras otomatis (hitam/putih) ngikutin terang-gelapnya
      // warna background yang barusan disampling.
      const brightness = (r * 299 + g * 587 + b * 114) / 1000;
      ctx.fillStyle = brightness > 140 ? "#111111" : "#f5f5f5";
      ctx.textBaseline = "middle";
      ctx.textAlign = "left";

      let fontSize = Math.max(9, Math.floor(h * 0.8));
      let fitted = translatedText;
      while (fontSize > 8) {
        ctx.font = `600 ${fontSize}px Inter`;
        if (ctx.measureText(fitted).width <= w) break;
        fontSize -= 1;
      }
      ctx.fillText(fitted, x0, y0 + h / 2);
    });

    const outBuffer = await canvas.encode("png");
    await sock.sendMessage(m.chat, { text: ok(`Selesai! ${lines.length} baris diterjemahin ke *${targetLang.toUpperCase()}*.`), edit: statusMsg.key });
    await sock.sendMessage(m.chat, {
      image: outBuffer,
      caption: `🌐 Foto udah diterjemahin ke *${targetLang.toUpperCase()}*` + footer(),
    }, { quoted: m });
  } catch (err) {
    console.error("[TRANSLATE IMG GAGAL]", err.message);
    try {
      await sock.sendMessage(m.chat, {
        text: fail(`Gagal nerjemahin foto: ${err.message}`),
        edit: statusMsg.key,
      });
    } catch {}
  }
};

handler.command = ["trimg", "translateimg", "trfoto", "imgtranslate"];
handler.tags = ["tools"];
handler.help = ["trimg <bahasa tujuan?> <kode ocr?> (reply foto — default: id, eng)"];

module.exports = handler;
