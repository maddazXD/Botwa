// plugins/owner/self.js — Toggle mode Public / Self / Admin Only
//
// Tiga mode bot:
//   public    — semua orang bisa pakai bot
//   self      — HANYA owner (tidak ada bypass untuk siapapun, termasuk admin grup)
//   adminonly — owner + admin grup bisa pakai; member biasa di-block total
//
// Semua mode disimpan ke global.db.settings.mode (persisted ke disk) DAN
// global.mode di-update langsung — sehingga nempel baik via restart manual
// maupun reconnect otomatis WA (yang memicu ulang startBot() di index.js).
const { ok, card, header, footer } = require("../../lib/theme");

let handler = async (m, { sock, command }) => {
  if (!global.db.settings) global.db.settings = {};

  switch (command) {

    case "public": {
      sock.public      = true;
      global.mode      = "public";
      global.db.settings.mode = "public";
      return m.reply(
        ok("Berhasil beralih ke mode *Public* 🌐\n\n_Semua orang bisa menggunakan bot._")
      );
    }

    case "self": {
      sock.public      = false;
      global.mode      = "self";
      global.db.settings.mode = "self";
      return m.reply(
        ok("Berhasil beralih ke mode *Self* 🔒\n\n_Hanya owner yang bisa menggunakan bot.\nAdmin grup pun tidak bisa bypass mode ini._")
      );
    }

    case "adminonly": {
      // Mode baru: owner + admin grup bisa pakai, member biasa di-block total.
      // Berguna saat bot hanya boleh dipakai oleh pengelola grup, bukan publik.
      sock.public      = false;
      global.mode      = "adminonly";
      global.db.settings.mode = "adminonly";
      return m.reply(
        ok("Berhasil beralih ke mode *Admin Only* 🛡️\n\n_Owner dan admin grup bisa menggunakan bot.\nMember biasa tidak akan direspons sama sekali._")
      );
    }

    default: {
      // Tampilkan status mode saat ini jika command tidak dikenali
      const currentMode = global.mode || global.db?.settings?.mode || "public";
      const modeDesc = {
        public:    "🌐 Public — semua orang bisa pakai",
        self:      "🔒 Self — hanya owner",
        adminonly: "🛡️ Admin Only — owner + admin grup",
      };
      return m.reply(
        header("Mode Bot", "⚙️") + "\n\n" +
        `Mode aktif: *${currentMode.toUpperCase()}*\n${modeDesc[currentMode] || "tidak dikenal"}\n\n` +
        `Perintah:\n` +
        `› .public     — ubah ke Public\n` +
        `› .self       — ubah ke Self\n` +
        `› .adminonly  — ubah ke Admin Only` +
        footer()
      );
    }
  }
};

handler.tags    = "owner";
handler.help    = ["self", "public", "adminonly"];
handler.command = ["self", "public", "adminonly"];
handler.owner   = true;

module.exports = handler;
