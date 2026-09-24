// plugins/owner/rvoown.js — buka pesan "Lihat Sekali" (foto/video/voice note)
// yang di-reply, kirim hasilnya ke CHAT PRIBADI OWNER YANG MANGGIL command ini
// (m.sender) — BUKAN selalu ke global.owner (nomor owner utama/pertama).
// Kalau ada lebih dari satu owner (global.db.settings.owner), hasilnya ke DM
// owner yang beneran ngetik command ini, bukan owner lain.
// KHUSUS OWNER (handler.owner = true) — masuk akal cuma buat owner, soalnya
// "kirim ke owner yang manggil" gak ada artinya kalau bukan owner yang manggil.
// Versi yang kirim ke chat/grup itu sendiri (bisa dipake admin) ada di
// plugins/owner/rvo.js.
const { usage, ok, fail } = require("../../lib/theme");
const { openAndSend } = require("../../lib/viewOnceExtract");

let handler = async (m, { sock, prefix, command }) => {
  if (!m.quoted) {
    return m.reply(usage(`Reply pesan "Lihat sekali" (foto/video/voice note), terus ketik ${prefix}${command}`, `${prefix}${command}`));
  }

  try {
    const result = await openAndSend(m, sock, m.sender);
    if (!result.ok) {
      if (result.reason === "not-viewonce") {
        return m.reply(fail("Pesan yang di-reply itu bukan pesan \"Lihat sekali\" (view once)."));
      }
      return m.reply(fail(`Tipe media "${result.dlType || "?"}" belum didukung.`));
    }
    // Kalau yang manggil lagi di DM sendiri, gak perlu reply konfirmasi lagi
    // (medianya udah langsung muncul di situ juga). Kalau manggilnya dari
    // grup, kasih tau biar jelas hasilnya "kabur" ke DM, bukan ilang.
    if (m.chat !== m.sender) {
      await m.reply(ok("Berhasil dibuka! Isinya udah dikirim ke chat pribadi kamu."));
    }
  } catch (err) {
    console.error("[RVOOWN GAGAL]", err?.message || err);
    m.reply(fail("Gagal buka pesan sekali lihat ini. Mungkin medianya udah expired/kehapus di server WhatsApp."));
  }
};

handler.command = ["rvoown"];
handler.help = ["rvoown (reply pesan \"Lihat sekali\" — buka & kirim ke DM kamu sendiri)"];
handler.tags = ["owner"];
handler.owner = true;

module.exports = handler;
