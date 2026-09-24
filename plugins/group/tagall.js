// plugins/group/tagall.js — Tag semua member grup (daftar mention keliatan)
const { getBaileys } = require("../../lib/baileysLoader");

let handler = async (m, { sock, text }) => {
  const { generateWAMessageFromContent, proto } = await getBaileys();
  const participants = m.metadata?.participants || [];

  let teks = `◇───── Tag All ─────◇\n乂 *Pesan : ${text || "kosong"}*\n\n`;
  const mentions = [];

  for (const p of participants) {
    const jid = p.id || p.jid;
    if (!jid) continue;
    teks += `• @${jid.split("@")[0]}\n`;
    mentions.push(jid);
  }

  const msg = generateWAMessageFromContent(
    m.chat,
    { extendedTextMessage: proto.Message.ExtendedTextMessage.fromObject({ text: teks, contextInfo: { mentionedJid: mentions } }) },
    { quoted: m }
  );
  await sock.relayMessage(m.chat, msg.message, { messageId: msg.key.id });
};

handler.command = ["tagall"];
handler.tags = "admin";
handler.help = ["tagall <teks>"];
handler.admin = true;
handler.group = true;

module.exports = handler;
