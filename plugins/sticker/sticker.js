const fs = require("fs");
const { usage, fail } = require("../../lib/theme");

let handler = async (m, { sock, prefix, command }) => {
  let mime = m.mime || "";
  if (!/image|video/.test(mime)) return m.reply(usage(`Kirim/reply foto atau video, terus ketik ${prefix}${command}`));

  if (/video/.test(mime)) {
    if ((m.quoted || m).seconds > 15) return m.reply(fail("Durasi video maksimal 15 detik ya!"));
  }

  let qmsg = m.qmsg;
  let media = await sock.downloadAndSaveMediaMessage(qmsg);

  await sock.sendSticker(m.chat, media, m, { packname: "👑 MaddazXD 👑" });
  await fs.unlinkSync(media);
};

handler.help = "sticker";
handler.command = ["sticker", "stiker", "sgif", "s"];
handler.tags = "sticker";

module.exports = handler;
