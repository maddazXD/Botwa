// lib/jazeChatSessions.js — satu instance GeminiChat (lib/jazeChat.js) per
// chat, biar riwayat percakapannya (this.messages) gak nyampur antar chat.
// CATATAN: sama kayak lib/askmeSessions.js, ini in-memory doang (Map biasa)
// — riwayatnya KE-RESET kalau bot di-restart.
const GeminiChat = require("./jazeChat");

const sessions = new Map();

function getJazeChatSession(chatId) {
  if (!sessions.has(chatId)) {
    sessions.set(chatId, new GeminiChat());
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

module.exports = { getJazeChatSession, clearAllSessions };
