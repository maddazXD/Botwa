// plugins/owner/sleepmode.js — Mode tidur bot: kalau ON, cuma owner yang bisa pakai fitur
//
// CATATAN: BEDA sama .self/.autotyping/.statusbot yang sekarang di-persist
// ke database (biar nempel walau restart) — sleepMode SENGAJA DIBIARIN
// cuma di memori (gak disimpen ke db.settings). Alasannya: sleepMode ini
// state SEMENTARA yang jalan bareng timer (`global.sleepTimer`,
// setTimeout). Timer JS itu ilang total kalau proses Node di-restart —
// jadi kalau sleepMode="true" dipersist tapi timernya gak (gak mungkin,
// setTimeout gak bisa disimpen ke disk), bot bisa nyangkut permanen di
// mode "tidur" abis restart, padahal harusnya cuma tidur sementara.
// Restart proses = anggep aja "bot dibangunin", itu perilaku yang wajar
// buat state sementara kayak gini.
let handler = async (m, { args }) => {
  if (!args[0]) {
    return m.reply(`*Format salah!*\n\nGunakan format:\n${m.cmd} on [durasi]\n${m.cmd} off\n\n*Contoh:*\n${m.cmd} on (permanen)\n${m.cmd} on 30m (30 menit)\n${m.cmd} on 2h (2 jam)`);
  }

  const action = args[0].toLowerCase();

  if (action === "on") {
    global.sleepMode = true;
    if (args[1]) {
      const time = parseInt(args[1]);
      const unit = args[1].replace(/[0-9]/g, "").toLowerCase();
      let durationInMs = 0;
      if (unit === "h" || unit === "jam") durationInMs = time * 60 * 60 * 1000;
      else if (unit === "m" || unit === "menit" || unit === "") durationInMs = time * 60 * 1000;
      else if (unit === "s" || unit === "detik") durationInMs = time * 1000;
      else return m.reply("❌ Unit waktu tidak valid! Gunakan m (menit) atau h (jam). Contoh: 30m");

      if (isNaN(time) || durationInMs <= 0) return m.reply("❌ Masukkan angka durasi yang benar!");

      if (global.sleepTimer) clearTimeout(global.sleepTimer);
      m.reply(`✅ Sleep Mode diaktifkan di SEMUA GRUP selama ${time}${unit}.\n\nBot akan otomatis bangun setelah durasi habis.`);

      global.sleepTimer = setTimeout(() => {
        global.sleepMode = false;
        delete global.sleepTimer;
      }, durationInMs);
    } else {
      m.reply("✅ Sleep Mode diaktifkan di SEMUA GRUP (tanpa batas waktu).\n\nSemua fitur terkunci di seluruh grup dan chat pribadi kecuali untuk Owner.");
    }
  } else if (action === "off") {
    global.sleepMode = false;
    if (global.sleepTimer) { clearTimeout(global.sleepTimer); delete global.sleepTimer; }
    m.reply("❌ Sleep Mode dinonaktifkan.\n\nBot kembali berjalan normal untuk semua pengguna di semua grup.");
  } else {
    m.reply(`Opsi tidak valid. Gunakan 'on' atau 'off'.\nContoh: ${m.cmd} on 1h`);
  }
};

handler.before = async (m, { isOwner }) => {
  if (typeof global.sleepMode === "undefined") global.sleepMode = false;
  if (global.sleepMode && !isOwner) {
    const prefix = global.prefix || /^[./#!]/;
    const isCommand = m.text && (typeof prefix === "string" ? m.text.startsWith(prefix) : prefix.test(m.text));
    if (isCommand) {
      m.reply("💤 *Bot sedang dalam Sleep Mode*\n\nSaat ini bot sedang istirahat di semua grup. Hanya Owner yang dapat menggunakan fitur bot.");
      return true;
    }
  }
  return false;
};

handler.command = ["sleepmode", "sleep"];
handler.tags = ["owner"];
handler.help = ["sleepmode <on/off> [durasi]"];
handler.owner = true;

module.exports = handler;
