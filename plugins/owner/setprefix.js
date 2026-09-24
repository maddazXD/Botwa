// plugins/owner/setprefix.js — Ganti prefix bot sesuka hati. Prefix baru
// langsung aktif SAAT INI JUGA (gak perlu restart) dan otomatis kesimpen ke
// database, jadi tetap nyantol walau bot mati-nyala lagi.
const { usage, ok, fail } = require("../../lib/theme");

let handler = async (m, { text }) => {
  if (!text) {
    return m.reply(
      usage(`${m.cmd} <prefix baru>`, `${m.cmd} !`) +
        `\n\nPrefix sekarang: *${global.prefix}*`
    );
  }

  const newPrefix = text.trim();

  if (newPrefix.length > 5) {
    return m.reply(fail("Prefix kepanjangan, maksimal 5 karakter ya."));
  }
  if (/\s/.test(newPrefix)) {
    return m.reply(fail("Prefix gak boleh ada spasi di dalamnya."));
  }

  const oldPrefix = global.prefix;
  global.prefix = newPrefix;
  if (!global.db.settings) global.db.settings = {};
  global.db.settings.prefix = newPrefix;

  m.reply(
    ok(
      `Prefix bot berhasil diganti.\n\n` +
        `Lama : *${oldPrefix}*\n` +
        `Baru : *${newPrefix}*\n\n` +
        `Coba: *${newPrefix}menu*`
    )
  );
};

handler.help = "setprefix <prefix baru>";
handler.command = ["setprefix", "changeprefix"];
handler.tags = "owner";
handler.owner = true;

module.exports = handler;
