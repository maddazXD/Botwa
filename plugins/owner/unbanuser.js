// plugins/owner/unbanuser.js — Cabut ban user dari bot
let handler = async (m, { text }) => {
  let who;
  if (m.isGroup) who = m.mentionedJid?.[0];
  else who = text ? `${text.replace(/[^0-9]/g, "")}@s.whatsapp.net` : m.chat;

  if (!who) return m.reply("Siapa yang mau di-unban? Tag orangnya atau kasih nomornya.");

  global.db.settings.banned = (global.db.settings.banned || []).filter((b) => b !== who);
  m.reply(`✅ Berhasil unban @${who.split("@")[0]}`);
};

handler.command = ["unban", "unbanuser"];
handler.tags = ["owner"];
handler.help = ["unban <@user/nomor>"];
handler.owner = true;

module.exports = handler;
