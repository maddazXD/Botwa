// plugins/group/antilink.js — Toggle & proteksi anti-link grup WhatsApp
const { footer } = require("../../lib/theme");

let handler = async (m, { sock, args }) => {
  const o = args[0] || "";
  if (!["--on", "--off"].includes(o)) return m.reply("⚠️ Pilih opsi:\n\n• --on\n• --off");

  if (!global.db.groups[m.chat]) global.db.groups[m.chat] = {};

  if (o === "--on") {
    global.db.groups[m.chat].antilink = true;
    m.reply("✅ Anti Link Grup berhasil diaktifkan" + footer());
  } else {
    global.db.groups[m.chat].antilink = false;
    m.reply("❌ Anti Link Grup berhasil dinonaktifkan" + footer());
  }
};

handler.before = async (m, { sock, isAdmin, isOwner, isBotAdmin }) => {
  if (!m.isGroup || !m.text || !isBotAdmin) return;

  const chat = global.db.groups?.[m.chat];
  // FIX BUG: dulu cuma exempt isAdmin, owner yang kebetulan bukan WA-admin
  // di grup itu ikut kena hapus pesannya sendiri kalau ngirim link.
  if (!chat?.antilink || isAdmin || isOwner) return;

  const linkRegex = /(chat\.whatsapp\.com\/|wa\.me\/chat)/i;
  if (!linkRegex.test(m.text)) return;

  try {
    const inviteCode = await sock.groupInviteCode(m.chat);
    const ownLink = `https://chat.whatsapp.com/${inviteCode}`;
    if (m.text.includes(ownLink)) return;

    await sock.sendMessage(m.chat, {
      delete: { remoteJid: m.chat, fromMe: false, id: m.key.id, participant: m.sender },
    });
    console.log(`[ANTILINK] Hapus pesan dari ${m.sender} di grup ${m.chat} — alasan: link grup WA terdeteksi.`);
    await sock.sendMessage(m.chat, { text: `*– 乂 Anti Link Grup –*\nLink grup WhatsApp tidak diperbolehkan di sini!` }, { quoted: m });
  } catch (e) {
    console.error("[ANTILINK GAGAL]", e.message);
  }
  // FIX BUG: sebelumnya gak pernah return true, jadi command TETAP diproses
  // lanjut setelah pesan pelanggaran dihapus (handler.js cuma stop kalau
  // before() return truthy). Sekarang stop total setelah delete.
  return true;
};

handler.command = ["antilink"];
handler.tags = "admin";
handler.help = ["antilink --on", "antilink --off"];
handler.group = true;
handler.admin = true;
handler.botAdmin = true;

module.exports = handler;
