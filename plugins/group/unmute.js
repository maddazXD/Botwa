// plugins/group/unmute.js — Kebalikan dari .mute, buka mute member tertentu
// sebelum durasinya abis (atau buat yang di-mute permanen). Cara target
// member sama persis kayak .mute: tag / nomor / reply.
const { ok, fail, usage } = require("../../lib/theme");
const { resolveTarget } = require("../../lib/resolveTarget");

let handler = async (m, { sock, args, isAdmin, isOwner }) => {
  if (!m.isGroup) return m.reply(fail("Fitur ini cuma bisa dipakai di grup."));
  if (!isAdmin && !isOwner) return m.reply(fail("Cuma admin grup atau owner yang boleh unmute member."));

  const { targetJid } = await resolveTarget(m, sock, args);
  if (!targetJid) {
    return m.reply(
      usage(`${m.cmd} @member`, `${m.cmd} @628xxx\natau reply pesan membernya + ${m.cmd}`)
    );
  }

  const chat = global.db.groups?.[m.chat];
  if (!chat?.mutedMembers?.[targetJid]) {
    return m.reply(fail("Member itu emang lagi gak di-mute."));
  }

  delete chat.mutedMembers[targetJid];
  const targetTag = `@${targetJid.split("@")[0]}`;
  return sock.sendMessage(m.chat, {
    text: ok(`${targetTag} berhasil di-unmute. Pesannya gak bakal dihapus otomatis lagi.`),
    mentions: [targetJid],
  }, { quoted: m });
};

handler.command = ["unmute"];
handler.tags = "admin";
handler.help = ["unmute @member", "unmute (reply pesan)"];
handler.group = true;
handler.admin = true;

module.exports = handler;
