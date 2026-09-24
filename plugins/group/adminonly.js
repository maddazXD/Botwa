// plugins/group/adminonly.js — Mode grup: kalau ON, cuma admin yang boleh chat
// (member biasa pesannya bakal dihapus otomatis). Toggle-nya sama persis kayak
// Anya; enforcement hapus-pesan saya tambahin karena di source aslinya cuma
// nyimpen status doang tanpa efek apa-apa.
const { footer } = require("../../lib/theme");

let handler = async (m, { args, isAdmin, isOwner }) => {
  if (!m.isGroup) return m.reply("❌ Fitur ini hanya untuk grup!");
  if (!isAdmin && !isOwner) return m.reply("🚫 Khusus admin grup!");

  const chat = (global.db.groups[m.chat] ||= {});
  const input = (args[0] || "").toLowerCase();

  if (!input) {
    return m.reply(`🛡️ *Admin Only Settings*\n\nStatus: ${chat.adminOnly ? "ON ✅" : "OFF ❌"}\n\nGunakan:\n• .adminonly on\n• .adminonly off`);
  }
  if (input === "on") { chat.adminOnly = true; return m.reply("✅ AdminOnly berhasil diaktifkan" + footer()); }
  if (input === "off") { chat.adminOnly = false; return m.reply("❌ AdminOnly berhasil dimatikan" + footer()); }
  return m.reply("⚠️ Gunakan *on* atau *off*");
};

handler.before = async (m, { sock, isAdmin, isOwner, isBotAdmin }) => {
  // FIX BUG: dulu cuma exempt isAdmin, owner yang kebetulan bukan WA-admin
  // di grup itu ikut kena hapus pesannya sendiri.
  if (!m.isGroup || isAdmin || isOwner) return;
  const chat = global.db.groups?.[m.chat];
  if (!chat?.adminOnly) return;
  // FIX BUG: sebelumnya `!isBotAdmin` ikut jadi syarat exempt di atas, jadi
  // kalau bot BUKAN admin grup, seluruh blokir ke-skip total (return kosong)
  // dan command member biasa tetap diproses seperti biasa. Padahal hak admin
  // cuma dibutuhkan buat aksi hapus pesan, bukan buat blokir command-nya.
  // Sekarang: blokir command tetap jalan walau bot bukan admin; hapus pesan
  // cuma dicoba kalau bot memang admin (karena WA nolak hapus pesan orang
  // lain kalau bot bukan admin).
  if (isBotAdmin) {
    try {
      await sock.sendMessage(m.chat, {
        delete: { remoteJid: m.chat, fromMe: false, id: m.key.id, participant: m.sender },
      });
    } catch (e) {}
  }
  return true;
};

handler.command = ["adminonly"];
handler.tags = "admin";
handler.help = ["adminonly"];
handler.group = true;

module.exports = handler;
