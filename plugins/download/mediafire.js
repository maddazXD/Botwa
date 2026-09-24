// plugins/download/mediafire.js — Downloader file dari Mediafire
//
// FIX SSRF (CWE-918): sebelumnya validasi cuma regex.test(text) TANPA
// anchor — itu cuma ngecek "apa ada substring mediafire.com/file/xxx DI
// SUATU TEMPAT dalam teks", bukan "apa SELURUH teks ini link mediafire
// valid". Padahal yang di-fetch (axios.get) itu TEKS MENTAH UTUH dari user,
// bukan hasil match-nya. Akibatnya payload kayak
// "http://169.254.169.254/meta-data?fake=https://mediafire.com/file/x" bisa
// LOLOS validasi (karena ada substring mediafire.com di dalemnya) padahal
// yang beneran di-fetch itu ke internal/cloud-metadata endpoint, bukan
// mediafire.com — bisa dipake buat SSRF ke jaringan internal server. Sekarang
// divalidasi pake URL parser ASLI (bukan regex text-matching doang) yang
// ngecek protokol & hostname SELURUH URL-nya secara ketat.
const axios = require("axios");
const cheerio = require("cheerio");

// Parse & validasi SELURUH input sebagai satu URL utuh — balikin URL yang
// udah divalidasi (aman dipake) kalau valid, null kalau enggak. Ini beda
// dari regex.test() yang cuma nyari SUBSTRING di mana aja dalam teks.
function extractSafeMediafireUrl(rawText) {
  let parsed;
  try {
    parsed = new URL(rawText.trim());
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
  if (parsed.hostname !== "mediafire.com" && parsed.hostname !== "www.mediafire.com") return null;
  if (!/^\/(file|folder)\/\w+/.test(parsed.pathname)) return null;
  return parsed.href;
}

function formatBytes(bytes) {
  if (!bytes) return "0 Bytes";
  const k = 1024, sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

async function mediafire(safeUrl) {
  // PENTING: safeUrl di sini WAJIB udah lolos extractSafeMediafireUrl() di
  // pemanggil — fungsi ini sendiri gak validasi ulang, biar satu sumber
  // kebenaran aja (di titik masuknya, handler di bawah).
  const match = /\/(file|folder)\/(\w+)/.exec(safeUrl);
  const id = match[2];

  const { data: html } = await axios.get(safeUrl, { headers: { "User-Agent": "Mozilla/5.0" } });
  const $ = cheerio.load(html);
  const download = $("a#downloadButton").attr("href");
  if (!download) throw new Error("Gagal mengambil link unduhan dari halaman Mediafire.");

  const { data: json } = await axios.get(
    `https://www.mediafire.com/api/1.5/file/get_info.php?response_format=json&quick_key=${id}`
  );
  if (json?.response?.result !== "Success") throw new Error("Gagal mengambil info file.");
  const info = json.response.file_info;

  const size = parseInt(info.size, 10);
  const ext = info.filename.split(".").pop();

  return {
    filename: info.filename,
    size,
    sizeReadable: formatBytes(size),
    download,
    filetype: info.filetype,
    mimetype: info.mimetype || `application/${ext}`,
    privacy: info.privacy,
    owner_name: info.owner_name,
  };
}

let handler = async (m, { sock, text }) => {
  if (!text) return m.reply(`*Contoh:*\n${m.cmd} https://www.mediafire.com/file/xxxxx/nama.apk/file`);

  const safeUrl = extractSafeMediafireUrl(text);
  if (!safeUrl) return m.reply("❌ Link tidak valid! Pastikan link Mediafire benar.");

  await m.reply("⏳ Diproses dulu ya...");

  try {
    const res = await mediafire(safeUrl);
    const caption =
      `💌 *Nama:* ${res.filename}\n` +
      `📊 *Size:* ${res.sizeReadable}\n` +
      `🗂️ *Tipe:* ${res.filetype}\n` +
      `👤 *Owner:* ${res.owner_name || "-"}`;

    await m.reply(caption);
    await sock.sendMessage(m.chat, {
      document: { url: res.download },
      fileName: res.filename,
      mimetype: res.mimetype,
    }, { quoted: m });
  } catch (err) {
    console.error("[MEDIAFIRE GAGAL]", err.message);
    m.reply("❌ Gagal mengambil file dari Mediafire: " + err.message);
  }
};

handler.command = ["mediafire", "mf"];
handler.tags = ["Download"];
handler.help = ["mediafire <link>"];

module.exports = handler;
