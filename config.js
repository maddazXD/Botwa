const fs = require("fs");

// ═══════════════════════════════════════════
//  MaddazXD V2 — Config
// ═══════════════════════════════════════════

// ── INFO BOT ──────────────────────────────
global.botname      = "MaddazXD V2"
global.versibot     = "1.3.0"
global.ownername    = "𝙼𝚊𝚍𝚍𝚊𝚣𝚇𝙳"         // Global Owner
global.owner        = ""     // Sengaja dikosongin — bot bakal auto-addowner
                              // dirinya sendiri pas pertama kali connect
                              // (lihat connection.update di index.js), jadi
                              // status owner disimpan di database, bukan
                              // hardcode di sini lagi.
global.pairingNumber = "6283842512960"  // Nomor WA yang di-pair

// ── LINK ──────────────────────────────────
global.linkChannel  = ""
global.idChannel    = ""
global.linkGrup     = ""
global.thumbnail    = "https://raw.githubusercontent.com/maddazXD/MaddazXD/refs/heads/main/logo.png"


// ── PREFIX & MODE ─────────────────────────
global.prefix       = "/"                        // prefix
global.mode         = "self"               // public / self

// ── STICKER ───────────────────────────────
global.packname     = "𝙼𝚊𝚍𝚍𝚊𝚣𝚇𝙳"
global.author       = "𝙼𝚊𝚍𝚍𝚊𝚣𝚇𝙳"

// ── API KEYS ──────────────────────────────
global.removebgApiKey = "AgUyvRmDfMfaECgZUtDJEnyt"   // https://www.remove.bg/api (untuk .rbg)
global.catboxUserHash  = "46f478f7ed9a8d9659fd14545"  // dari catbox.moe/user/manage.php — upload pakai akun (bukan anonim), buat coba lolos dari filter IP hosting
global.replicateApiToken = ""  // OPSIONAL & BERBAYAR. Daftar + isi saldo di replicate.com,
                                 // ambil token di replicate.com/account/api-tokens. Dipakai
                                 // buat tier AI kualitas terbaik di .hdvideo (Real-ESRGAN
                                 // Video) — hasilnya paling mirip Wink/Remini. Kosongin aja
                                 // kalau gak mau pakai, command tetap jalan normal pakai
                                 // tier gratis.
global.andarazApiKey    = "810a7913"   // Satu-satunya tier AI buat .hd — pakai endpoint
                                 // /api/ai/img2img/create dari api.andaraz.com (foto + custom
                                 // prompt). Ambil key dari halaman Profil di api.andaraz.com
                                 // setelah daftar/login. Kalau kosong/gagal, .hd otomatis
                                 // jatuh ke mode lokal (resize+sharpen, bukan AI).
global.geminiApiKey      = "AIzaSyCnEfvYE5DGtCYM5tvwkhUj-WFBA-IiwHg"   // API key Gemini ASLI (bukan lewat Andaraz) dari Google AI
                                 // Studio — https://aistudio.google.com -> "Get API key".
                                 // Ada free tier gratis buat pemakaian bot personal/grup kecil.
                                 // Dipakai KHUSUS buat .vai/autoai pas ada gambar (vision beneran
                                 // — gambar dikirim sebagai bytes langsung, BUKAN URL, jadi gak
                                 // kena masalah "gak bisa akses link" kayak Andaraz). Kalau
                                 // dikosongin, .vai/autoai tetap jalan normal buat teks doang
                                 // (lewat Andaraz), tapi kirim gambar bakal dibales pesan minta
                                 // API key ini diisi dulu.
global.geminiVisionModel = "gemini-2.5-flash"  // Model buat vision, lihat daftar model
                                 // terbaru & kuota gratis di ai.google.dev/gemini-api/docs/models
global.betabotzApiKey    = "Btz-qOdpa"   // https://api.betabotz.eu.org — dipakai buat
                                 // .ytmp3/.ytmp4 (endpoint /api/download/ytmp3 & ytmp4).
                                 // Ganti sendiri kalau apikey ini kadaluwarsa/rate-limit,
                                 // ambil key baru di halaman dokumentasi api.betabotz.eu.org.
// (fitur youtubeCookies buat video age-restricted udah dicabut — bikin
// semua command .ytmp3/.ytmp4 lambat & tetep sering gagal juga. Balik ke
// btch-downloader polos yang cepat & stabil buat video normal.)

// ── FITUR OURIN: GROUP PROTECTION ─────────
global.pesan = {
  antilink       : "⚠ *Antilink* — @%user% mengirim link. Pesan dihapus.",
  antilinkKick   : "⚠ *Antilink* — @%user% di-kick karena mengirim link.",
  antitagsw      : "⚠ *AntiTagSW* — Tag status dari @%user% dihapus.",
  antitoxic      : "⚠ @%user% berkata kasar. Peringatan ke %warn% dari %max%.",
  antidocument   : "⚠ *AntiDokumen* — Dokumen dari @%user% dihapus.",
  antisticker    : "⚠ *AntiStiker* — Stiker dari @%user% dihapus.",
  antimedia      : "⚠ *AntiMedia* — Media dari @%user% dihapus.",
}

// ── FITUR OTOMATIS ────────────────────────
global.autoTyping    = true
global.antiCall      = false    // true = tolak panggilan masuk
global.blockIfCall   = false    // true = blokir yang telepon

// ── WELCOME / GOODBYE DEFAULT ─────────────
global.welcomeDefault = false
global.goodbyeDefault = false

// ── DATABASE ──────────────────────────────
global.dbPath = "./database"

// ── HOT RELOAD ────────────────────────────
let file = require.resolve(__filename)
fs.watchFile(file, () => {
  fs.unwatchFile(file)
  delete require.cache[file]
  require(file)
})
