// lib/theme.js — Satu tempat buat semua elemen visual bot (border, font, footer).
// Gaya visual diambil dari referensi bot lain (border ┏━┓/╭┈⬡「 」, font small caps
// di semua label, tanpa brand di footer). Nama fungsi yang di-export TETAP SAMA
// biar semua file lain yang import dari sini (100+ plugin) gak perlu diubah.
"use strict";

// Font small caps — dipake di SEMUA label/judul (termasuk button title), gantiin
// gaya mono-bold yang lama, biar konsisten sama referensi.
const SMALL_CAPS = {
  a: "ᴀ", b: "ʙ", c: "ᴄ", d: "ᴅ", e: "ᴇ", f: "ꜰ", g: "ɢ", h: "ʜ", i: "ɪ",
  j: "ᴊ", k: "ᴋ", l: "ʟ", m: "ᴍ", n: "ɴ", o: "ᴏ", p: "ᴘ", q: "ǫ", r: "ʀ",
  s: "ꜱ", t: "ᴛ", u: "ᴜ", v: "ᴠ", w: "ᴡ", x: "x", y: "ʏ", z: "ᴢ",
};
function smallCaps(text) {
  return String(text).toLowerCase().split("").map(c => SMALL_CAPS[c] || c).join("");
}

// FIX TAMPILAN: dulu bold() bikin font "𝗠𝗢𝗡𝗢 𝗕𝗢𝗟𝗗" gede semua. Sekarang disamain ke
// small caps (nama fungsi tetap "bold" biar file lain yang manggil bold() gak error).
function bold(text) {
  return smallCaps(text);
}

// FIX TAMPILAN: brand/footer lama ("❀ 👑 MaddazXD 👑 ❀") dihapus sesuai request.
// footer() sekarang gak nambahin apa-apa secara default; kalau ada teks tambahan yang
// mau ditaro di bawah (jarang dipake), ditampilin gaya "> teks" (kutipan/catatan).
const BRAND = "";
// Pemanis: pembatas dekoratif buat misahin antar-blok (dipake di .menu), pendek
// banget jadi gak ada risiko ke-wrap kayak border box.
const DIVIDER = "· · ·  ✦  · · ·";

// Pemanis: dikumpulin banyak kata-kata random biar tiap buka .menu kalimatnya
// beda-beda terus (dipilih acak dari sini lewat quote()), gak keulang-ulang mulu.
const QUOTES = [
  "waku waku~! ada yang bisa dibantu?",
  "semangat harinya~ jangan lupa istirahat ✨",
  "siap membantu kapan aja!",
  "yeay, ketemu lagi~ 🌸",
  "santai aja, pelan-pelan juga sampai kok.",
  "gas terus, jangan males-males~",
  "udah minum air putih belum hari ini?",
  "jangan lupa senyum, walau cuma buat diri sendiri.",
  "kerja keras boleh, tapi jangan lupa istirahat ya.",
  "hari ini juga usaha lagi, keren banget!",
  "kalau capek, gapapa kok buat rehat sebentar.",
  "yuk lanjut, aku temenin kok.",
  "apapun yang lagi dikerjain, semoga lancar~",
  "jangan kebanyakan begadang, sayangi mata sama badan.",
  "sekecil apapun progress, tetep progress kok.",
  "hai hai~ ada yang bisa dibantu hari ini?",
  "tetap semangat walau banyak tugas numpuk.",
  "istirahat sejenak juga gapapa, gak akan ketinggalan kok.",
  "makasih udah mampir, semoga harinya menyenangkan.",
  "kalau bingung mulai dari mana, coba .listmenu aja dulu.",
  "sabar ya, semua ada waktunya masing-masing.",
  "belajar pelan-pelan juga gapapa, yang penting konsisten.",
  "kamu udah keren kok sampai sejauh ini.",
  "coba deh sekali-kali istirahatin mata dari layar.",
  "gak usah buru-buru, nikmatin prosesnya juga.",
  "kalau ada yang error, wajar kok, namanya juga belajar.",
  "semangat ngoding/kerja/belajarnya, jangan nyerah!",
  "hidrasi itu penting, minum dulu gih.",
  "hari ini juga effort kok, walau kecil.",
  "makin lama makin jago pasti, tenang aja.",
  "jangan lupa makan ya, jangan cuma mikirin kerjaan.",
  "gapapa kalau capek, wajar kok jadi manusia.",
  "kamu gak sendirian kok, pelan-pelan aja.",
  "semoga apa yang lagi dikerjain berjalan lancar ya.",
];
function quote() {
  return QUOTES[Math.floor(Math.random() * QUOTES.length)];
}

// Hitung "lebar tampilan" sebuah baris teks — markdown *bold* dibuang dulu
// (asterisk-nya gak keliatan di WA), dihitung per code point biar emoji/unicode
// 2-byte gak bikin hitungan lebar meleset.
function displayWidth(text) {
  return Array.from(String(text).replace(/\*/g, "")).length;
}

// FIX TAMPILAN: dulu lebar border tiap box itu DINAMIS — ngikutin baris terpanjang
// di box itu masing-masing. Akibatnya tiap box beda-beda lebar (kadang lebih lebar
// dari yang lain cuma gara-gara satu baris agak panjang), jadi kalau ditumpuk
// beberapa box beruntun keliatan gak rapi/gak nyambung satu sama lain.
// Sekarang lebar border-nya FIXED per tipe box (samain kayak referensi), jadi
// semua box konsisten lebarnya walau isinya beda-beda panjang.
//
// FIX BORDER PATAH: karakter "━" itu di-render LEBIH LEBAR dari huruf biasa di
// font WhatsApp. 22 karakter "━" berturut-turut ternyata udah kepanjangan buat
// satu baris di layar HP, jadi garisnya sendiri ke-wrap ke baris berikutnya dan
// keliatan "patah" di pojok box. Diperpendek jadi 16 biar aman gak ke-wrap.
const HEADER_BORDER = "━".repeat(16);
const PANEL_TAIL     = "─".repeat(12);
const CARD_TAIL       = "┈".repeat(8);

// Batasin panjang teks yang isinya gak pasti (nama user, dll) sebelum ditaro di
// DALAM box — biar baris di dalam box gak pernah ke-wrap (yang bikin border "┃"
// keliatan bocor/putus di baris sambungannya). Teks yang panjangnya gak pasti
// dan berpotensi panjang sebaiknya ditaro DI LUAR box (teks polos), bukan di
// dalam — pakai truncate() ini cuma buat jaga-jaga kalau terpaksa harus di dalam.
function truncate(text, max = 18) {
  const s = String(text);
  const chars = Array.from(s);
  if (chars.length <= max) return s;
  return chars.slice(0, max - 1).join("") + "…";
}

// Header judul utama — gaya kotak tegas ┏━━┓, dipake buat judul singkat di paling
// atas (misal sapaan "Selamat Pagi 👋").
function header(title, emoji = "✦") {
  return `┏${HEADER_BORDER}\n┃ ${emoji} *${smallCaps(title)}*\n┗${HEADER_BORDER}`;
}

// Panel info — gaya ╭─〔 judul 〕...╰──⬢, dipake buat blok status/info singkat
// (beberapa baris "label : value"), beda gaya dari card() biar ada variasi visual
// kayak di referensi (gak semua box gayanya sama/monoton).
function panel(title, lines, emoji = "⬢") {
  const items = Array.isArray(lines) ? lines : [lines];
  const body = items.map((l) => `│ ${l}`).join("\n");
  return `╭─〔 ${smallCaps(title)} 〕\n${body}\n╰${PANEL_TAIL}${emoji}`;
}

// "Kartu" isi konten/daftar item — gaya ╭┈┈⬡「 judul 」 ... ╰┈┈┈┈⬡, dipake buat
// detail/list command.
function card(title, lines, emoji = "⬡") {
  const items = Array.isArray(lines) ? lines : [lines];
  const body = items.map((l) => `┃ ${l}`).join("\n");
  return `╭┈┈${emoji}「 ${smallCaps(title)} 」\n${body}\n╰${CARD_TAIL}${emoji}`;
}

// Footer — dulu nempelin brand, sekarang kosong. Kalau ada catatan tambahan
// (jarang), ditampilin gaya kutipan "> teks" tanpa border/brand apapun.
function footer(extra = "") {
  return extra ? `\n> ${extra}` : "";
}

function ok(msg) { return `✅ ${msg}`; }
function fail(msg) { return `❌ ${msg}`; }
function warn(msg) { return `⚠️ ${msg}`; }
function processing(msg = "Diproses, tunggu sebentar...") { return `⏳ ${msg}`; }
function usage(cmd, example) { return `📝 *Cara pakai:*\n${cmd}${example ? `\n\n*Contoh:*\n${example}` : ""}`; }

function progressBar(percent, size = 12) {
  const pct = Math.max(0, Math.min(100, Math.round(percent)));
  const filled = Math.round((pct / 100) * size);
  return `[${"█".repeat(filled)}${"░".repeat(size - filled)}] ${pct}%`;
}

// Sama kayak header(), tapi buat box yang isinya lebih dari satu baris (misal
// greeting .menu: nama bot + sapaan). Lebar-nya ikut FIXED juga biar nyambung
// sama header() di atas.
function bigHeader(lines, emoji = "✦") {
  const items = Array.isArray(lines) ? lines : [lines];
  const body = items.map((l) => `┃ ${l}`).join("\n");
  return `┏${HEADER_BORDER}\n${body}\n┗${HEADER_BORDER}`;
}

// Daftar "label : value" rapi tersejajar (bukan box — SENGAJA gak dikasih
// border tetap, beda sama header/panel/card, biar gak kena bug wrap yang
// sama kalau isinya panjang/gak pasti, lihat catatan di atas). Cocok buat
// nampilin data terstruktur kayak hasil .getpp, .cekiq, detail file, dst.
// `rows` = array of { label, value }.
function table(rows) {
  const maxLabel = Math.max(...rows.map((r) => String(r.label).length));
  return rows.map((r) => `▸ ${String(r.label).padEnd(maxLabel)} : ${r.value}`).join("\n");
}

// Bentuk array tombol "quick_reply" (tap → langsung ngirim teks itu ke
// chat, KE-PROSES lagi sama bot persis kayak diketik manual) siap pake.
// Ini CUMA nyiapin BENTUK DATANYA doang — buat ngirimnya, tetep harus
// lewat lib/interactiveMessage.js (sendInteractiveCard), soalnya tombol
// asli WA gak bisa nempel di sock.sendMessage({text}) biasa.
// `items` = array of string ATAU array of { label, id } (id = teks yang
// bener2 dikirim pas tombolnya di-tap; default sama kayak label).
function quickReplyButtons(items) {
  return items.map((it) => {
    const label = typeof it === "string" ? it : it.label;
    const id = typeof it === "string" ? it : it.id || it.label;
    return { name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: label, id }) };
  });
}

module.exports = {
  bold, smallCaps, header, bigHeader, card, panel, footer, truncate, BRAND, DIVIDER,
  ok, fail, warn, processing, usage, progressBar, quote, table, quickReplyButtons,
};
