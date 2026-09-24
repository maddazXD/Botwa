// plugins/group/warnlist.js — Lihat daftar member yang punya peringatan
// aktif di grup ini, beserta jumlahnya.
const { header, card, fail } = require("../../lib/theme");

let handler = async (m, { sock, isAdmin, isOwner }) => {
  if (!m.isGroup) return m.reply(fail("Fitur ini cuma bisa dipakai di grup."));
  if (!isAdmin && !isOwner) return m.reply(fail("Cuma admin grup atau owner yang boleh lihat ini."));

  const chat = global.db.groups?.[m.chat];
  const warnings = chat?.warnings || {};
  const entries = Object.entries(warnings).filter(([, r]) => r.count > 0);

  if (!entries.length) return m.reply(fail("Gak ada member yang punya peringatan di grup ini."));

  const lines = [];
  const mentions = [];
  for (const [jid, record] of entries) {
    const lastReason = record.log?.[record.log.length - 1]?.reason || "-";
    lines.push(`• @${jid.split("@")[0]} — ${record.count}/3 (terakhir: ${lastReason})`);
    mentions.push(jid);
  }

  return sock.sendMessage(m.chat, {
    text: `${header("MEMBER DIPERINGATKAN", "⚠️")}\n\n` + card("Daftar", lines, "⚠️"),
    mentions,
  }, { quoted: m });
};

handler.command = ["warnlist", "listwarn"];
handler.tags = "admin";
handler.help = ["warnlist"];
handler.group = true;
handler.admin = true;

module.exports = handler;
