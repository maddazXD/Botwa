// plugins/upload/upload.js — penyimpanan file/teks universal, gak terikat konteks apapun
// (beda sama plugins/koleksi yang khusus tugas/materi kuliah). Arsitekturnya sengaja mirip
// koleksi.js (skema DB, cara simpan file, shortcut ".<nama>") biar konsisten sama fitur lain,
// tapi tanpa konsep "dosen" — cuma satu tingkat: nama -> isi.
const fs = require("fs");
const path = require("path");
const { header, card, ok, fail, usage } = require("../../lib/theme");
const { renderTable } = require("../../lib/tableImage");

const DB_DIR = path.join(process.cwd(), "database", "upload");
const DB_PATH = path.join(DB_DIR, "upload.json");
const STORAGE_DIR = path.join(process.cwd(), "storage", "upload");

function ensureDb() {
  if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });
  if (!fs.existsSync(DB_PATH)) fs.writeFileSync(DB_PATH, JSON.stringify([]));
  return JSON.parse(fs.readFileSync(DB_PATH));
}
function saveDb(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}
function normKey(s) {
  return String(s).toLowerCase().replace(/\s+/g, "");
}

async function sendUploadRecord(sock, m, record) {
  const caption = `📦 *${record.nama}*\n💾 Disimpan oleh: ${record.uploadedBy}\n🕓 ${new Date(record.uploadedAt).toLocaleString("id-ID")}`;

  if (record.contentType === "file") {
    if (!fs.existsSync(record.filePath)) {
      return sock.sendMessage(m.chat, { text: `${caption}\n\n⚠️ File aslinya sudah tidak ada di server.` }, { quoted: m });
    }
    const buffer = fs.readFileSync(record.filePath);
    const mt = record.mimetype || "";
    if (mt.startsWith("image/")) await sock.sendMessage(m.chat, { image: buffer, caption }, { quoted: m });
    else if (mt.startsWith("video/")) await sock.sendMessage(m.chat, { video: buffer, caption }, { quoted: m });
    else if (mt.startsWith("audio/")) {
      await sock.sendMessage(m.chat, { audio: buffer, mimetype: mt }, { quoted: m });
      await sock.sendMessage(m.chat, { text: caption }, { quoted: m });
    } else {
      await sock.sendMessage(m.chat, { document: buffer, fileName: record.fileName, mimetype: mt, caption }, { quoted: m });
    }
  } else {
    await sock.sendMessage(m.chat, { text: `${caption}\n\n${record.text}` }, { quoted: m });
  }
}

let handler = async (m, { sock, command, text, prefix }) => {
  // ── .upload <nama> (reply media/teks) atau .upload <nama>|<isi teks> ──
  if (command === "upload") {
    const quoted = m.quoted;
    const mediaTypes = ["imageMessage", "videoMessage", "audioMessage", "documentMessage", "stickerMessage"];
    const isMedia = quoted && mediaTypes.includes(quoted.mtype);
    const quotedText = quoted && !isMedia ? quoted.text : null;

    let nama, plainText;
    if (text.includes("|") && !isMedia) {
      [nama, plainText] = text.split("|").map((s) => s.trim());
    } else {
      nama = text.trim();
    }

    if (!nama) {
      return m.reply(
        usage(
          `Reply file/foto/video/teks apapun, terus ketik ${prefix}upload <nama>\natau simpan teks langsung: ${prefix}upload <nama>|<isi teksnya>`,
          `${prefix}upload notepenting|Jangan lupa beli galon`
        )
      );
    }
    if (!isMedia && !quotedText && !plainText) {
      return m.reply(fail("Gak ada yang mau disimpan — reply file/teks, atau pakai format .upload nama|isi."));
    }

    const db = ensureDb();
    if (db.some((d) => normKey(d.nama) === normKey(nama))) {
      return m.reply(fail(`Nama *${nama}* udah dipakai. Hapus dulu (.hapusupload ${nama}) atau pakai nama lain.`));
    }

    const id = `upload_${Date.now()}`;
    const record = { id, nama, uploadedBy: m.pushName || "User", uploaderJid: m.sender, uploadedAt: new Date().toISOString() };

    try {
      if (isMedia) {
        fs.mkdirSync(STORAGE_DIR, { recursive: true });
        const buffer = await quoted.download();
        const originalName = quoted.fileName || id;
        const ext = originalName.includes(".") ? originalName.split(".").pop() : ((quoted.mimetype || "").split("/").pop() || "bin");
        const fileName = `${id}.${ext}`;
        const filePath = path.join(STORAGE_DIR, fileName);
        fs.writeFileSync(filePath, buffer);

        record.contentType = "file";
        record.fileName = originalName;
        record.filePath = filePath;
        record.mimetype = quoted.mimetype || "application/octet-stream";
      } else {
        record.contentType = "text";
        record.text = plainText || quotedText;
      }

      db.push(record);
      saveDb(db);
      return m.reply(ok(`Tersimpan sebagai *${nama}*!\nKetik *.${normKey(nama)}* atau *.ambilupload ${nama}* buat manggil lagi.`));
    } catch (err) {
      return m.reply(fail("Gagal menyimpan: " + String(err)));
    }
  }

  // ── .ambilupload <nama> ──
  if (command === "ambilupload") {
    const db = ensureDb();
    const record = db.find((d) => normKey(d.nama) === normKey(text));
    if (!record) return m.reply(fail(`Gak ada yang tersimpan dengan nama "${text}".`));
    return sendUploadRecord(sock, m, record);
  }

  // ── .listupload ──
  if (command === "listupload") {
    const db = ensureDb();
    if (db.length === 0) return m.reply(fail("Belum ada yang di-upload sama sekali."));

    const rows = db.map((d, i) => ({
      no: i + 1,
      nama: d.nama,
      tipe: d.contentType === "file" ? (d.mimetype || "file").split("/")[0] : "teks",
      oleh: d.uploadedBy,
      tanggal: new Date(d.uploadedAt).toLocaleDateString("id-ID"),
    }));
    const img = await renderTable({
      title: "Daftar Upload",
      columns: [
        { key: "no", label: "No", max: 90 },
        { key: "nama", label: "Nama", max: 320 },
        { key: "tipe", label: "Tipe", max: 130 },
        { key: "oleh", label: "Oleh", max: 220 },
        { key: "tanggal", label: "Tanggal", max: 160 },
      ],
      rows,
      footNote: `Ketik .<nama> atau .ambilupload <nama> buat manggil lagi.`,
    });
    return sock.sendMessage(m.chat, { image: img, caption: "📦 *Daftar Upload*" }, { quoted: m });
  }

  // ── .hapusupload <nama> ──
  if (command === "hapusupload") {
    if (!text) return m.reply(usage(`${prefix}hapusupload <nama>`));
    const db = ensureDb();
    const record = db.find((d) => normKey(d.nama) === normKey(text));
    if (!record) return m.reply(fail(`Gak ada yang tersimpan dengan nama "${text}".`));

    if (record.uploaderJid !== m.sender) {
      return m.reply(fail("Cuma yang upload aslinya yang bisa hapus ini."));
    }

    if (record.contentType === "file" && record.filePath) {
      try { fs.unlinkSync(record.filePath); } catch {}
    }
    saveDb(db.filter((d) => d.id !== record.id));
    return m.reply(ok(`*${record.nama}* berhasil dihapus.`));
  }
};

handler.command = ["upload", "ambilupload", "listupload", "hapusupload"];
handler.help = ["upload <nama>", "listupload", "ambilupload <nama>", "hapusupload <nama>"];
handler.tags = ["upload"];

// ── Shortcut ".<nama>" — sama persis polanya kayak koleksi.js, tapi flat (gak ada dosen) ──
handler.before = async function (m, { sock }) {
  if (!m.body || !m.body.startsWith(global.prefix)) return false;

  const keyword = m.body.slice(global.prefix.length).trim().split(/ +/)[0]?.toLowerCase();
  if (!keyword) return false;

  const { getReservedCommands } = require("../../lib/reservedCommands");
  if (getReservedCommands().has(keyword)) return false;

  const db = ensureDb();
  const record = db.find((d) => normKey(d.nama) === keyword);
  if (!record) return false;

  await sendUploadRecord(sock, m, record);
  return true;
};

module.exports = handler;
