// FIX BUG: sebelumnya (1) pakai reply()/usedPrefix/db() yang gak ada di MaddazXD V2 -> crash,
// (2) nulis ke global.autotyping (huruf kecil) padahal index.js baca global.autoTyping
// (T besar) -> walau gak crash pun gak bakal ngefek beneran.
const { usage, ok } = require("../../lib/theme");

const handler = async (m, { text, command, prefix }) => {
  if (!text) return m.reply(usage(`${prefix}${command} on/off`));
  const t = text.toLowerCase();

  if (!global.db.settings) global.db.settings = {};

  if (t === "on") {
    global.autoTyping = true;
    global.db.settings.autoTyping = true; // FIX: dulu gak kesimpen, balik default tiap restart
  } else if (t === "off") {
    global.autoTyping = false;
    global.db.settings.autoTyping = false;
  } else {
    return m.reply(usage(`${prefix}${command} on/off`));
  }

  m.reply(ok(`*autotyping* diubah jadi: *${t.toUpperCase()}*`));
};

handler.command = ["autotyping"];
handler.tags = ["admin"];
handler.help = ["autotyping <on/off>"];
handler.admin = true;

module.exports = handler;
