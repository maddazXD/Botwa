// FIX BUG: sebelumnya (1) pakai reply()/usedPrefix/db() yang gak ada di MaddazXD V2 -> crash,
// (2) nulis ke global.anticall (huruf kecil) padahal index.js baca global.antiCall / 
// global.db.settings.antiCall (C besar) -> walau gak crash pun gak bakal ngefek beneran.
const { usage, ok } = require("../../lib/theme");

const handler = async (m, { text, command, prefix }) => {
  if (!text) return m.reply(usage(`${prefix}${command} on/off`));
  const t = text.toLowerCase();

  if (t === "on") {
    global.antiCall = true;
    if (global.db.settings) global.db.settings.antiCall = true;
  } else if (t === "off") {
    global.antiCall = false;
    if (global.db.settings) global.db.settings.antiCall = false;
  } else {
    return m.reply(usage(`${prefix}${command} on/off`));
  }

  m.reply(ok(`*AntiCall* sekarang: *${t.toUpperCase()}*`));
};

handler.command = ["anticall"];
handler.tags = ["admin"];
handler.help = ["anticall <on/off>"];
handler.admin = true;

module.exports = handler;
