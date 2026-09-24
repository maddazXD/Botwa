// lib/interactiveMessage.js — Helper generik buat kirim pesan WA interaktif (header
// gambar + body teks + tombol native, misalnya tombol buka link/maps). Dipisah ke sini
// (bukan ditaruh di plugins/main/menu.js) biar bisa dipakai bareng-bareng dari plugin
// manapun (cuaca, dst) tanpa copy-paste ulang logic relayMessage-nya.
//
// Pola & caranya sama persis kayak yang dipakai di plugins/main/menu.js buat nampilin
// menu bergambar dengan tombol kategori — cuma di sini "buttons" bebas diisi apa aja
// (termasuk "cta_url" buat tombol buka link kayak Google Maps).
const { getBaileys } = require("./baileysLoader");

async function sendInteractiveCard(sock, m, { bodyText, footer = "", imageBuffer, buttons = [], jid }) {
  const { prepareWAMessageMedia } = await getBaileys();
  const targetJid = jid || m.chat;
  const contextInfo = { mentionedJid: [], forwardingScore: 999, isForwarded: true };
  const nativeFlowMessage = { buttons };

  let sent = false;

  if (imageBuffer && prepareWAMessageMedia) {
    try {
      const media = await prepareWAMessageMedia({ image: imageBuffer }, { upload: sock.waUploadToServer });
      await sock.relayMessage(
        targetJid,
        {
          viewOnceMessage: {
            message: {
              messageContextInfo: {},
              interactiveMessage: {
                header: { title: "", subtitle: "", hasMediaAttachment: true, imageMessage: media.imageMessage },
                body: { text: bodyText },
                footer: { text: footer },
                contextInfo,
                nativeFlowMessage,
              },
            },
          },
        },
        {}
      );
      sent = true;
    } catch (e) {
      sent = false;
    }
  }

  if (!sent) {
    try {
      await sock.relayMessage(
        targetJid,
        {
          viewOnceMessage: {
            message: {
              messageContextInfo: {},
              interactiveMessage: {
                header: { title: "", subtitle: "", hasMediaAttachment: false },
                body: { text: bodyText },
                footer: { text: footer },
                contextInfo,
                nativeFlowMessage,
              },
            },
          },
        },
        {}
      );
      sent = true;
    } catch (e) {
      sent = false;
    }
  }

  return sent;
}

module.exports = { sendInteractiveCard };
