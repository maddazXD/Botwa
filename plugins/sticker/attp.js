// plugins/sticker/attp.js — Animated Text To Picture (stiker teks bergerak),
// pakai endpoint GET /maker/attp dari api.nexray.eu.cc (gratis, gak butuh API key).
// Defensif soal bentuk response: kadang provider kayak gini balikin biner
// gambar/gif langsung, kadang malah dibungkus JSON {url: "..."} — jadi
// content-type dicek dulu sebelum diputusin cara nanganinnya, biar gak
// gampang jebol kalau providernya ganti format tanpa pemberitahuan.
const { usage, fail } = require("../../lib/theme");
const { nexrayUrl, nexrayFetch, findHttpUrlDeep } = require("../../lib/nexrayClient");

let handler = async (m, { sock, text }) => {
  if (!text) return m.reply(usage(`${m.cmd} <teks>`, `${m.cmd} Halo apa kabar`));

  try {
    const url = nexrayUrl("/maker/attp", { text });
    const res = await nexrayFetch(url, { responseType: "arraybuffer", timeout: 60000 });

    if (res.status !== 200) {
      let msg = `HTTP ${res.status}`;
      try {
        const bodyText = Buffer.from(res.data).toString("utf8");
        const json = JSON.parse(bodyText);
        msg = json?.message || json?.error || msg;
      } catch {}
      throw new Error(msg);
    }

    const contentType = res.headers?.["content-type"] || "";
    let mediaSource;

    if (/json/i.test(contentType)) {
      const json = JSON.parse(Buffer.from(res.data).toString("utf8"));
      mediaSource = findHttpUrlDeep(json);
      if (!mediaSource) throw new Error("Response JSON gak punya URL hasil yang dikenali.");
    } else {
      mediaSource = Buffer.from(res.data);
    }

    await sock.sendSticker(m.chat, mediaSource, m, { packname: "👑 MaddazXD 👑" });
  } catch (err) {
    console.error("[ATTP GAGAL]", err?.message);
    m.reply(fail("Gagal membuat sticker attp: " + err.message));
  }
};

handler.help = "attp";
handler.command = ["attp"];
handler.tags = "sticker";

module.exports = handler;
