// plugins/group/bangc.js — Mute bot SEMENTARA di grup ini. Kalau di-mute,
// bot bakal diem total di grup ini (gak balesin command apapun) sampe
// di-.unbangc lagi — pengecualian cuma buat .bangc/.unbangc/.listbangc
// sendiri (biar tetep bisa dibuka lagi), logic pengecualiannya udah ada
// di handler.js.
const { ok, warn } = require("../../lib/theme");

let handler = async (m) => {
  if (!global.db.groups[m.chat]) global.db.groups[m.chat] = {};

  if (global.db.groups[m.chat].mute) {
    return m.reply(warn("Bot udah di-mute di grup ini.\nPake *.unbangc* buat nyalain lagi."));
  }

  global.db.groups[m.chat].mute = true;
  m.reply(ok("Bot di-mute di grup ini.\nBot bakal diem total sampe di-*.unbangc* lagi."));
};

handler.help = "bangc (mute bot sementara di grup ini)";
handler.command = ["bangc", "mutebot"];
handler.tags = "admin";
handler.group = true;
handler.admin = true;

module.exports = handler;
