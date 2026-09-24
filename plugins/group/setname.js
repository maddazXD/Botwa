// plugins/group/setname.js — Ganti nama grup. Bot WAJIB jadi admin (aturan
// WhatsApp: cuma admin yang boleh ganti nama grup).
const { usage, ok, fail } = require("../../lib/theme");

let handler = async (m, { sock, text }) => {
  if (!text) {
    return m.reply(usage(`${m.cmd} <nama baru>`, `${m.cmd} Keluarga Bahagia 🏡`));
  }
  if (text.length > 25) {
    return m.reply(fail("Nama grup maksimal 25 karakter (batasan WhatsApp)."));
  }

  try {
    await sock.groupUpdateSubject(m.chat, text);
    m.reply(ok(`Nama grup berhasil diganti jadi:\n*${text}*`));
  } catch (err) {
    console.error("[SETNAME GAGAL]", err?.message || err);
    m.reply(fail("Gagal ganti nama grup: " + (err?.message || "error tidak diketahui")));
  }
};

handler.help = "setname <nama baru>";
handler.command = ["setname", "setgroupname", "gcname"];
handler.tags = "admin";
handler.group = true;
handler.admin = true;
handler.botAdmin = true;

module.exports = handler;
