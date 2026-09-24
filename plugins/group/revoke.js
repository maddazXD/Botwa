// plugins/group/revoke.js — Reset (revoke) link invite grup ini, link lama
// otomatis gak berlaku lagi begitu ini dijalanin — berguna kalau link grup
// udah kesebar ke orang yang gak diinginkan. Bot WAJIB jadi admin (aturan
// WhatsApp: cuma admin yang boleh reset link invite).
const { ok, fail } = require("../../lib/theme");

let handler = async (m, { sock }) => {
  try {
    const code = await sock.groupRevokeInvite(m.chat);
    m.reply(
      ok(`Link lama udah gak berlaku lagi.\n\nLink baru:\nhttps://chat.whatsapp.com/${code}`)
    );
  } catch (err) {
    console.error("[REVOKE GAGAL]", err?.message || err);
    m.reply(fail("Gagal reset link grup: " + (err?.message || "error tidak diketahui")));
  }
};

handler.help = "revoke (reset link invite grup ini)";
handler.command = ["revoke", "resetlink"];
handler.tags = "admin";
handler.group = true;
handler.admin = true;
handler.botAdmin = true;

module.exports = handler;
