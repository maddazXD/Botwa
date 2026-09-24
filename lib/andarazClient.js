// lib/andarazClient.js — helper bersama buat manggil api.andaraz.com dari beberapa
// plugin AI (.hd, .txt2img, .jadianime, .jadizombie, dst) tanpa duplikat logic parsing
// response. Skema response Andaraz gak fix/gak didokumentasiin lengkap (kadang balikin
// file gambar langsung, kadang JSON isinya URL) — jadi ditangani dua-duanya di sini.
const axios = require("axios");

const ANDARAZ_BASE = "https://api.andaraz.com";

function requireAndarazKey() {
  if (!global.andarazApiKey) {
    throw new Error("global.andarazApiKey kosong di config.js.");
  }
  return global.andarazApiKey;
}

function andarazUrl(endpointPath, extraParams = {}) {
  const params = new URLSearchParams({ apikey: requireAndarazKey(), ...extraParams });
  return `${ANDARAZ_BASE}${endpointPath}?${params.toString()}`;
}

// Ambil buffer gambar dari response axios (responseType: "arraybuffer").
// Kalau content-type-nya gambar → langsung dipakai. Kalau JSON → dicoba beberapa
// kemungkinan field umum buat nemuin URL hasilnya, terus di-download.
async function extractAndarazImage(res) {
  const contentType = res.headers["content-type"] || "";
  if (contentType.startsWith("image/")) {
    return Buffer.from(res.data);
  }

  let json;
  try {
    json = JSON.parse(Buffer.from(res.data).toString("utf8"));
  } catch {
    throw new Error("Response Andaraz API gak jelas formatnya (bukan gambar maupun JSON valid).");
  }
  if (json.status && json.status !== "success" && json.status !== true) {
    throw new Error(`Andaraz API error: ${json.message || JSON.stringify(json).slice(0, 200)}`);
  }
  const resultUrl =
    json.result?.url || (typeof json.result === "string" ? json.result : null) ||
    json.data?.url || (typeof json.data === "string" ? json.data : null) ||
    json.url;
  if (!resultUrl || typeof resultUrl !== "string") {
    throw new Error(`Andaraz API gak ngasih URL hasil gambar. Response: ${JSON.stringify(json).slice(0, 200)}`);
  }
  const imgRes = await axios.get(resultUrl, { responseType: "arraybuffer", timeout: 60000 });
  return Buffer.from(imgRes.data);
}

// Cari string jawaban di dalam objek JSON, 1 level ke dalam (root, root.result,
// root.data) — nyoba beberapa nama field umum dulu (answer/text/message/response),
// karena skema Andaraz gak didokumentasiin lengkap & bisa beda tiap endpoint.
function findAnswerField(obj) {
  if (obj == null) return null;
  if (typeof obj === "string") return obj;
  if (typeof obj !== "object") return null;
  return obj.answer || obj.text || obj.message || obj.response || obj.result || null;
}

// Helper buat endpoint yang jawabannya teks/JSON (bukan gambar) — dipakai buat
// .vai/autoai lewat /api/ai/gemini. Balikin { answer, sessionId }:
// - answer: teks jawabannya (dari result.response, dengan fallback beberapa
//   nama field lain kalau skemanya beda).
// - sessionId: session_id yang DIBALIKIN server (bentuknya JWT, contoh
//   "eyJj..."), BUKAN yang dikirim di request. Kalau request gak nyertain
//   session_id (atau session_id-nya beda/expired), server bikinin yang baru
//   dan itu yang dibalikin di sini — makanya session_id harus disimpen &
//   dipakai ulang di request BERIKUTNYA biar AI-nya "inget" percakapan
//   sebelumnya (bukan sekadar string bebas kayak ID chat WA).
async function andarazJson(endpointPath, params = {}) {
  const res = await axios.get(andarazUrl(endpointPath, params), {
    responseType: "arraybuffer",
    timeout: 120000,
    validateStatus: () => true,
  });
  let json;
  try {
    json = JSON.parse(Buffer.from(res.data).toString("utf8"));
  } catch {
    throw new Error(`Response Andaraz API (HTTP ${res.status}) bukan JSON valid: ${Buffer.from(res.data).toString("utf8").slice(0, 200)}`);
  }
  if (res.status !== 200 || json.status === false) {
    throw new Error(`Andaraz API error: ${json.message || JSON.stringify(json).slice(0, 200)}`);
  }
  const r = json.result ?? json.data ?? json;
  const answer = findAnswerField(r);
  if (!answer || typeof answer !== "string") {
    throw new Error(`Andaraz API gak ngasih jawaban teks. Response: ${JSON.stringify(json).slice(0, 200)}`);
  }
  const sessionId = (r && typeof r === "object" && typeof r.session_id === "string") ? r.session_id : null;
  return { answer, sessionId };
}

module.exports = { ANDARAZ_BASE, requireAndarazKey, andarazUrl, extractAndarazImage, andarazJson };
