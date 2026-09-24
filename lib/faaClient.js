// lib/faaClient.js — helper buat manggil api-faa.my.id, dipakai gantiin Andaraz
// buat fitur .txt2img dan tier foto/video .hd. Endpoint-endpoint ini gak minta
// apikey, parameter dikirim lewat query string (GET). Skema respons udah
// kekonfirmasi dari log server (contoh .hd foto/hdv4):
//   {"status":true,"creator":"Faa","result":{"image_upscaled":"https://..."}}
// Field nama hasil bisa beda-beda antar endpoint (image_upscaled, video_upscaled,
// url, dst) — makanya dicoba beberapa kemungkinan nama field umum di bawah.
//
// API-nya punya dua macam masalah transient yang ketemu di log:
// 1) Rate-limit ketat: {"status":false,"message":"Too fast bro, cooldown 500ms"}
//    — kena bukan cuma kalau spam request awal, tapi juga pas fetch ULANG link
//    hasilnya buat didownload.
// 2) Timeout Cloudflare (HTTP 524) — proses generate di server FAA kelamaan
//    (>120 detik), jadi Cloudflare motong duluan sebelum FAA sempet jawab.
// Makanya semua fetch (baik ke endpoint utama maupun ke URL hasil) dibungkus
// retryFetch di bawah, yang otomatis retry buat DUA-DUANYA kasus itu.
const axios = require("axios");

const FAA_BASE = "https://api-faa.my.id";

// Kode HTTP yang biasanya transient (overload/timeout sisi server atau proxy
// Cloudflare-nya), layak dicoba ulang daripada langsung nyerah.
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504, 522, 523, 524]);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ═══════════ PROGRESS BERBASIS WAKTU (buat request yang SATU KALI tapi lama) ═══
// resolveFaaMedia ngasih progress dari jumlah PERCOBAAN poll — itu cuma jalan
// kalau endpoint-nya ASYNC (ngasih link status buat di-cek ulang, kayak
// /faa/hdvid). Banyak endpoint lain (toanime, dkk) BUKAN gitu — mereka cuma
// satu request HTTP yang lama (bisa sampai >100 detik sebelum kena timeout
// Cloudflare/524, lihat retryFetch), TANPA ada job buat di-poll. Jadi kalau
// nunggu request itu doang, onProgress gak pernah kepanggil sama sekali.
//
// tickProgress ngatasin itu: selama promise-nya masih pending, progress
// dihitung dari WAKTU BERJALAN dibanding estimasi durasi (bukan real progress
// dari API, sama kayak progress resolveFaaMedia — cuma indikator visual biar
// keliatan jalan, bukan diem). Berhenti otomatis begitu promise-nya selesai
// (berhasil atau gagal, gak masalah — hasil akhir tetap ditentuin promise-nya).
async function withTickedProgress(promise, onProgress, { estimatedMs = 90000, tickMs = 3000 } = {}) {
  if (!onProgress) return promise;
  const start = Date.now();
  const timer = setInterval(() => {
    const percent = Math.min(95, Math.round(((Date.now() - start) / estimatedMs) * 100));
    Promise.resolve(onProgress(percent)).catch(() => {});
  }, tickMs);
  try {
    return await promise;
  } finally {
    clearInterval(timer);
  }
}

// ═══════════ THROTTLE GLOBAL ═══════════
// Semua request ke FAA (dari command APAPUN, user manapun) diantre di sini
// dengan jarak minimum antar panggilan. Ini beda dari retry — retry ngatasin
// satu request yang gagal, throttle ini nyegah BEBERAPA request beda nembak
// FAA nyaris bersamaan (misal ada 2-3 orang mencet command FAA bareng), yang
// bisa bikin semuanya kena "too fast" berturut-turut.
const FAA_MIN_GAP_MS = 1200;
let faaQueue = Promise.resolve();
let faaLastCallAt = 0;

function throttleFaaCall(fn) {
  // .catch(()=>{}) di sini PENTING: kalau gak ada ini, begitu satu panggilan
  // di antrean gagal/reject, SISA antrean di belakangnya bakal ikut ke-skip
  // selamanya (rejection ngerembet ke .then berikutnya). Promise hasil throttle
  // yang dibalikin ke pemanggil tetap reject sesuai fn()-nya sendiri, cuma
  // antrean globalnya yang dijamin tetep jalan buat panggilan berikutnya.
  const result = faaQueue.catch(() => {}).then(async () => {
    const wait = FAA_MIN_GAP_MS - (Date.now() - faaLastCallAt);
    if (wait > 0) await sleep(wait);
    faaLastCallAt = Date.now();
    return fn();
  });
  faaQueue = result.catch(() => {});
  return result;
}

// Deteksi pesan cooldown/rate-limit dari API FAA, dari berbagai kemungkinan
// bentuk teks ("too fast", "cooldown", "rate limit", dst) — case-insensitive.
function isCooldownMessage(msg) {
  return typeof msg === "string" && /too\s*fast|cooldown|rate.?limit/i.test(msg);
}

// Bungkus axios.get biar otomatis retry beberapa kali kalau:
// - responsenya JSON {"status":false} dengan pesan cooldown/rate-limit, ATAU
// - HTTP status-nya termasuk RETRYABLE_STATUS (524 dkk).
// Nunggu sebentar (delay makin lama tiap percobaan) baru coba lagi.
async function retryFetch(url, options = {}, { retries = 3, delayMs = 800 } = {}) {
  let lastErr, lastRes;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await throttleFaaCall(() => axios.get(url, options));

      // Kalau caller pakai validateStatus:()=>true, axios gak akan nge-throw
      // sekalipun status-nya 524/dkk — jadi dicek manual di sini.
      if (RETRYABLE_STATUS.has(res.status)) {
        lastRes = res;
        if (attempt === retries) return res; // abis kesempatan, balikin apa adanya biar pemanggil yg kasih pesan error
        await sleep(delayMs * attempt);
        continue;
      }

      // Kalau responsenya arraybuffer JSON berisi status:false + pesan cooldown,
      // axios gak nge-throw sendiri (HTTP-nya tetep 200) — jadi dicek manual di sini.
      if (options.responseType === "arraybuffer") {
        const contentType = res.headers["content-type"] || "";
        if (!contentType.startsWith("image/") && !contentType.startsWith("video/")) {
          try {
            const json = JSON.parse(Buffer.from(res.data).toString("utf8"));
            if (json.status === false && isCooldownMessage(json.message)) {
              throw new Error(`cooldown: ${json.message}`);
            }
          } catch (parseErr) {
            if (parseErr.message?.startsWith("cooldown:")) throw parseErr;
            // Bukan JSON / bukan soal cooldown -> biarin lolos, biar ditangani pemanggil.
          }
        }
      }
      return res;
    } catch (err) {
      lastErr = err;
      const status = err?.response?.status;
      const bodyText = err?.response?.data ? Buffer.from(err.response.data).toString("utf8").slice(0, 200) : err?.message || "";
      const isCooldown = isCooldownMessage(bodyText) || isCooldownMessage(err?.message);
      const isRetryableStatus = RETRYABLE_STATUS.has(status);
      const isTimeout = err?.code === "ECONNABORTED" || /timeout/i.test(err?.message || "");
      if ((!isCooldown && !isRetryableStatus && !isTimeout) || attempt === retries) throw err;
      await sleep(delayMs * attempt);
    }
  }
  if (lastRes) return lastRes;
  throw lastErr;
}

function faaUrl(endpointPath, extraParams = {}) {
  const params = new URLSearchParams(extraParams);
  return `${FAA_BASE}${endpointPath}?${params.toString()}`;
}

// Cari string berupa URL (diawali http) di dalam objek, 1 level ke dalam
// (root, root.result, root.data). Ini FALLBACK terakhir kalau nama field-nya
// gak ketebak (kayak kejadian "image_upscaled" kemarin) — daripada tebak field
// satu-satu terus, langsung scan aja semua value string yang ada.
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

// Parse JSON response API FAA, balikin URL hasil (foto/video) dalam bentuk string.
// Dipisah dari extractFaaImage biar bisa dipakai bareng buat video juga (video
// gak langsung didownload jadi buffer di sini — URL-nya dioper ke
// downloadAndReencodeVideo biar dijamin kompatibel WA).
function parseFaaResultUrl(res) {
  let json;
  try {
    json = JSON.parse(Buffer.from(res.data).toString("utf8"));
  } catch {
    throw new Error("Response API FAA gak jelas formatnya (bukan JSON valid).");
  }
  // FIX: sebelumnya `json.status && ...` bikin status:false (boolean) LOLOS dari
  // pengecekan ini (false && apapun = false, gak pernah masuk if). Sekarang
  // eksplisit dicek status === false juga.
  if (json.status === false || (json.status && json.status !== "success" && json.status !== true)) {
    throw new Error(`API FAA error: ${json.message || JSON.stringify(json).slice(0, 200)}`);
  }
  const resultUrl =
    json.result?.url || (typeof json.result === "string" ? json.result : null) ||
    json.result?.image_upscaled || json.result?.image || json.result?.image_url ||
    json.result?.video_upscaled || json.result?.video || json.result?.video_url ||
    json.data?.url || (typeof json.data === "string" ? json.data : null) ||
    json.data?.image_upscaled || json.data?.image || json.data?.image_url ||
    json.data?.video_upscaled || json.data?.video || json.data?.video_url ||
    json.url || json.image_upscaled || json.image || json.image_url ||
    json.video_upscaled || json.video || json.video_url ||
    findHttpUrlDeep(json); // fallback generic buat endpoint baru yang nama field-nya beda
  if (!resultUrl || typeof resultUrl !== "string") {
    throw new Error(`API FAA gak ngasih URL hasil. Response: ${JSON.stringify(json).slice(0, 200)}`);
  }
  return resultUrl;
}

// Ambil buffer gambar dari response axios (responseType: "arraybuffer").
// Sekarang lewat resolveFaaMedia biar OTOMATIS nge-poll kalau ternyata
// endpoint-nya async (balikin link status "processing" dulu, kayak kejadian
// di /faa/hdvid) — gak cuma buat video, endpoint foto lain juga bisa aja gitu.
// onProgress (opsional) diteruskan ke resolveFaaMedia buat progress bar.
async function extractFaaImage(res, { onProgress } = {}) {
  const contentType = res.headers["content-type"] || "";
  if (contentType.startsWith("image/")) {
    if (onProgress) await onProgress(100);
    return Buffer.from(res.data);
  }

  const resultUrl = parseFaaResultUrl(res);
  const mediaRes = await resolveFaaMedia(resultUrl, { onProgress });
  return Buffer.from(mediaRes.data);
}

// Ambil URL video dari response axios (dipakai kalau content-type bukan video
// langsung — kalau API-nya balikin file video langsung, itu ditangani terpisah
// di pemanggilnya karena butuh path/buffer, bukan cuma buffer di memory).
function extractFaaVideoUrl(res) {
  return parseFaaResultUrl(res);
}

// ═══════════════ HELPER SIAP-PAKAI BUAT PLUGIN FOTO→FOTO ═══════════════
// Dipakai buat semua endpoint pola "kirim URL foto, dapet URL foto hasil"
// (toanime, tohitam, toputih, toreal, tovintage, tojapanese, tojepang,
// tomirror, removebg, editfoto, nano-banana, dst). uploadImageBuffer di-pass
// dari pemanggil (bukan di-require di sini) biar lib ini gak circular-depend
// ke lib/screaper.js. opts.onProgress (opsional) diteruskan ke extractFaaImage
// buat nampilin progress bar kalau endpoint-nya ternyata async/kelamaan.
async function faaImageTransform(uploadImageBuffer, buffer, endpointPath, extraParams = {}, urlParamName = "url", opts = {}) {
  const publicUrl = await uploadImageBuffer(buffer);
  if (!publicUrl) throw new Error("Gagal upload gambar ke hosting sementara buat diproses API FAA.");

  const res = await withTickedProgress(
    retryFetch(
      faaUrl(endpointPath, { [urlParamName]: publicUrl, ...extraParams }),
      { responseType: "arraybuffer", timeout: 180000, validateStatus: () => true }
    ),
    opts.onProgress,
    { estimatedMs: opts.estimatedMs || 90000 }
  );

  if (res.status !== 200) {
    const bodyPreview = Buffer.from(res.data).toString("utf8").slice(0, 300);
    throw new Error(`API FAA gagal (HTTP ${res.status}): ${bodyPreview}`);
  }
  return extractFaaImage(res, opts);
}

// ═══════════════ HELPER SIAP-PAKAI BUAT ENDPOINT TEKS/JSON ═══════════════
// Buat endpoint yang jawabannya bukan gambar (lyrics, jarakkota, venice-ai,
// iqcv2, dst). Balikin JSON mentahnya — parsing spesifik per-field dilakuin
// di masing-masing plugin karena skema tiap endpoint beda-beda.
async function faaJson(endpointPath, params = {}) {
  const res = await retryFetch(faaUrl(endpointPath, params), {
    responseType: "arraybuffer",
    timeout: 120000,
    validateStatus: () => true,
  });
  let json;
  try {
    json = JSON.parse(Buffer.from(res.data).toString("utf8"));
  } catch {
    throw new Error(`Response API FAA (HTTP ${res.status}) bukan JSON valid: ${Buffer.from(res.data).toString("utf8").slice(0, 200)}`);
  }
  if (res.status !== 200 || json.status === false) {
    throw new Error(`API FAA error: ${json.message || JSON.stringify(json).slice(0, 200)}`);
  }
  return json;
}

// ═══════════ POLLING BUAT ENDPOINT ASYNC (job-status pattern) ═══════════
// Ketemu dari log: /faa/hdvid GAK langsung balikin video — dia balikin link
// STATUS (/faa/result?id=...) yang isinya {"state":"processing", "message":
// "Video masih diproses"} kalau belum kelar. Jadi harus di-cek ULANG berkala
// sampai statusnya berubah (baru itu dapet URL video final, atau videonya
// langsung nempel di respons itu sendiri).
//
// resolveFaaMedia ngikutin "rantai" ini otomatis: fetch url -> kalau isinya
// media (video/image) langsung, selesai -> kalau JSON & masih "processing",
// tunggu terus fetch ulang url yang SAMA -> kalau JSON tapi udah kelar,
// ekstrak URL baru dari situ dan lanjutin (siapa tau itu masih link status
// lain, bukan langsung file final).
async function resolveFaaMedia(startUrl, { maxAttempts = 30, intervalMs = 5000, onProgress } = {}) {
  let url = startUrl;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const res = await retryFetch(url, { responseType: "arraybuffer", timeout: 60000 });
    const contentType = res.headers["content-type"] || "";
    if (contentType.startsWith("video/") || contentType.startsWith("image/")) {
      if (onProgress) await onProgress(100);
      return res; // beneran file media, selesai
    }

    let json;
    try {
      json = JSON.parse(Buffer.from(res.data).toString("utf8"));
    } catch {
      throw new Error(`Response dari ${url} bukan media maupun JSON valid.`);
    }
    if (json.status === false) {
      throw new Error(`API FAA error: ${json.message || JSON.stringify(json).slice(0, 200)}`);
    }

    const state = String(json.state || "").toLowerCase();
    if (/process|pending|queue|wait/.test(state)) {
      // Progress cuma ESTIMASI dari jumlah percobaan (attempt/maxAttempts) —
      // API-nya gak ngasih persentase asli, jadi ini bukan progress beneran,
      // cuma indikator visual biar user liat botnya jalan, gak diem/hang.
      // Di-cap ke 95% (bukan 99%) biar masih jelas kebedain sama yang bener-bener
      // selesai (100%, dikirim onProgress(100) di atas).
      if (onProgress) await onProgress(Math.min(95, Math.round((attempt / maxAttempts) * 100)));
      if (attempt === maxAttempts) {
        throw new Error(
          `Masih berstatus "${json.state}" setelah ditunggu ${Math.round((maxAttempts * intervalMs) / 1000)} detik — nyerah nunggu, coba lagi nanti (mungkin videonya kepanjangan/berat).`
        );
      }
      await sleep(intervalMs);
      continue; // fetch ulang URL status yang SAMA
    }

    // Bukan lagi "processing" — cari URL media final di JSON ini.
    const nextUrl = findHttpUrlDeep(json);
    if (!nextUrl || nextUrl === url) {
      throw new Error(`API FAA gak ngasih URL media final. Response: ${JSON.stringify(json).slice(0, 200)}`);
    }
    url = nextUrl; // lanjut ke URL berikutnya (siapa tau masih link status lagi)
  }
  throw new Error("Nyerah nunggu media dari API FAA siap (kehabisan percobaan).");
}

module.exports = {
  FAA_BASE,
  faaUrl,
  extractFaaImage,
  extractFaaVideoUrl,
  retryFetch,
  faaImageTransform,
  faaJson,
  findHttpUrlDeep,
  resolveFaaMedia,
  withTickedProgress,
};
