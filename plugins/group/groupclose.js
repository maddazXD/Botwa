// plugins/group/groupclose.js — Buka/tutup grup pakai fitur BAWAAN WhatsApp
// ("Only admins can send messages" / grup setting `announcement`), BUKAN
// hapus-pesan manual.
//
// KENAPA DIGANTI dari pendekatan lama (adminonly.js: hapus pesan member
// satu-satu): itu butuh bot jadi admin grup DAN nge-detect+hapus tiap
// pesan yang masuk dulu (baru terhapus SETELAH sempat terkirim — telat &
// boros resource). Fitur bawaan WA ini jauh lebih baik: begitu grup
// di-set "announcement", WhatsApp SENDIRI yang nolak member biasa ngirim
// pesan dari sisi client — gak akan pernah kekirim sama sekali, bot juga
// gak perlu terus-terusan mantau & hapus.
//
// CATATAN: bot TETAP harus jadi admin grup biar bisa ngubah setting ini
// (sama seperti requirement fitur adminonly versi lama).
const { footer } = require("../../lib/theme");

let handler = async (m, { sock, args, command, prefix, isAdmin, isOwner }) => {
  if (!m.isGroup) return m.reply("❌ Fitur ini hanya untuk grup!");
  if (!isAdmin && !isOwner) return m.reply("🚫 Khusus admin grup!");

  // SIMPLIFIKASI: command "close"/"open" langsung (m.cmd) sekarang jadi cara
  // utama pakai fitur ini — gak perlu lagi ".groupclose close"/".groupclose
  // open" yang kepanjangan, cukup ".close"/".open" aja (udah jelas ini
  // fitur grup dari kategorinya). "groupclose"/"closegroup"/"lockgroup"
  // masih dipertahankan sebagai alias lama biar gak break kebiasaan lama —
  // command itu tetep pakai args[0] (close/open) seperti sebelumnya.
  const directCommand = command === "close" || command === "open" ? command : null;
  const input = directCommand || (args[0] || "").toLowerCase();

  if (!input) {
    const meta = await sock.groupMetadata(m.chat).catch(() => null);
    const isClosed = !!meta?.announce;
    return m.reply(
      `🔒 *Status Grup*\n\n` +
      `Status: ${isClosed ? "Ditutup 🔒 (hanya admin bisa kirim pesan)" : "Terbuka 🔓 (semua bisa kirim pesan)"}\n\n` +
      `Gunakan:\n• ${prefix}close — tutup grup\n• ${prefix}open — buka grup`
    );
  }

  try {
    if (input === "close" || input === "tutup") {
      await sock.groupSettingUpdate(m.chat, "announcement");
      return m.reply("🔒 Grup berhasil ditutup — hanya admin yang bisa kirim pesan." + footer());
    }
    if (input === "open" || input === "buka") {
      await sock.groupSettingUpdate(m.chat, "not_announcement");
      return m.reply("🔓 Grup berhasil dibuka — semua member bisa kirim pesan lagi." + footer());
    }
    return m.reply(`⚠️ Gunakan *close/tutup* atau *open/buka*\nContoh: ${m.cmd} close`);
  } catch (e) {
    console.error("[GROUPCLOSE GAGAL]", e.message);
    m.reply("❌ Gagal mengubah setting grup — pastikan bot adalah admin grup ini.\n" + e.message);
  }
};

handler.tags = ["group"];
handler.help = ["close", "open"];
handler.command = ["close", "open", "groupclose", "closegroup", "lockgroup"];

module.exports = handler;
