// lib/convoMemory.js — Riwayat percakapan UNIFIED per-chat, gak terikat ke
// backend AI manapun. Beda sama lib/jazeChatSessions.js / lib/askmeSessions.js
// yang riwayatnya kepisah SENDIRI-SENDIRI di dalem masing-masing backend &
// GAK SALING NGERTI satu sama lain — makanya kalau giliran-1 dijawab AskMe
// terus giliran-2 kepaksa jatuh ke Andaraz, Andaraz gak tau apa-apa soal
// giliran-1 (obrolannya jadi "gak nyambung").
//
// Ini "buku catatan" independen: PASTI ke-update tiap ada balesan sukses,
// APAPUN backend yang jawab (JazeChat/AskMe/Gemini asli). lib/aiRouter.js
// makein ini buat ngasih konteks penuh ke Gemini API asli
// (lib/geminiVision.js) begitu suatu chat udah punya riwayat >1 giliran —
// jadi walau backend-backend gak resmi lagi pada rusak/gak konsisten,
// percakapan TETEP nyambung lewat jalur Gemini asli yang udah terbukti
// stabil.
//
// In-memory doang (Map), KE-RESET kalau bot restart (sama kayak
// jazeChatSessions/askmeSessions). Dibatasin maks 8 giliran terakhir per
// chat, dan gambar MENTAH cuma disimpen buat 2 giliran-gambar PALING BARU
// (giliran gambar yang lebih lama otomatis "dilupain" gambarnya, sisa
// teksnya doang) — biar gak numpuk gede-gede di memori kalau chat-nya
// rame/lama nyala.
const MAX_TURNS = 8;
const MAX_IMAGE_TURNS_KEPT = 2;

const memories = new Map(); // chatId -> array of { role, text, imageBuffer, imageMime }

function getMemory(chatId) {
  if (!memories.has(chatId)) memories.set(chatId, []);
  return memories.get(chatId);
}

function addTurn(chatId, role, text, imageBuffer, imageMime) {
  const mem = getMemory(chatId);
  mem.push({ role, text: text || "", imageBuffer: imageBuffer || null, imageMime: imageMime || null });

  // Buang gambar mentah dari giliran-gambar yang lebih lama dari
  // MAX_IMAGE_TURNS_KEPT, sisain teksnya doang (biar payload ke API gak
  // makin lama makin gede kalau obrolannya sering nyertain gambar).
  const imageTurnIdxs = [];
  mem.forEach((t, i) => { if (t.imageBuffer) imageTurnIdxs.push(i); });
  if (imageTurnIdxs.length > MAX_IMAGE_TURNS_KEPT) {
    const toStrip = imageTurnIdxs.slice(0, imageTurnIdxs.length - MAX_IMAGE_TURNS_KEPT);
    for (const i of toStrip) {
      mem[i].imageBuffer = null;
      mem[i].imageMime = null;
    }
  }

  if (mem.length > MAX_TURNS) mem.splice(0, mem.length - MAX_TURNS);
}

function clearMemory(chatId) {
  memories.delete(chatId);
}

// Buang SEMUA memory (semua chat sekaligus) — dipake .resetai.
function clearAllMemory() {
  const count = memories.size;
  memories.clear();
  return count;
}

module.exports = { getMemory, addTurn, clearMemory, clearAllMemory };
