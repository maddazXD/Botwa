// plugins/sticker/ttp.js — Text To Picture (versi statis, gak bergerak
// kayak attp), endpoint GET /maker/ttp dari api.nexray.eu.cc.
const { usage, fail } = require("../../lib/theme");
const { nexrayMediaSource } = require("../../lib/nexrayClient");

let handler = async (m, { sock, text }) => {
  if (!text) return m.reply(usage(`${m.cmd} <teks>`, `${m.cmd} Halo apa kabar`));

  try {
    const mediaSource = await nexrayMediaSource("/maker/ttp", { text });
    await sock.sendSticker(m.chat, mediaSource, m, { packname: "👑 MaddazXD 👑" });
  } catch (err) {
    console.error("[TTP GAGAL]", err?.message);
    m.reply(fail("Gagal membuat sticker ttp: " + err.message));
  }
};

handler.help = "ttp";
handler.command = ["ttp"];
handler.tags = "sticker";

module.exports = handler;
