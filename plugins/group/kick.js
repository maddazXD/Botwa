// plugins/group/kick.js — Kick member dari grup. Cara target member sama
// persis kayak .mute: reply pesan / tag @member / nomor langsung.
const { ok, fail, usage } = require("../../lib/theme");
const { resolveTarget } = require("../../lib/resolveTarget");

let handler = async (m, { sock, args, isAdmin, isOwner, isBotAdmin }) => {
  if (!m.isGroup) return m.reply(fail("Fitur ini cuma bisa dipakai di grup."));
  if (!isAdmin && !isOwner) return m.reply(fail("Cuma admin grup atau owner yang boleh kick member."));
  if (!isBotAdmin) return m.reply(fail("Bot harus jadi admin dulu buat bisa kick member (aturan WhatsApp)."));

  const { targetJid } = await resolveTarget(m, sock, args);
  if (!targetJid) {
    return m.reply(
      usage(`${m.cmd} @member`, `${m.cmd} @628xxx\natau reply pesan membernya + ${m.cmd}`)
    );
  }

  if (targetJid === m.sender) return m.reply(fail("Gak bisa kick diri sendiri (pakai .kickme kalau emang mau keluar)."));
  if (targetJid === m.botNumber) return m.reply(fail("Gak bisa kick bot sendiri."));

  const participants = m.metadata?.participants || [];
  const targetParticipant = participants.find((p) => (p.id || p.jid) === targetJid);
  if (!targetParticipant) {
    return m.reply(fail("Member itu gak ketemu di grup ini (mungkin udah keluar duluan)."));
  }
  const targetIsAdmin = targetParticipant.admin !== null;
  if (targetIsAdmin && !isOwner) {
    return m.reply(fail("Gak bisa kick sesama admin grup (kecuali kamu owner bot)."));
  }

  const targetTag = `@${targetJid.split("@")[0]}`;
  try {
    await sock.groupParticipantsUpdate(m.chat, [targetJid], "remove");
    return sock.sendMessage(m.chat, {
      text: ok(`${targetTag} berhasil dikeluarkan dari grup.`),
      mentions: [targetJid],
    }, { quoted: m });
  } catch (err) {
    console.error("[KICK GAGAL]", err?.message || err);
    return m.reply(fail("Gagal kick member: " + (err?.message || "error tidak diketahui")));
  }
};

handler.command = ["kick", "tendang"];
handler.tags = "admin";
handler.help = ["kick @member", "kick (reply pesan)"];
handler.group = true;
handler.admin = true;
handler.botAdmin = true;

module.exports = handler;
