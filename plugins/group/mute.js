// plugins/group/mute.js — Mute member tertentu di grup (bukan mute bot
// secara keseluruhan — itu udah ada di .bangc/.unbangc, beda konsep).
// Member yang di-mute pesannya bakal DIHAPUS OTOMATIS setiap kali dia
// ngirim apa pun, sampai di-unmute manual ATAU durasinya abis (kalau pakai
// durasi). WhatsApp sendiri gak punya fitur native "mute 1 orang" di level
// API grup (beda dari Telegram/Discord yang emang punya restrict-member),
// jadi cara paling realistis buat bot pihak ketiga: auto-hapus pesannya,
// pola yang sama kayak plugins/group/adminonly.js (yang auto-hapus pesan
// non-admin), cuma di sini targetnya per-JID spesifik, bukan semua non-admin.
//
// CARA TARGET MEMBER (3 cara, bisa pilih salah satu):
// 1. Tag: .mute @628xxx
// 2. Nomor langsung: .mute 628xxx
// 3. Reply pesan member: .mute (sambil reply pesan dia)
//
// DURASI (opsional, taruh di akhir argumen):
// .mute @628xxx          -> permanen (default kalau gak ada durasi)
// .mute @628xxx 1m       -> 1 menit
// .mute @628xxx 2h       -> 2 jam
// .mute @628xxx 3d       -> 3 hari
// Format durasi & parsingnya ada di lib/parseDuration.js (biar reusable).
const { ok, fail, usage, warn } = require("../../lib/theme");
const { parseDuration, formatRemaining } = require("../../lib/parseDuration");
const { resolveTarget } = require("../../lib/resolveTarget");

let handler = async (m, { sock, args, isAdmin, isOwner, isBotAdmin }) => {
  if (!m.isGroup) return m.reply(fail("Fitur ini cuma bisa dipakai di grup."));
  if (!isAdmin && !isOwner) return m.reply(fail("Cuma admin grup atau owner yang boleh mute member."));

  const { targetJid, restArgsStartIndex } = await resolveTarget(m, sock, args);
  const durationArg = args[restArgsStartIndex];
  if (!targetJid) {
    return m.reply(
      usage(
        `${m.cmd} @member [durasi]`,
        `${m.cmd} @628xxx 1h  (mute 1 jam)\n${m.cmd} @628xxx  (mute permanen)\natau reply pesan membernya + ${m.cmd} 1d`
      )
    );
  }

  // Gak boleh mute diri sendiri / bot / owner — biar gak kejadian aneh
  // (misal salah pencet terus bot mute pemiliknya sendiri).
  if (targetJid === m.sender) return m.reply(fail("Gak bisa mute diri sendiri."));
  if (targetJid === m.botNumber) return m.reply(fail("Gak bisa mute bot sendiri."));

  // Cek target itu admin grup juga atau bukan — sesama admin gak boleh
  // saling mute (biar gak disalahgunakan buat perang antar-admin), kecuali
  // yang manggil adalah owner (owner selalu boleh mute siapa aja).
  const participants = m.metadata?.participants || [];
  const targetParticipant = participants.find((p) => (p.id || p.jid) === targetJid);
  const targetIsAdmin = targetParticipant && targetParticipant.admin !== null;
  if (targetIsAdmin && !isOwner) {
    return m.reply(fail("Gak bisa mute sesama admin grup (kecuali kamu owner bot)."));
  }

  let expiresAt = null; // null = permanen
  let durationLabel = "permanen";
  if (durationArg) {
    const parsed = parseDuration(durationArg);
    if (!parsed) {
      return m.reply(fail(`Format durasi "${durationArg}" gak valid. Contoh yang benar: 1m, 2h, 3d (m=menit, h=jam, d=hari).`));
    }
    expiresAt = Date.now() + parsed.ms;
    durationLabel = parsed.label;
  }

  const chat = (global.db.groups[m.chat] ||= {});
  chat.mutedMembers ||= {};
  chat.mutedMembers[targetJid] = { mutedBy: m.sender, mutedAt: Date.now(), expiresAt };

  const targetTag = `@${targetJid.split("@")[0]}`;
  return sock.sendMessage(m.chat, {
    text: ok(`${targetTag} berhasil di-mute (${durationLabel}).\nSetiap pesan dari dia bakal otomatis dihapus${isBotAdmin ? "" : "\n\n⚠️ Bot belum admin — pesan gak akan otomatis kehapus sampai bot dijadiin admin."}.`),
    mentions: [targetJid],
  }, { quoted: m });
};

// FIX-PROOF: enforcement-nya di handler.before, pola yang sama kayak
// plugins/group/adminonly.js — return true buat stop command lain diproses
// lanjut setelah pesan pelanggaran dihapus (lihat catatan panjang soal ini
// di adminonly.js/antilink.js dkk, bug yang sama pernah ada di situ).
handler.before = async (m, { sock, isBotAdmin }) => {
  if (!m.isGroup || !isBotAdmin) return;
  const chat = global.db.groups?.[m.chat];
  const muted = chat?.mutedMembers?.[m.sender];
  if (!muted) return;

  // Kalau ada durasi dan udah lewat, otomatis un-mute (bersihin entry-nya)
  // alih-alih terus ngecek/hapus pesan padahal harusnya udah bebas.
  if (muted.expiresAt && Date.now() >= muted.expiresAt) {
    delete chat.mutedMembers[m.sender];
    return;
  }

  try {
    await sock.sendMessage(m.chat, {
      delete: { remoteJid: m.chat, fromMe: false, id: m.key.id, participant: m.sender },
    });
    // LOG DIAGNOSTIK: ini SATU-SATUNYA fitur yang hapus pesan TANPA peduli
    // isinya (command ataupun chat biasa) — jadi kalau ada laporan "semua
    // pesan dari member ini kehapus, apapun isinya", cek log ini duluan.
    // Mute permanen (gak ada expiresAt) NEMPEL TERUS sampai di-.unmute
    // manual, gak ke-reset walau mode bot (public/self/adminonly) diganti —
    // dua fitur ini sengaja independen satu sama lain.
    console.log(`[MUTE] Hapus pesan dari ${m.sender} di grup ${m.chat} — sedang di-mute (permanen: ${!muted.expiresAt}).`);
  } catch (e) {}
  return true;
};

handler.command = ["mute"];
handler.tags = "admin";
handler.help = ["mute @member [durasi]", "mute (reply pesan) [durasi]"];
handler.group = true;
handler.admin = true;

module.exports = handler;
