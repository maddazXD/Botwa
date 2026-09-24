// lib/resolveTarget.js — Helper bersama buat ambil JID member target dari
// 3 kemungkinan sumber: reply pesan / tag @member / nomor mentah di teks.
// Dipakai plugins/group/mute.js, unmute.js, kick.js, warn.js, unwarn.js —
// disatuin di sini biar behaviour-nya KONSISTEN di semua command yang
// nargetin member (bukan diduplikasi & berisiko beda logic tiap file).
//
// Prioritas: reply > tag > nomor mentah. Reply diprioritaskan duluan
// karena kalau orang reply SEKALIGUS nulis argumen lain di teks (misal
// durasi mute, atau alasan warn), argumen teks itu HARUS dianggap bukan
// nomor — jadi harus dicek reply/tag dulu sebelum coba parse args[0]
// sebagai nomor.
//
// Nomor mentah di-toLid() dulu sebelum dipakai — WAJIB, karena m.sender/
// m.mentionedJid di bot ini semua udah dalam bentuk LID (@lid), bukan PN
// (@s.whatsapp.net). Kalau dibiarkan format PN, perbandingan JID di tempat
// lain (misal cek "siapa yang lagi kena mute/warn") bakal SELALU GAGAL
// walau itu orang yang sama — kelas bug yang sama persis kayak yang pernah
// ketemu di del.js (m.quoted.fromMe sebelum di-toLid-in).
//
// restArgsStartIndex: index argumen SETELAH target buat dipakai command
// pemanggil (misal durasi di .mute, alasan di .warn) — beda-beda tergantung
// target diambil dari reply (semua args dianggap sisa) vs tag/nomor (geser
// 1 index karena args[0] "dipakai" buat target).
async function resolveTarget(m, sock, args) {
  if (m.quoted?.sender) {
    return { targetJid: m.quoted.sender, restArgsStartIndex: 0 };
  }
  if (m.mentionedJid?.length) {
    return { targetJid: m.mentionedJid[0], restArgsStartIndex: 1 };
  }
  const first = args[0] || "";
  const digitsOnly = first.replace(/[^0-9]/g, "");
  if (/^\d{6,}$/.test(digitsOnly)) {
    const rawJid = `${digitsOnly}@s.whatsapp.net`;
    const targetJid = await sock.toLid(rawJid);
    return { targetJid, restArgsStartIndex: 1 };
  }
  return { targetJid: null, restArgsStartIndex: 0 };
}

module.exports = { resolveTarget };
