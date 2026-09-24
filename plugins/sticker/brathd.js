// plugins/sticker/brathd.js — Brat versi resolusi tinggi, endpoint GET
// /maker/brathd dari api.nexray.eu.cc (pola sama kayak /maker/attp yang
// udah kebukti jalan: query param "text").
const { usage, fail } = require("../../lib/theme");
const { nexrayMediaSource } = require("../../lib/nexrayClient");

let handler = async (m, { sock, text }) => {
  if (!text) return m.reply(usage(`${m.cmd} <teks>`, `${m.cmd} Halo apa kabar`));

  try {
    const mediaSource = await nexrayMediaSource("/maker/brathd", { text });
    await sock.sendSticker(m.chat, mediaSource, m, { packname: "👑 MaddazXD 👑" });
  } catch (err) {
    console.error("[BRATHD GAGAL]", err?.message);
    m.reply(fail("Gagal membuat sticker brathd: " + err.message));
  }
};

handler.help = "brathd";
handler.command = ["brathd"];
handler.tags = "sticker";

module.exports = handler;
