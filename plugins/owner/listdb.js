// plugins/owner/listdb.js — Liat isi database bot dari chat (tanpa perlu
// download file). Tanpa argumen = ringkasan jumlah data; dikasih path
// (notasi titik) = detail bagian itu.
//
// PENTING soal JID: nomor WA (628xxx@s.whatsapp.net) itu ada titiknya
// ("s.whatsapp.net"), jadi kalau ditulis dengan titik biasa bakal kebaca
// path bersarang yang salah. Buat nunjuk key yang ada titik/karakter aneh
// kayak gitu, bungkus pake notasi bracket+petik:
//   listdb users["628xxx@s.whatsapp.net"]
const _ = require("lodash");
const { header, card, fail } = require("../../lib/theme");

let handler = async (m, { text }) => {
  const db = global.db || {};

  if (!text) {
    const lines = [
      `👤 Users    : ${Object.keys(db.users || {}).length}`,
      `👥 Groups   : ${Object.keys(db.groups || {}).length}`,
      `⚙️ Settings : ${Object.keys(db.settings || {}).length} key`,
    ];
    return m.reply(
      `${header("DATABASE OVERVIEW", "🗄️")}\n\n${card("Ringkasan", lines, "🗄️")}\n\n` +
        `📝 Pake *${m.cmd} <path>* buat liat detail.\n` +
        `Contoh: *${m.cmd} settings*\n` +
        `Contoh (JID ada titik, wajib bracket+petik): *${m.cmd} users["628xxx@s.whatsapp.net"]*`
    );
  }

  const value = _.get(db, text);
  if (value === undefined) {
    return m.reply(fail(`Path "${text}" gak ketemu di database.`));
  }

  let display;
  try {
    display = JSON.stringify(value, null, 2);
  } catch {
    display = String(value);
  }
  if (display.length > 3500) display = display.slice(0, 3500) + "\n... (dipotong, kepanjangan)";

  m.reply(`${header(`DB: ${text}`, "🗄️")}\n\n\`\`\`${display}\`\`\``);
};

handler.help = "listdb [path] — contoh: listdb settings / listdb users.628xxx";
handler.command = ["listdb", "checkdb"];
handler.tags = "owner";
handler.owner = true;

module.exports = handler;
