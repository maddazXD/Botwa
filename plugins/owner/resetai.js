// plugins/owner/resetai.js — Reset SEMUA riwayat obrolan AI (semua chat
// sekaligus), buat testing AI dari nol lagi. Ngebersihin 4 lapisan:
//   1. JazeChat (lib/jazeChatSessions.js) — in-memory
//   2. AskMe (lib/askmeSessions.js) — in-memory
//   3. Andaraz session_id (persisted di global.db.chats[...].andarazSessionId)
//   4. convoMemory (lib/convoMemory.js) — riwayat UNIFIED lintas-backend
//      yang dipake buat nyambungin obrolan giliran ke-2 dst (lihat
//      lib/aiRouter.js)
// Owner-only karena ini ngaruh ke SEMUA chat/grup sekaligus, bukan cuma
// chat yang lagi dipake ngetik command ini.
const { ok } = require("../../lib/theme");
const { clearAllSessions: clearJaze } = require("../../lib/jazeChatSessions");
const { clearAllSessions: clearAskMe } = require("../../lib/askmeSessions");
const { clearAllMemory } = require("../../lib/convoMemory");

let handler = async (m) => {
  const jazeCount = clearJaze();
  const askmeCount = clearAskMe();
  const memoryCount = clearAllMemory();

  let andarazCount = 0;
  for (const chatId in global.db.chats || {}) {
    const c = global.db.chats[chatId];
    if (c?.andarazSessionId) {
      delete c.andarazSessionId;
      delete c.andarazSessionAt;
      andarazCount++;
    }
  }

  return m.reply(
    ok(
      `Semua riwayat obrolan AI direset.\n\n` +
        `🗑️ JazeChat: ${jazeCount} chat\n` +
        `🗑️ AskMe: ${askmeCount} chat\n` +
        `🗑️ Andaraz: ${andarazCount} chat\n` +
        `🗑️ Convo memory (lintas-backend): ${memoryCount} chat\n\n` +
        `Semua percakapan .vai/autoai bakal mulai dari NOL lagi.`
    )
  );
};

handler.command = ["resetai", "clearai"];
handler.tags = "owner";
handler.help = ["resetai (owner-only: hapus SEMUA riwayat obrolan AI, semua chat)"];
handler.owner = true;

module.exports = handler;
