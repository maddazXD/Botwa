// plugins/tools/maker-fakedana.js — Generate gambar "fake saldo DANA".
// Contoh: .fakedana 50.000
const { createCanvas, loadImage, GlobalFonts } = require("@napi-rs/canvas");
const { writeFile, mkdir } = require("node:fs/promises");
const { existsSync } = require("node:fs");
const { join } = require("node:path");
const axios = require("axios");
const { footer } = require("../../lib/theme");

let handler = async (m, { sock, text, command }) => {
  if (!text) return m.reply(`*Format salah!*\n\nContoh:\n${m.cmd} 50.000`);

  await m.reply("⏳ Memproses fake saldo DANA...");

  try {
    const ASSETS_DIR = join(process.cwd(), "assets", "fakedana");
    const FONTS_DIR = join(ASSETS_DIR, "fonts");
    const FONT_PATH = join(FONTS_DIR, "PlusJakartaSans-SemiBold.ttf");
    const BG_LOCAL = join(ASSETS_DIR, "fkedana.png");
    const EYE_LOCAL = join(ASSETS_DIR, "eye_icon.jpg");

    const TTF_URL = "https://cdn.jsdelivr.net/fontsource/fonts/plus-jakarta-sans@latest/latin-600-normal.ttf";
    const BG_URL = "https://raw.githubusercontent.com/ryyntwx/Image-rinn/refs/heads/main/fkedana.png";
    const EYE_URL = "https://raw.githubusercontent.com/ryyntwx/Image-rinn/refs/heads/main/IMG-20260726-WA1031.jpg";

    await mkdir(FONTS_DIR, { recursive: true });

    if (!existsSync(FONT_PATH)) {
      const fontRes = await axios.get(TTF_URL, { responseType: "arraybuffer", headers: { "User-Agent": "Mozilla/5.0" } });
      await writeFile(FONT_PATH, Buffer.from(fontRes.data));
    }
    GlobalFonts.registerFromPath(FONT_PATH, "DANA");

    if (!existsSync(BG_LOCAL)) {
      const bgRes = await axios.get(BG_URL, { responseType: "arraybuffer", headers: { "User-Agent": "Mozilla/5.0" } });
      await writeFile(BG_LOCAL, Buffer.from(bgRes.data));
    }
    if (!existsSync(EYE_LOCAL)) {
      const eyeRes = await axios.get(EYE_URL, { responseType: "arraybuffer", headers: { "User-Agent": "Mozilla/5.0" } });
      await writeFile(EYE_LOCAL, Buffer.from(eyeRes.data));
    }

    const bgImg = await loadImage(BG_LOCAL);
    const eyeImg = await loadImage(EYE_LOCAL);

    const canvas = createCanvas(bgImg.width, bgImg.height);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(bgImg, 0, 0, canvas.width, canvas.height);

    const valX = 138, valY = 52, eyeGap = 7, eyeScale = 1.3;
    const inputSaldo = text.trim();
    const maxAllowedWidth = canvas.width - valX - 100;

    let currentFontSize = 37;
    ctx.font = `600 ${currentFontSize}px DANA`;
    let textWidth = ctx.measureText(inputSaldo).width;
    while (textWidth > maxAllowedWidth && currentFontSize > 16) {
      currentFontSize -= 2;
      ctx.font = `600 ${currentFontSize}px DANA`;
      textWidth = ctx.measureText(inputSaldo).width;
    }

    ctx.fillStyle = "#FFFFFF";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(inputSaldo, valX, valY);

    const eyeHeight = currentFontSize * eyeScale;
    const eyeWidth = (eyeImg.width / eyeImg.height) * eyeHeight;
    const eyeX = valX + textWidth + eyeGap;
    const eyeY = valY + (currentFontSize - eyeHeight) / 2;
    ctx.drawImage(eyeImg, eyeX, eyeY, eyeWidth, eyeHeight);

    const outBuffer = await canvas.encode("png");
    await sock.sendMessage(m.chat, {
      image: outBuffer,
      caption: `— *FAKE SALDO DANA* —\n\n✎ *Nominal:* Rp ${inputSaldo}` + footer(),
    }, { quoted: m });
  } catch (err) {
    console.error("[FAKEDANA GAGAL]", err.message);
    m.reply("❌ Gagal membuat fake saldo DANA: " + err.message);
  }
};

handler.command = ["fakedana", "fakedan"];
handler.tags = ["tools"];
handler.help = ["fakedana <nominal>"];

module.exports = handler;
