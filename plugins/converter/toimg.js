// plugins/converter/toimg.js
const fs = require("fs");
const { exec } = require("child_process");
const { promisify } = require("util");
const execAsync = promisify(exec);
const { getMediaSource } = require("../../lib/mediaHelper");
const { loadWebpImage } = require("../../lib/webpAnimUtil");
const { usage, processing, fail } = require("../../lib/theme");

let handler = async (m, { sock, prefix, command }) => {
  const source = getMediaSource(m);
  if (!source || source.mtype !== "stickerMessage") {
    return m.reply(usage(`Reply stiker yang mau diubah jadi gambar, terus ketik ${prefix}${command}`));
  }

  await m.reply(processing());
  const buffer = await source.download();

  if (!fs.existsSync("./tmp")) fs.mkdirSync("./tmp", { recursive: true });
  const workDir = `./tmp/toimg_${Date.now()}`;
  fs.mkdirSync(workDir);
  const input = `${workDir}/input.webp`;
  const output = `${workDir}/output.png`;
  fs.writeFileSync(input, buffer);

  const cleanup = () => { try { fs.rmSync(workDir, { recursive: true, force: true }); } catch {} };

  try {
    const { img, isAnimated } = await loadWebpImage(input);
    let sourceForFfmpeg = input;

    if (isAnimated) {
      // ffmpeg gak bisa baca webp animasi langsung -> ambil frame pertama dulu
      // pakai node-webpmux, baru itu yang diproses ffmpeg (webp statis dibaca lancar).
      // FIX BUG: node-webpmux v3.x ganti signature .demux() jadi satu objek
      // gabungan { path, ...settings } — versi terinstall (3.2.1) butuh ini.
      await img.demux({ path: workDir, prefix: "frame", frame: 0 });
      sourceForFfmpeg = `${workDir}/frame_0.webp`;
      if (!fs.existsSync(sourceForFfmpeg)) {
        cleanup();
        return m.reply(fail("Gagal mengambil frame dari stiker ini."));
      }
    }

    await execAsync(`ffmpeg -y -hide_banner -loglevel error -i "${sourceForFfmpeg}" -vframes 1 "${output}"`, { maxBuffer: 1024 * 1024 * 50 });
    await sock.sendMessage(m.chat, { image: fs.readFileSync(output) }, { quoted: m });
  } catch (err) {
    console.error("[TOIMG GAGAL]", err?.stderr || err?.message || err);
    return m.reply(fail("Gagal mengubah stiker jadi gambar."));
  } finally {
    cleanup();
  }
};

handler.command = ["toimg"];
handler.help = ["toimg"];
handler.tags = ["converter"];

module.exports = handler;
