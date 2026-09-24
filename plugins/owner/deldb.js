// plugins/owner/deldb.js — Hapus satu key/path dari database (notasi titik).
// PENTING soal JID: nomor WA (628xxx@s.whatsapp.net) ada titiknya, jadi
// tulis pake notasi bracket+petik biar gak kebaca path bersarang yang salah.
// Contoh: .deldb users["628xxxxxxxxxx@s.whatsapp.net"]
const _ = require("lodash");
const { usage, ok, fail } = require("../../lib/theme");
const { isPathSafe } = require("../../lib/safeDbPath");

let handler = async (m, { text }) => {
  if (!text) {
    return m.reply(usage(`${m.cmd} <path>`, `${m.cmd} users["628xxxxxxxxxx@s.whatsapp.net"]`));
  }

  // FIX PROTOTYPE POLLUTION: sama kayak setdb.js, _.unset() bisa dipakai
  // buat NGERUSAK Object.prototype (misal ".deldb constructor.prototype.toString")
  // kalau path-nya gak divalidasi dulu.
  if (!isPathSafe(text)) {
    return m.reply(fail("Path gak boleh ngandung __proto__/constructor/prototype (buat nyegah prototype pollution)."));
  }

  if (!_.has(global.db, text)) {
    return m.reply(fail(`Path "${text}" emang gak ada di database.`));
  }

  _.unset(global.db, text);
  m.reply(ok(`Berhasil hapus *${text}* dari database.`));
};

handler.help = "deldb <path>";
handler.command = ["deldb"];
handler.tags = "owner";
handler.owner = true;

module.exports = handler;
