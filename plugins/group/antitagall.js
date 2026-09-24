// plugins/group/antitagall.js — Toggle & proteksi anti tag-massal di grup
const { footer } = require("../../lib/theme");

let handler = async (m, { args }) => {
  const o = args[0] || "";
  if (!["--on", "--off"].includes(o)) return m.reply("⚠️ Pilih opsi:\n\n• --on\n• --off");

  if (!global.db.groups[m.chat]) global.db.groups[m.chat] = {};

  if (o === "--on") {
    global.db.groups[m.chat].antitagall = true;
    m.reply("✅ Anti TagAll berhasil diaktifkan" + footer());
  } else {
    global.db.groups[m.chat].antitagall = false;
    m.reply("❌ Anti TagAll berhasil dinonaktifkan" + footer());
  }
};

handler.before = async (m, { sock, isAdmin, isOwner, isBotAdmin }) => {
  if (!m.isGroup || !isBotAdmin) return;
  if (!m.mentionedJid || !m.mentionedJid.length) return;

  const chat = global.db.groups?.[m.chat];
  // FIX BUG: beda sama antitoxic.js/antilink.js/antivirtex.js yang udah
  // exempt owner, di sini ketinggalan — owner bot yang kebetulan bukan
  // admin WA di grup ini ikut kena hapus pesannya sendiri kalau nge-tag
  // banyak orang.
  if (!chat?.antitagall || isAdmin || isOwner) return;

  const maxTag = 5;
  if (m.mentionedJid.length < maxTag) return;

  try {
    await sock.sendMessage(m.chat, {
      delete: { remoteJid: m.chat, fromMe: false, id: m.key.id, participant: m.sender },
    });
    await sock.sendMessage(m.chat, { text: `*– 乂 Anti TagAll –*\nTerlalu banyak mention dalam satu pesan.` }, { quoted: m });
  } catch (e) {
    console.error("[ANTITAGALL GAGAL]", e.message);
  }
  // FIX BUG: sebelumnya gak pernah return true, jadi command TETAP diproses
  // lanjut setelah pesan pelanggaran dihapus (handler.js cuma stop kalau
  // before() return truthy). Sekarang stop total setelah delete.
  return true;
};

handler.command = ["antitagall"];
handler.tags = "admin";
handler.help = ["antitagall --on", "antitagall --off"];
handler.group = true;
handler.admin = true;
handler.botAdmin = true;

module.exports = handler;
