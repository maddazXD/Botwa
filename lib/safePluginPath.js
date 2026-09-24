// lib/safePluginPath.js — FIX PATH TRAVERSAL (CWE-22) buat command yang
// nanganin file plugin (.getplugin, .delplugin, .saveplugin).
//
// Sebelumnya, ketiga command itu langsung `path.join(pluginDir, text.trim())`
// tanpa validasi apapun. path.join() TIDAK NGEHALANGIN "../" — kalau text
// diisi "../../config.js" atau "../session/creds.json", hasilnya bisa
// KABUR TOTAL dari folder plugins/ dan baca/hapus/tulis file APAPUN di
// server (config.js isinya semua API key, session/ isinya kredensial
// WhatsApp). Semua command ini emang owner-only, tapi tetap harus dibatesin
// scope-nya cuma ke folder plugins/ — itu emang niatnya command-command ini
// (kelola FILE PLUGIN, bukan akses filesystem umum).
//
// Fix-nya: resolve ke absolute path, terus PASTIIN hasilnya masih di dalam
// folder plugins/ (bukan cuma "diawali sama nama folder yang sama" — itu
// juga rawan, misal "./plugins-backup" bakal ke-anggep "diawali plugins"
// padahal beda folder; makanya dicek pake path separator juga).
const path = require("path");

const PLUGIN_DIR = path.resolve(__dirname, "..", "plugins");

// Balikin absolute path yang UDAH TERJAMIN masih di dalam folder plugins/,
// atau null kalau inputnya nyoba keluar (path traversal). Dipanggil dengan
// `text` mentah dari user (misal "tools/vai.js" atau "../../config.js").
function resolveSafePluginPath(rawText) {
  if (!rawText || typeof rawText !== "string") return null;
  const resolved = path.resolve(PLUGIN_DIR, rawText.trim());
  if (resolved !== PLUGIN_DIR && !resolved.startsWith(PLUGIN_DIR + path.sep)) {
    return null; // nyoba kabur dari folder plugins/
  }
  return resolved;
}

module.exports = { PLUGIN_DIR, resolveSafePluginPath };
