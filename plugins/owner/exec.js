// plugins/owner/exec.js — Jalanin perintah SHELL (bash) langsung dari chat,
// buat debug/maintenance server cepat (cek proses, install package, dsb)
// tanpa perlu buka Termux/MT Manager manual.
//
// ⚠️ PERINGATAN: sama kayak .eval, ini juga akses PENUH ke server bot
// (bisa hapus file, install/uninstall apapun, matiin bot, dst) — cuma buat
// OWNER, jangan pernah dibuka ke publik atau dipindah keluar folder owner/.
const { exec } = require("child_process");
const util = require("util");
const execAsync = util.promisify(exec);
const { usage, fail } = require("../../lib/theme");

let handler = async (m, { text }) => {
  if (!text) return m.reply(usage(`${m.cmd} <perintah shell>`, `${m.cmd} ls -la`));

  try {
    const { stdout, stderr } = await execAsync(text, {
      timeout: 30000,
      maxBuffer: 1024 * 1024 * 5,
    });
    let out = (stdout || "").trim();
    if (stderr && stderr.trim()) out += `${out ? "\n" : ""}[stderr]\n${stderr.trim()}`;
    if (!out) out = "(gak ada output)";
    if (out.length > 4000) out = out.slice(0, 4000) + "\n... (dipotong, kepanjangan)";
    m.reply("```" + out + "```");
  } catch (err) {
    let out = err?.stdout || err?.stderr || err?.message || String(err);
    out = String(out);
    if (out.length > 4000) out = out.slice(0, 4000) + "\n... (dipotong)";
    m.reply(fail("Error:\n```" + out + "```"));
  }
};

handler.help = "exec <perintah shell> — DEBUG, owner only, HATI-HATI dipakainya";
handler.command = ["exec", "shell", "$"];
handler.tags = "owner";
handler.owner = true;

module.exports = handler;
