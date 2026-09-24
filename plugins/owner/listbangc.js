// plugins/owner/listbangc.js — Lihat daftar SEMUA grup yang lagi di-mute
// bot (owner only, soalnya ini nge-list data dari semua grup bot-wide,
// bukan cuma grup ini).
// FIX BUG: sebelumnya file ini nangkring di plugins/group/ dengan
// handler.tags = "admin", padahal aksesnya owner-only (handler.owner = true)
// dan datanya bot-wide (semua grup, bukan cuma grup tempat command
// dijalankan) — jelas konsepnya beda dari command "admin" biasa yang
// cakupannya cuma 1 grup itu sendiri. Dipindah ke plugins/owner/ dan
// tags-nya diubah jadi "owner" biar konsisten sama flag handler.owner,
// dan biar muncul di kategori OWNER waktu .menu/.listmenu, bukan nyempil
// di kategori ADMIN yang isinya harusnya command per-grup.
const { header, card, fail } = require("../../lib/theme");

let handler = async (m, { sock }) => {
  const groups = global.db.groups || {};
  const mutedIds = Object.keys(groups).filter((id) => groups[id]?.mute);

  if (!mutedIds.length) {
    return m.reply(fail("Gak ada grup yang lagi di-mute saat ini."));
  }

  const lines = [];
  for (const id of mutedIds) {
    let name = id;
    try {
      let meta = global.groupMetadataCache?.get(id);
      if (!meta) meta = await sock.groupMetadata(id).catch(() => null);
      if (meta?.subject) name = meta.subject;
    } catch {}
    lines.push(`• ${name}`);
  }

  m.reply(
    `${header("GRUP YANG DI-MUTE", "🔇")}\n\n` + card("Daftar", lines, "🔇")
  );
};

handler.help = "listbangc (lihat daftar grup yang lagi di-mute bot)";
handler.command = ["listbangc"];
handler.tags = "owner";
handler.owner = true;

module.exports = handler;
