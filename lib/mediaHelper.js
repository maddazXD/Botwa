// lib/mediaHelper.js
// Menyeragamkan cara ambil media: user bisa REPLY ke pesan media, ATAU kirim medianya
// langsung dengan caption command (mis. kirim gambar dengan caption ".rbg"). Baileys/
// serialize.js nyimpen struktur field yang beda antara m.quoted vs m langsung, jadi
// helper ini nyamain jadi satu bentuk yang konsisten: { mtype, mimetype, fileName,
// seconds, download }.

function getMediaSource(m) {
  if (m.quoted && m.quoted.mtype && m.quoted.download) {
    return {
      mtype: m.quoted.mtype,
      mimetype: m.quoted.mimetype || "",
      fileName: m.quoted.fileName || null,
      seconds: m.quoted.seconds || 0,
      download: m.quoted.download,
    };
  }
  if (m.download && m.mtype && m.msg) {
    return {
      mtype: m.mtype,
      mimetype: m.msg.mimetype || "",
      fileName: m.msg.fileName || null,
      seconds: m.msg.seconds || 0,
      download: m.download,
    };
  }
  return null;
}

module.exports = { getMediaSource };
