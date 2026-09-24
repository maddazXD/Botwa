// lib/parseDuration.js — Parser durasi format singkat "1m"/"2h"/"3d" jadi
// milidetik. Dipakai fitur mute member (plugins/group/mute.js), tapi
// ditaruh di lib/ (bukan inline di plugin) biar bisa dipakai ulang kalau
// ada fitur lain nanti yang butuh format durasi sama (misal .banc dengan
// durasi, atau reminder).
//
// Format yang didukung: <angka><satuan>, satuan cuma m/h/d (menit/jam/hari)
// sesuai spec yang diminta — SENGAJA gak nambah satuan lain (detik/minggu/
// bulan) yang gak diminta, biar gak ambigu (contoh: "s" bisa disalahartiin
// "second" atau "sider", mending gak usah ada daripada nebak-nebak).
const UNIT_MS = {
  m: 60 * 1000,          // menit
  h: 60 * 60 * 1000,     // jam
  d: 24 * 60 * 60 * 1000, // hari
};

const UNIT_LABEL = { m: "menit", h: "jam", d: "hari" };

/**
 * Parse string durasi kayak "1m", "2h", "3d" jadi { ms, label }.
 * Return null kalau formatnya gak valid (bukan berarti "permanen" — itu
 * beda kasus, dicek terpisah di pemanggil kalau argumennya kosong).
 */
function parseDuration(str) {
  if (!str || typeof str !== "string") return null;
  const match = str.trim().toLowerCase().match(/^(\d+)([mhd])$/);
  if (!match) return null;

  const amount = parseInt(match[1], 10);
  const unit = match[2];
  if (amount <= 0) return null;

  return {
    ms: amount * UNIT_MS[unit],
    label: `${amount} ${UNIT_LABEL[unit]}`,
  };
}

/**
 * Format sisa waktu (ms) jadi teks singkat "2j 15m" / "45m" / "<1m" — buat
 * ditampilin di pesan status (misal ".mutelist" atau notifikasi kena mute).
 */
function formatRemaining(ms) {
  if (ms <= 0) return "0 menit";
  const days = Math.floor(ms / UNIT_MS.d);
  const hours = Math.floor((ms % UNIT_MS.d) / UNIT_MS.h);
  const minutes = Math.floor((ms % UNIT_MS.h) / UNIT_MS.m);

  const parts = [];
  if (days > 0) parts.push(`${days}h`);
  if (hours > 0) parts.push(`${hours}j`);
  if (minutes > 0 || parts.length === 0) parts.push(`${minutes}m`);
  return parts.join(" ");
}

module.exports = { parseDuration, formatRemaining };
