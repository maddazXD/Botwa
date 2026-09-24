// plugins/group/del.js — Hapus pesan siapapun di grup (mode moderasi), pakai
// fitur "revoke" bawaan WhatsApp. Caranya: REPLY ke pesan yang mau dihapus,
// terus ketik .del.
//
// SIAPA YANG BOLEH PAKAI COMMAND INI SAMA SEKALI:
// - Admin grup, ATAU
// - Owner bot (m.isOwner — otomatis true juga kalau yang connect adalah
//   nomor bot sendiri, karena m.isOwner dihitung dari m.sender == m.botNumber
//   di lib/serialize.js, jadi "nomor bot" gak perlu dicek terpisah, udah
//   otomatis kebagian lewat isOwner).
// FIX BUG: sebelumnya SAMA SEKALI GAK ADA pengecekan siapa yang boleh manggil
// command ini — member biasa pun bisa ngetik .del bebas. Baru DI DALAM logika
// (buat nentuin apakah butuh bot-admin atau nggak) ada cek isAdmin, tapi itu
// cuma berlaku kalau targetnya BUKAN pesan bot sendiri. Sekarang syarat
// "siapa yang boleh pakai command ini" dicek DULU, di awal, terpisah dari
// logika "apakah bot butuh jadi admin".
//
// APAKAH BOT PERLU JADI ADMIN DULU (beda syarat, jangan disamain):
// - Hapus pesan ORANG LAIN (bukan bot sendiri): BOT WAJIB admin — ini aturan
//   WhatsApp sendiri (server WA nolak request hapus pesan orang lain kalau
//   pengirimnya bukan admin), bukan batasan yang bot ini buat sendiri.
// - Hapus pesan BOT SENDIRI: bot TIDAK PERLU jadi admin sama sekali (WhatsApp
//   selalu izinkan siapapun/apapun hapus pesannya sendiri, gak ada syarat
//   admin buat itu) — makanya blok pengecekan isBotAdmin di bawah cuma
//   jalan kalau isOwnMessage === false.
const { usage, ok, fail } = require("../../lib/theme");

let handler = async (m, { sock, isAdmin, isBotAdmin, isOwner }) => {
  if (!isAdmin && !isOwner) {
    return m.reply(fail("Command ini cuma bisa dipakai admin grup atau owner bot."));
  }

  if (!m.quoted) {
    return m.reply(
      usage(`${m.cmd}`, `Reply pesan yang mau dihapus, terus ketik ${m.cmd}`)
    );
  }

  const isOwnMessage = !!m.quoted.fromMe;

  // Syarat BOT WAJIB ADMIN cuma berlaku buat hapus pesan ORANG LAIN — bukan
  // syarat tambahan buat "siapa yang boleh pakai command", itu udah dicek di
  // atas. Ini murni soal batasan teknis WhatsApp: hapus pesan sendiri gak
  // butuh admin sama sekali, jadi gak perlu dicek isBotAdmin kalau
  // isOwnMessage true.
  if (!isOwnMessage && !isBotAdmin) {
    return m.reply(fail("Bot harus jadi admin dulu di grup ini buat bisa hapus pesan orang lain."));
  }

  try {
    await sock.sendMessage(m.chat, {
      delete: {
        remoteJid: m.chat,
        fromMe: isOwnMessage,
        id: m.quoted.id,
        ...(isOwnMessage ? {} : { participant: m.quoted.sender }),
      },
    });
    await m.react("🗑️");
  } catch (err) {
    console.error("[DEL GAGAL]", err?.message || err);
    m.reply(fail("Gagal hapus pesan: " + (err?.message || "error tidak diketahui")));
  }
};

handler.help = "del (reply pesan yang mau dihapus)";
handler.command = ["del", "delete", "hapus"];
handler.tags = "admin";
handler.group = true;

module.exports = handler;
