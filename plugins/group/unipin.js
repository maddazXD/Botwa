// plugins/group/unipin.js — Unpin pesan yang di-reply
let handler = async (m, { sock }) => {
  if (!m.quoted) return m.reply("Balas pesan yang ingin di-unpin!");

  await sock.sendMessage(m.chat, {
    pin: { remoteJid: m.quoted.chat || m.chat, fromMe: false, id: m.quoted.id, participant: m.quoted.sender },
    type: 2,
  });
  m.reply("✅ Pin pesan berhasil dihapus.");
};

handler.command = ["unpin"];
handler.tags = "admin";
handler.help = ["unpin (reply pesan)"];
handler.group = true;
handler.admin = true;
handler.botAdmin = true;

module.exports = handler;
