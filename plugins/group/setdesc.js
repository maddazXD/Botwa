// plugins/group/setdesc.js — Ganti deskripsi grup. Bot WAJIB jadi admin
// (aturan WhatsApp: cuma admin yang boleh ganti deskripsi grup).
const { usage, ok, fail } = require("../../lib/theme");

let handler = async (m, { sock, text }) => {
  if (!text) {
    return m.reply(
      usage(`${m.cmd} <deskripsi baru>`, `${m.cmd} Grup resmi keluarga besar, dilarang spam!`)
    );
  }

  try {
    await sock.groupUpdateDescription(m.chat, text);
    m.reply(ok("Deskripsi grup berhasil diganti."));
  } catch (err) {
    console.error("[SETDESC GAGAL]", err?.message || err);
    m.reply(fail("Gagal ganti deskripsi grup: " + (err?.message || "error tidak diketahui")));
  }
};

handler.help = "setdesc <deskripsi baru>";
handler.command = ["setdesc", "setgroupdesc", "gcdesc"];
handler.tags = "admin";
handler.group = true;
handler.admin = true;
handler.botAdmin = true;

module.exports = handler;
