// plugins/group/sider.js — Deteksi member "silent reader" (gak pernah aktif) di grup
const { getBaileys } = require("../../lib/baileysLoader");

const INACTIVE_TIME = 3 * 24 * 60 * 60 * 1000; // 3 hari

function clockString(ms) {
  if (!isFinite(ms)) return "Belum Pernah Aktif";
  const h = Math.floor(ms / 3600000);
  const mi = Math.floor(ms / 60000) % 60;
  return `${h}H ${mi}J`;
}

async function sendForceMention(sock, m, text, mentions = []) {
  const { generateWAMessageFromContent, proto } = await getBaileys();
  const msg = generateWAMessageFromContent(
    m.chat,
    { extendedTextMessage: proto.Message.ExtendedTextMessage.fromObject({ text, contextInfo: { mentionedJid: mentions } }) },
    { quoted: m }
  );
  await sock.relayMessage(m.chat, msg.message, { messageId: msg.key.id });
}

let handler = async (m, { sock, command }) => {
  const users = global.db.users;
  const members = m.metadata?.participants || [];

  if (command === "resetsider") {
    let total = 0;
    for (const mem of members) {
      const jid = mem.id || mem.jid;
      if (!jid) continue;
      if (!users[jid]) users[jid] = {};
      users[jid].lastseen = Date.now();
      total++;
    }
    return m.reply(`✅ Berhasil reset aktivitas ${total} member grup`);
  }

  const sider = [];
  for (const mem of members) {
    const jid = mem.id || mem.jid;
    if (!jid || jid === sock.user.jid) continue;
    const lastseen = users[jid]?.lastseen || 0;
    const inactive = !lastseen || Date.now() - lastseen > INACTIVE_TIME;
    if (inactive) sider.push({ jid, lastseen });
  }

  if (command === "kicksider") {
    const kicked = [];
    for (const user of sider) {
      try {
        await sock.groupParticipantsUpdate(m.chat, [user.jid], "remove");
        kicked.push(user.jid);
      } catch {}
    }
    if (!kicked.length) return m.reply("Tidak ada sider yang berhasil di kick 🗿");
    return sendForceMention(sock, m, `✅ Berhasil kick ${kicked.length} sider`, kicked);
  }

  if (!sider.length) return m.reply("Tidak ada sider di grup ini 🗿");

  const mentions = [];
  const siderList = [];
  for (const user of sider) {
    const time = user.lastseen ? clockString(Date.now() - user.lastseen) : "Belum Pernah Aktif";
    siderList.push(`○ @${user.jid.split("@")[0]} (${time})`);
    mentions.push(user.jid);
  }

  const teks =
    `*${sider.length}/${members.length}* anggota grup *${m.metadata?.subject || ""}* terdeteksi sebagai *sider*\n\n` +
    `*Perintah Admin:*\n🚫 Kick sider\n.kicksider\n\n♻️ Reset aktivitas\n.resetsider\n\n` +
    `_"Harap aktif di grup karena akan ada pembersihan member setiap saat"_\n\n*LIST SIDER:*\n${siderList.join("\n")}`;

  await sendForceMention(sock, m, teks, mentions);
};

handler.command = ["sider", "ceksider", "kicksider", "resetsider"];
handler.tags = "admin";
handler.help = ["sider", "kicksider", "resetsider"];
handler.group = true;
handler.admin = true;
handler.botAdmin = true;

module.exports = handler;
