// lib/screaper.js — upload buffer ke hosting file publik biar dapet link (dipakai
// .qrcode mode media & .setthumbnail).
//
// CATATAN (Agustus 2026): CatBox jadi prioritas utama, GoFile.io fallback kalau
// CatBox gagal/lagi ngeblok. Penyebab paling umum CatBox gagal dari server/VPS:
//   1. Request nggak punya header kayak browser beneran (User-Agent/Origin/Referer
//      default axios/node-fetch gampang dikenali & ditolak) -> makanya di bawah ini
//      semua header itu di-set manual biar mirip request dari browser.
//   2. CatBox kadang balikin halaman HTML (Cloudflare challenge / pesan error teks
//      biasa, bukan JSON) waktu nolak upload -> kalau cuma dicek `.startsWith(...)`
//      doang, isi pesan errornya beneran gak pernah kelihatan di log. Sekarang body
//      responsenya selalu dicatat di console biar ketauan itu ditolak karena apa
//      (IP diban, rate limit, dsb) — bukan cuma "gagal" tanpa keterangan.
//   3. Kalau semua percobaan CatBox tetap gagal terus (mentok diblokir dari sisi
//      CatBox berdasarkan IP), fallback otomatis lanjut ke GoFile di bawah.
const axios = require("axios");
const FormData = require("form-data");
const { fromBuffer } = require("file-type");

async function GoFile(buffer, filename) {
  // Endpoint GoFile beberapa kali berubah — ini yang paling baru per pertengahan 2026:
  // GET /servers (bukan /getServer lagi) -> POST ke {server}.gofile.io/contents/uploadfile
  // (bukan /uploadFile lagi), field "file" (bukan "filesUploaded" lagi).
  const serverRes = await axios.get("https://api.gofile.io/servers", { timeout: 15000 });
  const server = serverRes.data?.data?.servers?.[0]?.name;
  if (!server) {
    console.error("[GoFile] Response /servers gak dikenali:", JSON.stringify(serverRes.data).slice(0, 300));
    throw new Error("Gagal dapetin server upload dari GoFile.");
  }

  const form = new FormData();
  form.append("file", buffer, filename);

  const headers = { ...form.getHeaders() };
  // Opsional: kalau GoFile makin ketat soal anonymous upload, isi global.gofileApiToken
  // di config.js (daftar gratis di gofile.io -> Profile -> copy token) buat lebih reliable.
  if (global.gofileApiToken) headers.Authorization = `Bearer ${global.gofileApiToken}`;

  const uploadRes = await axios.post(`https://${server}.gofile.io/contents/uploadfile`, form, {
    headers,
    timeout: 60000,
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
  });

  const data = uploadRes.data?.data;
  const link = data?.downloadPage || data?.link || data?.directLink;
  if (!link) {
    console.error("[GoFile] Response upload gak dikenali:", JSON.stringify(uploadRes.data).slice(0, 500));
    throw new Error("Format response GoFile berubah/gak dikenali.");
  }
  return link;
}

async function CatBox(buffer, filename) {
  const detected = await fromBuffer(buffer).catch(() => null);
  const finalName = filename || `file.${detected?.ext || "bin"}`;

  const form = new FormData();
  form.append("reqtype", "fileupload");
  // Kalau ada userhash (dari config.js -> global.catboxUserHash), upload dikirim
  // sebagai upload akun (bukan anonim). Beberapa laporan pengguna lain nunjukin
  // upload authenticated kadang lolos dari filter anti-bot/anti-IP-hosting yang
  // cuma nyasar ke upload anonim — worth dicoba, tapi bukan jaminan 100% lolos
  // kalau CatBox ngeban di level IP/network beneran.
  if (global.catboxUserHash) form.append("userhash", global.catboxUserHash);
  form.append("fileToUpload", buffer, finalName);

  // Header-header di bawah ini yang bikin request keliatan kayak dari browser
  // beneran, bukan dari library HTTP mentahan (axios/node-fetch default UA
  // sering langsung ditolak/diban CatBox). Referer & Origin ikut disamain
  // sama domain resminya karena CatBox ngecek itu juga.
  const headers = {
    ...form.getHeaders(),
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    Accept: "*/*",
    Origin: "https://catbox.moe",
    Referer: "https://catbox.moe/",
  };

  const res = await axios.post("https://catbox.moe/user/api.php", form, {
    headers,
    timeout: 60000,
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
    // Jangan lempar exception buat status non-2xx, biar body error-nya bisa
    // dibaca & di-log dulu sebelum diputusin gagal.
    validateStatus: () => true,
  });

  const text = typeof res.data === "string" ? res.data.trim() : JSON.stringify(res.data);

  if (res.status !== 200 || !text || !text.startsWith("https://files.catbox.moe/")) {
    // Log lengkap: status code + isi body asli, biar ketauan CatBox nolaknya
    // karena apa (IP diban, rate limit, Cloudflare challenge, dll) — bukan
    // cuma "gagal" tanpa keterangan kayak sebelumnya.
    const authInfo = global.catboxUserHash ? "pakai userhash" : "anonim (tanpa userhash)";
    console.error(`[CatBox] Upload gagal (status ${res.status}, ${authInfo}):`, text?.slice(0, 500));
    throw new Error(`CatBox menolak upload (status ${res.status}): ${text?.slice(0, 200) || "response kosong"}`);
  }

  return text;
}

async function uploadImageBuffer(buffer) {
  const detected = await fromBuffer(buffer).catch(() => null);
  const filename = `file.${detected?.ext || "bin"}`;

  try {
    return await CatBox(buffer, filename);
  } catch (err) {
    console.error("[uploadImageBuffer] CatBox gagal, coba GoFile:", err.message);
  }

  try {
    return await GoFile(buffer, filename);
  } catch (err) {
    console.error("[uploadImageBuffer] GoFile juga gagal:", err.message);
  }

  return null;
}

module.exports = {
  uploadImageBuffer,
  CatBox,
  GoFile,
};
