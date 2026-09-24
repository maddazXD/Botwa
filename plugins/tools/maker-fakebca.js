// plugins/tools/maker-fakebca.js — Generate gambar "fake dashboard BCA".
// Contoh: .fkebca RIN IMUP|111 - 222 - 3333|1,000,000
const { createCanvas, loadImage, GlobalFonts } = require("@napi-rs/canvas");
const { writeFile, mkdir } = require("node:fs/promises");
const { existsSync } = require("node:fs");
const { join } = require("node:path");
const axios = require("axios");
const { footer } = require("../../lib/theme");

let handler = async (m, { sock, text, command }) => {
  if (!text) {
    return m.reply(`*Format salah!*\n\nContoh:\n${m.cmd} RIN IMUP|111 - 222 - 3333|1,000,000`);
  }

  const [namaPayload, rekPayload, saldoPayload] = text.split("|");
  if (!namaPayload || !rekPayload || !saldoPayload) {
    return m.reply(`*Format salah!*\n\nPastikan pakai pemisah |\nContoh:\n${m.cmd} RIN IMUP|111 - 222 - 3333|1,000,000`);
  }

  const txtNama = namaPayload.trim().toUpperCase();
  const txtRek = rekPayload.trim();
  const txtSaldo = saldoPayload.trim();

  await m.reply("⏳ Memproses gambar fake BCA...");

  try {
    const BG_URL = "https://raw.githubusercontent.com/ryyntwx/allimagerin/refs/heads/main/F1.png";
    const ASSETS_DIR = join(process.cwd(), "assets", "bcadash");
    const FONTS_DIR = join(ASSETS_DIR, "fonts");
    const BG_LOCAL = join(ASSETS_DIR, "template_f1.png");

    await mkdir(FONTS_DIR, { recursive: true });

    const fontConfigs = [
      { url: "https://fonts.gstatic.com/s/poppins/v23/pxiByp8kv8JHgFVrLEj6Z1xlFQ.woff2", name: "Poppins-SemiBold.ttf", family: "PoppinsBca" },
      { url: "https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuI6fAZ9hiJ-Ek-_EeA.woff2", name: "Inter-Medium.ttf", family: "InterMediumBca" },
      { url: "https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuFuYAZ9hiJ-Ek-_EeA.woff2", name: "Inter-Bold.ttf", family: "InterBoldBca" },
    ];
    for (const f of fontConfigs) {
      const fPath = join(FONTS_DIR, f.name);
      if (!existsSync(fPath)) {
        const fRes = await axios.get(f.url, { responseType: "arraybuffer" });
        await writeFile(fPath, Buffer.from(fRes.data));
      }
      GlobalFonts.registerFromPath(fPath, f.family);
    }

    if (!existsSync(BG_LOCAL)) {
      const res = await axios.get(BG_URL, { responseType: "arraybuffer" });
      await writeFile(BG_LOCAL, Buffer.from(res.data));
    }

    const bgImg = await loadImage(BG_LOCAL);
    const canvas = createCanvas(bgImg.width, bgImg.height);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(bgImg, 0, 0, canvas.width, canvas.height);
    ctx.textAlign = "left";
    ctx.textBaseline = "top";

    ctx.fillStyle = "#FFFFFF";
    ctx.font = "600 27px PoppinsBca";
    ctx.fillText(txtNama, 127, 56);

    ctx.fillStyle = "#FFFFFF";
    ctx.font = "500 28px InterMediumBca";
    ctx.fillText(txtRek, 211, 219);

    ctx.fillStyle = "#4F4F4F";
    ctx.font = "700 43px InterBoldBca";
    ctx.fillText(txtSaldo, 156, 361);

    const outBuffer = await canvas.encode("png");
    await sock.sendMessage(m.chat, {
      image: outBuffer,
      caption: `✅ *BCA Dashboard Generator*\n\n👤 *Nama:* ${txtNama}\n💳 *No. Rek:* ${txtRek}\n💰 *Saldo:* Rp ${txtSaldo}` + footer(),
    }, { quoted: m });
  } catch (err) {
    console.error("[FAKEBCA GAGAL]", err.message);
    m.reply("❌ Gagal membuat gambar fake BCA: " + err.message);
  }
};

handler.command = ["fkebca"];
handler.tags = ["tools"];
handler.help = ["fkebca <nama>|<norek>|<saldo>"];

module.exports = handler;
