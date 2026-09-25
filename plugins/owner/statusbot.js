// FIX BUG: sebelumnya (1) reply()/usedPrefix/db() gak ada di konvensi MaddazXD V2 -> crash,
// (2) key "autotyping"/"anticall" (huruf kecil) gak match sama global.autoTyping/
// global.antiCall (huruf besar) yang beneran dibaca index.js -> gak ngefek walau gak crash.
//
// FITUR BARU: bare command (tanpa "on"/"off") sekarang nunjukin status LENGKAP
// bot — bukan cuma daftar fitur toggle-nya, tapi juga mode bot (public/self/
// adminonly), prefix aktif, uptime, ping (ms), jumlah plugin ke-load, dan
// total command yang udah diproses. Sebelumnya info ini gak ada satupun
// command yang nampilin dalam satu tempat.
const { header, card, footer } = require("../../lib/theme");
const os = require("os");

function formatUptime(seconds) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const mnt = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const parts = [];
  if (d) parts.push(`${d}h`);
  if (h) parts.push(`${h}j`);
  if (mnt) parts.push(`${mnt}m`);
  parts.push(`${s}d`);
  return parts.join(" ");
}

const handler = async (m, { args, command, prefix }) => {
  const fiturList = [
    "autoTyping", // 1
    "pconly",     // 2
    "gconly",     // 3
    "antiCall",   // 4
    "blockIfCall", // 5
  ];

  const action = args[0] ? args[0].toLowerCase() : "";

  if (action !== "on" && action !== "off") {
    // Ping: selisih waktu antara pesan masuk (m.messageTimestamp dari WA,
    // dalam detik) sampai command ini mulai diproses — approksimasi latency
    // bot yang umum dipakai di bot WA lain (baileys gak punya "true" RTT
    // ping ke server WA).
    const pingMs = Math.max(0, Date.now() - (Number(m.messageTimestamp) * 1000 || Date.now()));

    const currentMode = global.mode || global.db?.settings?.mode || "public";
    const modeLabel = { public: "🌐 Public", self: "🔒 Self", adminonly: "🛡️ Admin Only" }[currentMode] || currentMode;
    const activePrefix = global.db?.settings?.prefix || global.prefix || "/";
    const totalPlugins = Object.keys(global.plugins || {}).length;
    const totalHit = global.db?.settings?.totalhit || 0;
    const bannedCount = (global.db?.settings?.banned || []).length;
    const ramUsed = (process.memoryUsage().rss / 1024 / 1024).toFixed(1);
    const ramTotal = (os.totalmem() / 1024 / 1024 / 1024).toFixed(1);

    const infoLines = [
      `Mode bot : *${modeLabel}*`,
      `Prefix : *${activePrefix}*`,
      `Ping : *${pingMs} ms*`,
      `Uptime : *${formatUptime(process.uptime())}*`,
      `RAM : *${ramUsed} MB* / ${ramTotal} GB`,
      `Plugin ter-load : *${totalPlugins}*`,
      `Total command diproses : *${totalHit}*`,
      `User dibanned : *${bannedCount}*`,
    ];

    const lines = fiturList.map((key, index) => `[${index + 1}] ${key} : *${(global[key] || global.db?.settings?.[key]) ? "ON ✅" : "OFF ❌"}*`);
    const teks =
      `${header("Status Bot", "📊")}\n\n` +
      card("INFO", infoLines, "📊") + "\n\n" +
      card("FITUR (toggle)", lines, "⚙️") + "\n\n" +
      `📝 *Cara ubah fitur:*\n› ${prefix}${command} on/off <nomor>\n\n` +
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

handler.command = ["statusbot", "setbot", "settings", "botstatus"];
handler.tags = ["admin"];
handler.help = ["statusbot", "statusbot on/off <nomor>"];
handler.admin = true;

module.exports = handler;
