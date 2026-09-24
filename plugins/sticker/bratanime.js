// plugins/sticker/bratanime.js — Brat versi anime, endpoint GET
// /maker/bratanime dari api.nexray.eu.cc (pola sama kayak /maker/attp).
const { usage, fail } = require("../../lib/theme");
const { nexrayMediaSource } = require("../../lib/nexrayClient");

let handler = async (m, { sock, text }) => {
  if (!text) return m.reply(usage(`${m.cmd} <teks>`, `${m.cmd} Halo apa kabar`));

  try {
    const mediaSource = await nexrayMediaSource("/maker/bratanime", { text });
    await sock.sendSticker(m.chat, mediaSource, m, { packname: "👑 MaddazXD 👑" });
  } catch (err) {
    console.error("[BRATANIME GAGAL]", err?.message);
    m.reply(fail("Gagal membuat sticker bratanime: " + err.message));
  }
};

handler.help = "bratanime";
handler.command = ["bratanime"];
handler.tags = "sticker";

module.exports = handler;
