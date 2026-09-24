// plugins/tools/tempmail.js — Email sementara (buat daftar akun, dll)
const axios = require("axios");

const tempail = {
  base: "https://tempail.top/api",
  headers: { "user-agent": "Postify/1.0.0" },
  deletedInTimestamp: null,

  async createEmail() {
    try {
      const res = await axios.post(`${this.base}/email/create/ApiTempail`, null, { headers: this.headers });
      if (res.data.status !== "success") return { success: false, error: "Gagal bikin email temp." };
      const { email, email_token: emailToken, deleted_in: deletedIn } = res.data.data;
      this.deletedInTimestamp = new Date(deletedIn).getTime();
      return { success: true, email, emailToken, deletedIn };
    } catch (e) {
      return { success: false, error: e.message };
    }
  },

  isExpired() {
    return this.deletedInTimestamp ? Date.now() > this.deletedInTimestamp : false;
  },

  async getMessages(emailToken) {
    if (!emailToken?.trim()) return { success: false, error: "Email token harus diisi." };
    try {
      const res = await axios.get(`${this.base}/messages/${emailToken}/ApiTempail`, { headers: this.headers });
      if (res.data.status !== "success") return { success: false, error: "Gagal ambil list pesan." };
      const { mailbox, messages } = res.data.data;
      return { success: true, mailbox, messages };
    } catch (e) {
      return { success: false, error: e.message };
    }
  },

  async getMessage(messageId) {
    if (!messageId?.trim()) return { success: false, error: "Message ID harus diisi." };
    try {
      const res = await axios.get(`${this.base}/message/${messageId}/ApiTempail`, { headers: this.headers });
      if (res.data.status !== "success") return { success: false, error: "Gagal ambil isi pesan." };
      const [msg] = res.data.data;
      return { success: true, message: msg };
    } catch (e) {
      return { success: false, error: e.message };
    }
  },
};

let handler = async (m, { command, text }) => {
  if (command === "tempmail") {
    const res = await tempail.createEmail();
    if (!res.success) return m.reply(res.error);
    return m.reply(
      `📫 *Email Sementara berhasil dibuat!*\n📧 Email: ${res.email}\n🔐 Token: ${res.emailToken}\n🕐 Expired: ${res.deletedIn}\n\n` +
      `Gunakan token ini untuk cek inbox:\n*${global.prefix}cekmail ${res.emailToken}*`
    );
  }

  if (command === "cekmail") {
    const token = text.trim();
    if (!token) return m.reply("Contoh: .cekmail <email_token>");
    const res = await tempail.getMessages(token);
    if (!res.success) return m.reply(res.error);
    if (!res.messages.length) return m.reply("📭 Belum ada pesan yang masuk.");
    let out = `📥 *Daftar Pesan Masuk*\n📫 Email: ${res.mailbox}\n\n`;
    out += res.messages.map((v, i) => `🔹 *${i + 1}*. ${v.subject || "(Tanpa Subjek)"}\n📩 ID: ${v.id}`).join("\n\n");
    return m.reply(out + `\n\nGunakan *${global.prefix}pesanmail <id>* untuk baca isi pesannya.`);
  }

  if (command === "pesanmail") {
    const id = text.trim();
    if (!id) return m.reply("Contoh: .pesanmail <message_id>");
    const res = await tempail.getMessage(id);
    if (!res.success) return m.reply(res.error);
    const msg = res.message;
    return m.reply(
      `📨 *Isi Pesan*\n📌 Subjek: ${msg.subject}\n👤 Dari: ${msg.from} <${msg.from_email}>\n🕐 Diterima: ${msg.receivedAt}\n🆔 ID: ${msg.id}\n\n` +
      `📬 Pesan:\n${msg.content ? msg.content.replace(/<[^>]*>/g, "") : "(Tidak ada isi)"}`
    );
  }
};

handler.command = ["tempmail", "cekmail", "pesanmail"];
handler.tags = ["tools"];
handler.help = ["tempmail", "cekmail <token>", "pesanmail <id>"];

module.exports = handler;
