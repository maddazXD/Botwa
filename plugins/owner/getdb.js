// plugins/owner/getdb.js — Download file database/db.json mentah (isinya
// semua data users, groups, & settings bot). Owner only, soalnya isinya
// data pribadi orang-orang yang pernah chat bot (nomor, nama, dll).
const fs = require("fs");
const path = require("path");
const { fail } = require("../../lib/theme");

let handler = async (m, { sock }) => {
  try {
    const dbPath = path.join(process.cwd(), "database", "db.json");
    if (!fs.existsSync(dbPath)) {
      return m.reply(fail("File database belum ada / belum pernah ke-generate."));
    }

    await sock.sendMessage(
      m.chat,
      {
        document: fs.readFileSync(dbPath),
        fileName: `db_${Date.now()}.json`,
        mimetype: "application/json",
      },
      { quoted: m }
    );
  } catch (err) {
    console.error("[GETDB GAGAL]", err?.message || err);
    m.reply(fail("Gagal ambil database: " + (err?.message || "error tidak diketahui")));
  }
};

handler.help = "getdb (download database/db.json)";
handler.command = ["getdb"];
handler.tags = "owner";
handler.owner = true;

module.exports = handler;
