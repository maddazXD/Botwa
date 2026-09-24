// plugins/tools/ssweb.js — Screenshot atau record video sebuah website
const axios = require("axios");

let handler = async (m, { sock, text }) => {
  if (!text) {
    return m.reply(
      `乂 *SSWEB / RECORD WEB*\n\n📌 Screenshot:\n${m.cmd} https://github.com\n\n🎥 Record video:\n${m.cmd} video https://github.com\n\n` +
      `⚙️ Opsi device:\ndesktop_fhd / desktop / tablet / mobile\n\nContoh:\n${m.cmd} video https://github.com desktop_fhd 8000`
    );
  }

  try {
    const args = text.trim().split(/\s+/);
    const mode = args[0]?.toLowerCase() === "video" ? "video" : "image";
    if (mode === "video") args.shift();

    let url = args[0];
    const device = args[1] || "desktop_fhd";
    const duration = Number(args[2]) || 8000;

    if (!url) return m.reply("Masukkan URL website-nya.");
    if (!/^https?:\/\//i.test(url)) url = "https://" + url;

    await m.reply(mode === "video" ? "⏳ Lagi record website jadi video..." : "⏳ Lagi screenshot website...");

    if (mode === "video") {
      const { data } = await axios.post(
        "https://shinana-bentosnap.hf.space/api/record",
        { url, device, duration_ms: duration, fps: 30, scroll: true, dark_mode: false, wait_ms: 1500 },
        { headers: { accept: "application/json", "Content-Type": "application/json" }, timeout: 120000 }
      );
      const videoUrl = data?.url || data?.video || data?.result || data?.output || data?.data?.url;
      if (!videoUrl) return m.reply(`Gagal ambil hasil video.\n\n${JSON.stringify(data, null, 2).slice(0, 1000)}`);

      return sock.sendMessage(m.chat, {
        video: { url: videoUrl }, mimetype: "video/mp4",
        caption: `乂 *WEB RECORD*\n\n🌐 URL: ${url}\n📱 Device: ${device}\n⏱️ Duration: ${duration}ms`,
      }, { quoted: m });
    }

    const { data } = await axios.post(
      "https://shinana-bentosnap.hf.space/api/screenshot",
      { url, device, dark_mode: false, wait_ms: 1500 },
      { headers: { accept: "application/json", "Content-Type": "application/json" }, timeout: 120000 }
    );
    const imageUrl = data?.url || data?.image || data?.result || data?.output || data?.data?.url;
    if (!imageUrl) return m.reply(`Gagal ambil hasil screenshot.\n\n${JSON.stringify(data, null, 2).slice(0, 1000)}`);

    return sock.sendMessage(m.chat, { image: { url: imageUrl }, caption: `乂 *SS WEB*\n\n🌐 URL: ${url}\n📱 Device: ${device}` }, { quoted: m });
  } catch (e) {
    m.reply(`Error: ${e.message}`);
  }
};

handler.command = ["ssweb", "ss", "webss", "recordweb"];
handler.tags = ["tools"];
handler.help = ["ssweb <url>", "ssweb video <url>"];

module.exports = handler;
