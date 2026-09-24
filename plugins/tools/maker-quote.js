// plugins/tools/maker-quote.js — Generate gambar quote card gaya "status chat HP".
// Beda template dari .iqc (yang generate lewat API luar) — ini render lokal pakai canvas.
// Contoh: .quote jangan terlalu sibuk mengejar dunia
const axios = require("axios");
const { createCanvas, loadImage, GlobalFonts } = require("@napi-rs/canvas");
const { writeFile, mkdir, unlink } = require("node:fs/promises");
const { existsSync } = require("node:fs");
const { join } = require("node:path");
const { footer } = require("../../lib/theme");

let handler = async (m, { sock, text, command }) => {
  if (!text) {
    return m.reply(
      `Cara pakai *${m.cmd}*:\n\n` +
      `Format: *${m.cmd} teks quotes*\n` +
      `Contoh: *${m.cmd} jangan terlalu sibuk mengejar dunia*`
    );
  }

  const qcText = text.trim();
  await m.reply("⏳ Membuat quote card...");

  try {
    const BG_URL = "https://raw.githubusercontent.com/ryyntwx/allimagerin/refs/heads/main/qc.png";
    const QC_DIR = join(process.cwd(), "assets", "qc_maker");
    const BG_LOCAL = join(QC_DIR, "qc.png");
    const FONTS_DIR = join(QC_DIR, "fonts");
    const TMP_DIR = join(process.cwd(), "tmp");

    const INTER_FONTS = [
      { url: "https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuFuYAZ9hiJ-Ek-_EeA.woff2", file: "Inter-SemiBold.ttf" },
    ];

    await mkdir(FONTS_DIR, { recursive: true });
    await mkdir(TMP_DIR, { recursive: true });

    for (const f of INTER_FONTS) {
      const dest = join(FONTS_DIR, f.file);
      if (!existsSync(dest)) {
        const res = await axios.get(f.url, { responseType: "arraybuffer", headers: { "User-Agent": "Mozilla/5.0" } });
        await writeFile(dest, Buffer.from(res.data));
      }
      GlobalFonts.registerFromPath(dest, "Inter");
    }

    if (!existsSync(BG_LOCAL)) {
      const res = await axios.get(BG_URL, { responseType: "arraybuffer", headers: { "User-Agent": "Mozilla/5.0" } });
      await writeFile(BG_LOCAL, Buffer.from(res.data));
    }

    const BG_W = 1080, BG_H = 2280;
    const canvas = createCanvas(BG_W, BG_H);
    const ctx = canvas.getContext("2d");
    const bgImg = await loadImage(BG_LOCAL);
    ctx.drawImage(bgImg, 0, 0, BG_W, BG_H);

    function wrapByWords(str, wordsPerLine = 3) {
      const words = str.replace(/\s+/g, " ").trim().split(" ");
      const lines = [];
      for (let i = 0; i < words.length; i += wordsPerLine) lines.push(words.slice(i, i + wordsPerLine).join(" "));
      return lines;
    }

    const lines = wrapByWords(qcText, 3);
    const fontSize = 55, lineGap = 5, centerX = 443, centerY = 1192;

    ctx.font = `600 ${fontSize}px Inter`;
    ctx.fillStyle = "#111111";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const lineHeight = fontSize + lineGap;
    const totalHeight = lines.length * lineHeight;

    ctx.save();
    ctx.translate(centerX, centerY);
    let startY = -(totalHeight / 2) + fontSize / 2;
    lines.forEach((line, i) => ctx.fillText(line, 0, startY + i * lineHeight));
    ctx.restore();

    const outBuffer = await canvas.encode("png");
    await sock.sendMessage(m.chat, { image: outBuffer, caption: "📱 Quote card kamu~" + footer() }, { quoted: m });
  } catch (err) {
    console.error("[QUOTE MAKER GAGAL]", err.message);
    m.reply("❌ Gagal membuat quote card: " + err.message);
  }
};

handler.command = ["quote", "qc2"];
handler.tags = ["tools"];
handler.help = ["quote <teks>"];

module.exports = handler;
