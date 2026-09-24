// lib/imageUpscalingClient.js — kelola client_id buat image-upscaling.net (layanan AI
// upscale gratis, gak butuh API key resmi — cukup ID acak 32 karakter sebagai identitas).
// Disimpan ke file biar SAMA terus tiap restart bot (biar histori kuota hariannya nyambung
// di akun yang sama, bukan selalu dianggap "user baru" tiap kali bot nyala ulang).
const fs = require("fs");
const path = require("path");

const FILE_PATH = path.join(__dirname, "..", "database", "image-upscaling-client-id.txt");
const CHARS = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

function generateId() {
  let id = "";
  for (let i = 0; i < 32; i++) id += CHARS[Math.floor(Math.random() * CHARS.length)];
  return id;
}

function getClientId() {
  try {
    if (fs.existsSync(FILE_PATH)) {
      const existing = fs.readFileSync(FILE_PATH, "utf8").trim();
      if (existing.length === 32) return existing;
    }
  } catch {}

  const fresh = generateId();
  try {
    fs.writeFileSync(FILE_PATH, fresh);
  } catch (e) {
    console.error("[imageUpscalingClient] Gagal simpan client_id:", e.message);
  }
  return fresh;
}

module.exports = { getClientId };
