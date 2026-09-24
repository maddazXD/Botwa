// plugins/owner/setdb.js — Ubah/isi data database langsung dari chat (pakai
// notasi titik buat nunjuk lokasinya). Value boleh ditulis sebagai JSON
// (angka/true/false/object/array) atau teks polos.
//
// PENTING soal JID: nomor WA (628xxx@s.whatsapp.net) itu ada titiknya, jadi
// kalau ditulis pake titik biasa bakal kebaca path bersarang yang salah.
// Buat nunjuk key kayak gitu, bungkus pake notasi bracket+petik.
//
// Contoh:
//   .setdb settings.namaSaveContact "Bestie"
//   .setdb settings.jedaPushkontak 5000
//   .setdb groups["123-456@g.us"].welcome true
const _ = require("lodash");
const { usage, ok, fail } = require("../../lib/theme");
const { isPathSafe } = require("../../lib/safeDbPath");

let handler = async (m, { text }) => {
  if (!text) {
    return m.reply(usage(`${m.cmd} <path> <value>`, `${m.cmd} settings.namaSaveContact "Bestie"`));
  }

  const spaceIdx = text.indexOf(" ");
  if (spaceIdx === -1) {
    return m.reply(usage(`${m.cmd} <path> <value>`, `${m.cmd} settings.jedaPushkontak 5000`));
  }

  const path_ = text.slice(0, spaceIdx).trim();
  const rawValue = text.slice(spaceIdx + 1).trim();

  if (!isPathSafe(path_)) {
    return m.reply(fail("Path gak boleh ngandung __proto__/constructor/prototype (buat nyegah prototype pollution)."));
  }

  let value;
  try {
    value = JSON.parse(rawValue);
  } catch {
    value = rawValue; // bukan JSON valid -> anggap aja string polos
  }

  _.set(global.db, path_, value);
  m.reply(ok(`Berhasil set *${path_}* jadi:\n\`\`\`${JSON.stringify(value)}\`\`\``));
};

handler.help = "setdb <path> <value> — value boleh JSON (angka/boolean/object) atau teks biasa";
handler.command = ["setdb"];
handler.tags = "owner";
handler.owner = true;

module.exports = handler;
