// plugins/group/kickall.js — Kick MASSAL semua member biasa di grup sekaligus
// (admin & bot bot dikecualikan otomatis, gak diapa-apain). Beda sama .kick
// yang cuma nendang 1 target spesifik.
const { ok, fail } = require("../../lib/theme");

// Kick banyak orang sekaligus dalam SATU panggilan groupParticipantsUpdate
// sering gagal/partial di WhatsApp (rate limit) — jadi dipecah per BATCH
// kecil + jeda antar batch, biar lebih reliable buat grup gede.
const BATCH_SIZE = 15;
const DELAY_BETWEEN_BATCH_MS = 2000;

let handler = async (m, { sock, isAdmin, isOwner, isBotAdmin }) => {
  if (!m.isGroup) return m.reply(fail("Fitur ini cuma bisa dipakai di grup."));
  if (!isAdmin && !isOwner) return m.reply(fail("Cuma admin grup atau owner yang boleh kick massal."));
  if (!isBotAdmin) return m.reply(fail("Bot harus jadi admin dulu buat bisa kick member (aturan WhatsApp)."));

  const participants = m.metadata?.participants || [];

  // Target: SEMUA member biasa (admin === null artinya bukan admin, sesuai
  // konvensi Baileys — dipake juga di plugins/group/kick.js). Admin & bot
  // sendiri DIKECUALIKAN dari target, juga si pengirim command (jaga-jaga
  // kalau ownernya kebetulan gak admin di grup itu tapi tetep bisa jalanin
  // command ini lewat bypass owner).
  const targets = participants
    .filter((p) => p.admin === null)
    .map((p) => p.id || p.jid)
    .filter((jid) => jid && jid !== m.botNumber && jid !== m.sender);

  if (targets.length === 0) {
    return m.reply(fail("Gak ada member biasa buat dikick (semua peserta grup ini udah admin, atau grupnya emang cuma isi admin/bot)."));
  }

  await m.reply(`⏳ Mengeluarkan ${targets.length} member dari grup...`);

  let successCount = 0;
  let failCount = 0;
  for (let i = 0; i < targets.length; i += BATCH_SIZE) {
    const batch = targets.slice(i, i + BATCH_SIZE);
    try {
      await sock.groupParticipantsUpdate(m.chat, batch, "remove");
      successCount += batch.length;
    } catch (err) {
      console.error("[KICKALL GAGAL BATCH]", err?.message || err);
      failCount += batch.length;
    }
    if (i + BATCH_SIZE < targets.length) {
      await new Promise((r) => setTimeout(r, DELAY_BETWEEN_BATCH_MS));
    }
  }

  return m.reply(
    ok(
      `Kick massal selesai.\n\n✅ Berhasil: ${successCount} member${
        failCount > 0 ? `\n❌ Gagal: ${failCount} member (kemungkinan kena rate limit WhatsApp, coba jalanin lagi kalau masih ada sisa)` : ""
      }\n👑 Admin & bot gak diganggu.`
    )
  );
};

handler.command = ["kickall", "tendangsemua"];
handler.tags = "admin";
handler.help = ["kickall (kick semua member biasa sekaligus — admin & bot aman)"];
handler.group = true;
handler.admin = true;
handler.botAdmin = true;

module.exports = handler;
