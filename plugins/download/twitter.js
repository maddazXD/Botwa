// plugins/download/twitter.js — Downloader video Twitter/X
// Scrape via savetwitter.net (public, gak butuh API key). Video only.
const axios = require("axios");
const { footer } = require("../../lib/theme");

let handler = async (m, { sock, text }) => {
  // FIX BUG: sebelumnya cuma cek `!text` tanpa validasi domain sama sekali —
  // beda dari download-tikok.js/facebook.js yang udah benar validasi domain
  // dulu. Ketikan apa pun (bukan link twitter/x) bakal lolos dan langsung
  // nembak API savetwitter.net, hasil errornya jadi membingungkan ("video
  // tidak ditemukan") padahal user emang belum kasih link sama sekali.
  if (!text || !/(twitter\.com|x\.com)/.test(text)) {
    return m.reply(`*Contoh:*\n${m.cmd} https://x.com/...`);
  }

  await m.reply("⏳ Diproses dulu ya...");

  try {
    const body = new URLSearchParams({ q: text.trim(), lang: "id", cftoken: "" });
    const res = await axios.post("https://savetwitter.net/api/ajaxSearch", body, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Content-Type": "application/x-www-form-urlencoded",
        "X-Requested-With": "XMLHttpRequest",
        Origin: "https://savetwitter.net",
        Referer: "https://savetwitter.net/id3",
      },
    });

    const html = res.data?.data;
    if (!html) return m.reply("❌ Gagal mengambil data video.");

    const title = html.match(/<h3>(.*?)<\/h3>/)?.[1]?.trim() || "Twitter Video";
    const duration = html.match(/<p>(\d+:\d+)<\/p>/)?.[1] || "-";

    const mp4 = [...html.matchAll(/href="(https:\/\/dl\.snapcdn\.app\/get\?token=[^"]+)".*?MP4\s*\(([^)]+)\)/g)]
      .map((v) => ({ quality: v[2], url: v[1] }));

    if (!mp4.length) return m.reply("❌ Video tidak ditemukan (mungkin post-nya bukan video).");

    const best = mp4[0];
    const videoRes = await axios.get(best.url, { responseType: "arraybuffer", timeout: 120000 });

    await sock.sendMessage(m.chat, {
      video: Buffer.from(videoRes.data),
      caption: `🐦 *Twitter/X Downloader*\n📌 ${title}\n⏱️ ${duration}\n🎞️ Kualitas: ${best.quality}` + footer(),
    }, { quoted: m });
  } catch (err) {
    console.error("[TWITTER GAGAL]", err.message);
    m.reply("❌ Terjadi kesalahan saat memproses video: " + err.message);
  }
};

handler.command = ["twitter", "tw", "xdl"];
handler.tags = ["Download"];
handler.help = ["twitter <link>"];

module.exports = handler;
