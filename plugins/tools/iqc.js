// plugins/tools/iqc.js — generate gambar quote-card (kayak screenshot chat/status
// HP, lengkap jam & indikator baterai), pakai endpoint GET
// /faa/iqcv2?prompt=...&jam=...&batre=... dari api-faa.my.id.
// Format input: "teks|jam|persen baterai" (jam & baterai opsional, ada default).
const { faaUrl, retryFetch, extractFaaImage, withTickedProgress } = require("../../lib/faaClient");
const { usage, processing, ok, fail, progressBar } = require("../../lib/theme");

let handler = async (m, { sock, text, prefix, command }) => {
  const parts = (text || "").split("|").map((s) => s?.trim());
  const prompt = parts[0];
  if (!prompt) {
    return m.reply(
      usage(`${prefix}${command} <teks>|<jam opsional>|<persen baterai opsional>`, `${prefix}${command} lagi males ngoding|21:45|76`)
    );
  }
  const jam = parts[1] || "12:00";
  const batre = parts[2] || "100";

  const label = "Lagi bikin quote card...";
  const statusMsg = await sock.sendMessage(m.chat, { text: processing(label) }, { quoted: m });

  try {
    let lastPercent = -1;
    const onProgress = async (percent) => {
      if (percent === lastPercent || percent >= 100) return;
      lastPercent = percent;
      try { await sock.sendMessage(m.chat, { text: processing(`${label}\n${progressBar(percent)}`), edit: statusMsg.key }); } catch {}
    };

    const res = await withTickedProgress(
      retryFetch(faaUrl("/faa/iqcv2", { prompt, jam, batre }), {
        responseType: "arraybuffer",
        timeout: 60000,
        validateStatus: () => true,
      }),
      onProgress,
      { estimatedMs: 60000 }
    );
    if (res.status !== 200) {
      const bodyPreview = Buffer.from(res.data).toString("utf8").slice(0, 300);
      throw new Error(`API FAA gagal (HTTP ${res.status}): ${bodyPreview}`);
    }
    const imageBuffer = await extractFaaImage(res, { onProgress });
    await sock.sendMessage(m.chat, { text: ok("Nih quote card-nya!"), edit: statusMsg.key });
    await sock.sendMessage(m.chat, { image: imageBuffer }, { quoted: m });
  } catch (err) {
    console.error("[IQC GAGAL]", err?.message || err);
    try { await sock.sendMessage(m.chat, { text: fail("Gagal bikin quote card — API FAA lagi down/error. Coba lagi nanti."), edit: statusMsg.key }); } catch {}
  }
};

handler.command = ["iqc"];
handler.help = ["iqc <teks>|<jam>|<baterai> (bikin quote card ala status HP)"];
handler.tags = ["tools"];

module.exports = handler;
