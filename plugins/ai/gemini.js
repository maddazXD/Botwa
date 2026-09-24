// plugins/ai/gemini.js — Chat AI (.ai / .gemini)
//
// FIX (API mati): sebelumnya manggil API pihak ketiga sendiri
// (puruboy.kozow.com) yang ternyata udah 404 (endpoint mati/ganti, sama
// pola kayak Venice AI/JazeChat yang juga pernah mati mendadak). Daripada
// gantung ke satu API gak resmi doang, sekarang dialihin pake
// lib/aiRouter.js — sistem yang SAMA dipake .vai/autoai, udah punya
// fallback berlapis (JazeChat -> AskMe -> Andaraz) jadi jauh lebih tahan
// banting kalau salah satu backend mati.
//
// EFEK SAMPING (yang bagus): .ai/.gemini sekarang share konteks
// percakapan (lib/convoMemory.js) bareng .vai/autoai di chat yang sama —
// dulu ini 3 sistem AI yang kepisah total & gak saling kenal, sekarang
// nyatu jadi satu "otak" per chat.
//
// Fitur konteks tanggal/jam real-time & web search buat pertanyaan yang
// butuh info terkini TETEP DIPERTAHANIN (itu logic yang berguna & gak ada
// hubungannya sama backend AI yang dipake), cuma titik manggil AI-nya yang
// diganti.
const { askText } = require("../../lib/aiRouter");
const { footer } = require("../../lib/theme");
const { searchWeb, looksLikeNeedsLiveInfo } = require("../../lib/webSearch");

async function buildPromptWithContext(question) {
  const now = new Date();
  const tgl = now.toLocaleDateString("id-ID", {
    timeZone: "Asia/Jakarta", weekday: "long", day: "2-digit", month: "long", year: "numeric",
  });
  const jam = now.toLocaleTimeString("id-ID", {
    timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit", hour12: false,
  });

  let context =
    `[Catatan INTERNAL buat kamu (AI) — INI BUKAN BAGIAN DARI PERTANYAAN USER: ` +
    `sekarang tanggal ${tgl}, pukul ${jam} WIB (Waktu Indonesia Barat, UTC+7), ` +
    `ini waktu ASLI/REAL-TIME, bukan asumsi. Kalau pertanyaan user di bawah ini ` +
    `NYANGKUT tanggal/jam/hari sekarang, jawab pakai info ini (bukan tanggal dari ` +
    `data latihanmu yang udah lama). TAPI kalau pertanyaannya GAK nyangkut waktu ` +
    `sama sekali, JANGAN sebut-sebut atau singgung tanggal/jam ini di jawabanmu — ` +
    `ini cuma catatan buat kamu pegang kalau diperlukan, bukan sesuatu yang harus ` +
    `selalu dicantumin di setiap jawaban.`;

  if (looksLikeNeedsLiveInfo(question)) {
    try {
      const results = await searchWeb(question, 4);
      if (results.length) {
        const cuplikan = results.map((r, i) => `${i + 1}. ${r.title} — ${r.snippet}`).join("\n");
        context +=
          `\n\n[Catatan INTERNAL lagi — juga BUKAN bagian pertanyaan user]: berikut ` +
          `hasil pencarian internet TERKINI yang relevan (dari DuckDuckGo, hari ini ` +
          `juga) — pakai sebagai BAHAN jawaban kalau memang relevan sama pertanyaan ` +
          `user, JANGAN cuma ngandelin ingatanmu sendiri buat hal yang sifatnya ` +
          `terkini/berubah-ubah. Jangan sebut-sebut "hasil pencarian" atau ` +
          `"menurut DuckDuckGo" di jawabanmu, langsung jawab aja pakai infonya:\n${cuplikan}`;
      }
    } catch (e) {
      console.error("[GEMINI WEBSEARCH GAGAL]", e.message);
    }
  }

  context += `\n\nJawab pertanyaan user berikut ini:\n${question}`;
  return context;
}

let handler = async (m, { text }) => {
  if (!text) return m.reply("Masukkan pertanyaan!");

  await m.react("🕒");

  try {
    const prompt = await buildPromptWithContext(text);
    const { answer } = await askText(m.chat, prompt);
    await m.reply(`🤖 *Gemini AI*\n\n${answer}` + footer());
    await m.react("✅");
  } catch (e) {
    console.error("[GEMINI GAGAL TOTAL]", e.message);
    await m.react("❌");
    m.reply("❌ Semua backend AI lagi gagal/down. Coba lagi nanti.");
  }
};

handler.command = ["gemini", "ai"];
handler.tags = ["ai"];
handler.help = ["gemini <pertanyaan>"];

module.exports = handler;
