// plugins/tools/qrcode.js — generate QR code. Library "qrcode" jalan 100% lokal.
//
// CATATAN TEKNIS PENTING: QR code itu kapasitasnya kecil (paling banyak ~3000 karakter
// teks/data mentah) — gak mungkin nampung bytes foto/video beneran (foto biasanya
// ratusan KB - jutaan byte). Jadi buat "gambar jadi QR code", yang kejadian sebenarnya
// adalah: media di-upload dulu ke hosting (catbox.moe, dipakai juga di .setthumbnail),
// terus LINK hasil upload itu yang di-encode jadi QR code. Ini cara yang sama dipakai
// semua QR generator lain di dunia buat "share file lewat QR".
const QRCode = require("qrcode");
const { getMediaSource } = require("../../lib/mediaHelper");
const { uploadImageBuffer } = require("../../lib/screaper");
const { usage, processing, fail } = require("../../lib/theme");

function buildWifiPayload(ssid, password) {
  const esc = (s) => String(s).replace(/([\\;,:"])/g, "\\$1");
  return `WIFI:T:WPA;S:${esc(ssid)};P:${esc(password)};;`;
}
function buildVcardPayload(name, phone) {
  return `BEGIN:VCARD\nVERSION:3.0\nN:${name}\nFN:${name}\nTEL:${phone}\nEND:VCARD`;
}

let handler = async (m, { sock, text, prefix, command }) => {
  const source = getMediaSource(m);

  // Mode media: reply foto/video/dokumen -> upload dulu, baru link-nya yang di-QR-in
  if (source && ["imageMessage", "videoMessage", "documentMessage"].includes(source.mtype)) {
    await m.reply(processing("Upload media dulu, abis itu bikin QR code-nya..."));
    try {
      const buffer = await source.download();
      const link = await uploadImageBuffer(buffer);
      if (!link) return m.reply(fail("Gagal upload medianya, coba lagi."));

      const qrBuf = await QRCode.toBuffer(link, { type: "png", width: 512, margin: 2 });
      return sock.sendMessage(
        m.chat,
        {
          image: qrBuf,
          caption: `📱 QR Code link ke media ini:\n${link}\n\n_(QR code cuma bisa nyimpen teks pendek, jadi media di-upload dulu, baru link-nya yang di-QR-in — bukan file-nya langsung.)_`,
        },
        { quoted: m }
      );
    } catch (err) {
      console.error("[QRCODE MEDIA GAGAL]", err?.message || err);
      return m.reply(fail("Gagal memproses media."));
    }
  }

  if (!text) {
    return m.reply(
      usage(
        `${prefix}${command} <teks/link>\n${prefix}${command} wifi <ssid>|<password>\n${prefix}${command} vcard <nama>|<nomor>\natau reply foto/video/dokumen`,
        `${prefix}${command} wifi RumahKu|passwordwifiku123`
      )
    );
  }

  let payload = text.trim();
  const lower = payload.toLowerCase();

  if (lower.startsWith("wifi ")) {
    const [ssid, password] = payload.slice(5).split("|").map((s) => s?.trim());
    if (!ssid || !password) return m.reply(fail(`Format: ${prefix}${command} wifi <ssid>|<password>`));
    payload = buildWifiPayload(ssid, password);
  } else if (lower.startsWith("vcard ")) {
    const [name, phone] = payload.slice(6).split("|").map((s) => s?.trim());
    if (!name || !phone) return m.reply(fail(`Format: ${prefix}${command} vcard <nama>|<nomor>`));
    payload = buildVcardPayload(name, phone);
  }

  try {
    const buffer = await QRCode.toBuffer(payload, { type: "png", width: 512, margin: 2, errorCorrectionLevel: "M" });
    await sock.sendMessage(m.chat, { image: buffer, caption: `📱 QR Code buat:\n${text.trim()}` }, { quoted: m });
  } catch (err) {
    console.error("[QRCODE GAGAL]", err?.message || err);
    m.reply(fail("Gagal membuat QR code, isinya mungkin kepanjangan."));
  }
};

handler.command = ["qrcode", "qr"];
handler.help = ["qrcode <teks/link>", "qrcode wifi <ssid>|<password>", "qrcode vcard <nama>|<nomor>", "qrcode (reply media)"];
handler.tags = ["tools"];

module.exports = handler;
