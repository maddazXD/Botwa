// plugins/main/menu.js — Menu Utama (MaddazXD V2)
"use strict";

const os = require("os");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const { getBaileys } = require("../../lib/baileysLoader");
const { bold: toMonoUpperBold, card, panel, footer, quote, truncate, DIVIDER, progressBar } = require("../../lib/theme");

function getGreeting() {
  const h = parseInt(new Date().toLocaleString("id-ID", {
    timeZone: "Asia/Jakarta", hour: "numeric", hour12: false
  }));
  if (h >= 0  && h < 5)  return "Selamat Malam 🌙";
  if (h >= 5  && h < 11) return "Selamat Pagi ☀️";
  if (h >= 11 && h < 15) return "Selamat Siang 🔆";
  if (h >= 15 && h < 18) return "Selamat Sore 🌤️";
  return "Selamat Malam 🌙";
}

function fmtUptime(s) {
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600),
        mn = Math.floor((s % 3600) / 60), sc = Math.floor(s % 60);
  return d ? `${d}d ${h}j ${mn}m` : h ? `${h}j ${mn}m ${sc}d` : `${mn}m ${sc}d`;
}

const CAT_EMOJI = {
  main: "🏠", owner: "👑", download: "📥",
  sticker: "✨", info: "📋", converter: "🔄", koleksi: "🎓",
  tools: "🛠️", upload: "📦", ai: "🧠", anime: "🎌", admin: "🛡️", game: "🎮",
};
const CAT_LABEL = {
  main: "Menu Utama", owner: "Owner", download: "Downloader",
  sticker: "Sticker",
  info: "Informasi", converter: "Converter", koleksi: "Tugas & Materi",
  tools: "Tools", upload: "Upload", ai: "AI Kreatif", anime: "Anime", admin: "Admin Grup",
  internet: "Internet", search: "Search", fun: "Fun", maker: "Maker", game: "Game",
};
const CAT_ORDER = ["main","koleksi","owner","admin","download","sticker","converter","info","tools","internet","search","fun","maker","game","anime","upload","ai"];


// Kategori "admin" isinya command yang emang CUMA bisa dipakai admin grup
// (handler.admin = true di tiap plugin-nya) — samain perlakuannya kayak
// kategori "owner": disembunyiin dari yang bukan admin, biar gak ada tombol
// nongol tapi pas di-tap ternyata "Admin Only!". Owner selalu bisa lihat semua
// kategori (termasuk yang admin-gated), sama kayak sebelumnya owner selalu
// lihat kategori "owner".
const ADMIN_GATED_CATS = new Set(["admin"]);

function scanAllPlugins(ownerMode = false, adminMode = false) {
  const toArr = v => !v ? [] : (Array.isArray(v) ? v : [v]);
  let categories = {};
  let hasInMemoryData = false;
  if (global.plugins) {
    for (const file in global.plugins) {
      const plug = global.plugins[file];
      if (!plug) continue;
      const tags = toArr(plug.tags);
      const cmds = plug.help ? toArr(plug.help) : toArr(plug.command);
      if (!tags.length && cmds.length) {
        let defaultTag = "main";
        if (file.includes("owner")) defaultTag = "owner";
        else if (file.includes("group")) defaultTag = "admin";
        else if (file.includes("download")) defaultTag = "download";
        else if (file.includes("sticker")) defaultTag = "sticker";
        else if (file.includes("converter")) defaultTag = "converter";
        else if (file.includes("koleksi")) defaultTag = "koleksi";
        tags.push(defaultTag);
      }
      if (!tags.length || !cmds.length) continue;
      hasInMemoryData = true;
      for (const rawTag of tags) {
        const key = String(rawTag).toLowerCase();
        // FIX BUG: sebelumnya kategori "owner" selalu ditampilkan ke SEMUA orang di sini,
        // padahal menu-sub.js (yang beneran nangani klik ".cat_owner") sengaja nyembunyiin
        // kategori ini buat non-owner. Akibatnya user biasa lihat tombol "OWNER" muncul di
        // daftar kategori, tapi begitu di-tap selalu gagal "Kategori tidak ditemukan!" —
        // sekarang disamain: non-owner gak akan lihat kategori owner sama sekali dari awal.
        if (key === "owner" && !ownerMode) continue;
        // Sama kayak di atas, tapi buat kategori yang butuh admin grup ("admin"/"group") —
        // sebelumnya kategori ini keliatan ke SEMUA ORANG walau isinya command yang cuma
        // bisa dipakai admin grup, jadi user biasa lihat tombolnya tapi pas dipakai ditolak.
        if (ADMIN_GATED_CATS.has(key) && !adminMode) continue;
        if (!categories[key]) categories[key] = { cat: key, emoji: CAT_EMOJI[key] || "📌", cmds: [], plugins: [] };
        cmds.forEach(c => {
          const cmd = c.toString().split(" ")[0];
          if (cmd && !categories[key].cmds.includes(cmd)) {
            categories[key].cmds.push(cmd);
            categories[key].plugins.push(file);
          }
        });
      }
    }
  }
  // FIX BUG: sebelumnya scanPluginFolder (disk-scan pakai regex manual) SELALU
  // dipanggil, digabung ke categories yang sama dengan hasil global.plugins —
  // padahal global.plugins itu sendiri sudah di-sync otomatis & real-time sama
  // disk lewat watchPlugins() (lib/pluginLoader.js, pakai fs.watch + debounce
  // 200ms) buat SEMUA 145 file plugin yang ada sekarang (dicek: semuanya udah
  // punya handler.tags eksplisit, gak ada yang butuh fallback disk-scan ini).
  // Masalahnya, disk-scan pakai REGEX MENTAH buat baca handler.command/tags
  // langsung dari teks file — beda dari global.plugins yang divalidasi lewat
  // require() Node.js asli. Ini nyimpen risiko senyap: kalau ada file yang
  // LAGI DITULIS SETENGAH JALAN (race condition saat upload/edit plugin) pas
  // .menu dipanggil persis di window 200ms sebelum watcher selesai proses,
  // disk-scan regex bisa nangkep command dari konten yang belum lengkap/rusak
  // dan nampilinnya di menu sebagai "ada", padahal global.plugins belum/gak
  // bakal pernah punya entry itu (require() bakal gagal duluan kalau filenya
  // emang rusak) — user lihat command di menu yang KELIATAN ada tapi manggil-
  // nya bakal gagal "command not found" beneran, gak sinkron sama isi bot yang
  // sesungguhnya. Sekarang disk-scan cuma jalan sebagai FALLBACK TERAKHIR kalau
  // global.plugins beneran kosong/belum ke-load (misal race condition di awal
  // startup) — bukan selalu digabung berbarengan.
  if (!hasInMemoryData) {
    try {
      const pluginsDir = path.join(process.cwd(), "plugins");
      if (fs.existsSync(pluginsDir)) scanPluginFolder(pluginsDir, categories, ownerMode, adminMode);
    } catch (e) {}
  }
  return categories;
}

function scanPluginFolder(dir, categories, ownerMode = false, adminMode = false) {
  // Ambil isi field (command/tags/help) dari source code plugin, entah ditulis sebagai
  // array (`= [...]`) ATAU string polos (`= "..."`) — regex sebelumnya CUMA nangkep
  // bentuk array, jadi field yang ditulis string polos (kayak `handler.help = "tiktok"`
  // di download-tikok.js, atau `handler.tags = "sticker"` di brat.js) gagal kebaca,
  // fallback ke command penuh (semua alias ikut kehitung), bikin jumlah command yang
  // ditampilin di menu jadi kebanyakan/gak akurat.
  function extractField(content, fieldName) {
    const arrMatch = content.match(new RegExp(`handler\\.${fieldName}\\s*=\\s*\\[([^\\]]+)\\]`));
    if (arrMatch) return arrMatch[1].split(",").map(c => c.trim().replace(/['"]/g, "")).filter(Boolean);
    const strMatch = content.match(new RegExp(`handler\\.${fieldName}\\s*=\\s*["']([^"']+)["']`));
    if (strMatch) return [strMatch[1]];
    return [];
  }

  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    // FIX BUG: rekursi ke subfolder ini sebelumnya lupa nerusin `adminMode`,
    // jadi di dalam subfolder (misal plugins/group/) parameter adminMode
    // selalu balik ke default `false` walau pemanggil aslinya admin/owner —
    // kategori "admin" jadi ke-skip terus khusus di jalur fallback disk-scan
    // ini (lihat ADMIN_GATED_CATS check di bawah).
    if (stat.isDirectory()) { scanPluginFolder(filePath, categories, ownerMode, adminMode); continue; }
    if (!file.endsWith(".js") || file.includes("menu")) continue;
    try {
      const content = fs.readFileSync(filePath, "utf-8");
      const cmds = extractField(content, "command");
      let tags = extractField(content, "tags");
      const help = extractField(content, "help");
      const finalCmds = help.length > 0 ? help : cmds;
      if (!tags.length && finalCmds.length) {
        let defaultTag = "main";
        const folderName = path.basename(path.dirname(filePath));
        if (["owner","download","sticker","converter","koleksi","info"].includes(folderName)) defaultTag = folderName;
        tags.push(defaultTag);
      }
      if (tags.length && finalCmds.length) {
        for (const rawTag of tags) {
          const key = String(rawTag).toLowerCase();
          // FIX BUG: sebelumnya fungsi ini gak pernah cek ownerMode sama sekali, jadi
          // kategori "owner" selalu ke-inject ulang ke SEMUA orang lewat jalur disk-scan
          // ini — nge-undo fix owner-filtering yang udah dipasang di scanAllPlugins.
          if (key === "owner" && !ownerMode) continue;
          // Sama kayak "owner" di atas, tapi buat kategori admin-gated ("admin"/"group").
          if (ADMIN_GATED_CATS.has(key) && !adminMode) continue;
          if (!categories[key]) categories[key] = { cat: key, emoji: CAT_EMOJI[key] || "📌", cmds: [], plugins: [] };
          finalCmds.forEach(c => {
            const cmd = c.toString().split(" ")[0];
            if (cmd && !categories[key].cmds.includes(cmd)) {
              categories[key].cmds.push(cmd);
              categories[key].plugins.push(file);
            }
          });
        }
      }
    } catch {}
  }
}

function sortCategories(categories) {
  return [
    ...CAT_ORDER.filter(k => categories[k]).map(k => categories[k]),
    ...Object.keys(categories).filter(k => !CAT_ORDER.includes(k)).sort().map(k => categories[k]),
  ];
}

async function getThumbBuffer() {
  try {
    const r = await axios.get(global.thumbnail, { responseType: "arraybuffer", timeout: 8000 });
    return Buffer.from(r.data);
  } catch { return null; }
}

// Video pembuka .menu — file lokal (assets/menu/menu.mp4), gak perlu fetch tiap kali.
// Kalau filenya gak ada/gagal dibaca, nanti otomatis fallback ke thumbnail gambar biasa.
const MENU_VIDEO_PATH = path.join(process.cwd(), "assets", "menu", "menu.mp4");
function getVideoBuffer() {
  try {
    if (fs.existsSync(MENU_VIDEO_PATH)) return fs.readFileSync(MENU_VIDEO_PATH);
  } catch {}
  return null;
}

function buildContextInfo(m) {
  return {
    isForwarded: true, forwardingScore: 9,
    participant: "0@s.whatsapp.net",
    quotedMessage: { conversation: `${global.botname}` },
    mentionedJid: [`${m.sender}`],
    forwardedNewsletterMessageInfo: {
      newsletterJid: global.idChannel || "",
      newsletterName: global.botname,
      serverMessageId: 127,
    },
  };
}

async function sendInteractive(sock, m, { bodyText, footer, nativeFlow, thumbBuf, videoBuf }) {
  const contextInfo = buildContextInfo(m);
  const { prepareWAMessageMedia } = await getBaileys();
  let sent = false;
  // Coba pasang VIDEO dulu (biar mirip Anya yang buka .menu pakai video), baru
  // fallback ke gambar thumbnail biasa kalau video gagal/gak ada filenya.
  // FIX: dulu videoMessage dikirim polos, jadi pas di-tap malah buka FULLSCREEN video
  // player (kayak video biasa). Sekarang dipasang gifPlayback: true, biar videonya
  // autoplay muter LOOP di tempat langsung di dalam bubble chat (kayak GIF), gak perlu
  // di-tap dan gak buka fullscreen.
  if (videoBuf && prepareWAMessageMedia) {
    try {
      const media = await prepareWAMessageMedia({ video: videoBuf, gifPlayback: true }, { upload: sock.waUploadToServer });
      if (media.videoMessage) media.videoMessage.gifPlayback = true;
      await sock.relayMessage(m.chat, {
        viewOnceMessage: {
          message: {
            messageContextInfo: {},
            interactiveMessage: {
              header: { title: "", subtitle: "", hasMediaAttachment: true, videoMessage: media.videoMessage },
              body: { text: bodyText },
              footer: { text: footer },
              contextInfo,
              nativeFlowMessage: nativeFlow,
            },
          },
        },
      }, {});
      sent = true;
    } catch (e) {}
  }
  if (!sent && thumbBuf && prepareWAMessageMedia) {
    try {
      const media = await prepareWAMessageMedia({ image: thumbBuf }, { upload: sock.waUploadToServer });
      await sock.relayMessage(m.chat, {
        viewOnceMessage: {
          message: {
            messageContextInfo: {},
            interactiveMessage: {
              header: { title: "", subtitle: "", hasMediaAttachment: true, imageMessage: media.imageMessage },
              body: { text: bodyText },
              footer: { text: footer },
              contextInfo,
              nativeFlowMessage: nativeFlow,
            },
          },
        },
      }, {});
      sent = true;
    } catch (e) {}
  }
  if (!sent) {
    try {
      await sock.relayMessage(m.chat, {
        viewOnceMessage: {
          message: {
            messageContextInfo: {},
            interactiveMessage: {
              header: { title: "", subtitle: "", hasMediaAttachment: false },
              body: { text: bodyText },
              footer: { text: footer },
              contextInfo,
              nativeFlowMessage: nativeFlow,
            },
          },
        },
      }, {});
      sent = true;
    } catch (e) {}
  }
  return sent;
}

let handler = async (m, { sock, command }) => {
  // adminMode: owner selalu bisa lihat SEMUA kategori (termasuk yang admin-gated),
  // sedangkan user biasa cuma lihat kategori "admin"/"group" kalau dia beneran lagi
  // jadi admin di grup TEMPAT dia ngetik .menu ini (m.isAdmin, dihitung per-chat oleh
  // handler.js). Di chat pribadi/grup yang dia bukan admin, kategori ini disembunyiin.
  const adminMode = m.isOwner || m.isAdmin;
  const categories = scanAllPlugins(m.isOwner, adminMode);
  const sorted = sortCategories(categories);

  const rows = sorted.map(({ cat, emoji, cmds }) => ({
    title: `${emoji} ${toMonoUpperBold(CAT_LABEL[cat] || cat)}`,
    description: `${cmds.length} perintah tersedia`,
    id: `${global.prefix}cat_${cat}`,
  }));

  const totalCmd  = sorted.reduce((a, c) => a + c.cmds.length, 0);
  const uptime    = fmtUptime(process.uptime());
  // FIX BOX PATAH (RAM): dulu format "19872 MB / 25.44 GB" itu KEPANJANGAN buat
  // satu baris di dalam box (mepet 30+ karakter), jadi kata "GB" di ujungnya
  // ke-wrap keluar border. Sekarang used memory juga ditampilin dalam GB (1
  // angka desimal) biar dua-duanya kompak: "19.4/25.4 GB".
  const totalMemGB = (os.totalmem() / 1024 / 1024 / 1024).toFixed(1);
  const usedMemGB  = ((os.totalmem() - os.freemem()) / 1024 / 1024 / 1024).toFixed(1);
  const ramPercent = (usedMemGB / totalMemGB) * 100;
  const greeting  = getGreeting();

  const now = new Date();
  const tgl = now.toLocaleDateString("id-ID", { timeZone: "Asia/Jakarta", weekday: "long", day: "2-digit", month: "long", year: "numeric" });
  const jam = now.toLocaleTimeString("id-ID", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });

  // FIX CARA KERJA (dikembaliin): .menu tugasnya cuma RINGKASAN per kategori
  // (nama kategori + jumlah command) + tombol buat loncat ke kategori yang mau
  // dilihat. Dump SEMUA command sekaligus itu tugasnya .listmenu (lihat
  // menu-sub.js), bukan di sini — supaya .menu tetap ringkas/cepet dibaca.
  //
  // FIX (request): daftar kategori dihapus dari body .menu — tombol kategori di
  // bawah pesan ini udah cukup buat milih kategori, gak perlu dobel ditulis lagi
  // di teksnya.

  // FIX BOX PATAH: konten yang panjangnya GAK PASTI (nama WA orang bisa panjang
  // banget & bisa ada emoji, kalimat quote juga variatif) sekarang ditaro DI LUAR
  // box, sebagai teks polos biasa — bukan di dalam bigHeader()/panel() lagi.
  // Kalau ini wrap ke baris baru, itu wajar & gak keliatan "patah" karena emang
  // gak ada border yang harus nyambung. Yang tetep di dalam box cuma baris yang
  // udah pasti pendek (tanggal, jam, angka, dst).
  const greetingText =
    `✦ *${toMonoUpperBold(global.botname || "MaddazXD V2")}* ✦\n` +
    `${greeting}, ${m.pushName || "Kak"} ✨\n` +
    `_"${quote()}"_`;

  // Pemanis: dikasih pembatas dekoratif (DIVIDER) antar-blok biar gak polos cuma
  // baris kosong, plus progress bar kecil buat RAM biar keliatan lebih hidup.
  const bodyText = greetingText + `\n\n${DIVIDER}\n\n` +
    panel("Status Sistem", [
      `📅 ${tgl}`,
      `🕐 ${jam} WIB`,
      `⚙️ Prefix : *${global.prefix}*`,
      `🟢 Mode   : *${sock.public ? "Public" : "Self"}*`,
      `⏳ Uptime : *${uptime}*`,
      `💾 RAM    : *${usedMemGB}/${totalMemGB} GB*`,
      `${progressBar(ramPercent, 10)}`,
    ], "🖥️") + `\n\n${DIVIDER}\n\n` +
    panel("Info Kamu", [
      `✦ Nama : *${truncate(m.pushName || "-", 18)}*`,
      // FIX: role sebelumnya cuma 2 kemungkinan (Owner/User), padahal
      // m.isAdmin udah tersedia dan DIHITUNG ULANG tiap pesan berdasarkan
      // groupMetadata chat itu sendiri (lib: handler.js) — bukan disimpan
      // statis. Konsekuensinya otomatis benar sesuai yang diminta: kalau
      // orang yang sama chat dari grup tempat dia admin, tampil "Admin";
      // begitu dia chat dari PC (private chat) atau grup lain tempat dia
      // BUKAN admin, otomatis balik ke "User" — gak perlu logic tambahan
      // apa pun buat "reset" statusnya, karena m.isAdmin memang di-default
      // false dan cuma di-set true di dalam blok `if (m.isGroup)` untuk
      // grup yang sedang aktif itu saja.
      `✦ Role : *${m.isOwner ? "👑 Owner" : m.isAdmin ? "🛡️ Admin" : "🙍 User"}*`,
    ], "👤") + `\n\n${DIVIDER}\n\n` +
    `📊 Total *${sorted.length}* kategori, *${totalCmd}* command\n` +
    `📂 Tap tombol di bawah buat lihat command per kategori, atau ketik *${global.prefix}listmenu* buat lihat semua command sekaligus.` +
    footer();

  // 🔒 TAG CARD - JANGAN DIHAPUS! 🔒
  // HANYA BUTTON KATEGORI! (2 button dihapus)
  const nativeFlow = {
    messageParamsJson: JSON.stringify({
      limited_time_offer: {
        text: greeting,
        url: "https://wa.me/" + (global.owner || "081915483630"),
        copy_code: "Dibuat oleh " + (global.ownername || "Owner"),
        expiration_time: Date.now() + 86400000,
      },
      bottom_sheet: {
        in_thread_buttons_limit: 1,
        divider_indices: [1, 999],
        list_title: "Loncat cepat ke kategori",
        button_title: "📂 Jump ke Kategori",
      },
    }),
    buttons: [
      {
        name: "single_select",
        buttonParamsJson: JSON.stringify({
          title: "📂 Jump ke Kategori",
          sections: [{ title: "Loncat cepat ke kategori", rows }],
        }),
      },
    ],
  };

  const thumbBuf = await getThumbBuffer();
  const videoBuf = getVideoBuffer();
  const sent = await sendInteractive(sock, m, {
    bodyText,
    footer: "⚡ Premium Menu",
    nativeFlow,
    thumbBuf,
    videoBuf,
  });

  if (!sent) {
    const fallback =
      panel(global.botname || "MaddazXD V2", [
        `Mode   : *${sock.public ? "Public" : "Self"}*`,
        `Uptime : *${uptime}*`,
        `RAM    : *${usedMemGB}/${totalMemGB} GB*`,
        `Prefix : *${global.prefix}*`,
        `Role   : *${m.isOwner ? "👑 Owner" : m.isAdmin ? "🛡️ Admin" : "🙍 User"}*`,
      ], "☰") + "\n\n" +
      `Total *${sorted.length}* kategori, *${totalCmd}* command\n` +
      `📂 Ketik *${global.prefix}listmenu* buat lihat semua command sekaligus.` +
      footer();
    if (videoBuf) await sock.sendMessage(m.chat, { video: videoBuf, caption: fallback, gifPlayback: true }, { quoted: m.verifiedQuoted });
    else if (thumbBuf) await sock.sendMessage(m.chat, { image: thumbBuf, caption: fallback }, { quoted: m.verifiedQuoted });
    else await sock.sendMessage(m.chat, { text: fallback }, { quoted: m.verifiedQuoted });
  }
};

handler.command = ["menu", "help", "?", "m"];
handler.tags = ["main"];
handler.help = ["menu"];
module.exports = handler;
