const { usage, fail } = require("../../lib/theme");

let handler = async (m, { sock, text }) => {
  if (!text) return m.reply(usage(`${m.cmd} <teks>`, `${m.cmd} hello`));
  let apis = `https://api.siputzx.my.id/api/m/brat?text=${encodeURIComponent(text)}&delay=500`;
  try {
    await sock.sendSticker(m.chat, apis, m, { packname: "👑 MaddazXD 👑" });
  } catch (err) {
    console.error("[BRAT GAGAL]", err?.message);
    m.reply(fail("Gagal membuat sticker brat: " + err.message));
  }
};

handler.help = "brat";
handler.command = ["brat"];
handler.tags = "sticker";

module.exports = handler;
