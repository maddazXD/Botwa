// plugins/koleksi/koleksi.js
const fs = require("fs");
const path = require("path");
const moment = require("moment-timezone");
const { ok, fail } = require("../../lib/theme");
const { renderTable } = require("../../lib/tableImage");

const DB_DIR = path.join(process.cwd(), "database", "koleksi");
const DEADLINE_INPUT_FORMAT = "DD-MM-YYYY";

function ensureDb(kategori) {
  if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });
  const p = path.join(DB_DIR, `${kategori}.json`);
  if (!fs.existsSync(p)) fs.writeFileSync(p, JSON.stringify([]));
  return JSON.parse(fs.readFileSync(p));
}
function saveDb(kategori, data) {
  fs.writeFileSync(path.join(DB_DIR, `${kategori}.json`), JSON.stringify(data, null, 2));
}
function normKey(s) {
  return String(s).toLowerCase().replace(/\s+/g, "");
}
function parseDeadline(str) {
  const parsed = moment.tz(str, DEADLINE_INPUT_FORMAT, true, "Asia/Jakarta");
  return parsed.isValid() ? parsed : null;
}
function formatDeadline(iso) {
  return moment.tz(iso, "Asia/Jakarta").format("dddd, DD MMMM YYYY");
}

// Ingatan sementara "dosen yang barusan dilihat" per-pengirim (1 menit), biar alur
// .tugas -> .namadosen -> .deskripsi bisa nyambung tanpa perlu ketik ulang nama dosen.
const lastDosenContext = new Map();
const DOSEN_CONTEXT_TTL = 60 * 1000;
function setLastDosen(sender, dosen) {
  lastDosenContext.set(sender, { dosen, expires: Date.now() + DOSEN_CONTEXT_TTL });
}
function getLastDosen(sender) {
  const ctx = lastDosenContext.get(sender);
  if (!ctx) return null;
  if (Date.now() > ctx.expires) { lastDosenContext.delete(sender); return null; }
  return ctx.dosen;
}

async function sendKoleksiRecord(sock, m, record) {
  const deadlineLine = record.deadline ? `\n⏰ Deadline: *${formatDeadline(record.deadline)}*` : "";
  const caption = `📌 *${record.deskripsi}*\n👤 Dosen: ${record.dosen}\n🗂️ Kategori: ${record.kategori}${deadlineLine}\n💾 Disimpan oleh: ${record.savedBy}`;

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

let handler = async (m, { sock, command, text, prefix, isOwner, isAdmin }) => {
  // ── .save ──────────────────────────────
  if (command === "save") {
    const quoted = m.quoted;
    const mediaTypes = ["imageMessage", "videoMessage", "audioMessage", "documentMessage"];
    const isMedia = quoted && mediaTypes.includes(quoted.mtype);
    const sourceText = quoted && !isMedia ? quoted.text : null;

    if (!quoted || (!isMedia && !sourceText)) {
      return m.reply(`Reply chat/file yang mau disimpan, lalu ketik:\n${prefix}save tugas|nama dosen|deskripsi\natau\n${prefix}save materi|nama dosen|deskripsi\n\n💡 Mau tambahin deadline? Tinggal tambah bagian ke-4:\n${prefix}save tugas|nama dosen|deskripsi|dd-mm-yyyy`);
    }

    const parts = text.split("|").map((s) => s.trim());
    if ((parts.length !== 3 && parts.length !== 4) || !parts[0] || !parts[1] || !parts[2]) {
      return m.reply(`Format salah!\nContoh: ${prefix}save tugas|Yadi|Buat Makalah Ekonomi\nAtau dengan deadline: ${prefix}save tugas|Yadi|Buat Makalah Ekonomi|25-07-2026`);
    }

    const [kategoriRaw, dosen, deskripsi, deadlineRaw] = parts;
    const kategori = kategoriRaw.toLowerCase();
    if (kategori !== "tugas" && kategori !== "materi") {
      return m.reply(`Kategori cuma boleh "tugas" atau "materi".\nContoh: ${prefix}save tugas|Yadi|Buat Makalah Ekonomi`);
    }

    let deadlineIso = null;
    if (deadlineRaw) {
      const parsedDeadline = parseDeadline(deadlineRaw);
      if (!parsedDeadline) return m.reply(`Format tanggal deadline salah. Pakai format ${DEADLINE_INPUT_FORMAT}, contoh: 25-07-2026.`);
      deadlineIso = parsedDeadline.format("YYYY-MM-DD");
    }

    const db = ensureDb(kategori);
    const id = `${kategori}_${Date.now()}`;
    const record = { id, dosen, deskripsi, kategori, deadline: deadlineIso, savedBy: m.pushName || "User", savedAt: new Date().toISOString() };

    try {
      if (isMedia) {
        const buffer = await quoted.download();
        const storageDir = path.join(process.cwd(), "storage", kategori);
        fs.mkdirSync(storageDir, { recursive: true });
        const originalName = quoted.fileName || id;
        const ext = originalName.includes(".") ? originalName.split(".").pop() : ((quoted.mimetype || "").split("/").pop() || "bin");
        const fileName = `${id}.${ext}`;
        const filePath = path.join(storageDir, fileName);
        fs.writeFileSync(filePath, buffer);

        record.contentType = "file";
        record.fileName = originalName;
        record.filePath = filePath;
        record.mimetype = quoted.mimetype || "application/octet-stream";
      } else {
        record.contentType = "text";
        record.text = sourceText;
      }

      db.push(record);
      saveDb(kategori, db);

      const deadlineInfo = deadlineIso ? `\n⏰ Deadline: ${formatDeadline(deadlineIso)}` : "";
      return m.reply(ok(`Tersimpan sebagai *${kategori}*!\n👤 Dosen: ${dosen}\n📝 Deskripsi: ${deskripsi}${deadlineInfo}`));
    } catch (err) {
      return m.reply(fail("Gagal menyimpan: " + String(err)));
    }
  }

  // ── .tugas / .materi ───────────────────
  if (command === "tugas" || command === "materi") {
    const kategori = command;
    const db = ensureDb(kategori);
    if (db.length === 0) {
      return m.reply(`Belum ada ${kategori} yang tersimpan.\nSimpan dulu pakai:\n${prefix}save ${kategori}|nama dosen|deskripsi\n(reply chat/file yang mau disimpan)`);
    }

    if (!text) {
      const dosenList = [...new Set(db.map((d) => d.dosen))];
      const rows = dosenList.map((dosen, i) => ({
        no: i + 1,
        dosen,
        jumlah: db.filter((d) => d.dosen === dosen).length,
      }));
      const img = await renderTable({
        title: `Daftar Dosen - ${kategori.toUpperCase()}`,
        columns: [
          { key: "no", label: "No", max: 90 },
          { key: "dosen", label: "Nama Dosen", max: 560 },
          { key: "jumlah", label: `Jml ${kategori}`, max: 190 },
        ],
        rows,
        footNote: `Ketik .${normKey(dosenList[0])} buat liat daftar ${kategori}-nya.`,
      });
      return sock.sendMessage(
        m.chat,
        { image: img, caption: `📚 *Daftar Dosen (${kategori})*\n\nKetik *.${normKey(dosenList[0])}* (nama dosennya) buat liat daftar ${kategori}-nya.` },
        { quoted: m }
      );
    }

    const parts = text.split("|").map((s) => s.trim());
    const dosenQuery = parts[0];
    const deskripsiQuery = parts[1];

    let matches = db.filter((d) => normKey(d.dosen) === normKey(dosenQuery));
    if (matches.length === 0) return m.reply(fail(`Dosen "${dosenQuery}" gak ketemu di daftar ${kategori}.`));

    if (deskripsiQuery) {
      const found = matches.filter((d) => normKey(d.deskripsi) === normKey(deskripsiQuery));
      if (found.length === 0) return m.reply(fail(`Deskripsi "${deskripsiQuery}" gak ketemu buat dosen ${dosenQuery}.`));
      for (const rec of found) await sendKoleksiRecord(sock, m, rec);
      return;
    }

    const today = moment.tz("Asia/Jakarta").format("YYYY-MM-DD");
    const rows = matches.map((d, i) => ({
      no: i + 1,
      deskripsi: d.deskripsi,
      deadline: d.deadline ? moment.tz(d.deadline, "Asia/Jakarta").format("DD/MM/YYYY") : "-",
      _lewat: d.deadline && d.deadline < today,
    }));
    const img = await renderTable({
      title: `${kategori.toUpperCase()} - ${matches[0].dosen}`,
      columns: [
        { key: "no", label: "No", max: 90 },
        { key: "deskripsi", label: "Deskripsi", max: 600 },
        { key: "deadline", label: "Deadline", max: 220 },
      ],
      rows,
      rowHighlight: (r) => r._lewat,
      footNote: `Ketik .${normKey(matches[0].deskripsi)} buat liat isinya. (baris merah = deadline lewat)`,
    });
    setLastDosen(m.sender, matches[0].dosen);
    return sock.sendMessage(
      m.chat,
      {
        image: img,
        caption: `📄 *${kategori} — ${dosenQuery}*\n\nKetik *.${normKey(matches[0].deskripsi)}* buat liat isinya.\n⏱️ _Bot cuma inget kamu lagi liat dosen ini selama 1 menit — kalau lewat, sebutin lagi nama dosennya ya._`,
      },
      { quoted: m }
    );
  }

  // ── .hapustugas / .hapusmateri ─────────
  if (command === "hapustugas" || command === "hapusmateri") {
    const kategori = command === "hapustugas" ? "tugas" : "materi";
    if (!isOwner && !isAdmin) return m.reply("Cuma Owner/Admin grup yang boleh hapus data, biar gak kehapus gak sengaja.");

    const db = ensureDb(kategori);
    if (db.length === 0) return m.reply(`Belum ada ${kategori} yang tersimpan.`);
    if (!text) return m.reply(`Format: ${prefix}${command} <nama dosen>|<deskripsi>\natau cukup ${prefix}${command} <deskripsi> kalau deskripsinya unik.\n\nContoh: ${prefix}${command} Yadi|Buat Makalah Ekonomi`);

    const parts = text.split("|").map((s) => s.trim());
    let matches;

    if (parts.length >= 2) {
      const [dosenQuery, deskripsiQuery] = parts;
      matches = db.filter((d) => normKey(d.dosen) === normKey(dosenQuery) && normKey(d.deskripsi) === normKey(deskripsiQuery));
      if (matches.length === 0) return m.reply(`Gak ketemu ${kategori} dari dosen "${dosenQuery}" dengan deskripsi "${deskripsiQuery}".`);
    } else {
      const deskripsiQuery = parts[0];
      matches = db.filter((d) => normKey(d.deskripsi) === normKey(deskripsiQuery));
      if (matches.length === 0) return m.reply(`Gak ketemu ${kategori} dengan deskripsi "${deskripsiQuery}".`);
      if (matches.length > 1) {
        let msg = `⚠️ Ada ${matches.length} ${kategori} dengan deskripsi itu, dari dosen berbeda:\n`;
        matches.forEach((d, i) => (msg += `${i + 1}. ${d.dosen}\n`));
        msg += `\nSebutkan dosennya biar spesifik:\n${prefix}${command} <nama dosen>|${deskripsiQuery}`;
        return m.reply(msg);
      }
    }

    for (const rec of matches) {
      if (rec.contentType === "file" && rec.filePath) { try { fs.unlinkSync(rec.filePath); } catch {} }
    }
    const idsToDelete = matches.map((d) => d.id);
    saveDb(kategori, db.filter((d) => !idsToDelete.includes(d.id)));

    return m.reply(ok(`Berhasil hapus ${matches.length} ${kategori}:\n${matches.map((d) => `• ${d.dosen} — ${d.deskripsi}`).join("\n")}`));
  }

  // ── .deadline ───────────────────────────
  if (command === "deadline") {
    let items = [];
    for (const kategori of ["tugas", "materi"]) {
      const db = ensureDb(kategori);
      items.push(...db.filter((d) => d.deadline).map((d) => ({ ...d, kategori })));
    }
    if (items.length === 0) {
      return m.reply(`Belum ada tugas/materi yang punya deadline.\nTambahin pas nyimpen, contoh:\n${prefix}save tugas|nama dosen|deskripsi|25-07-2026`);
    }
    items.sort((a, b) => a.deadline.localeCompare(b.deadline));
    const today = moment.tz("Asia/Jakarta").format("YYYY-MM-DD");
    const rows = items.map((d, i) => ({
      no: i + 1,
      kategori: d.kategori,
      deskripsi: d.deskripsi,
      dosen: d.dosen,
      deadline: moment.tz(d.deadline, "Asia/Jakarta").format("DD/MM/YYYY"),
      _lewat: d.deadline < today,
    }));
    const img = await renderTable({
      title: "Daftar Deadline",
      columns: [
        { key: "no", label: "No", max: 90 },
        { key: "kategori", label: "Kategori", max: 150 },
        { key: "deskripsi", label: "Deskripsi", max: 460 },
        { key: "dosen", label: "Dosen", max: 280 },
        { key: "deadline", label: "Deadline", max: 190 },
      ],
      rows,
      rowHighlight: (r) => r._lewat,
      footNote: "Baris merah = deadline sudah terlewat.",
    });
    return sock.sendMessage(m.chat, { image: img, caption: "⏰ *Daftar Deadline Tugas & Materi*" }, { quoted: m });
  }
};

handler.command = ["save", "tugas", "materi", "hapustugas", "hapusmateri", "deadline"];
handler.help = ["save tugas|dosen|deskripsi", "tugas", "materi", "deadline", "hapustugas", "hapusmateri"];
handler.tags = ["koleksi"];
handler.group = true;

// ── Shortcut ".<namadosen>" / ".<deskripsi>" ──
// Command dinamis (nama dosen/deskripsi) gak mungkin didaftarin statis di handler.command,
// jadi dicek lewat "before" hook yang jalan di setiap pesan. Dicek DULU apakah keyword-nya
// bentrok sama command asli yang udah terdaftar di plugin lain — kalau iya, biarin command
// asli itu yang jalan (jangan sampai shortcut ini nyerobot).
handler.before = async function (m, { sock }) {
  if (!m.isGroup) return false;
  if (!m.body || !m.body.startsWith(global.prefix)) return false;

  const keyword = m.body.slice(global.prefix.length).trim().split(/ +/)[0]?.toLowerCase();
  if (!keyword) return false;

  const { getReservedCommands } = require("../../lib/reservedCommands");
  if (getReservedCommands().has(keyword)) return false;

  const key = normKey(keyword);
  const kategoris = ["tugas", "materi"];
  let dosenMatches = [];
  let deskripsiMatches = [];

  for (const kategori of kategoris) {
    const dbPath = path.join(DB_DIR, `${kategori}.json`);
    if (!fs.existsSync(dbPath)) continue;
    const db = JSON.parse(fs.readFileSync(dbPath));

    const itemsByDosen = db.filter((d) => normKey(d.dosen) === key);
    if (itemsByDosen.length > 0) dosenMatches.push({ kategori, dosen: itemsByDosen[0].dosen, items: itemsByDosen });

    const itemsByDeskripsi = db.filter((d) => normKey(d.deskripsi) === key);
    if (itemsByDeskripsi.length > 0) deskripsiMatches.push(...itemsByDeskripsi);
  }

  if (deskripsiMatches.length === 1) {
    setLastDosen(m.sender, deskripsiMatches[0].dosen);
    await sendKoleksiRecord(sock, m, deskripsiMatches[0]);
    return true;
  }

  if (deskripsiMatches.length > 1) {
    const lastDosen = getLastDosen(m.sender);
    if (lastDosen) {
      const narrowed = deskripsiMatches.filter((d) => normKey(d.dosen) === normKey(lastDosen));
      if (narrowed.length === 1) {
        await sendKoleksiRecord(sock, m, narrowed[0]);
        return true;
      }
    }
    const today = moment.tz("Asia/Jakarta").format("YYYY-MM-DD");
    const rows = deskripsiMatches.map((d, i) => ({
      no: i + 1,
      dosen: d.dosen,
      kategori: d.kategori,
      deadline: d.deadline ? moment.tz(d.deadline, "Asia/Jakarta").format("DD/MM/YYYY") : "-",
      _lewat: d.deadline && d.deadline < today,
    }));
    const img = await renderTable({
      title: `Deskripsi "${keyword}" - ${deskripsiMatches.length} Ditemukan`,
      columns: [
        { key: "no", label: "No", max: 90 },
        { key: "dosen", label: "Dosen", max: 320 },
        { key: "kategori", label: "Kategori", max: 150 },
        { key: "deadline", label: "Deadline", max: 190 },
      ],
      rows,
      rowHighlight: (r) => r._lewat,
      footNote: `Sebutkan dosennya biar spesifik, contoh: .${deskripsiMatches[0].kategori} ${deskripsiMatches[0].dosen}|${keyword}`,
    });
    await sock.sendMessage(
      m.chat,
      {
        image: img,
        caption: `⚠️ Ada *${deskripsiMatches.length}* tugas/materi dengan deskripsi "${keyword}", dari dosen berbeda.\n\nSebutkan dosennya biar spesifik, contoh:\n.${deskripsiMatches[0].kategori} ${deskripsiMatches[0].dosen}|${keyword}`,
      },
      { quoted: m }
    );
    return true;
  }

  if (dosenMatches.length > 0) {
    setLastDosen(m.sender, dosenMatches[0].dosen);
    const today = moment.tz("Asia/Jakarta").format("YYYY-MM-DD");
    const rows = [];
    for (const dm of dosenMatches) {
      for (const d of dm.items) {
        rows.push({
          no: rows.length + 1,
          kategori: dm.kategori,
          deskripsi: d.deskripsi,
          deadline: d.deadline ? moment.tz(d.deadline, "Asia/Jakarta").format("DD/MM/YYYY") : "-",
          _lewat: d.deadline && d.deadline < today,
        });
      }
    }
    const firstDeskripsi = dosenMatches[0].items[0].deskripsi;
    const img = await renderTable({
      title: `Tugas & Materi - ${dosenMatches[0].dosen}`,
      columns: [
        { key: "no", label: "No", max: 90 },
        { key: "kategori", label: "Kategori", max: 150 },
        { key: "deskripsi", label: "Deskripsi", max: 460 },
        { key: "deadline", label: "Deadline", max: 190 },
      ],
      rows,
      rowHighlight: (r) => r._lewat,
      footNote: `Ketik .${normKey(firstDeskripsi)} buat liat isinya. (baris merah = deadline lewat)`,
    });
    await sock.sendMessage(
      m.chat,
      {
        image: img,
        caption: `📚 *${dosenMatches[0].dosen}*\n\nKetik *.${normKey(firstDeskripsi)}* (nama deskripsinya) buat liat isinya.\n⏱️ _Bot cuma inget kamu lagi liat dosen ini selama 1 menit._`,
      },
      { quoted: m }
    );
    return true;
  }

  return false;
};

module.exports = handler;
