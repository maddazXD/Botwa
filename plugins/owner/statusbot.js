// FIX BUG: sebelumnya (1) reply()/usedPrefix/db() gak ada di konvensi MaddazXD V2 -> crash,
// (2) key "autotyping"/"anticall" (huruf kecil) gak match sama global.autoTyping/
// global.antiCall (huruf besar) yang beneran dibaca index.js -> gak ngefek walau gak crash.
const { header, card, footer } = require("../../lib/theme");

const handler = async (m, { args, command, prefix }) => {
  const fiturList = [
    "autoTyping", // 1
    "pconly",     // 2
    "gconly",     // 3
    "antiCall",   // 4
  ];

  const action = args[0] ? args[0].toLowerCase() : "";

  if (action !== "on" && action !== "off") {
    const lines = fiturList.map((key, index) => `[${index + 1}] ${key} : *${(global[key] || global.db?.settings?.[key]) ? "ON ✅" : "OFF ❌"}*`);
    const teks =
      `${header("Settings Bot", "⚙️")}\n\n` +
      card("FITUR", lines, "⚙️") + "\n\n" +
      `📝 *Cara pakai:*\n› ${prefix}${command} on/off <nomor>\n\n` +
      `*Contoh:*\n› ${prefix}${command} on 1\n› ${prefix}${command} off 1 2` +
      footer();
    return m.reply(teks);
  }

  const indexes = args.slice(1);
  if (indexes.length === 0) return m.reply(`❌ Masukkan nomor fitur!\nContoh: *${prefix}${command} ${action} 1*`);

  const isEnable = action === "on";
  const success = [];
  const failed = [];

  if (!global.db.settings) global.db.settings = {};

  for (const strIndex of indexes) {
    const i = parseInt(strIndex) - 1;
    const key = fiturList[i];
    if (!key) { failed.push(strIndex); continue; }
    global[key] = isEnable;
    global.db.settings[key] = isEnable; // FIX: dulu cuma di-set ke global[key], gak pernah kesimpen ke database — balik ke default tiap restart
    success.push(key);
  }

  let msg = `${header("Status Update", "🔄")}\n\n`;
  if (success.length > 0) msg += `✅ Berhasil di *${action.toUpperCase()}*:\n${success.map(s => `- ${s}`).join("\n")}\n`;
  if (failed.length > 0) msg += `\n❌ Tidak Valid: ${failed.join(", ")}`;
  msg += footer();

  m.reply(msg);
};

handler.command = ["statusbot", "setbot", "settings"];
handler.tags = ["admin"];
handler.help = ["statusbot", "statusbot on/off <nomor>"];
handler.admin = true;

module.exports = handler;
