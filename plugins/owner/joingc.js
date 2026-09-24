// plugins/owner/joingc.js — Join grup lewat link undangan WhatsApp
let handler = async (m, { sock, text }) => {
  if (!text) return m.reply(`Contoh:\n${m.cmd} https://chat.whatsapp.com/AbCdEfGhIjKlMnOpQrStUv`);

  const match = text.trim().match(/(?:https?:\/\/)?chat\.whatsapp\.com\/([0-9A-Za-z]{20,30})/i);
  if (!match) return m.reply("❌ Link grup WhatsApp tidak valid.");
  const code = match[1];

  try {
    let info = null;
    try { info = await sock.groupGetInviteInfo(code); } catch {}

    const jid = await sock.groupAcceptInvite(code);
    let txt = `✅ Berhasil bergabung ke grup.`;
    if (info) txt += `\n\n📌 Nama : ${info.subject || "-"}\n👥 Member : ${info.size || info.participants?.length || "-"}\n🆔 JID : ${jid}`;
    m.reply(txt);
  } catch (e) {
    console.error("[JOINGC GAGAL]", e.message);
    let msg = "❌ Gagal bergabung ke grup.";
    if (/already/i.test(String(e))) msg = "ℹ️ Bot sudah berada di grup tersebut.";
    else if (/expired/i.test(String(e))) msg = "❌ Link grup sudah kedaluwarsa.";
    else if (/not-authorized|401/i.test(String(e))) msg = "❌ Link grup tidak valid.";
    m.reply(msg);
  }
};

handler.command = ["joingc"];
handler.tags = ["owner"];
handler.help = ["joingc <link grup>"];
handler.owner = true;

module.exports = handler;
