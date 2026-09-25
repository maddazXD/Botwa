// plugins/group/antitoxic.js — Toggle & proteksi anti kata kasar di grup
const { footer } = require("../../lib/theme");

const toxicWords = [
  "anjing", "babi", "bangsat", "kontol", "memek", "ngentot", "asu", "goblok",
  "tolol", "bajingan", "fuck", "shit", "bitch", "jembut", "ajg", "tlol", "bngst", "gblk", "dongo",
];

let handler = async (m, { args }) => {
  const o = args[0] || "";
  if (!["--on", "--off"].includes(o)) return m.reply("⚠️ Pilih opsi:\n\n• --on\n• --off");

  if (!global.db.groups[m.chat]) global.db.groups[m.chat] = {};

  if (o === "--on") {
    global.db.groups[m.chat].antitoxic = true;
    m.reply("✅ Anti Toxic berhasil diaktifkan" + footer());
  } else {
    global.db.groups[m.chat].antitoxic = false;
    m.reply("❌ Anti Toxic berhasil dinonaktifkan" + footer());
  }
};

handler.before = async (m, { sock, isAdmin, isOwner, isBotAdmin }) => {
  if (!m.isGroup || !m.text || !isBotAdmin) return;

  const chat = global.db.groups?.[m.chat];
  // FIX BUG: dulu cuma exempt isAdmin, owner ikut kena kalau kebetulan
  // bukan WA-admin di grup itu.
  if (!chat?.antitoxic || isAdmin || isOwner) return;

  const text = m.text.toLowerCase().replace(/[^a-z0-9\s]/g, "");
  const found = toxicWords.some((word) => new RegExp(`\\b${word}\\b`, "i").test(text));
  if (!found) return;

  try {
    await sock.sendMessage(m.chat, {
      delete: { remoteJid: m.chat, fromMe: false, id: m.key.id, participant: m.sender },
    });
    // LOG DIAGNOSTIK: biar kalau ada laporan "pesan kehapus sendiri, gak
    // tau kenapa" ke depannya, tinggal cek log Railway — ketauan LANGSUNG
    // plugin mana yang micu, bukan nebak-nebak dari gejala di WA lagi.
    console.log(`[ANTITOXIC] Hapus pesan dari ${m.sender} di grup ${m.chat} — alasan: kata toxic terdeteksi.`);
    await sock.sendMessage(
      m.chat,
      { text: `*– 乂 Anti Toxic –*\n\n⚠️ Pesan dari @${m.sender.split("@")[0]} mengandung kata toxic dan telah dihapus.`, mentions: [m.sender] },
      { quoted: m }
    );
  } catch (e) {
    console.error("[ANTITOXIC GAGAL]", e.message);
  }
  // FIX BUG: sebelumnya gak pernah return true, jadi command TETAP diproses
  // lanjut setelah pesan pelanggaran dihapus (handler.js cuma stop kalau
  // before() return truthy). Sekarang stop total setelah delete.
  return true;
};

handler.command = ["antitoxic"];
handler.tags = "admin";
handler.help = ["antitoxic --on", "antitoxic --off"];
handler.group = true;
handler.admin = true;
handler.botAdmin = true;

module.exports = handler;
