// plugins/converter/hd.js — SATU command (.hd) buat perjelas FOTO maupun VIDEO.
// Otomatis deteksi tipe media dari yang di-reply, terus nyoba tier BERURUTAN dari
// yang kualitasnya paling bagus sampai yang paling gampang diandalkan — semua otomatis,
// gak perlu ketik kata kunci tambahan kayak "anime"/"ai" lagi.
//
// Buat FOTO, teks setelah command bisa dua macam:
// - Angka (mis. ".hd 3")            → dipakai sebagai SKALA. Skala tetap default 2x kalau kosong.
// - Teks lain (mis. ".hd buat gambar ini jadi realistis") → BELUM kepake, karena endpoint
//   FAA hdv4 (tier satu-satunya sekarang) cuma nerima parameter "image", gak ada prompt/style.
//
// ── FOTO ──────────────────────────────────────────────────────────────────────
// 1) API FAA (hdv4)  [gak butuh apikey] — SATU-SATUNYA tier, endpoint GET
//    /faa/hdv4?image=<url> dari api-faa.my.id (sebelumnya Andaraz img2img).
//    Foto di-upload dulu ke hosting sementara (lib/screaper.js) buat dapet URL
//    publik, baru dikirim ke API. GAK ADA fallback lokal lagi — kalau ini
//    gagal, .hd langsung gagal & kasih tau errornya.
//
// ── VIDEO ─────────────────────────────────────────────────────────────────────
// 1) API FAA (hdvid)  [gak butuh apikey] — SATU-SATUNYA tier, endpoint GET
//    /faa/hdvid?url=<url> dari api-faa.my.id (sebelumnya Replicate Real-ESRGAN
//    + fallback ffmpeg lokal). Video di-upload dulu ke hosting sementara
//    (lib/screaper.js) buat dapet URL publik, baru dikirim ke API. Hasilnya
//    (baik file video langsung maupun URL di JSON) di-reencode paksa biar
//    dijamin kompatibel diputer di WA. GAK ADA fallback lokal lagi.
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");
const { promisify } = require("util");
const execAsync = promisify(exec);
const Jimp = require("jimp");
const { getMediaSource } = require("../../lib/mediaHelper");
const { uploadImageBuffer } = require("../../lib/screaper");
const { getMediaDuration } = require("../../lib/videoReencode");
const { faaUrl, extractFaaImage, extractFaaVideoUrl, retryFetch, resolveFaaMedia } = require("../../lib/faaClient");
const { usage, processing, ok, fail, progressBar } = require("../../lib/theme");

const MAX_DURATION_LOCAL = 120;   // detik — batas durasi video, biar server gak keberatan

// ══════════════════════════════ TIER — FOTO ══════════════════════════════════

// API FAA hdv4 nerima parameter "image" via query string (GET) — beda dari
// Andaraz yang nerima file lewat multipart POST. Karena itu, foto yang mau
// diperjelas HARUS di-upload dulu ke hosting sementara buat dapet URL publik
// (pakai lib/screaper.js, hosting yang sama dipakai buat tier video di bawah),
// baru URL-nya dikirim ke endpoint FAA.
//
// CATATAN: dari contoh endpoint yang dikasih (cuma "?image=...") gak kelihatan
// ada parameter prompt/style kayak Andaraz img2img dulu — jadi customPrompt
// (kalau user isi teks custom di ".hd <prompt>") BELUM kepake di tier ini.
async function upscaleViaFaa(buffer) {
  const publicUrl = await uploadImageBuffer(buffer);
  if (!publicUrl) throw new Error("Gagal upload gambar ke hosting sementara buat diproses API FAA.");

  const res = await retryFetch(faaUrl("/faa/hdv4", { image: publicUrl }), {
    responseType: "arraybuffer",
    timeout: 240000,
    validateStatus: () => true,
  });

  if (res.status !== 200) {
    const bodyPreview = Buffer.from(res.data).toString("utf8").slice(0, 300);
    throw new Error(`API FAA gagal (HTTP ${res.status}): ${bodyPreview}`);
  }

  return extractFaaImage(res);
}

const MAX_UPSCALED_DIM = 4096; // cap biar file gak kegedean/lemot dikirim

// Andaraz (dan API img2img sejenis) biasanya cuma "memperjelas" gambar —
// kualitas naik tapi RESOLUSI/jumlah piksel tetep sama kayak input. Kalau
// dibiarin, hasilnya keliatan pecah pas di-zoom walau captionnya bilang
// "skala 2x", karena piksel aslinya emang gak nambah. Fungsi ini nambahin
// langkah upscale resolusi BENERAN (resize bicubic) di atas hasil AI,
// biar jumlah piksel akhir bener-bener sesuai skala yang diminta.
async function resizeUpToScale(buffer, scale, origDims) {
  if (scale <= 1) return buffer;
  const img = await Jimp.read(buffer);
  const curW = img.bitmap.width, curH = img.bitmap.height;
  const baseW = origDims?.w || curW, baseH = origDims?.h || curH;
  let targetW = Math.round(baseW * scale);
  let targetH = Math.round(baseH * scale);

  // Kalau hasil AI-nya udah lebih gede/sama dengan target, gak usah diapa-apain
  // lagi (jangan resize turun, itu malah ngerusak kualitas).
  if (curW >= targetW && curH >= targetH) return buffer;

  if (targetW > MAX_UPSCALED_DIM || targetH > MAX_UPSCALED_DIM) {
    const ratio = Math.min(MAX_UPSCALED_DIM / targetW, MAX_UPSCALED_DIM / targetH);
    targetW = Math.round(targetW * ratio);
    targetH = Math.round(targetH * ratio);
  }

  img.resize(targetW, targetH, Jimp.RESIZE_BICUBIC);
  return img.getBufferAsync(Jimp.MIME_PNG);
}

async function handleImage(m, sock, buffer, scale, customPrompt) {
  let origDims = null;
  try {
    const probe = await Jimp.read(buffer);
    origDims = { w: probe.bitmap.width, h: probe.bitmap.height };
  } catch {}

  // Susunan tier dicoba BERURUTAN, satu command doang, otomatis lanjut ke tier
  // berikutnya kalau yang sebelumnya gagal/gak di-set.
  const tiers = [
    {
      label: "FAA",
      msg: customPrompt
        ? `API FAA (hdv4) — perjelas gambar (catatan: prompt custom kamu belum didukung endpoint ini, diabaikan)...`
        : "API FAA (hdv4) — perjelas gambar...",
      run: () => upscaleViaFaa(buffer),
    },
  ];

  const statusMsg = await sock.sendMessage(m.chat, { text: processing(tiers[0].msg) }, { quoted: m });

  for (const tier of tiers) {
    try {
      let out = await tier.run();
      out = await resizeUpToScale(out, scale, origDims);
      let finalDims = "";
      try {
        const finalProbe = await Jimp.read(out);
        finalDims = ` (${finalProbe.bitmap.width}x${finalProbe.bitmap.height})`;
      } catch {}
      await sock.sendMessage(
        m.chat,
        { text: ok(`Selesai (${tier.label})! Skala ${scale}x${origDims ? ` — asli ${origDims.w}x${origDims.h}` : ""}${finalDims}`), edit: statusMsg.key }
      );
      return sock.sendMessage(m.chat, { image: out }, { quoted: m });
    } catch (err) {
      console.error(`[HD] ${tier.label} gagal:`, err?.response?.data ? JSON.stringify(err.response.data).slice(0, 300) : err?.message);
    }
  }

  // FAA sekarang satu-satunya tier (gak ada fallback lokal lagi, dan gak
  // butuh apikey). Kalau gagal, langsung kasih tau gagal, gak diem-diem aja.
  try {
    await sock.sendMessage(m.chat, { text: fail("Gagal memproses gambar — API FAA lagi down/error, atau upload ke hosting sementara gagal. Coba lagi beberapa saat lagi."), edit: statusMsg.key });
  } catch {}
}

// ══════════════════════════════ TIER — VIDEO ═════════════════════════════════

// API FAA hdvid nerima parameter "url" via query string (GET), sama pola kayak
// hdv4 buat foto — video di-upload dulu ke hosting sementara (lib/screaper.js)
// buat dapet URL publik, baru URL-nya dikirim ke endpoint FAA.
async function reencodeVideoBuffer(buffer, label) {
  if (!fs.existsSync("./tmp")) fs.mkdirSync("./tmp", { recursive: true });
  const input = path.join("./tmp", `${label}_${Date.now()}_in`);
  const output = path.join("./tmp", `${label}_${Date.now()}_out.mp4`);
  fs.writeFileSync(input, buffer);
  try {
    // Sama kayak fix di lib/videoReencode.js — -loglevel error biar ffmpeg gak
    // ngeluarin log progress verbose, plus maxBuffer dinaikin jaga-jaga video berat.
    await execAsync(
      `ffmpeg -y -hide_banner -loglevel error -i "${input}" -c:v libx264 -preset veryfast -crf 23 -c:a aac -b:a 128k -pix_fmt yuv420p -movflags +faststart "${output}"`,
      { maxBuffer: 1024 * 1024 * 50 }
    );
    const duration = await getMediaDuration(output);
    return { buffer: fs.readFileSync(output), duration };
  } finally {
    try { fs.unlinkSync(input); } catch {}
    try { fs.unlinkSync(output); } catch {}
  }
}

async function handleVideo(m, sock, source, scale) {
  const durationSec = source.seconds || 0;
  if (durationSec > MAX_DURATION_LOCAL) {
    return m.reply(fail(`Video kepanjangan (${durationSec}s). Maks ${MAX_DURATION_LOCAL} detik biar server gak keberatan proses.`));
  }

  const statusMsg = await sock.sendMessage(
    m.chat,
    { text: processing("API FAA (hdvid) — perjelas video, bisa makan waktu beberapa menit tergantung durasi...") },
    { quoted: m }
  );

  try {
    const buffer = await source.download();
    const publicUrl = await uploadImageBuffer(buffer);
    if (!publicUrl) throw new Error("Gagal upload video ke hosting sementara buat diproses API FAA.");

    const res = await retryFetch(faaUrl("/faa/hdvid", { url: publicUrl }), {
      responseType: "arraybuffer",
      timeout: 300000,
      validateStatus: () => true,
    });

    if (res.status !== 200) {
      const bodyPreview = Buffer.from(res.data).toString("utf8").slice(0, 300);
      throw new Error(`API FAA gagal (HTTP ${res.status}): ${bodyPreview}`);
    }

    const contentType = res.headers["content-type"] || "";
    let finalBuf, duration;
    if (contentType.startsWith("video/")) {
      // API balikin file video mentah langsung — tetep di-reencode paksa biar
      // dijamin format-nya kompatibel diputer di WA (moov atom depan, H.264/AAC).
      ({ buffer: finalBuf, duration } = await reencodeVideoBuffer(Buffer.from(res.data), "hdvid"));
    } else {
      // JSON isinya link STATUS (bukan langsung video!) — ketemu dari log:
      // {"state":"processing","message":"Video masih diproses"}. Jadi harus
      // di-poll berkala pakai resolveFaaMedia sampai videonya beneran siap.
      // Pesan statusMsg yang SAMA (dari awal function) terus diedit tiap poll
      // buat nampilin progress bar-nya jalan — bukan bikin pesan baru lagi.
      const resultUrl = extractFaaVideoUrl(res);
      let lastPercent = -1;
      const videoRes = await resolveFaaMedia(resultUrl, {
        onProgress: async (percent) => {
          if (percent === lastPercent) return; // gak usah edit kalau angkanya sama kayak sebelumnya
          lastPercent = percent;
          try {
            await sock.sendMessage(
              m.chat,
              { text: processing(`Video masih diproses di server FAA...\n${progressBar(percent)}`), edit: statusMsg.key }
            );
          } catch (e) {
            // Edit gagal (jarang, misal pesan kehapus user) — gak fatal, lanjut aja proses utamanya.
            console.error("[HD VIDEO] gagal edit progress bar:", e.message);
          }
        },
      });
      ({ buffer: finalBuf, duration } = await reencodeVideoBuffer(Buffer.from(videoRes.data), "hdvid"));
    }

    await sock.sendMessage(m.chat, { text: ok(`Selesai (FAA hdvid)!${duration ? ` Durasi ${duration}` : ""}`), edit: statusMsg.key });
    await sock.sendMessage(m.chat, { video: finalBuf, mimetype: "video/mp4" }, { quoted: m });
  } catch (err) {
    console.error("[HD VIDEO GAGAL]", err?.response?.data ? JSON.stringify(err.response.data).slice(0, 300) : err?.message);
    try {
      await sock.sendMessage(m.chat, { text: fail("Gagal memproses video — API FAA lagi down/error, atau upload ke hosting sementara gagal. Coba lagi beberapa saat lagi."), edit: statusMsg.key });
    } catch {}
  }
}

// ══════════════════════════════ HANDLER UTAMA ════════════════════════════════

let handler = async (m, { sock, prefix, command, text }) => {
  const source = getMediaSource(m);
  const isImage = source && source.mtype === "imageMessage";
  const isVideo = source && source.mtype === "videoMessage";

  if (!isImage && !isVideo) {
    return m.reply(
      usage(
        `Reply FOTO atau VIDEO, terus ketik ${prefix}${command} [skala]\n` +
        `Buat FOTO, bisa juga ganti [skala] dengan prompt custom kalau mau hasil beda dari default (default-nya udah otomatis 4K + full color + tanpa blur).`,
        `${prefix}${command} 2\n${prefix}${command} buat gambar ini jadi realistis`
      )
    );
  }

  const trimmedText = (text || "").trim();

  if (isImage) {
    // Kalau teksnya cuma angka → dianggap skala (perilaku lama). Kalau ada
    // teks lain → dianggap prompt custom, GANTIKAN HD_PROMPT default buat
    // tier Andaraz (skala tetep pakai default 2x buat fallback lokal).
    const isNumericScale = /^\d+(\.\d+)?$/.test(trimmedText);
    let scale = 2;
    let customPrompt = null;
    if (trimmedText) {
      if (isNumericScale) {
        scale = Math.min(Math.max(Math.round(parseFloat(trimmedText)), 1), 4);
      } else {
        customPrompt = trimmedText;
      }
    }
    const buffer = await source.download();
    return handleImage(m, sock, buffer, scale, customPrompt);
  }

  const rawScale = parseFloat(trimmedText);
  let scale = Number.isFinite(rawScale) ? rawScale : 1.5;
  scale = Math.min(Math.max(scale, 1), 2);
  return handleVideo(m, sock, source, scale);
};

handler.command = ["hd", "hdimage", "hdvideo", "hdvid", "videohd", "upscale"];
handler.help = [
  "hd [skala] (reply foto/video — default: 4K + full color + tanpa blur)",
  "hd <prompt custom> (reply foto — pakai instruksi kamu sendiri, contoh: hd buat gambar ini jadi realistis)",
];
handler.tags = ["converter"];

module.exports = handler;
