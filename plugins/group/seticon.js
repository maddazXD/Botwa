// plugins/group/seticon.js — Ganti foto profil grup. Reply/kirim gambar
// dengan caption .seticon. Bot WAJIB jadi admin (aturan WhatsApp: cuma
// admin yang boleh ganti foto grup).
const fs = require("fs");
const { usage, ok, fail } = require("../../lib/theme");

let handler = async (m, { sock, mime }) => {
  if (!mime || !/image/.test(mime)) {
    return m.reply(usage(`${m.cmd}`, `Reply/kirim gambar, terus ketik ${m.cmd}`));
  }

  let bufferPath, croppedPath;
  try {
    const qmsg = m.qmsg;
    bufferPath = await sock.downloadAndSaveMediaMessage(qmsg);
    const { img } = await global.generateProfilePicture(bufferPath);
    croppedPath = bufferPath.replace(/\.[^.]+$/, "_gc.jpg");
    fs.writeFileSync(croppedPath, img);

    await sock.updateProfilePicture(m.chat, { url: croppedPath });
    m.reply(ok("Berhasil ganti foto grup."));
  } catch (err) {
    console.error("[SETICON GAGAL]", err?.message || err);
    m.reply(fail("Gagal ganti foto grup: " + (err?.message || "error tidak diketahui")));
  } finally {
    try { if (bufferPath) fs.unlinkSync(bufferPath); } catch {}
    try { if (croppedPath) fs.unlinkSync(croppedPath); } catch {}
  }
};

handler.help = "seticon (reply/kirim gambar)";
handler.command = ["seticon", "setgcpp", "setgrouppp"];
handler.tags = "admin";
handler.group = true;
handler.admin = true;
handler.botAdmin = true;

module.exports = handler;
