// plugins/tools/translate.js — Translate teks pakai Google Translate (gratis, gak butuh API key)
const axios = require("axios");
const { footer } = require("../../lib/theme");

async function translate(query, lang) {
  const url = new URL("https://translate.googleapis.com/translate_a/single");
  url.searchParams.append("client", "gtx");
  url.searchParams.append("sl", "auto");
  url.searchParams.append("dt", "t");
  url.searchParams.append("tl", lang);
  url.searchParams.append("q", query);
  const { data } = await axios.get(url.href);
  return [data[0].map((item) => item[0]).join(""), data[2]];
}

let handler = async (m, { args, text }) => {
  let lang, txt;
  if (args.length >= 2) { lang = args[0]; txt = args.slice(1).join(" "); }
  else if (m.quoted?.text) { lang = args[0] || "id"; txt = m.quoted.text; }
  else return m.reply(`*Contoh:*\n${m.cmd} id hello i am robot`);

  try {
    const [translated, detected] = await translate(txt.trim(), lang);
    const caption =
      `*❲•❳ Terdeteksi ❲•❳*\n- ${(detected || "auto").toUpperCase()}\n\n` +
      `*❲•❳ Ke Bahasa ❲•❳*\n- ${lang.toUpperCase()}\n\n` +
      `*❲•❳ Terjemahan ❲•❳*\n- ${translated.trim()}` + footer();
    await m.reply(caption);
  } catch (err) {
    console.error("[TRANSLATE GAGAL]", err.message);
    m.reply("❌ Gagal menerjemahkan. Pastikan kode bahasa valid (contoh: id, en, ja).");
  }
};

handler.command = ["translate", "tr"];
handler.tags = ["tools"];
handler.help = ["translate <kode bahasa> <teks>"];

module.exports = handler;
