// plugins/group/warn.js — Kasih peringatan ke member. Peringatan disimpen
// per-grup per-member (global.db.groups[chat].warnings[jid] = { count, log }),
// jadi kalau member yang sama pindah grup, hitungannya gak kebawa (masing-
// masing grup independen, sesuai konsep "kesalahan di grup ini").
//
// ATURAN (sesuai yang diminta):
// - Peringatan ke-1, ke-2, ke-3: cuma dicatat & dikasih tau member/grup,
//   gak ada efek tambahan apa pun.
// - Peringatan ke-4 (atau lebih — lihat catatan JUMLAH di bawah): OTOMATIS
//   KICK member itu dari grup, terus counter di-reset ke 0 (biar kalau dia
//   di-add lagi nanti, mulai dari 0 lagi, bukan nyangkut di angka yang
//   bikin dia auto-kick lagi begitu masuk).
// - Admin bisa .unwarn buat ngurangin peringatan (biar keputusan "maafin
//   atau nggak" tetep di tangan admin — bot cuma nyediain tombolnya, bukan
//   maksa apa pun).
//
// JUMLAH (mirror dari .unwarn, biar simetris):
//   .warn @member Spam         -> nambah 1 (default), alasan "Spam"
//   .warn @member 2 Spam berat -> nambah 2 sekaligus, alasan "Spam berat"
// Argumen pertama setelah target dicek: kalau itu ANGKA MURNI, dianggap
// jumlah; sisanya jadi alasan. Kalau bukan angka, semuanya dianggap alasan
// (jumlah default 1) — jadi ".warn @member Spam link" tetap jalan normal
// kayak sebelumnya, gak perlu selalu nulis angka.
const { ok, fail, usage, card, header } = require("../../lib/theme");
const { resolveTarget } = require("../../lib/resolveTarget");

const MAX_WARN = 3; // sampai 3x masih "aman", lewat dari ini auto kick

let handler = async (m, { sock, args, isAdmin, isOwner, isBotAdmin }) => {
  if (!m.isGroup) return m.reply(fail("Fitur ini cuma bisa dipakai di grup."));
  if (!isAdmin && !isOwner) return m.reply(fail("Cuma admin grup atau owner yang boleh warn member."));

  const { targetJid, restArgsStartIndex } = await resolveTarget(m, sock, args);
  if (!targetJid) {
    return m.reply(
      usage(
        `${m.cmd} @member [jumlah] [alasan]`,
        `${m.cmd} @628xxx Spam link\n${m.cmd} @628xxx 2 Spam berat\natau reply pesan membernya + ${m.cmd} Toxic`
      )
    );
  }

  if (targetJid === m.sender) return m.reply(fail("Gak bisa warn diri sendiri."));
  if (targetJid === m.botNumber) return m.reply(fail("Gak bisa warn bot sendiri."));

  const participants = m.metadata?.participants || [];
  const targetParticipant = participants.find((p) => (p.id || p.jid) === targetJid);
  const targetIsAdmin = targetParticipant && targetParticipant.admin !== null;
  if (targetIsAdmin && !isOwner) {
    return m.reply(fail("Gak bisa warn sesama admin grup (kecuali kamu owner bot)."));
  }

  // Cek argumen pertama setelah target: angka murni = jumlah, sisanya alasan.
  // Bukan angka = semuanya alasan, jumlah default 1.
  const restArgs = args.slice(restArgsStartIndex);
  const maybeAmount = parseInt(restArgs[0], 10);
  const isAmountGiven = Number.isInteger(maybeAmount) && maybeAmount > 0 && String(maybeAmount) === restArgs[0];
  const amount = isAmountGiven ? maybeAmount : 1;
  const reason = (isAmountGiven ? restArgs.slice(1) : restArgs).join(" ").trim() || "-";

  const chat = (global.db.groups[m.chat] ||= {});
  chat.warnings ||= {};
  const record = (chat.warnings[targetJid] ||= { count: 0, log: [] });

  record.count += amount;
  record.log.push({ by: m.sender, reason, amount, at: Date.now() });

  const targetTag = `@${targetJid.split("@")[0]}`;

  // FIX-PROOF: cek strict ">" bukan ">=" biar jelas — begitu total ngelewatin
  // batas 3 (mau nambahnya 1-1-1-1 atau langsung +5 sekaligus), auto-kick
  // ke-trigger. Lompatan besar (misal .warn 5 buat pelanggaran berat) tetap
  // wajar langsung kick, gak perlu nunggu nambah pas ke angka 4 doang.
  if (record.count > MAX_WARN) {
    delete chat.warnings[targetJid]; // reset biar gak nyangkut kalau di-add lagi nanti
    try {
      if (!isBotAdmin) {
        return sock.sendMessage(m.chat, {
          text: fail(`${targetTag} udah ngelewatin batas peringatan (harusnya auto-kick), tapi BOT BELUM ADMIN jadi gak bisa kick otomatis. Kick manual pakai .kick ya.`),
          mentions: [targetJid],
        }, { quoted: m });
      }
      await sock.groupParticipantsUpdate(m.chat, [targetJid], "remove");
      return sock.sendMessage(m.chat, {
        text: fail(`${targetTag} ngelewatin batas peringatan dan otomatis DIKELUARKAN dari grup.\nAlasan terakhir: ${reason}`),
        mentions: [targetJid],
      }, { quoted: m });
    } catch (err) {
      console.error("[WARN AUTO-KICK GAGAL]", err?.message || err);
      return m.reply(fail("Peringatan tercatat, tapi auto-kick gagal: " + (err?.message || "error tidak diketahui")));
    }
  }

  return sock.sendMessage(m.chat, {
    text: ok(`${targetTag} kena peringatan +${amount} (total: ${record.count}/${MAX_WARN}).\nAlasan: ${reason}\n\n${record.count === MAX_WARN ? "⚠️ Ini peringatan terakhir — sekali lagi langsung di-kick otomatis!" : `Sisa kesempatan: ${MAX_WARN - record.count}`}`),
    mentions: [targetJid],
  }, { quoted: m });
};

handler.command = ["warn", "peringatan"];
handler.tags = "admin";
handler.help = ["warn @member [jumlah] [alasan]", "warn (reply pesan) [jumlah] [alasan]"];
handler.group = true;
handler.admin = true;

module.exports = handler;
