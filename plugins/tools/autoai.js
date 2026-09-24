// plugins/tools/autoai.js — Mode "ngobrol langsung sama AI", GLOBAL tapi
// DIPISAH jadi 2 saklar independen:
//   /autoai on|off    -> khusus buat CHAT PRIBADI (PC) di SEMUA chat pribadi
//   /autoaigb on|off  -> khusus buat GRUP di SEMUA grup
// Dua-duanya bisa nyala/mati sendiri-sendiri (misal cuma di grup doang, atau
// cuma di PC doang, atau dua-duanya). Kalau salah satunya ON, SEMUA pesan
// (teks ATAU gambar, yang BUKAN command bot) di kategori chat itu otomatis
// dijawab AI — jadi kayak chat biasa, gak perlu ketik ".vai" tiap mau nanya.
// AI-nya lewat lib/aiRouter.js yang nyoba beberapa backend berurutan
// (JazeChat -> AskMe -> Andaraz/Gemini asli), fallback otomatis kalau salah
// satu gagal/down. Lihat komentar lengkap urutan & alasannya di
// lib/aiRouter.js.
//
// Toggle-nya disimpen di global.db.settings.autoaiPC & .autoaiGroup (lihat
// lib/configDatabase.js buat default init-nya) — nempel walau bot di-restart.
//
// SIAPA YANG BOLEH NGATUR ON/OFF: cuma OWNER bot, di PC maupun grup.
//
// SIAPA YANG BISA DIJAWAB AI (pas kategorinya lagi ON): siapa aja, di chat
// itu — KECUALI kalau bot lagi mode "self" (toggle lewat command /self atau
// /public, lihat plugins/owner/self.js): mode self OVERRIDE saklar
// autoaiPC — walau autoaiPC lagi ON, chat pribadi TETEP gak dijawab AI sama
// sekali selama mode self (lihat handler.before di bawah). Saklar
// autoaiGroup gak kena pengaruh mode self.
const { getMediaSource } = require("../../lib/mediaHelper");
const { askText, askImage } = require("../../lib/aiRouter");
const { footer } = require("../../lib/theme");

let handler = async (m, { args, isOwner, command }) => {
  // Owner-only, berlaku sama di PC MAUPUN grup.
  if (!isOwner) {
    return m.reply("👑 Cuma owner bot yang bisa ngatur Auto AI.");
  }

  const o = (args[0] || "").toLowerCase();
  if (!["on", "off"].includes(o)) {
    return m.reply(`⚠️ Format salah!\n\n${m.cmd} on\n${m.cmd} off`);
  }

  if (!global.db.settings) global.db.settings = {};
  const isGroupCmd = command === "autoaigb";
  const settingKey = isGroupCmd ? "autoaiGroup" : "autoaiPC";
  const label = isGroupCmd ? "SEMUA grup" : "SEMUA chat pribadi";

  if (o === "on") {
    global.db.settings[settingKey] = true;
    m.reply(
      `✅ *Auto AI diaktifkan* untuk ${label}.\n\nSemua pesan (bukan command) di kategori chat itu bakal otomatis dijawab AI. Ketik \`${m.cmd} off\` buat matiin.` +
        footer()
    );
  } else {
    global.db.settings[settingKey] = false;
    m.reply(`❌ Auto AI dinonaktifkan untuk ${label}.` + footer());
  }
};

handler.before = async (m, { sock, isOwner }) => {
  // Jangan proses pesan dari bot sendiri (hindari nge-reply ke reply-nya
  // sendiri -> looping gak berkesudahan).
  if (m.fromMe) return;

  // PENTING: pakai m.body, BUKAN m.text. m.text KEPOLUSI di handler.js
  // (baris `m.text = text`, dengan `text` = args.join(" ")) — itu artinya
  // buat pesan BIASA (bukan command) m.text selalu jadi STRING KOSONG (bikin
  // Auto AI gak pernah jawab pesan biasa sama sekali), dan buat pesan yang
  // MEMANG command (misal "/autoai on") m.text cuma keisi ARGS-nya doang
  // ("on"), tanpa prefix/nama command, jadi pengecekan isCmd di bawah bakal
  // gagal ngenalin itu sebagai command dan malah dikirim ke AI sebagai
  // prompt. m.body gak pernah disentuh setelah di-set sekali di
  // lib/serialize.js, jadi aman dipakai di sini buat DUA-duanya (cek command
  // & ambil isi pesan).
  const raw = (m.body || "").trim();

  // Ada gambar (dikirim langsung ATAU di-reply)? Kalau gambar tanpa caption
  // sama sekali, tetep diproses (raw bakal kosong, tapi imgSource ada) — beda
  // sama sebelumnya yang langsung skip kalau raw kosong. Kalau dua-duanya
  // kosong (gak ada teks ATAU gambar), baru bener-bener di-skip.
  const mediaSource = getMediaSource(m);
  const imgSource = mediaSource && mediaSource.mtype === "imageMessage" ? mediaSource : null;
  if (!raw && !imgSource) return;

  // Sleep Mode (lihat plugins/owner/sleepmode.js) tetep harus dihormatin —
  // kalau bot lagi "tidur" buat non-owner, Auto AI juga ikut diem, jangan
  // sampe malah balesin chat padahal fitur lain lagi dikunci semua.
  if (global.sleepMode && !isOwner) return;

  // Command asli (yang emang diawali prefix) TETEP diproses normal lewat
  // jalur command dispatch biasa di handler.js — Auto AI cuma nyangkut
  // pesan teks BIASA (bukan command), biar `.vai`, `.menu`, dst (termasuk
  // `.autoai off` / `.autoaigb off` buat matiin) tetep jalan seperti biasa
  // walau Auto AI lagi ON. Kalau raw kosong (gambar doang tanpa caption),
  // gak mungkin ini command, jadi pengecekan ini di-skip aman-aman aja.
  if (raw) {
    const prefix = m.prefix || global.prefix || /^[./#!]/;
    const isCmd = typeof prefix === "string" ? raw.startsWith(prefix) : prefix.test(raw);
    if (isCmd) return;
  }

  // Saklar sesuai kategori chat-nya masing-masing — grup pakai autoaiGroup,
  // chat pribadi pakai autoaiPC. Independen, gak saling ganggu.
  if (m.isGroup) {
    if (!global.db.settings?.autoaiGroup) return;
  } else {
    if (!global.db.settings?.autoaiPC) return;

    // Mode SELF (di-toggle lewat command /self atau /public, lihat
    // plugins/owner/self.js — TOGGLE-nya ngubah sock.public) OVERRIDE
    // saklar autoaiPC: bot ceritanya "punya sendiri" pas mode self, jadi
    // chat pribadi (PC) SENGAJA gak dijawab AI sama sekali walau autoaiPC
    // lagi ON. Ini berlaku ke SEMUA orang, termasuk owner sendiri — kalau
    // mode public, gak ada override ini. Saklar autoaiGroup gak kena
    // pengaruh ini sama sekali.
    if (!sock.public) return;
  }

  try {
    await sock.sendPresenceUpdate("composing", m.chat).catch(() => {});

    if (imgSource) {
      const buffer = await imgSource.download();
      if (buffer?.length) {
        const { answer } = await askImage(m.chat, raw, buffer, imgSource.mimetype);
        await sock.sendMessage(m.chat, { text: answer }, { quoted: m });
      }
    } else {
      const { answer } = await askText(m.chat, raw);
      await sock.sendMessage(m.chat, { text: answer }, { quoted: m });
    }
  } catch (e) {
    console.error("[AUTOAI GAGAL TOTAL]", e.message);
    // Sengaja gak kirim pesan error ke chat — kalau lagi rame/API lagi
    // bermasalah, mending diem daripada spam pesan gagal tiap orang ngetik.
  }

  // Stop di sini — pesan ini udah "dijawab" sama AI, jangan lanjut diproses
  // lebih jauh (before-hook lain / command dispatch) buat pesan yang sama.
  return true;
};

handler.command = ["autoai", "autoaigb"];
handler.tags = ["tools"];
handler.help = [
  "autoai on|off (owner-only: Auto AI di SEMUA chat pribadi)",
  "autoaigb on|off (owner-only: Auto AI di SEMUA grup)",
];

module.exports = handler;
