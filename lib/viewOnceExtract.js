// lib/viewOnceExtract.js — logic bersama buat buka pesan "Lihat Sekali" (view
// once) yang di-reply, dipakai bareng sama plugins/owner/rvo.js (kirim ke
// chat/grup itu sendiri) dan plugins/owner/rvoown.js (kirim ke DM owner yang
// manggil). m.quoted.isViewOnce & field media (url/mediaKey/mimetype/dll)
// udah dijamin bener dari lib/serialize.js.
const { ok, fail } = require("./theme");

// Download + kirim ulang media view-once ke `targetJid`. Balikin true kalau
// sukses, false kalau gagal (pesan error udah dikirim ke m.chat sendiri).
async function openAndSend(m, sock, targetJid) {
  if (!m.quoted) {
    return { ok: false, reason: "no-quoted" };
  }
  if (!m.quoted.isViewOnce) {
    // Debug: kalau ternyata masih ada varian LAIN lagi dari cara WhatsApp
    // ngirim view-once yang belum ketebak, log ini nunjukin struktur mentah
    // aslinya biar gak nebak-nebak lagi.
    console.error("[RVO] isViewOnce=false. Raw quoted contextInfo:", JSON.stringify(m.msg?.contextInfo?.quotedMessage)?.slice(0, 1000));
    return { ok: false, reason: "not-viewonce" };
  }

  const buffer = await m.quoted.download();
  if (!buffer) throw new Error("download() balikin kosong.");

  const senderJid = m.quoted.sender || null;
  const senderTag = senderJid ? `@${senderJid.split("@")[0]}` : "(gak diketahui)";
  const chatLabel = m.isGroup ? "grup" : "chat pribadi";
  // FIX: sertakan juga caption ASLI dari pengirim (kalau ada) — sebelumnya
  // caption yang dikirim cuma info metadata (siapa/dari mana), teks yang
  // beneran ditulis pengirim pas kirim foto/video view-once itu (m.quoted.text,
  // udah diisi lib/serialize.js dari field caption media yang di-unwrap)
  // malah dibuang gitu aja. Sekarang caption asli ditaruh duluan, info
  // metadata nyusul di bawahnya biar tetap jelas ini hasil "buka view once".
  const originalCaption = m.quoted.text ? `${m.quoted.text}\n\n` : "";
  const caption = `${originalCaption}${ok(`🔓 View Once dibuka!\nDari: ${senderTag}\nAsal: ${chatLabel}`)}`;
  const sendOpts = senderJid ? { mentions: [senderJid] } : {};

  const dlType = m.quoted.mtype.replace(/message/i, "").toLowerCase(); // image / video / audio / document

  switch (dlType) {
    case "image":
      await sock.sendMessage(targetJid, { image: buffer, caption, ...sendOpts });
      break;
    case "video":
      await sock.sendMessage(targetJid, { video: buffer, caption, mimetype: m.quoted.mimetype || "video/mp4", ...sendOpts });
      break;
    case "audio":
      // Voice note sekali lihat: kirim dulu audionya (ptt biar keliatan kayak
      // voice note asli), baru info pengirimnya nyusul (audio message gak
      // punya field caption).
      await sock.sendMessage(targetJid, { audio: buffer, mimetype: m.quoted.mimetype || "audio/ogg; codecs=opus", ptt: true });
      await sock.sendMessage(targetJid, { text: caption, ...sendOpts });
      break;
    case "document":
      await sock.sendMessage(targetJid, { document: buffer, mimetype: m.quoted.mimetype, fileName: m.quoted.fileName || "file", caption, ...sendOpts });
      break;
    default:
      return { ok: false, reason: "unsupported-type", dlType };
  }

  return { ok: true };
}

module.exports = { openAndSend };
