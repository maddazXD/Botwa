// plugins/owner/rvo.js — buka pesan "Lihat Sekali" (foto/video/voice note)
// yang di-reply, kirim hasilnya ke CHAT/GRUP ITU SENDIRI (chat yang sama
// tempat command dijalankan). Bisa dipake ADMIN GRUP (handler.admin = true).
// Versi yang kirim ke DM owner ada di plugins/owner/rvoown.js.
const { usage, ok, fail } = require("../../lib/theme");
const { openAndSend } = require("../../lib/viewOnceExtract");

let handler = async (m, { sock, prefix, command }) => {
  if (!m.quoted) {
    return m.reply(usage(`Reply pesan "Lihat sekali" (foto/video/voice note), terus ketik ${prefix}${command}`, `${prefix}${command}`));
  }

  try {
    const result = await openAndSend(m, sock, m.chat);
    if (!result.ok) {
      if (result.reason === "not-viewonce") {
        return m.reply(fail("Pesan yang di-reply itu bukan pesan \"Lihat sekali\" (view once)."));
      }
      return m.reply(fail(`Tipe media "${result.dlType || "?"}" belum didukung.`));
    }
    // Gak perlu reply konfirmasi tambahan — medianya udah langsung muncul di
    // chat ini juga (beda dari .rvoown yang kirimnya ke chat LAIN).
  } catch (err) {
    console.error("[RVO GAGAL]", err?.message || err);
    m.reply(fail("Gagal buka pesan sekali lihat ini. Mungkin medianya udah expired/kehapus di server WhatsApp."));
  }
};

handler.command = ["rvo", "readviewonce"];
handler.help = ["rvo (reply pesan \"Lihat sekali\" — buka & tampilin di chat ini juga)"];
handler.tags = ["admin"];
handler.admin = true;

module.exports = handler;
