// plugins/tools/vai.js — chat AI (teks & gambar), lewat lib/aiRouter.js yang
// nyoba beberapa backend berurutan (JazeChat -> AskMe -> Andaraz/Gemini
// asli) dan otomatis fallback kalau salah satu gagal/down. Lihat komentar
// lengkap urutan & alasannya di lib/aiRouter.js.
const { getMediaSource } = require("../../lib/mediaHelper");
const { askText, askImage } = require("../../lib/aiRouter");
const { usage, processing, fail, footer } = require("../../lib/theme");

let handler = async (m, { sock, text, prefix, command }) => {
  const prompt = (text || "").trim();
  const source = getMediaSource(m);
  const isImage = source && source.mtype === "imageMessage";

  if (!prompt && !isImage) {
    return m.reply(usage(`${prefix}${command} <pertanyaan/teks>`, `${prefix}${command} jelasin apa itu lubang hitam`));
  }

  // ── Jalur GAMBAR ──────────────────────
  if (isImage) {
    const statusMsg = await sock.sendMessage(m.chat, { text: processing("Lagi liat gambarnya...") }, { quoted: m });
    try {
      const buffer = await source.download();
      if (!buffer?.length) throw new Error("Gagal download gambar, buffer kosong.");
      const { answer } = await askImage(m.chat, prompt, buffer, source.mimetype);
      await sock.sendMessage(m.chat, { text: `${answer}${footer()}`, edit: statusMsg.key });
    } catch (err) {
      console.error("[VAI GAMBAR GAGAL TOTAL]", err?.message || err);
      try { await sock.sendMessage(m.chat, { text: fail(`Gagal baca gambarnya: ${err.message}`), edit: statusMsg.key }); } catch {}
    }
    return;
  }

  // ── Jalur TEKS ────────────────────────
  const statusMsg = await sock.sendMessage(m.chat, { text: processing("AI lagi mikir...") }, { quoted: m });
  try {
    const { answer } = await askText(m.chat, prompt);
    await sock.sendMessage(m.chat, { text: `${answer}${footer()}`, edit: statusMsg.key });
  } catch (err) {
    console.error("[VAI TEKS GAGAL TOTAL]", err?.message || err);
    try { await sock.sendMessage(m.chat, { text: fail("Semua backend AI lagi gagal/down. Coba lagi nanti."), edit: statusMsg.key }); } catch {}
  }
};

handler.command = ["vai"];
handler.help = ["vai <pertanyaan> (chat AI multi-backend, teks & gambar)"];
handler.tags = ["tools"];

module.exports = handler;
