// lib/aiRouter.js — router terpusat buat .vai & autoai: nyoba beberapa
// backend AI, balikin jawaban pertama yang berhasil. Satu tempat ini dipake
// dari DUA plugin (plugins/tools/vai.js & plugins/tools/autoai.js) biar
// urutan fallback-nya konsisten & gak keduplikat logic-nya di dua tempat.
//
// STRATEGI (PENTING, ini yang bikin obrolan lintas-turn TETEP NYAMBUNG):
//   - GILIRAN PERTAMA di suatu chat (belum ada riwayat di lib/convoMemory.js):
//     coba berurutan JazeChat -> AskMe -> Andaraz(teks)/Gemini-asli(gambar).
//     Yang PERTAMA berhasil dipake, DAN dicatet ke convoMemory (unified,
//     independen dari backend manapun).
//   - GILIRAN KE-2 DST di chat yang SAMA (convoMemory udah ada isinya):
//     LANGSUNG ke Gemini API asli + convoMemory (chatWithMemory), SKIP
//     JazeChat/AskMe sama sekali. Alasannya: JazeChat & AskMe masing-masing
//     nyimpen riwayat SENDIRI-SENDIRI yang GAK NYAMBUNG kalau turn
//     sebelumnya kebetulan dijawab backend LAIN (udah kejadian nyata:
//     gambar dijawab AskMe, giliran teks lanjutannya malah AskMe gagal &
//     jatuh ke Andaraz yang gak tau apa-apa soal gambar itu — obrolannya
//     jadi "lupa ingatan"). convoMemory + Gemini asli itu SATU-SATUNYA
//     jalur yang PASTI punya konteks penuh dari SEMUA giliran sebelumnya,
//     apapun backend yang jawab giliran-giliran itu.
//   - Kalau Gemini+memory GAGAL (misal geminiApiKey kosong/limit), baru
//     jatuh lagi ke jalur normal (JazeChat -> AskMe -> Andaraz/Gemini
//     single-shot) sebagai penyelamat terakhir — walau ini bakal
//     kehilangan sebagian konteks obrolan sebelumnya, itu lebih baik
//     daripada gak jawab sama sekali.
const { getJazeChatSession } = require("./jazeChatSessions");
const { getAskMeSession } = require("./askmeSessions");
const { andarazJson } = require("./andarazClient");
const { describeImage, chatWithMemory } = require("./geminiVision");
const { getMemory, addTurn } = require("./convoMemory");

const SESSION_MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000; // 3 hari — cuma dipake session_id JWT Andaraz

function getAndarazChatCfg(chatId) {
  if (!global.db.chats) global.db.chats = {};
  if (!global.db.chats[chatId]) global.db.chats[chatId] = { id: chatId };
  const cfg = global.db.chats[chatId];
  if (cfg.andarazSessionId && cfg.andarazSessionAt && Date.now() - cfg.andarazSessionAt > SESSION_MAX_AGE_MS) {
    delete cfg.andarazSessionId;
    delete cfg.andarazSessionAt;
  }
  return cfg;
}

async function andarazTextFallback(chatId, prompt) {
  const cfg = getAndarazChatCfg(chatId);
  const params = { prompt };
  if (cfg.andarazSessionId) params.session_id = cfg.andarazSessionId;
  const { answer, sessionId } = await andarazJson("/api/ai/gemini", params);
  if (sessionId) {
    cfg.andarazSessionId = sessionId;
    cfg.andarazSessionAt = Date.now();
  }
  return answer;
}

// Coba jalur normal berurutan (dipake buat giliran PERTAMA suatu chat, ATAU
// sebagai penyelamat terakhir kalau Gemini+memory gagal). Kalau ada yang
// berhasil, DICATET ke convoMemory di sini juga.
async function askNormalChain(chatId, prompt, buffer, mimetype) {
  const isImage = Boolean(buffer);
  const finalPrompt = isImage ? prompt || "Jelaskan isi gambar ini." : prompt;

  const jaze = getJazeChatSession(chatId);
  try {
    const r = await jaze.chat({ prompt: finalPrompt, image: buffer || undefined });
    if (r.result) {
      addTurn(chatId, "user", finalPrompt, buffer, mimetype);
      addTurn(chatId, "assistant", r.result);
      return { answer: r.result, source: "jazechat" };
    }
  } catch (e) {
    console.error(`[AI ROUTER][${isImage ? "gambar" : "teks"}] JazeChat gagal:`, e?.message || e);
  }

  const askme = getAskMeSession(chatId);
  try {
    const r = isImage ? await askme.chatImage(finalPrompt, buffer) : await askme.chatText(finalPrompt);
    if (r.msg) {
      addTurn(chatId, "user", finalPrompt, buffer, mimetype);
      addTurn(chatId, "assistant", r.msg);
      return { answer: r.msg, source: "askme" };
    }
  } catch (e) {
    console.error(`[AI ROUTER][${isImage ? "gambar" : "teks"}] AskMe gagal:`, e?.message || e);
  }

  if (isImage) {
    if (!global.geminiApiKey) {
      throw new Error("JazeChat & AskMe dua-duanya gagal, dan fallback terakhir (Gemini API asli) belum bisa dipake (global.geminiApiKey kosong di config.js).");
    }
    const answer = await describeImage(buffer, mimetype, finalPrompt);
    addTurn(chatId, "user", finalPrompt, buffer, mimetype);
    addTurn(chatId, "assistant", answer);
    return { answer, source: "gemini-vision" };
  }

  const answer = await andarazTextFallback(chatId, finalPrompt);
  addTurn(chatId, "user", finalPrompt);
  addTurn(chatId, "assistant", answer);
  return { answer, source: "andaraz" };
}

// Tanya AI TEKS doang. Giliran ke-2 dst -> Gemini+memory duluan (biar
// nyambung). Giliran pertama / Gemini+memory gagal -> jalur normal.
async function askText(chatId, prompt) {
  const memory = getMemory(chatId);

  if (memory.length > 0 && global.geminiApiKey) {
    try {
      const answer = await chatWithMemory(memory, prompt, null, null);
      addTurn(chatId, "user", prompt);
      addTurn(chatId, "assistant", answer);
      return { answer, source: "gemini-memory" };
    } catch (e) {
      console.error("[AI ROUTER][teks] Gemini+memory gagal:", e?.message || e);
    }
  }

  return askNormalChain(chatId, prompt, null, null);
}

// Tanya AI soal GAMBAR (buffer mentah). Sama strateginya kayak askText.
async function askImage(chatId, prompt, buffer, mimetype) {
  const finalPrompt = prompt || "Jelaskan isi gambar ini.";
  const memory = getMemory(chatId);

  if (memory.length > 0 && global.geminiApiKey) {
    try {
      const answer = await chatWithMemory(memory, finalPrompt, buffer, mimetype);
      addTurn(chatId, "user", finalPrompt, buffer, mimetype);
      addTurn(chatId, "assistant", answer);
      return { answer, source: "gemini-memory" };
    } catch (e) {
      console.error("[AI ROUTER][gambar] Gemini+memory gagal:", e?.message || e);
    }
  }

  return askNormalChain(chatId, finalPrompt, buffer, mimetype);
}

module.exports = { askText, askImage };
