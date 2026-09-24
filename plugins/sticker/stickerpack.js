// plugins/sticker/stickerpack.js — Cari & download satu paket sticker
const axios = require("axios");

if (!global.getStickerSession) global.getStickerSession = {};

class StickerPack {
  async search(query) {
    const res = await axios.post("https://getstickerpack.com/api/v1/stickerdb/search", { query, page: 1 }).then((v) => v.data);
    return res.data.map((v) => ({ name: v.title, slug: v.slug, download: v.download_counter }));
  }
  async detail(slug) {
    const res = await axios.get(`https://getstickerpack.com/api/v1/stickerdb/stickers/${slug}`).then((v) => v.data.data);
    return { title: res.title, stickers: res.images.map((v) => ({ image: `https://s3.getstickerpack.com/${v.url}`, animated: v.is_animated !== 0 })) };
  }
}
const scraper = new StickerPack();

let handler = async (m, { args }) => {
  if (!args.length) return m.reply(`Contoh:\n${m.cmd} blue archive`);

  const query = args.join(" ");
  const packs = await scraper.search(query);
  if (!packs.length) return m.reply("Sticker pack tidak ditemukan.");

  global.getStickerSession[m.sender] = packs.slice(0, 10);

  let teks = `✨ *HASIL STICKER PACK*\n\n`;
  packs.slice(0, 10).forEach((p, i) => { teks += `${i + 1}. ${p.name}\n• Download: ${p.download}\n\n`; });
  teks += `Balas dengan angka (1-${Math.min(packs.length, 10)}) untuk kirim sticker pack-nya.`;
  m.reply(teks);
};

handler.before = async (m, { sock }) => {
  if (!m.text || !/^(10|[1-9])$/.test(m.text)) return;
  const session = global.getStickerSession?.[m.sender];
  if (!session) return;

  const index = Number(m.text) - 1;
  const pick = session[index];
  if (!pick) return;

  delete global.getStickerSession[m.sender];
  await m.reply(`Mengirim sticker dari *${pick.name}*...`);

  try {
    const res = await scraper.detail(pick.slug);
    if (!res.stickers.length) return m.reply("Sticker kosong.");

    const hasStatic = res.stickers.some((s) => !s.animated);
    let sent = 0;
    for (const s of res.stickers) {
      if (sent >= 10) break;
      if (hasStatic && s.animated) continue;
      try {
        const img = await axios.get(s.image, { responseType: "arraybuffer" });
        await sock.sendSticker(m.chat, Buffer.from(img.data), m, { packname: "MaddazXD", author: "MaddazXD" });
        sent++;
        await new Promise((r) => setTimeout(r, 2000));
      } catch (e) {}
    }
    m.reply(`✔ Selesai, terkirim ${sent} sticker dari *${res.title}*`);
  } catch (e) {
    console.error("[STICKERPACK GAGAL]", e.message);
    m.reply("Gagal mengambil sticker pack.");
  }
};

handler.command = ["stickerpack"];
handler.tags = ["sticker"];
handler.help = ["stickerpack <query>"];

module.exports = handler;
