// plugins/ai/ghibli.js — Ubah foto jadi gaya anime Ghibli
const crypto = require("crypto");
const { getMediaSource } = require("../../lib/mediaHelper");

const SIMPAN_SITE = "https://simpan.site/api/upload";
const TEMPLATE = "photo-to-ghibli-anime";

class AnimeConverter {
  constructor() {
    this.cookies = {};
    this.baseHeaders = {
      accept: "*/*", "accept-language": "id-ID", "cache-control": "no-cache",
      origin: "https://www.photosstyle.com", pragma: "no-cache",
      referer: "https://www.photosstyle.com/",
      "user-agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Mobile Safari/537.36",
    };
    this.setCookie("GUEST_ID", crypto.randomUUID());
    this.setCookie("user_fingerprint", crypto.randomUUID());
  }

  setCookie(key, value) { if (key && value) this.cookies[key] = value; }
  getCookieHeader() { return Object.entries(this.cookies).map(([k, v]) => `${k}=${v}`).join("; "); }

  async _req(url, options = {}) {
    const response = await fetch(url, {
      method: options.method || "GET",
      headers: { ...this.baseHeaders, ...options.headers, cookie: this.getCookieHeader() },
      body: options.body,
    });
    const setCookie = response.headers?.getSetCookie?.() || [];
    for (const cookieStr of setCookie) {
      const main = cookieStr.split(";")[0];
      const [key, ...val] = main.split("=");
      if (key && val.length) this.cookies[key.trim()] = val.join("=").trim();
    }
    return response;
  }

  async _upload(buffer) {
    const filename = crypto.randomBytes(8).toString("hex") + ".jpg";
    const blob = new Blob([buffer], { type: "image/jpeg" });
    const form = new FormData();
    form.append("file", blob, filename);
    const res = await this._req("https://www.photosstyle.com/api/upload", { method: "POST", body: form });
    const json = await res.json();
    const url = json?.url || json?.data?.url;
    if (!url) throw new Error("Upload gagal.");
    return url;
  }

  async _poll(taskId) {
    for (let i = 1; i <= 60; i++) {
      await new Promise((r) => setTimeout(r, 3000));
      const res = await this._req(`https://www.photosstyle.com/api/generation/task?taskId=${taskId}`);
      const json = await res.json();
      const status = json?.data?.status;
      if (status === "succeeded") return json.data;
      if (status === "failed" || status === "error") throw new Error("Generation failed.");
    }
    throw new Error("Polling timeout.");
  }

  async _uploadToSimpan(url) {
    try {
      const img = await fetch(url);
      const buffer = Buffer.from(await img.arrayBuffer());
      const blob = new Blob([buffer], { type: "image/png" });
      const form = new FormData();
      form.append("file", blob, "anime-result.png");
      const upload = await fetch(SIMPAN_SITE, { method: "POST", body: form });
      const json = await upload.json();
      if (json.success && json.files?.[0]) return json.files[0].file.url;
      return null;
    } catch { return null; }
  }

  async generate(buffer) {
    const uploaded = await this._upload(buffer);
    const payload = { urls: [uploaded], templateId: TEMPLATE, aspectRatio: "2:3", category: TEMPLATE, credit: "1", utm_source: null };
    const res = await this._req("https://www.photosstyle.com/api/generation/chat", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload),
    });
    const json = await res.json();
    const taskId = json?.data?.id;
    if (!taskId) throw new Error("Task ID tidak ditemukan.");
    const result = await this._poll(taskId);
    const resultUrl = result?.imgUrl;
    const mirror = resultUrl ? await this._uploadToSimpan(resultUrl) : null;
    return { status: true, result: resultUrl, url: mirror };
  }
}

let handler = async (m, { sock }) => {
  const source = getMediaSource(m);
  if (!source || source.mtype !== "imageMessage") return m.reply("Reply/Kirim gambar dengan caption *.ghibli*");

  await m.reply("🎨 Sedang membuat anime...\nMohon tunggu sekitar 1-3 menit.");

  try {
    const media = await source.download();
    const api = new AnimeConverter();
    const result = await api.generate(media);
    if (!result.status) throw new Error(result.error || "Gagal.");

    const finalUrl = result.url || result.result;
    const imgRes = await fetch(finalUrl);
    const buf = Buffer.from(await imgRes.arrayBuffer());
    await sock.sendMessage(m.chat, { image: buf, caption: "✨ Berhasil membuat gambar anime." }, { quoted: m });
  } catch (e) {
    console.error("[GHIBLI GAGAL]", e.message);
    m.reply("❌ Gagal: " + e.message);
  }
};

handler.command = ["ghibli"];
handler.tags = ["ai"];
handler.help = ["ghibli (reply foto)"];

module.exports = handler;
