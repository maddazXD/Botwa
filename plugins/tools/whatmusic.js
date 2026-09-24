// plugins/tools/whatmusic.js — Deteksi judul lagu dari cuplikan audio (reply audio)
const axios = require("axios");
const FormData = require("form-data");
const { getMediaSource } = require("../../lib/mediaHelper");

let handler = async (m, { sock }) => {
  const source = getMediaSource(m);
  if (!source || source.mtype !== "audioMessage") {
    return m.reply(`*Contoh: reply audio dengan perintah ${m.cmd}*`);
  }

  await m.react("⏳");

  try {
    const media = await source.download();
    const form = new FormData();
    form.append("file", media, "audio.mp3");
    form.append("sample_size", "118784");

    const res = await axios.post("https://api.doreso.com/humming", form, {
      headers: {
        ...form.getHeaders(),
        "user-agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36",
        accept: "application/json, text/plain, */*",
        origin: "https://www.aha-music.com",
        referer: "https://www.aha-music.com/",
      },
    });

    const json = res.data;
    if (!json?.data?.title) return m.reply("*🍂 Gagal Mendeteksi Musik*");

    const hasil = `*🎵 WHAT MUSIC DETECTED*\n*🎤 Artist:* ${json.data.artists || "Tidak Diketahui"}\n*🎧 Title:* ${json.data.title || "Tidak Diketahui"}\n*🆔 Track ID:* ${json.data.acrid}`;
    await m.reply(hasil);
  } catch (e) {
    m.reply("*🍂 Terjadi Kesalahan Saat Mendeteksi Musik*");
  } finally {
    await m.react("");
  }
};

handler.command = ["whatmusic", "whatmusik", "wmusic"];
handler.tags = ["tools"];
handler.help = ["whatmusic (reply audio)"];

module.exports = handler;
