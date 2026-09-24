// plugins/group/link.js — Lihat link invite grup ini. Bot WAJIB jadi admin
// (aturan WhatsApp: cuma admin yang boleh liat/generate link invite).
const { ok, fail } = require("../../lib/theme");

let handler = async (m, { sock }) => {
  try {
    const code = await sock.groupInviteCode(m.chat);
    m.reply(ok(`Link grup ini:\nhttps://chat.whatsapp.com/${code}`));
  } catch (err) {
    console.error("[LINK GAGAL]", err?.message || err);
    m.reply(fail("Gagal ambil link grup: " + (err?.message || "error tidak diketahui")));
  }
};

handler.help = "link (lihat link invite grup ini)";
handler.command = ["link", "grouplink", "linkgrup"];
handler.tags = "admin";
handler.group = true;
handler.admin = true;
handler.botAdmin = true;

module.exports = handler;
