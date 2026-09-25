// plugins/group/antivirtex.js — Toggle & proteksi anti pesan virtex/spam-karakter
const { footer } = require("../../lib/theme");

let handler = async (m, { args }) => {
  const o = args[0] || "";
  if (!["--on", "--off"].includes(o)) return m.reply("⚠️ Pilih opsi:\n\n• --on\n• --off");

  if (!global.db.groups[m.chat]) global.db.groups[m.chat] = {};

  if (o === "--on") {
    global.db.groups[m.chat].antivirtex = true;
    m.reply("✅ Anti Virtex berhasil diaktifkan" + footer());
  } else {
    global.db.groups[m.chat].antivirtex = false;
    m.reply("❌ Anti Virtex berhasil dinonaktifkan" + footer());
  }
};

handler.before = async (m, { sock, isAdmin, isOwner, isBotAdmin }) => {
  if (!m.isGroup || !m.text || !isBotAdmin) return;

  const chat = global.db.groups?.[m.chat];
  // FIX BUG: dulu cuma exempt isAdmin, owner ikut kena kalau kebetulan
  // bukan WA-admin di grup itu.
  if (!chat?.antivirtex || isAdmin || isOwner) return;

  const maxLength = 4000;
  const repeatRegex = /(.)\1{15,}/g;
  const isVirtex = m.text.length > maxLength || repeatRegex.test(m.text);
  if (!isVirtex) return;

  try {
    await sock.sendMessage(m.chat, {
      delete: { remoteJid: m.chat, fromMe: false, id: m.key.id, participant: m.sender },
    });
    console.log(`[ANTIVIRTEX] Hapus pesan dari ${m.sender} di grup ${m.chat} — alasan: teks terlalu panjang/spam karakter.`);
    await sock.sendMessage(m.chat, { text: `*– 乂 Anti Virtex –*\nPesan terdeteksi sebagai spam / virtex dan telah dihapus.` }, { quoted: m });
  } catch (e) {
    console.error("[ANTIVIRTEX GAGAL]", e.message);
  }
  // FIX BUG: sebelumnya gak pernah return true, jadi command TETAP diproses
  // lanjut setelah pesan pelanggaran dihapus (handler.js cuma stop kalau
  // before() return truthy). Sekarang stop total setelah delete.
  return true;
};

handler.command = ["antivirtex"];
handler.tags = "admin";
handler.help = ["antivirtex --on", "antivirtex --off"];
handler.group = true;
handler.admin = true;
handler.botAdmin = true;

module.exports = handler;
