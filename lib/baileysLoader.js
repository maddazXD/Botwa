// lib/baileysLoader.js
//
// Fork Baileys yang dipakai sekarang (@itsliaaa/baileys) itu ESM-only, sedangkan
// seluruh proyek ini masih CommonJS (require/module.exports di 100+ file). Daripada
// convert semuanya ke ESM (rewrite besar, risiko tinggi), modul kecil ini jadi
// SATU-SATUNYA titik yang "nyebrang" ke ESM lewat dynamic import(), lalu hasilnya
// di-cache di memori supaya walau dipanggil dari banyak file/banyak pesan, proses
// import beneran cuma kejadian sekali di seumur hidup proses bot.
//
// Cara pakai di file CommonJS manapun yang butuh fungsi Baileys:
//   const { getBaileys } = require("../lib/baileysLoader");
//   const { makeWASocket, useMultiFileAuthState, ... } = await getBaileys();
//
// PENTING: pemanggilnya harus di dalam fungsi async (getBaileys mengembalikan Promise).

let _baileysPromise = null;

function getBaileys() {
  if (!_baileysPromise) {
    _baileysPromise = import("@itsliaaa/baileys");
  }
  return _baileysPromise;
}

module.exports = { getBaileys };
