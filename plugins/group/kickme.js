// plugins/group/kickme.js — Keluar sendiri dari grup lewat bot
let handler = async (m, { sock, isBotAdmin }) => {
  if (!m.isGroup) return m.reply("❌ Fitur ini hanya bisa digunakan di grup.");
  if (!isBotAdmin) return m.reply("❌ Bot harus menjadi admin.");

  await m.reply("👋 Oke, sampai jumpa lagi!");
  await sock.groupParticipantsUpdate(m.chat, [m.sender], "remove");
};

handler.command = ["leavegc", "kickme", "out"];
handler.tags = "admin";
handler.help = ["kickme"];
handler.group = true;

module.exports = handler;
