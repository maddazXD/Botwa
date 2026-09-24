// lib/nexrayClient.js — helper buat manggil api.nexray.eu.cc (369+ endpoint,
// gratis tanpa API key). Polanya mirip lib/faaClient.js tapi provider beda,
// jadi dipisah biar gak nyampur asumsi (misal cooldown/pola async FAA belum
// tentu sama di Nexray — baru tau kalau ternyata mirip).
const axios = require("axios");

const NEXRAY_BASE = "https://api.nexray.eu.cc";

// Kode HTTP yang layak di-retry (429 didokumentasiin resmi di sini sebagai
// rate-limit, beda dari FAA yang makenya lewat body JSON status:false).
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function nexrayUrl(endpointPath, params = {}) {
  const qs = new URLSearchParams(params);
  return `${NEXRAY_BASE}${endpointPath}${qs.toString() ? `?${qs.toString()}` : ""}`;
}

// GET dengan retry otomatis buat status yang RETRYABLE_STATUS (rate-limit/
// server error) — delay makin lama tiap percobaan.
async function nexrayFetch(url, options = {}, { retries = 3, delayMs = 800 } = {}) {
  let lastRes;
  for (let attempt = 1; attempt <= retries; attempt++) {
    const res = await axios.get(url, { ...options, validateStatus: () => true });
    if (!RETRYABLE_STATUS.has(res.status)) return res;
    lastRes = res;
    if (attempt === retries) return res;
    await sleep(delayMs * attempt);
  }
  return lastRes;
}

// Ambil JSON dari endpoint Nexray, throw kalau HTTP-nya gagal beneran (bukan
// yang di-retry) atau body-nya bukan JSON valid.
async function nexrayJson(endpointPath, params = {}) {
  const res = await nexrayFetch(nexrayUrl(endpointPath, params), { responseType: "arraybuffer", timeout: 60000 });
  const bodyText = Buffer.from(res.data).toString("utf8");
  let json;
  try {
    json = JSON.parse(bodyText);
  } catch {
    throw new Error(`Response Nexray (HTTP ${res.status}) bukan JSON valid: ${bodyText.slice(0, 200)}`);
  }
  if (res.status !== 200) {
    throw new Error(`Nexray API error (HTTP ${res.status}): ${json?.message || json?.error || bodyText.slice(0, 200)}`);
  }
  return json;
}

// Ambil media hasil endpoint Nexray yang berupa gambar/gif/video — dipakai
// bareng-bareng sama semua plugin "maker" stiker (attp, brat*, ttp, ustadz,
// dll) biar gak duplikat logika deteksi biner-vs-JSON di tiap file plugin.
// Kebanyakan endpoint kayak gini balikin biner medianya langsung, tapi ada
// juga provider yang bungkus hasilnya di JSON {url: "..."} — content-type
// response dicek dulu biar bisa nangkep dua-duanya tanpa nebak per endpoint.
async function nexrayMediaSource(endpointPath, params = {}) {
  const res = await nexrayFetch(nexrayUrl(endpointPath, params), { responseType: "arraybuffer", timeout: 60000 });

  if (res.status !== 200) {
    let msg = `HTTP ${res.status}`;
    try {
      const json = JSON.parse(Buffer.from(res.data).toString("utf8"));
      msg = json?.message || json?.error || msg;
    } catch {}
    throw new Error(msg);
  }

  const contentType = res.headers?.["content-type"] || "";
  if (/json/i.test(contentType)) {
    const json = JSON.parse(Buffer.from(res.data).toString("utf8"));
    const found = findHttpUrlDeep(json);
    if (!found) throw new Error("Response JSON gak punya URL hasil yang dikenali.");
    return found;
  }
  return Buffer.from(res.data);
}

// Cari string URL (diawali http) di dalam objek, dipakai buat endpoint yang
// hasilnya gambar/media — nama field gak fix jadi di-scan generic.
function findHttpUrlDeep(obj) {
  if (!obj || typeof obj !== "object") return null;
  for (const val of Object.values(obj)) {
    if (typeof val === "string" && /^https?:\/\//i.test(val)) return val;
  }
  for (const val of Object.values(obj)) {
    if (val && typeof val === "object") {
      const found = findHttpUrlDeep(val);
      if (found) return found;
    }
  }
  return null;
}

// Cari field TEKS hasil generik di JSON (nama field beda-beda tiap endpoint:
// result/data/text/message/output/response/answer, bisa juga langsung string).
function findTextResult(json) {
  const r = json.result ?? json.data ?? json;
  if (typeof r === "string") return r;
  return (
    r?.text || r?.output || r?.response || r?.answer || r?.message ||
    json.text || json.output || json.response || json.answer || null
  );
}

// Field teknis/noise yang gak perlu ditampilin ke user.
function shouldHideKey(key) {
  return /^(id|_id|slug|type|class|status_code|raw|html)$/i.test(String(key || ""));
}

// Ubah object/array JSON jadi baris-baris teks "Label: value" — generic,
// dipakai buat endpoint yang skema hasilnya gak dikonfirmasi persis.
function flattenToLines(value, prefix = "", lines = [], depth = 0, limit = { n: 0, max: 45 }) {
  if (value == null || depth > 4 || limit.n >= limit.max) return lines;
  if (typeof value !== "object") {
    lines.push(`${prefix.replace(/\.$/, "") || "Hasil"}: ${value}`);
    limit.n++;
    return lines;
  }
  if (Array.isArray(value)) {
    lines.push(`${prefix.replace(/\.$/, "") || "Jumlah"}: ${value.length} item`);
    limit.n++;
    for (let i = 0; i < Math.min(value.length, 8) && limit.n < limit.max; i++) {
      flattenToLines(value[i], `${prefix}[${i}].`, lines, depth + 1, limit);
    }
    return lines;
  }
  for (const [k, v] of Object.entries(value)) {
    if (shouldHideKey(k) || v == null || v === "") continue;
    if (typeof v === "object") {
      flattenToLines(v, `${prefix}${k}.`, lines, depth + 1, limit);
    } else {
      lines.push(`${prefix}${k}: ${v}`);
      limit.n++;
    }
  }
  return lines;
}

module.exports = { NEXRAY_BASE, nexrayUrl, nexrayFetch, nexrayJson, nexrayMediaSource, findHttpUrlDeep, findTextResult, flattenToLines };
