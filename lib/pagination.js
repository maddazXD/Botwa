// lib/pagination.js — Generic pagination buat command yang nampilin daftar (berita, gempa
// terkini, gempa dirasakan, dll). Nyimpen "sesi" per chat di memori (Map), isinya daftar
// blok teks yang udah jadi + posisi halaman sekarang.
//
// CATATAN DESAIN:
// - State disimpen per m.chat, BUKAN per user. Di grup, siapapun yang ketik .next/.back akan
//   geser halaman punya sesi terakhir yang aktif di chat itu — ini best-effort by design,
//   kalau butuh per-user beda mesti simpen keyed by `${chatId}:${senderId}` sebagai gantinya.
// - State ke-reset kalau bot restart (in-memory doang, gak disimpen ke file/database).
//   Kalau butuh persist lintas restart tinggal ganti Map ini ke lib/database yang udah ada.
// - Otomatis dibersihin (prune) sesi yang nganggur >2 jam biar Map gak numpuk terus di memori.

const { header, footer } = require("./theme");

const PAGE_SIZE = 7;
const SESSION_TTL_MS = 2 * 60 * 60 * 1000; // 2 jam

const sessions = new Map(); // chatId -> { title, emoji, blocks: string[], page, updatedAt }

function prune() {
  const now = Date.now();
  for (const [key, s] of sessions) {
    if (now - s.updatedAt > SESSION_TTL_MS) sessions.delete(key);
  }
}

function render(session) {
  const totalPages = Math.max(1, Math.ceil(session.blocks.length / PAGE_SIZE));
  const start = session.page * PAGE_SIZE;
  const pageBlocks = session.blocks.slice(start, start + PAGE_SIZE);

  let txt = `${header(session.title, session.emoji)}\n\n`;
  txt += pageBlocks.join("\n┈┈┈┈┈┈┈┈┈┈┈┈\n");
  txt += `\n\n╭─📄 *NAVIGASI*\n`;
  txt += `┃ Halaman *${session.page + 1}/${totalPages}* • Total *${session.blocks.length}* item\n`;
  const navHints = [];
  if (session.page < totalPages - 1) navHints.push("➡️ *.next* buat lanjut");
  if (session.page > 0) navHints.push("⬅️ *.back* buat balik");
  if (navHints.length) txt += `┃ ${navHints.join("  |  ")}\n`;
  txt += `╰──────────────📄`;
  txt += footer();
  return txt;
}

// Mulai/replace sesi baru untuk chat ini, langsung balikin teks halaman pertama.
function startSession(chatId, { title, emoji, blocks }) {
  prune();
  const session = { title, emoji, blocks, page: 0, updatedAt: Date.now() };
  sessions.set(chatId, session);
  return render(session);
}

function nextPage(chatId) {
  const s = sessions.get(chatId);
  if (!s) return { error: "none" };
  const totalPages = Math.max(1, Math.ceil(s.blocks.length / PAGE_SIZE));
  if (s.page >= totalPages - 1) return { error: "end" };
  s.page++;
  s.updatedAt = Date.now();
  return { text: render(s) };
}

function backPage(chatId) {
  const s = sessions.get(chatId);
  if (!s) return { error: "none" };
  if (s.page <= 0) return { error: "start" };
  s.page--;
  s.updatedAt = Date.now();
  return { text: render(s) };
}

module.exports = { PAGE_SIZE, startSession, nextPage, backPage };
