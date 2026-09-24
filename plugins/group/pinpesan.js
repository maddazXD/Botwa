// plugins/group/pinpesan.js — Pin pesan yang di-reply
let handler = async (m, { sock }) => {
  if (!m.quoted) return m.reply("Balas pesan yang ingin dipin!");

  await sock.sendMessage(m.chat, {
    pin: { remoteJid: m.quoted.chat || m.chat, fromMe: false, id: m.quoted.id, participant: m.quoted.sender },
    type: 1,
  });
  m.reply("📌 Pesan berhasil dipin.");
};

handler.command = ["pinpesan"];
handler.tags = "admin";
handler.help = ["pinpesan (reply pesan)"];
handler.group = true;
handler.admin = true;
handler.botAdmin = true;

module.exports = handler;
