// lib/tableImage.js — Render daftar data (dosen, tugas/materi, deadline) jadi gambar
// tabel PNG pakai jimp (pure-JS, aman dipakai di panel Pterodactyl tanpa native lib).
//
// CATATAN PENTING:
// - Font bitmap bawaan jimp cuma tersedia di ukuran 8/16/32/64/128, dan glyph-nya cuma
//   ASCII biasa (gak ada emoji, gak ada tanda "—" em-dash, dll). Kalau dipaksa print,
//   karakter yang gak dikenal jadi kotak/"?" — makanya SEMUA teks yang mau digambar
//   WAJIB lewat sanitize() dulu.
// - Dipakai ukuran 32 (bukan 16) biar resolusi gambar lebih besar & tajam waktu dibuka
//   di HP — kalau cuma ~400-500px lebar, WA/HP bakal upscale gambarnya sendiri dan
//   hasilnya buram.
"use strict";

const Jimp = require("jimp");

const COLOR = {
  bg: 0xffffffff,
  titleBg: 0x101a2eff,
  headBg: 0x24406bff,
  rowA: 0xffffffff,
  rowB: 0xf2f5f9ff,
  border: 0xd7dee6ff,
  rowDanger: 0xfdecebff,
};

const PAD = 26;
const ROW_H = 78;
const HEAD_H = 70;
const TITLE_H = 96;

// Buang karakter yang gak bisa digambar font bitmap jimp (emoji, dash aneh, dll),
// ganti dash/quote "pintar" jadi versi ASCII biasa, sisanya cuma disaring ke printable ASCII.
function sanitize(str) {
  return String(str ?? "")
    .replace(/[—–]/g, "-")
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[^\x20-\x7E]/g, "")
    .trim();
}

let _fonts = null;
async function fonts() {
  if (_fonts) return _fonts;
  const [title, head, body, small, smallWhite] = await Promise.all([
    Jimp.loadFont(Jimp.FONT_SANS_32_WHITE),
    Jimp.loadFont(Jimp.FONT_SANS_32_WHITE),
    Jimp.loadFont(Jimp.FONT_SANS_32_BLACK),
    Jimp.loadFont(Jimp.FONT_SANS_16_BLACK),
    Jimp.loadFont(Jimp.FONT_SANS_16_WHITE),
  ]);
  _fonts = { title, head, body, small, smallWhite };
  return _fonts;
}

function tw(font, str) {
  return Jimp.measureText(font, sanitize(str));
}

function fillRect(image, x, y, w, h, color) {
  image.scan(x, y, w, h, function (px, py, idx) {
    this.bitmap.data.writeUInt32BE(color, idx);
  });
}

/**
 * Render tabel jadi buffer PNG.
 * @param {Object} opts
 * @param {string} opts.title - judul di header bar
 * @param {string} [opts.subtitle] - baris kecil di bawah judul (mis. konteks dosen)
 * @param {Array<{key:string,label:string,max?:number,min?:number}>} opts.columns
 * @param {Array<Object>} opts.rows
 * @param {string} [opts.emptyText]
 * @param {string} [opts.footNote] - catatan kecil di paling bawah (opsional)
 * @param {(row:Object)=>boolean} [opts.rowHighlight] - baris ini dikasih tint merah muda (mis. deadline lewat)
 */
async function renderTable({ title, subtitle, columns, rows, emptyText = "Belum ada data.", footNote, rowHighlight }) {
  const F = await fonts();

  const colWidths = columns.map((col, i) => {
    let w = tw(F.head, col.label);
    for (const r of rows) w = Math.max(w, tw(F.body, r[col.key]));
    w += PAD * 2;
    if (i === 0 && typeof rowHighlight === "function") w += 34; // slack buat prefix "! "
    if (col.max) w = Math.min(w, col.max);
    if (col.min) w = Math.max(w, col.min);
    return Math.round(w);
  });

  const tableW = colWidths.reduce((a, b) => a + b, 0);
  const width = Math.max(tableW, 760);
  const bodyRowCount = rows.length === 0 ? 1 : rows.length;
  const subH = subtitle ? 40 : 0;
  const footH = footNote ? 48 : 20;
  const height = TITLE_H + subH + HEAD_H + bodyRowCount * ROW_H + footH;

  const image = new Jimp(width, height, COLOR.bg);

  // Title bar (diperlebar biar nampung subtitle kalau ada)
  fillRect(image, 0, 0, width, TITLE_H + subH, COLOR.titleBg);
  image.print(F.title, PAD, 18, sanitize(title));
  if (subtitle) {
    image.print(F.smallWhite, PAD, TITLE_H + 4, sanitize(subtitle), width - PAD * 2);
  }
  let cursorY = TITLE_H + subH;

  // Column header row
  fillRect(image, 0, cursorY, width, HEAD_H, COLOR.headBg);
  let cx = 0;
  for (let i = 0; i < columns.length; i++) {
    image.print(F.head, cx + PAD, cursorY + 18, sanitize(columns[i].label));
    cx += colWidths[i];
  }
  cursorY += HEAD_H;

  // Rows
  if (rows.length === 0) {
    fillRect(image, 0, cursorY, width, ROW_H, COLOR.rowA);
    image.print(F.body, PAD, cursorY + 20, sanitize(emptyText), width - PAD * 2);
    cursorY += ROW_H;
  } else {
    rows.forEach((row, ri) => {
      const highlighted = typeof rowHighlight === "function" && rowHighlight(row);
      const rowColor = highlighted ? COLOR.rowDanger : ri % 2 === 0 ? COLOR.rowA : COLOR.rowB;
      fillRect(image, 0, cursorY, width, ROW_H, rowColor);
      let x = 0;
      for (let ci = 0; ci < columns.length; ci++) {
        const value = sanitize(row[columns[ci].key]);
        const prefix = highlighted && ci === 0 ? "! " : "";
        image.print(F.body, x + PAD, cursorY + 20, `${prefix}${value}`, colWidths[ci] - PAD);
        x += colWidths[ci];
      }
      // separator line antar baris
      fillRect(image, 0, cursorY + ROW_H - 1, width, 1, COLOR.border);
      cursorY += ROW_H;
    });
  }

  // Vertical column separators
  let vx = 0;
  for (let i = 0; i < columns.length - 1; i++) {
    vx += colWidths[i];
    fillRect(image, vx, TITLE_H + subH, 1, HEAD_H + bodyRowCount * ROW_H, COLOR.border);
  }

  if (footNote) {
    image.print(F.small, PAD, height - 34, sanitize(footNote), width - PAD * 2);
  }

  return image.getBufferAsync(Jimp.MIME_PNG);
}

module.exports = { renderTable };
