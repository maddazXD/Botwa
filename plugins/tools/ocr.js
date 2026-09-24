// plugins/tools/ocr.js — scan foto jadi teks, pakai endpoint GET /faa/ocr?url=...
// dari api-faa.my.id (sebelumnya pakai tesseract.js lokal yang kurang akurat
// buat foto biasa/gak scan). Skema respons gak dikonfirmasi persis, jadi dicoba
// beberapa kemungkinan nama field umum + fallback tampilin JSON mentah kalau
// semuanya gak ketemu (biar gak diem2 gagal tanpa info).
const { getMediaSource } = require("../../lib/mediaHelper");
const { uploadImageBuffer } = require("../../lib/screaper");
const { faaUrl, retryFetch } = require("../../lib/faaClient");
const { usage, processing, ok, fail, footer } = require("../../lib/theme");

let handler = async (m, { sock, prefix, command }) => {
  const source = getMediaSource(m);
  if (!source || source.mtype !== "imageMessage") {
    return m.reply(usage(`Reply foto yang ada tulisannya, terus ketik ${prefix}${command}`, `${prefix}${command}`));
  }

  const label = "Lagi baca tulisan di foto...";
  const statusMsg = await sock.sendMessage(m.chat, { text: processing(label) }, { quoted: m });

  try {
    const buffer = await source.download();
    const publicUrl = await uploadImageBuffer(buffer);
    if (!publicUrl) throw new Error("Gagal upload foto ke hosting sementara buat diproses API FAA.");

    const res = await retryFetch(faaUrl("/faa/ocr", { url: publicUrl }), {
      responseType: "arraybuffer",
      timeout: 60000,
      validateStatus: () => true,
    });

    if (res.status !== 200) {
      const bodyPreview = Buffer.from(res.data).toString("utf8").slice(0, 300);
      throw new Error(`API FAA gagal (HTTP ${res.status}): ${bodyPreview}`);
    }

    const contentType = res.headers["content-type"] || "";
    let text;
    if (contentType.startsWith("text/plain")) {
      text = Buffer.from(res.data).toString("utf8").trim();
    } else {
      const json = JSON.parse(Buffer.from(res.data).toString("utf8"));
      if (json.status === false) throw new Error(`API FAA error: ${json.message || JSON.stringify(json).slice(0, 200)}`);
      const r = json.result ?? json.data ?? json;
      if (r?.IsErroredOnProcessing) {
        const errMsg = r?.ParsedResults?.[0]?.ErrorMessage || r?.ErrorMessage || "OCR gagal proses foto ini.";
        throw new Error(Array.isArray(errMsg) ? errMsg.join(", ") : String(errMsg));
      }
      text = (
        (typeof r === "string" ? r : null) ||
        r?.ParsedResults?.[0]?.ParsedText ||
        r?.text || r?.ocr_text || r?.extracted_text || r?.content ||
        json.text || json.ocr_text
      );
      if (!text) {
        console.error("[OCR] Field teks gak ketemu:", JSON.stringify(json).slice(0, 300));
        return sock.sendMessage(m.chat, { text: fail("API gak ngasih teks yang bisa dikenali. Detail ada di log server."), edit: statusMsg.key });
      }
      text = String(text).trim();
    }

    if (!text) {
      return sock.sendMessage(m.chat, { text: fail("Gak ada tulisan yang kebaca di foto ini. Coba foto yang lebih jelas/terang."), edit: statusMsg.key });
    }

    await sock.sendMessage(m.chat, { text: `📝 *Hasil OCR:*\n\n${text}${footer()}`, edit: statusMsg.key });
  } catch (err) {
    console.error("[OCR GAGAL]", err?.response?.data ? JSON.stringify(err.response.data).slice(0, 300) : err?.message);
    try { await sock.sendMessage(m.chat, { text: fail("Gagal baca tulisan dari foto — API FAA lagi down/error. Coba lagi nanti."), edit: statusMsg.key }); } catch {}
  }
};

handler.command = ["ocr", "scantext", "baca"];
handler.help = ["ocr (reply foto yang ada tulisannya — baca teksnya)"];
handler.tags = ["tools"];

module.exports = handler;
