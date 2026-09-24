// plugins/group/unwarn.js — Kurangin peringatan member (keputusan admin,
// misal member udah minta maaf/memperbaiki kesalahan). Jumlah yang
// dikurangin bisa diatur lewat argumen:
//   .unwarn @member        -> kurangin 1 (default)
//   .unwarn @member 1      -> kurangin 1
//   .unwarn @member 2      -> kurangin 2
//   .unwarn @member 3      -> kurangin 3
// Sesuai konsep "tergantung mood admin" — kalau cuma mau maafin sebagian
// (misal dari 3 jadi 2), pakai .unwarn tanpa angka atau angka 1. Kalau mau
// langsung bersihin semua, tinggal kasih angka sebesar/lebih dari total
// warn-nya (otomatis di-clamp, gak akan minus).
const { ok, fail, usage } = require("../../lib/theme");
const { resolveTarget } = require("../../lib/resolveTarget");

let handler = async (m, { sock, args, isAdmin, isOwner }) => {
  if (!m.isGroup) return m.reply(fail("Fitur ini cuma bisa dipakai di grup."));
  if (!isAdmin && !isOwner) return m.reply(fail("Cuma admin grup atau owner yang boleh unwarn member."));

  const { targetJid, restArgsStartIndex } = await resolveTarget(m, sock, args);
  if (!targetJid) {
    return m.reply(
      usage(`${m.cmd} @member [jumlah]`, `${m.cmd} @628xxx 2\natau reply pesan membernya + ${m.cmd} 1`)
    );
  }

  const chat = global.db.groups?.[m.chat];
  const record = chat?.warnings?.[targetJid];
  if (!record || record.count <= 0) {
    return m.reply(fail("Member itu emang gak lagi punya peringatan."));
  }

  // Parse jumlah dari argumen — default 1 kalau kosong/gak valid (bukan
  // error, biar ".unwarn" polos tanpa angka tetep jalan kayak biasa).
  // FIX BUG (asimetri sama warn.js): sebelumnya pakai `parseInt(rawAmount)`
  // doang tanpa validasi string-nya MURNI angka — parseInt("2abc") tetap
  // balikin 2 (valid!), jadi ".unwarn @member 2abc" bakal diam-diam
  // dianggap "kurangi 2" padahal itu kemungkinan typo/bukan maksud kasih
  // jumlah. warn.js udah lebih ketat (cek String(angka) === string aslinya),
  // sekarang unwarn.js disamain persis biar dua command ini bener-bener
  // simetris kayak yang diminta — bukan cuma sama-sama nerima argumen
  // angka, tapi juga sama-sama ketat soal APA YANG DIANGGAP angka.
  const rawAmount = args[restArgsStartIndex];
  const maybeAmount = parseInt(rawAmount, 10);
  const isAmountValid = Number.isInteger(maybeAmount) && maybeAmount > 0 && String(maybeAmount) === rawAmount;
  let amount = isAmountValid ? maybeAmount : 1;
  // Clamp biar gak minus — kurangin maksimal sebanyak sisa yang ada.
  amount = Math.min(amount, record.count);

  record.count -= amount;
  record.log.push({ by: m.sender, reason: `(unwarn -${amount})`, at: Date.now(), isUnwarn: true });

  if (record.count <= 0) delete chat.warnings[targetJid];

  const targetTag = `@${targetJid.split("@")[0]}`;
  return sock.sendMessage(m.chat, {
    text: ok(`${amount} peringatan ${targetTag} dihapus. Sisa peringatan sekarang: ${Math.max(0, record.count)}/3.`),
    mentions: [targetJid],
  }, { quoted: m });
};

handler.command = ["unwarn"];
handler.tags = "admin";
handler.help = ["unwarn @member [jumlah]", "unwarn (reply pesan) [jumlah]"];
handler.group = true;
handler.admin = true;

module.exports = handler;
