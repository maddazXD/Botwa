// lib/askmeSessions.js — satu instance AskMe (lib/askme.js) per chat, biar
// riwayat obrolannya (history internal di dalem class-nya) gak nyampur
// antar chat/grup.
//
// CATATAN: beda sama session Andaraz yang persisted ke disk
// (db.chats[...].andarazSessionId), instance AskMe di sini disimpen di Map
// in-memory biasa — riwayatnya KE-RESET kalau bot di-restart. Ini trade-off
// yang sengaja diambil biar gak perlu re-engineer class AskMe jadi
// stateless (ngerombak logic internal history-nya) cuma buat fitur
// fallback tambahan yang mudah-mudahan jarang kepake beneran.
const AskMe = require("./askme");

const sessions = new Map();

function getAskMeSession(chatId) {
  if (!sessions.has(chatId)) {
    sessions.set(chatId, new AskMe());
  }
  return sessions.get(chatId);
}

// Buang SEMUA session (semua chat sekaligus) — dipake .resetai buat testing
// AI dari nol lagi.
function clearAllSessions() {
  const count = sessions.size;
  sessions.clear();
  return count;
}

module.exports = { getAskMeSession, clearAllSessions };
