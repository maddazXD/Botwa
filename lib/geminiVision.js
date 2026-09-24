// lib/geminiVision.js — panggil Gemini API ASLI (Google AI Studio), BUKAN
// lewat Andaraz. Andaraz's /api/ai/gemini cuma nerima teks & TERBUKTI gak
// bisa fetch gambar dari URL apapun (udah dites: pone.rs, CatBox, GET, POST
// — semua gagal, AI-nya sendiri konfirmasi cuma bisa baca file yang
// "diunggah langsung", bukan URL). Jadi di sini beda pendekatan total:
// gambar dikirim LANGSUNG sebagai bytes (base64), nempel di body request —
// gak ada acara upload ke hosting luar dulu, gak ada URL sama sekali, jadi
// gak mungkin ke-block/gagal-fetch kayak sebelumnya.
//
// Butuh API KEY SENDIRI dari https://aistudio.google.com (Google AI Studio,
// GRATIS) -> tombol "Get API key" -> isi ke config.js sebagai
// global.geminiApiKey. Ini API key BEDA dari global.andarazApiKey.
const axios = require("axios");

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";

function requireGeminiKey() {
  if (!global.geminiApiKey) {
    throw new Error(
      "global.geminiApiKey kosong di config.js. Daftar gratis dulu di https://aistudio.google.com -> \"Get API key\", baru isi ke config.js."
    );
  }
  return global.geminiApiKey;
}

// Helper inti: kirim array `contents` (format resmi Gemini, role
// user/model) ke generateContent, balikin teks jawabannya. Dipake bareng
// sama describeImage() (single-shot) & chatWithMemory() (multi-turn).
async function callGemini(contents) {
  const key = requireGeminiKey();
  const model = global.geminiVisionModel || "gemini-2.5-flash";
  const url = `${GEMINI_BASE}/models/${model}:generateContent`;

  const res = await axios.post(url, { contents }, {
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    timeout: 60000,
    validateStatus: () => true,
  });

  if (res.status !== 200) {
    const errMsg = res.data?.error?.message || JSON.stringify(res.data).slice(0, 300);
    throw new Error(`Gemini API error (HTTP ${res.status}): ${errMsg}`);
  }

  const parts = res.data?.candidates?.[0]?.content?.parts || [];
  const text = parts.map((p) => p.text || "").join("").trim();
  if (!text) {
    // Bisa aja diblokir safety filter Gemini sendiri (finishReason: SAFETY dst)
    const finishReason = res.data?.candidates?.[0]?.finishReason;
    throw new Error(
      finishReason
        ? `Gemini gak ngasih jawaban (finishReason: ${finishReason}) — mungkin gambarnya kena safety filter.`
        : `Gemini API gak ngasih jawaban teks. Response: ${JSON.stringify(res.data).slice(0, 300)}`
    );
  }
  return text;
}

// Kirim gambar (Buffer mentah, BUKAN URL) + prompt teks LANGSUNG ke Gemini
// API asli, balikin jawaban teksnya. Gambar beneran "dilihat" byte-per-byte
// di sini (base64 inline), bukan nyoba fetch link kayak Andaraz.
// SINGLE-SHOT — gak ada memori percakapan sebelumnya (buat itu, pakai
// chatWithMemory di bawah).
async function describeImage(buffer, mimetype, prompt) {
  return callGemini([
    {
      role: "user",
      parts: [
        { text: prompt || "Jelaskan isi gambar ini." },
        { inlineData: { mimeType: mimetype || "image/jpeg", data: buffer.toString("base64") } },
      ],
    },
  ]);
}

// MULTI-TURN — dipake dari lib/aiRouter.js pas suatu chat udah punya
// riwayat percakapan (lib/convoMemory.js), biar Gemini asli bisa nge-liat
// KONTEKS PENUH obrolan sebelumnya (termasuk gambar yang udah dibahas
// sebelumnya, kalau masih kesimpen di memory-nya) — bukan cuma jawab satu
// pertanyaan berdiri sendiri. `memoryTurns` = array dari lib/convoMemory.js
// (getMemory), `imageBuffer`/`imageMime` = gambar BARU di giliran ini
// (boleh null kalau giliran ini teks doang).
async function chatWithMemory(memoryTurns, prompt, imageBuffer, imageMime) {
  const contents = memoryTurns.map((t) => {
    const parts = [];
    if (t.imageBuffer) {
      parts.push({ inlineData: { mimeType: t.imageMime || "image/jpeg", data: t.imageBuffer.toString("base64") } });
    }
    if (t.text) parts.push({ text: t.text });
    if (parts.length === 0) parts.push({ text: "" });
    return { role: t.role === "assistant" ? "model" : "user", parts };
  });

  const newParts = [];
  if (imageBuffer) {
    newParts.push({ inlineData: { mimeType: imageMime || "image/jpeg", data: imageBuffer.toString("base64") } });
  }
  newParts.push({ text: prompt || "Jelaskan isi gambar ini." });
  contents.push({ role: "user", parts: newParts });

  return callGemini(contents);
}

module.exports = { describeImage, chatWithMemory };
