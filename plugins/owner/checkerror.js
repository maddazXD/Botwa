// plugins/owner/checkerror.js — Cek semua file plugin (termasuk di subfolder), laporin
// yang syntax error-nya rusak. Beda dari versi Anya (pakai dynamic import ESM), di sini
// pakai `node --check` lewat child_process karena semua plugin sekarang CommonJS.
const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");
const { promisify } = require("util");
const execFileAsync = promisify(execFile);

function listJsFiles(dir) {
  let results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) results = results.concat(listJsFiles(full));
    else if (entry.name.endsWith(".js")) results.push(full);
  }
  return results;
}

let handler = async (m) => {
  const pluginFolder = path.join(process.cwd(), "plugins");
  if (!fs.existsSync(pluginFolder)) return m.reply("❌ Folder *plugins* tidak ditemukan!");

  const files = listJsFiles(pluginFolder);
  const errorList = [];

  for (const file of files) {
    try {
      await execFileAsync(process.execPath, ["--check", file]);
    } catch (err) {
      const rel = path.relative(pluginFolder, file);
      const msg = (err.stderr || err.message || "").split("\n").find((l) => l.includes("Error")) || "Syntax error";
      errorList.push(`❌ *${rel}* → ${msg.trim()}`);
    }
  }

  if (!errorList.length) m.reply("✅ Semua fitur aman, tidak ada error!");
  else m.reply(`🚨 Ditemukan *${errorList.length}* error pada fitur:\n\n${errorList.join("\n")}`);
};

handler.command = ["checkerror"];
handler.tags = ["owner"];
handler.help = ["checkerror"];
handler.owner = true;

module.exports = handler;
