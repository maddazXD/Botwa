// plugins/tools/alightmotion.js — .am/.amvip/.alightmotion/.ampro. Bukan
// generate akun/verify email kayak versi awal (itu dihapus, alurnya nyerempet
// bypass sistem verifikasi Alight Motion sendiri). Sekarang cuma promo teks +
// arahin ke link resmi buat beli Alight Motion Premium.
const { header, card } = require("../../lib/theme");

const OFFICIAL_LINK = "https://alightmotion.com";

let handler = async (m) => {
  const body =
    header("ALIGHT MOTION PREMIUM", "🎬") + "\n\n" +
    card("Info", [
      "Butuh AM Prem? Di sini aja!",
      "",
      "Beli langsung di dalam app Alight Motion (ikon mahkota 👑), atau cek info resminya:",
      `🔗 ${OFFICIAL_LINK}`,
    ], "🎬");

  m.reply(body);
};

handler.command = ["am", "amvip", "alightmotion", "ampro"];
handler.help = ["am (info & link beli Alight Motion Premium resmi)"];
handler.tags = ["tools"];

module.exports = handler;
