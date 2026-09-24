// lib/replicateClient.js — helper generik buat manggil model AI di Replicate.com
// lewat endpoint POST /v1/models/{owner}/{name}/predictions. Endpoint ini otomatis
// pakai versi model TERBARU tanpa perlu hardcode version-hash (yang gampang basi
// kalau modelnya di-update sama pembuatnya).
//
// KENAPA PAKAI REPLICATE: model-model kayak GFPGAN/Real-ESRGAN ini riset-grade AI
// beneran (bukan cuma resize+sharpen kayak mode lokal) — hasilnya yang paling
// deket sama kualitas app komersil kayak Wink/Remini. TAPI catatan penting:
//   - BERBAYAR per pemakaian (gak ada tier gratis permanen) — isi saldo dulu di
//     replicate.com/account/billing, terus daftarin API token ke
//     global.replicateApiToken di config.js.
//   - Kalau token itu KOSONG, semua fungsi yang makai helper ini bakal throw
//     error dari awal (fail fast) dan plugin pemanggilnya bakal auto fallback
//     ke tier gratis/lokal.
const axios = require("axios");

async function runReplicateModel(owner, name, input, { pollMs = 3000, maxWaitMs = 300000 } = {}) {
  if (!global.replicateApiToken) {
    throw new Error("global.replicateApiToken belum diisi di config.js (fitur AI premium Replicate nonaktif).");
  }

  const authHeaders = { Authorization: `Bearer ${global.replicateApiToken}` };

  // "Prefer: wait=60" bikin request nunggu sampai 60 detik nunggu hasilnya langsung
  // kebalik di response yang sama (buat model cepet kayak GFPGAN, biasanya kelar
  // dalam hitungan detik) — kalau lebih lama dari itu, lanjut di-polling di bawah.
  const createRes = await axios.post(
    `https://api.replicate.com/v1/models/${owner}/${name}/predictions`,
    { input },
    { headers: { ...authHeaders, "Content-Type": "application/json", Prefer: "wait=60" }, timeout: 65000 }
  );

  let prediction = createRes.data;
  const start = Date.now();
  while (!["succeeded", "failed", "canceled"].includes(prediction.status)) {
    if (Date.now() - start > maxWaitMs) {
      throw new Error(`Timeout nunggu hasil dari Replicate (model ${owner}/${name}) — lebih dari ${Math.round(maxWaitMs / 1000)} detik.`);
    }
    await new Promise((r) => setTimeout(r, pollMs));
    const pollRes = await axios.get(prediction.urls.get, { headers: authHeaders, timeout: 30000 });
    prediction = pollRes.data;
  }

  if (prediction.status !== "succeeded") {
    throw new Error(`Replicate (${owner}/${name}) gagal, status "${prediction.status}": ${prediction.error || "gak ada detail error dari Replicate"}`);
  }

  return prediction.output;
}

module.exports = { runReplicateModel };
