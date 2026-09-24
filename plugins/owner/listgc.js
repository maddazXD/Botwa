// plugins/owner/listgc.js — Daftar semua grup tempat bot berada
let handler = async (m, { sock }) => {
  const groups = await sock.groupFetchAllParticipating();
  const list = Object.values(groups);
  if (!list.length) return m.reply("Bot belum masuk grup manapun.");

  let teks = `📋 *LIST GRUP BOT*\n\n`;
  list.forEach((g, i) => {
    teks += `${i + 1}. *${g.subject}*\n   🆔 ID: ${g.id}\n   👥 Member: ${g.participants?.length || 0}\n\n`;
  });
  teks += `Total Grup: ${list.length}`;
  m.reply(teks);
};

handler.command = ["listgc", "listgrup"];
handler.tags = ["owner"];
handler.help = ["listgc"];
handler.owner = true;

module.exports = handler;
