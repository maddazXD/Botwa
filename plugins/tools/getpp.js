// plugins/tools/getpp.js — Ambil foto profil WhatsApp dari nomor
const axios = require("axios");
const { table, fail, usage } = require("../../lib/theme");

let handler = async (m, { sock, text }) => {
  if (!text) return m.reply(usage(`${m.cmd} <nomor>`, `${m.cmd} 628xxxx`));

  const nomor = text.replace(/[^0-9]/g, "");
  if (!nomor) return m.reply(fail("Nomor gak valid!"));

  try {
    const { data } = await axios.get("https://wa-api.b-cdn.net/wa-dp/", {
      headers: {
        accept: "*/*",
        "user-agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36",
        origin: "https://snaplytics.io",
        referer: "https://snaplytics.io/",
      },
      params: { phone: nomor },
    });

    const caption = (sumber) => table([
      { label: "Nomor", value: nomor },
      { label: "Sumber", value: sumber },
    ]);

    if (data?.profilePicture) {
      const imgRes = await axios.get(data.profilePicture, { responseType: "arraybuffer" });
      return sock.sendMessage(m.chat, { image: Buffer.from(imgRes.data), caption: caption("API pihak ketiga") }, { quoted: m });
    }

    const jid = nomor + "@s.whatsapp.net";
    const pp = await sock.profilePictureUrl(jid, "image").catch(() => null);
    if (pp) {
      const imgRes = await axios.get(pp, { responseType: "arraybuffer" });
      await sock.sendMessage(m.chat, { image: Buffer.from(imgRes.data), caption: caption("WhatsApp langsung") }, { quoted: m });
    } else {
      m.reply(fail("Nomor gak punya foto profil / gak terdaftar di WhatsApp."));
    }
  } catch (e) {
    console.error("[GETPP GAGAL]", e.message);
    m.reply(fail("Terjadi kesalahan saat ambil foto profil."));
  }
};

handler.command = ["ppwa", "getpp"];
handler.tags = ["tools"];
handler.help = ["ppwa <nomor>"];

module.exports = handler;
