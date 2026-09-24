// plugins/info/info-nav.js
// Navigasi buat daftar yang dipaginate (.berita, .cnn, .tribun, dst, .gempaterkini,
// .gempadirasakan). Baca lib/pagination.js buat detail cara kerja sesinya.
const { nextPage, backPage } = require("../../lib/pagination");
const { fail } = require("../../lib/theme");

let handler = async (m, { command }) => {
  const isNext = ["next", "lanjut"].includes(command);
  const result = isNext ? nextPage(m.chat) : backPage(m.chat);

  if (result.error === "none") {
    return m.reply(
      fail("Belum ada daftar yang lagi dibuka di chat ini.\n" +
      "Ketik dulu salah satu command kayak .berita, .cnn, .cnbc, .detik, .republika, .tribun, .gempaterkini, atau .gempadirasakan.")
    );
  }
  if (result.error === "end") return m.reply(fail("Udah di halaman terakhir, gak ada lagi selanjutnya."));
  if (result.error === "start") return m.reply(fail("Udah di halaman pertama, gak bisa balik lagi."));

  await m.react(isNext ? "➡️" : "⬅️");
  return m.reply(result.text);
};

handler.command = ["next", "lanjut", "back", "prev", "kembali"];
handler.tags = ["info"];
handler.help = ["next", "back"];
module.exports = handler;
