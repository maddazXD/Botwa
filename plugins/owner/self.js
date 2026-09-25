// plugins/owner/self.js — Toggle mode Public / Self / Admin Only
//
// Tiga mode bot, SALING EKSKLUSIF (cuma bisa 1 yang aktif dalam satu waktu,
// disimpan di SATU variabel: global.mode):
//   public    — semua orang bisa pakai bot (mode "netral"/default)
//   self      — HANYA owner (tidak ada bypass untuk siapapun, termasuk admin grup)
//   adminonly — owner + admin grup bisa pakai; member biasa di-block total
//
// PENTING (biar gak ke-mispersepsi kayak pengalaman sebelumnya):
// adminonly HANYA ngatur SIAPA YANG BOLEH MEMAKAI COMMAND BOT. Dia SAMA
// SEKALI TIDAK menyentuh/menghapus pesan member di grup — itu urusan fitur
// lain (.mute buat per-member, .close buat native WA announcement). Kalau
// nemu pesan member kehapus pas mode ini aktif, itu BUKAN dari sini —
// cek .mutelist atau status .close grup itu.
//
// FIX BUG (sebelumnya): ".adminonly off" / ".self off" gak pernah beneran
// mematikan apa-apa — argumen "off" gak pernah dibaca sama sekali (switch
// cuma mikirin nama command-nya, bukan args[0]), jadi ".adminonly off"
// efeknya SAMA PERSIS kayak ".adminonly" — selalu MENYALAKAN mode itu lagi,
// padahal user niatnya mematikan. Sekarang args[0] ("on"/"off") dibaca
// eksplisit, dan "off" berarti balik ke mode "public" (mode paling netral),
// bukan diam-diam nyalain mode lain.
//
// Semua mode disimpan ke global.db.settings.mode (persisted ke disk) DAN
// global.mode di-update langsung — sehingga nempel baik via restart manual
// maupun reconnect otomatis WA (yang memicu ulang startBot() di index.js).
const { ok, warn, header, footer } = require("../../lib/theme");

const MODE_META = {
  public:    { label: "Public 🌐",     emoji: "🌐", desc: "Semua orang bisa menggunakan bot." },
  self:      { label: "Self 🔒",       emoji: "🔒", desc: "Hanya owner yang bisa menggunakan bot.\nAdmin grup pun tidak bisa bypass mode ini." },
  adminonly: { label: "Admin Only 🛡️", emoji: "🛡️", desc: "Owner dan admin grup bisa menggunakan bot.\nMember biasa tidak akan direspons sama sekali (pesan mereka TIDAK dihapus, cuma tidak dilayani)." },
};

function getCurrentMode() {
  return global.mode || global.db?.settings?.mode || "public";
}

// Satu-satunya tempat yang boleh mengubah mode — biar gak ada 2 jalur beda
// yang bisa saling menimpa / balapan (race) kayak yang kejadian sebelumnya.
function setMode(newMode) {
  if (!global.db.settings) global.db.settings = {};
  global.mode = newMode;
  global.db.settings.mode = newMode;
  // sock.public HANYA true buat mode "public" — dipertahankan sebagai flag
  // pendukung kompatibilitas, security gate asli tetap baca global.mode.
  if (global.sock) global.sock.public = newMode === "public";
}

let handler = async (m, { sock, args, command }) => {
  if (!global.db.settings) global.db.settings = {};
  global.sock = sock; // dipakai setMode() supaya sock.public ikut sinkron

  const action = (args[0] || "on").toLowerCase();
  const current = getCurrentMode();

  // ── .public — selalu jadi target langsung, gak ada konsep "on/off" ──
  // (public itu sendiri adalah state "netral"/kondisi mati-nya self & adminonly)
  if (command === "public") {
    if (current === "public") {
      return m.reply(warn("Mode *Public* 🌐 memang sudah aktif — tidak ada yang perlu diubah."));
    }
    setMode("public");
    return m.reply(ok(`Berhasil beralih ke mode *Public* 🌐\n\n_${MODE_META.public.desc}_`));
  }

  // ── .self / .adminonly — dukung "on" (default) dan "off" ──
  if (command === "self" || command === "adminonly") {
    if (action !== "on" && action !== "off") {
      return m.reply(
        warn(`Opsi \`${action}\` tidak dikenal. Gunakan:\n› ${m.cmd} on\n› ${m.cmd} off`)
      );
    }

    if (action === "on") {
      if (current === command) {
        return m.reply(warn(`Mode *${MODE_META[command].label}* memang sudah aktif — tidak ada yang perlu diubah.`));
      }
      // FITUR BENTROK: kalau mode lain yang restriktif lagi aktif, kasih tau
      // jelas alih-alih diam-diam nimpa tanpa penjelasan.
      if (current !== "public") {
        m.reply(warn(`Mode *${MODE_META[current].label}* sebelumnya aktif — sekarang diganti ke *${MODE_META[command].label}* (cuma boleh 1 mode aktif dalam satu waktu).`));
      }
      setMode(command);
      return m.reply(ok(`Berhasil beralih ke mode *${MODE_META[command].label}*\n\n_${MODE_META[command].desc}_`));
    }

    // action === "off"
    if (current !== command) {
      // Fitur yang mau dimatikan memang lagi gak aktif — kasih pesan jelas
      // "fitur X sedang tidak aktif" bukan diam-diam nyalain sesuatu.
      return m.reply(
        warn(`*${MODE_META[command].label}* sedang TIDAK aktif (mode saat ini: *${MODE_META[current].label}*), jadi tidak ada yang dimatikan.`)
      );
    }
    setMode("public");
    return m.reply(ok(`*${MODE_META[command].label}* berhasil dimatikan.\n\nBot kembali ke mode *Public* 🌐 — _${MODE_META.public.desc}_`));
  }

  // ── default: tampilkan status mode saat ini ──
  return m.reply(
    header("Mode Bot", "⚙️") + "\n\n" +
    `Mode aktif: *${MODE_META[current]?.label || current}*\n${MODE_META[current]?.desc || ""}\n\n` +
    `Perintah:\n` +
    `› .public           — ubah ke Public\n` +
    `› .self on/off      — nyalakan/matikan Self\n` +
    `› .adminonly on/off — nyalakan/matikan Admin Only` +
    footer()
  );
};

handler.tags    = "owner";
handler.help    = ["self on/off", "public", "adminonly on/off"];
handler.command = ["self", "public", "adminonly"];
handler.owner   = true;

module.exports = handler;
