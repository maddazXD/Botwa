// plugins/group/mutelist.js — Lihat daftar member yang lagi di-mute di
// grup ini, beserta sisa waktunya (kalau ada durasi) atau "permanen".
const { header, card, fail } = require("../../lib/theme");
const { formatRemaining } = require("../../lib/parseDuration");

let handler = async (m, { sock, isAdmin, isOwner }) => {
  if (!m.isGroup) return m.reply(fail("Fitur ini cuma bisa dipakai di grup."));
  if (!isAdmin && !isOwner) return m.reply(fail("Cuma admin grup atau owner yang boleh lihat ini."));

  const chat = global.db.groups?.[m.chat];
  const muted = chat?.mutedMembers || {};
  const entries = Object.entries(muted);

  if (!entries.length) return m.reply(fail("Gak ada member yang lagi di-mute di grup ini."));

  // Sekalian bersihin entry yang durasinya udah abis tapi belum sempat
  // ke-trigger handler.before (misal grup lagi sepi, gak ada pesan masuk
  // buat trigger auto-cleanup di mute.js) — biar list ini akurat.
  const now = Date.now();
  const lines = [];
  const mentions = [];
  for (const [jid, info] of entries) {
    if (info.expiresAt && now >= info.expiresAt) {
      delete muted[jid];
      continue;
    }
    const sisa = info.expiresAt ? formatRemaining(info.expiresAt - now) : "permanen";
    lines.push(`• @${jid.split("@")[0]} — sisa: ${sisa}`);
    mentions.push(jid);
  }

  if (!lines.length) return m.reply(fail("Gak ada member yang lagi di-mute di grup ini."));

  return sock.sendMessage(m.chat, {
    text: `${header("MEMBER DI-MUTE", "🔇")}\n\n` + card("Daftar", lines, "🔇"),
    mentions,
  }, { quoted: m });
};

handler.command = ["mutelist", "listmute"];
handler.tags = "admin";
handler.help = ["mutelist"];
handler.group = true;
handler.admin = true;

module.exports = handler;
