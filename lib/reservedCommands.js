// lib/reservedCommands.js — cache daftar SEMUA command yang udah "kepake"
// sama plugin manapun. Sebelumnya upload.js & koleksi.js masing-masing
// ngebangun ulang Set ini dari NOL tiap ada pesan masuk yang diawali prefix
// (lewat handler.before, jalan buat hampir semua command di grup/chat) —
// kerjaan berulang & dobel di 2 tempat buat hal yang jarang berubah.
// Sekarang di-cache, cuma dihitung ulang kalau isi command berubah.
let cache = null;
let cachedSignature = null;

// FIX BUG: sebelumnya invalidation cache cuma ngecek JUMLAH plugin yang
// ke-load (Object.keys(plugins).length), BUKAN isi command-nya. Skenario
// yang bikin ini gagal: admin hapus 1 plugin lewat .delplugin (command lama
// ilang) TERUS tambah 1 plugin lain lewat .addplugin (command baru masuk) —
// JUMLAH plugin tetep sama persis, jadi cache DIANGGAP MASIH VALID padahal
// isinya udah beda total. Akibatnya:
// - Command LAMA yang udah gak ada pluginnya lagi masih dianggap "reserved"
//   (padahal harusnya udah bebas dipakai buat nama upload/koleksi record)
// - Command BARU yang beneran aktif sekarang malah GAK dianggap reserved
//   (karena cache basi), jadi kalau user upload file/koleksi dengan nama
//   yang sama persis, sistem ngizinin — bikin konflik senyap antara command
//   plugin asli vs trigger upload/koleksi record, tergantung urutan iterasi
//   plugin di handler.before (gak deterministik, beda hasil di lain waktu).
// Fix: signature sekarang berupa STRING GABUNGAN semua nama command yang
// ke-scan (bukan cuma hitungannya) — kalau ada satu aja command yang
// berubah/ilang/nambah, signature-nya pasti beda, cache otomatis rebuild.
function computeSignature(plugins) {
  const names = [];
  for (const name in plugins) {
    const p = plugins[name];
    if (!p?.command) continue;
    const cmds = Array.isArray(p.command) ? p.command : [p.command];
    for (const c of cmds) if (typeof c === "string") names.push(c.toLowerCase());
  }
  names.sort();
  return names.join(",");
}

function getReservedCommands() {
  const plugins = global.plugins || {};
  const signature = computeSignature(plugins);
  if (cache && signature === cachedSignature) return cache;

  const reserved = new Set(signature ? signature.split(",") : []);
  cache = reserved;
  cachedSignature = signature;
  return reserved;
}

module.exports = { getReservedCommands };
