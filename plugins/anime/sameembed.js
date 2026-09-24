// plugins/anime/sameembed.js — .sameembed <post>|<nume>|<type>|<url opsional>.
// Endpoint low-level buat ambil embed URL video player langsung (biasanya
// value post/nume/type ini didapet dari hasil .samestream, bukan diketik
// manual dari nol), GET /anime/samehadaku/embed?post=&nume=&type=(&url=)
// dari api.nexray.eu.cc.
const { nexrayJson, flattenToLines } = require("../../lib/nexrayClient");
const { usage, processing, fail, footer } = require("../../lib/theme");

let handler = async (m, { sock, text, prefix, command }) => {
  const parts = (text || "").split("|").map((s) => s?.trim());
  const [post, nume, type, url] = parts;
  if (!post || !nume || !type) {
    return m.reply(
      usage(
        `${prefix}${command} <post>|<nume>|<type>|<url opsional>`,
        `${prefix}${command} 37909|1|schtml`
      )
    );
  }

  const statusMsg = await sock.sendMessage(m.chat, { text: processing("Lagi ambil embed URL...") }, { quoted: m });

  try {
    const params = { post, nume, type };
    if (url) params.url = url;
    const json = await nexrayJson("/anime/samehadaku/embed", params);
    const data = json.result ?? json.data ?? json;
    const lines = flattenToLines(data);
    if (!lines.length) {
      console.error("[SAMEEMBED] Kosong:", JSON.stringify(json).slice(0, 300));
      return sock.sendMessage(m.chat, { text: fail("Data kosong/format gak dikenali. Detail ada di log server."), edit: statusMsg.key });
    }
    await sock.sendMessage(m.chat, { text: `🎬 *Embed Player*\n\n${lines.join("\n")}${footer()}`, edit: statusMsg.key });
  } catch (err) {
    console.error("[SAMEEMBED GAGAL]", err?.message || err);
    try { await sock.sendMessage(m.chat, { text: fail("Gagal ambil embed URL — API Nexray lagi down/error."), edit: statusMsg.key }); } catch {}
  }
};

handler.command = ["sameembed"];
handler.help = ["sameembed <post>|<nume>|<type> (ambil embed URL video player)"];
handler.tags = ["anime"];

module.exports = handler;
