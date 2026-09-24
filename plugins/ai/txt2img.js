// plugins/ai/txt2img.js — generate gambar dari deskripsi teks (Text-to-Image AI),
// pakai endpoint GET /faa/ai-text2img-pro dari api-faa.my.id (sebelumnya pakai
// /api/ai/txt2img/create dari api.andaraz.com, diganti karena hasilnya "Ai Text2Img
// Pro" di api-faa dianggap lebih bagus). Beda dari Andaraz, endpoint ini gak minta
// apikey — cuma parameter "prompt" lewat query string (GET, bukan form POST).
const axios = require("axios");
const { faaUrl, extractFaaImage, withTickedProgress } = require("../../lib/faaClient");
const { usage, processing, ok, fail, progressBar } = require("../../lib/theme");

let handler = async (m, { sock, text, prefix, command }) => {
  const prompt = (text || "").trim();
  if (!prompt) {
    return m.reply(
      usage(`${prefix}${command} <deskripsi gambar>`, `${prefix}${command} kucing oren duduk di atas awan, gaya anime`)
    );
  }

  const label = `Lagi generate gambar dari prompt: "${prompt}"...`;
  const statusMsg = await sock.sendMessage(m.chat, { text: processing(label) }, { quoted: m });

  try {
    // Suffix "anatomy/limbs/body parts" CUMA ditambahin kalau prompt-nya emang
    // ngandung makhluk hidup (orang/hewan/karakter) — soalnya kalau ditempel ke
    // SEMUA prompt (termasuk yang gak nyambung, kayak "halaman VSCode"), kata
    // "anatomy"/"limbs" malah bisa jadi dominan dan nge-drive hasilnya ke arah
    // figur anatomi/otot yang gak diminta sama sekali. Prompt non-makhluk-hidup
    // cukup dikasih suffix kualitas umum yang netral.
    const LIVING_SUBJECT_HINTS = /\b(cat|dog|human|person|man|woman|boy|girl|animal|creature|character|hero|warrior|monster|cow|horse|bird|dragon|fish|wolf|lion|tiger|bear|kucing|anjing|manusia|orang|hewan|karakter|pahlawan|monster|naga|kuda|burung|sapi|singa|harimau|beruang|ikan|serigala|wanita|pria|anak)\b/i;
    const hasLivingSubject = LIVING_SUBJECT_HINTS.test(prompt);
    const qualitySuffix = hasLivingSubject
      ? ", correct anatomy, correct proportions, anatomically accurate, no extra limbs, no extra legs, no extra fingers, no distorted or malformed body parts, high quality, coherent details"
      : ", high quality, coherent details, sharp focus, well-composed";
    const enhancedPrompt = `${prompt}${qualitySuffix}`;

    let lastPercent = -1;
    const onProgress = async (percent) => {
      if (percent === lastPercent || percent >= 100) return;
      lastPercent = percent;
      try { await sock.sendMessage(m.chat, { text: processing(`${label}\n${progressBar(percent)}`), edit: statusMsg.key }); } catch {}
    };

    const res = await withTickedProgress(
      axios.get(faaUrl("/faa/ai-text2img-pro", { prompt: enhancedPrompt }), {
        responseType: "arraybuffer",
        timeout: 120000,
        validateStatus: () => true,
      }),
      onProgress,
      { estimatedMs: 90000 }
    );

    if (res.status !== 200) {
      console.error("[TXT2IMG GAGAL] HTTP", res.status, Buffer.from(res.data).toString("utf8").slice(0, 300));
      return sock.sendMessage(m.chat, { text: fail(`API FAA gagal generate gambar (HTTP ${res.status}). Coba lagi nanti.`), edit: statusMsg.key });
    }

    const imageBuffer = await extractFaaImage(res, { onProgress });
    await sock.sendMessage(m.chat, { text: ok(`Selesai! Prompt: "${prompt}"`), edit: statusMsg.key });
    await sock.sendMessage(m.chat, { image: imageBuffer }, { quoted: m });
  } catch (err) {
    console.error("[TXT2IMG GAGAL]", err?.response?.data ? JSON.stringify(err.response.data).slice(0, 300) : err?.message);
    try { await sock.sendMessage(m.chat, { text: fail("Gagal generate gambar. Coba lagi, atau pakai prompt yang lebih simpel."), edit: statusMsg.key }); } catch {}
  }
};

handler.command = ["txt2img", "text2img", "imagine"];
handler.help = ["txt2img <deskripsi gambar> (generate gambar dari teks pakai AI)"];
handler.tags = ["ai"];

module.exports = handler;
