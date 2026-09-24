// plugins/owner/banuser.js — Ban user dari pakai bot (disesuaikan ke sistem
// banned list MaddazXD yaitu array global.db.settings.banned, bukan flag per-user)
let handler = async (m, { text }) => {
  let who;
  if (m.isGroup) who = m.mentionedJid?.[0];
  else who = text ? `${text.replace(/[^0-9]/g, "")}@s.whatsapp.net` : m.chat;

  if (!who) return m.reply("Siapa yang mau di-ban? Tag orangnya atau kasih nomornya.");

  if (!global.db.settings.banned) global.db.settings.banned = [];
  if (!global.db.settings.banned.includes(who)) global.db.settings.banned.push(who);

  m.reply(`✅ Berhasil ban @${who.split("@")[0]}`);
};

handler.command = ["ban", "banuser"];
handler.tags = ["owner"];
handler.help = ["ban <@user/nomor>"];
handler.owner = true;

module.exports = handler;
