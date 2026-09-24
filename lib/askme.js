/*
 * AskMe AI Chat (Chat + Image Vision)
 * API      : askme.matlubapps.com (image) + ai4chat.co (text)
 * Date     : 26-07-2026
 * Model    : gpt_4__1_nano (image) + ai4chat boss_mode (text)
 * Feature  : Multi-turn chat, history, image analysis (base64/URL/file)
 * Creator  :  febry.is-a.dev (please do not remove the creator wm)
 *
 * Note     : AskMe API only works for image analysis.
 *            Text chat uses AI4Chat API (free, no API key needed).
 *
 * CATATAN INTEGRASI (project ini, Agustus 2026): API ini GAK RESMI/GAK
 * DIDOKUMENTASIIN PUBLIK (reverse-engineered dari app pihak ketiga) — jadi
 * dipakai sebagai PRIMARY di plugins/tools/vai.js & plugins/tools/autoai.js
 * dengan FALLBACK otomatis ke Andaraz (teks)/Gemini API asli (gambar) kalau
 * ini gagal/down. Dikonversi dari ESM (import/export) ke CommonJS
 * (require/module.exports) biar konsisten sama sisa project ini. Bagian CLI
 * standalone (readline/process.argv) dari script aslinya DIHAPUS karena gak
 * kepake sama sekali dalam konteks bot ini (cuma dipakai buat testing
 * manual lewat terminal).
 */
const axios = require("axios");
const fs = require("fs");

// PENTING: API pihak ketiga kayak gini kadang balikin pesan error sebagai
// TEKS BIASA dengan HTTP 200 (bukan status error beneran) — misal
// "Invalid Request". Kalau ini gak dideteksi, kode bakal nganggep itu
// JAWABAN ASLI dari AI (soalnya lolos cek "reply kosong apa nggak"), terus
// ditampilin apa adanya ke user, PADAHAL itu error & harusnya trigger
// fallback ke Andaraz/Gemini. Jadi di sini dicek manual: kalau reply-nya
// PERSIS (bukan cuma "includes", biar gak nge-false-positive kalau user
// beneran nanya sesuatu yang isinya kebetulan mirip kata-kata ini) cocok
// sama salah satu frasa error umum di bawah, dianggep GAGAL (throw), bukan
// jawaban valid.
const ERROR_LIKE_REPLIES = [
  "invalid request",
  "bad request",
  "unauthorized",
  "forbidden",
  "internal server error",
  "rate limit exceeded",
  "rate limited",
  "quota exceeded",
  "something went wrong",
  "an error occurred",
  "service unavailable",
  "request failed",
];

function looksLikeErrorReply(reply) {
  if (typeof reply !== "string") return false;
  const normalized = reply.trim().toLowerCase().replace(/[.!]+$/, "");
  return ERROR_LIKE_REPLIES.includes(normalized);
}

class AskMe {
  constructor() {
    this.askmeUrl = "https://askme.matlubapps.com/ask-me";
    this.askmeKey = "ak8asda9$5kpq";
    this.askmeModel = "gpt_4__1_nano";
    this.ai4chatUrl = "https://yw85opafq6.execute-api.us-east-1.amazonaws.com/default/boss_mode_15aug";
    this.history = [];
    this.systemPrompt = "Kamu adalah AI assistant yang membantu dalam bahasa Indonesia. Jawab dengan singkat, jelas, dan informatif.";
  }

  async resolveMedia(input) {
    if (!input) return "";
    if (Buffer.isBuffer(input)) return input.toString("base64");
    if (typeof input === "string") {
      if (input.startsWith("http://") || input.startsWith("https://")) {
        const { data } = await axios.get(input, { responseType: "arraybuffer", timeout: 30000 });
        return Buffer.from(data).toString("base64");
      }
      if (input.startsWith("data:")) return input.split(",")[1];
      if (fs.existsSync(input)) return fs.readFileSync(input).toString("base64");
      return input;
    }
    return "";
  }

  async chatImage(prompt, image) {
    const b64 = await this.resolveMedia(image);
    this.history.push({ role: "user", content: prompt, data: b64 });

    const { data } = await axios.post(this.askmeUrl, {
      history: this.history,
      isPremium: false,
      modelname: this.askmeModel,
    }, {
      headers: { "Content-Type": "application/json", key: this.askmeKey },
      timeout: 60000,
    });

    const reply = data.msg || data.text;
    if (!reply) throw new Error("Empty response from server");
    if (looksLikeErrorReply(reply)) throw new Error(`AskMe (image) balikin respons error-like: "${reply}"`);

    this.history.push({ role: "assistant", content: reply, data: "" });
    return { code: 200, msg: reply, source: "askme" };
  }

  async chatText(prompt) {
    const context = this.history.slice(-10).map(h => `${h.role}: ${h.content}`).join("\n");
    const fullPrompt = context ? `${context}\nuser: ${prompt}` : prompt;

    const { data } = await axios.get(this.ai4chatUrl, {
      params: {
        text: fullPrompt,
        country: "Asia",
        user_id: "askme_user_" + Math.random().toString(36).slice(2, 10)
      },
      headers: {
        Origin: "https://www.ai4chat.co",
        Referer: "https://www.ai4chat.co/"
      },
      timeout: 30000,
    });

    const reply = typeof data === "string" ? data : (data.msg || data.text || data.result);
    if (!reply) throw new Error("Empty response from server");
    if (looksLikeErrorReply(reply)) throw new Error(`AskMe (text/ai4chat) balikin respons error-like: "${reply}"`);

    this.history.push({ role: "user", content: prompt });
    this.history.push({ role: "assistant", content: reply });

    if (this.history.length > 20) {
      this.history = this.history.slice(-20);
    }

    return { code: 200, msg: reply, source: "ai4chat" };
  }

  async chat(prompt, { model, image } = {}) {
    if (image) {
      return this.chatImage(prompt || "deskripsikan gambar ini", image);
    }
    return this.chatText(prompt);
  }

  clearHistory() {
    this.history = [];
  }
}

module.exports = AskMe;
