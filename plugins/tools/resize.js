// plugins/tools/resize.js — Resize ukuran gambar (reply/kirim gambar)
const Jimp = require("jimp");
const { getMediaSource } = require("../../lib/mediaHelper");
const { footer } = require("../../lib/theme");

let handler = async (m, { sock, args }) => {
  const towidth = parseInt(args[0]);
  const toheight = parseInt(args[1]);
  if (!towidth && !toheight) return m.reply("Masukkan ukuran width atau height minimal 1!\n\nContoh:\n.resize 512 512");

  const source = getMediaSource(m);
  if (!source || source.mtype !== "imageMessage") return m.reply("Reply/kirim gambar dulu.");

  await m.reply("⏳ Memproses...");

  try {
    const media = await source.download();
    const image = await Jimp.read(media);
    const before = { width: image.bitmap.width, height: image.bitmap.height };

    image.resize(towidth || Jimp.AUTO, toheight || Jimp.AUTO);
    const resizedBuffer = await image.getBufferAsync(Jimp.MIME_JPEG);
    const after = { width: image.bitmap.width, height: image.bitmap.height };

    await sock.sendMessage(m.chat, {
      image: resizedBuffer,
      caption:
        `*––––––『 RESIZE 』––––––*\n\n*• BEFORE*\n> ᴡɪᴅᴛʜ : ${before.width}\n> ʜᴇɪɢʜᴛ : ${before.height}\n\n` +
        `*• AFTER*\n> ᴡɪᴅᴛʜ : ${after.width}\n> ʜᴇɪɢʜᴛ : ${after.height}` + footer(),
    }, { quoted: m });
  } catch (e) {
    console.error("[RESIZE GAGAL]", e.message);
    m.reply("❌ Gagal resize gambar.");
  }
};

handler.command = ["resize"];
handler.tags = ["tools"];
handler.help = ["resize <width> <height> (reply gambar)"];

module.exports = handler;
