// plugins/group/hidetag.js — Tag semua member grup tanpa nongol daftar mention.
// Command "tag" itu ALIAS persis buat "hidetag" — sama plek, bukan behavior
// beda kayak .tagall (yang nampilin daftar @member-nya).
//
// Dua mode kirim, tergantung siapa yang manggil command-nya:
//
// 1. DARI NOMOR BOT SENDIRI (self-bot, m.fromMe === true): pesan command
//    aslinya (".tag halo"/".hidetag halo") DIHAPUS, terus dikirim pesan
//    BARU berisi teks tag-nya. Hasil akhirnya: command-nya gak nyisa sama
//    sekali di chat (kayak "berubah wujud" jadi pesan tag).
//    CATATAN: sebelumnya sempet dicoba pake fitur EDIT pesan bawaan WA
//    (biar gak ada acara hapus segala) — TAPI ternyata WhatsApp gak
//    nge-notif/nge-tag beneran buat pesan yang cuma di-EDIT, walau data
//    mentionedJid-nya udah bener dikirim (edit dianggep WA sebagai
//    "koreksi teks diam-diam", bukan event pesan baru yang men-trigger
//    mention). Makanya diganti ke hapus+kirim-baru, biar itu BENERAN event
//    pesan baru yang notif/tag-nya jalan normal.
//
// 2. BUKAN dari nomor bot sendiri (admin lain make command dari nomor
//    mereka sendiri): WA gak ngizinin bot HAPUS pesan orang lain seenaknya
//    di sini (lagipula gak perlu), jadi langsung kirim PESAN BARU aja,
//    TANPA di-quote/reply ke pesan command aslinya — biar teks
//    ".tag"/".hidetag ..."-nya gak nongol di reply-preview nempel ke pesan
//    tag-nya.
const { getBaileys } = require("../../lib/baileysLoader");

let handler = async (m, { sock, text }) => {
  const { generateWAMessageFromContent, proto } = await getBaileys();
  const participants = m.metadata?.participants || [];
  const mentions = participants.map((p) => p.id || p.jid).filter(Boolean);

  const teks = text || m.quoted?.text || m.quoted?.caption || "";
  if (!teks) return m.reply("Masukin teksnya atau reply pesan yang mau di-tag!");

  if (m.fromMe) {
    // Mode 1: hapus pesan command aslinya, terus kirim pesan baru.
    try {
      await sock.sendMessage(m.chat, {
        delete: { remoteJid: m.chat, fromMe: true, id: m.key.id },
      });
    } catch (e) {
      console.error("[HIDETAG] Gagal hapus pesan command:", e?.message || e);
      // Gagal hapus bukan alasan buat batal ngetag — lanjut aja kirim pesan tag-nya.
    }
  }

  // Kirim pesan tag-nya — SELALU lewat jalur kirim-baru (bukan edit), biar
  // notif/tag-nya beneran jalan. Gak di-quote ke pesan command aslinya.
  const msg = generateWAMessageFromContent(
    m.chat,
    { extendedTextMessage: proto.Message.ExtendedTextMessage.fromObject({ text: teks, contextInfo: { mentionedJid: mentions } }) },
    {}
  );
  await sock.relayMessage(m.chat, msg.message, { messageId: msg.key.id });
};

handler.command = ["hidetag", "h", "tag"];
handler.tags = "admin";
handler.help = ["hidetag <teks>", "tag <teks>"];
handler.admin = true;
handler.group = true;

module.exports = handler;
