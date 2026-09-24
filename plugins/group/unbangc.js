// plugins/group/unbangc.js — Kebalikan dari .bangc, nyalain lagi bot yang
// lagi di-mute di grup ini.
const { ok, warn } = require("../../lib/theme");

let handler = async (m) => {
  if (!global.db.groups[m.chat]) global.db.groups[m.chat] = {};

  if (!global.db.groups[m.chat].mute) {
    return m.reply(warn("Bot emang lagi gak di-mute di grup ini."));
  }

  global.db.groups[m.chat].mute = false;
  m.reply(ok("Bot udah aktif lagi di grup ini. Siap terima command seperti biasa."));
};

handler.help = "unbangc (nyalain lagi bot yang di-mute di grup ini)";
handler.command = ["unbangc", "unmutebot"];
handler.tags = "admin";
handler.group = true;
handler.admin = true;

module.exports = handler;
