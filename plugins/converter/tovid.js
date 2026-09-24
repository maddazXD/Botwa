// plugins/converter/tovid.js
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
    return m.reply(usage(`Reply stiker (video/gif) yang mau diubah jadi video mp4, terus ketik ${prefix}${command}`));
  }

  await m.reply(processing());
  const buffer = await source.download();

  if (!fs.existsSync("./tmp")) fs.mkdirSync("./tmp", { recursive: true });
  const workDir = `./tmp/tovid_${Date.now()}`;
  fs.mkdirSync(workDir);
  const input = `${workDir}/input.webp`;
  const output = `${workDir}/output.mp4`;
  const concatListPath = `${workDir}/list.txt`;
  fs.writeFileSync(input, buffer);

  const cleanup = () => { try { fs.rmSync(workDir, { recursive: true, force: true }); } catch {} };

  try {
    const { img, isAnimated, frameCount } = await loadWebpImage(input);
    console.log(`[TOVID DEBUG] frameCount: ${frameCount}, isAnimated: ${isAnimated}`);

    if (!isAnimated) {
      cleanup();
      return m.reply(fail("Stiker ini gambar diam (bukan animasi/video), jadi gak bisa diubah jadi video. Coba .toimg buat ubah jadi gambar biasa."));
    }

    // FIX BUG: node-webpmux v3.x ganti signature .demux() dari dua argumen
    // terpisah (path, settings) jadi SATU objek gabungan { path, ...settings }.
    // Versi yang terinstall di proyek ini persis 3.2.1 (declare "^3.1.0" di
    // package.json), jadi signature lama di bawah ini gak valid lagi — inilah
    // kemungkinan besar penyebab missingFrames selalu kedeteksi di bawah.
    await img.demux({ path: workDir, prefix: "frame" });

    const dirContents = fs.readdirSync(workDir);
    console.log(`[TOVID DEBUG] isi folder kerja setelah demux():`, dirContents);

    const missingFrames = [];
    for (let i = 0; i < img.frames.length; i++) {
      if (!fs.existsSync(`${workDir}/frame_${i}.webp`)) missingFrames.push(i);
    }
    if (missingFrames.length > 0) {
      console.error(`[TOVID GAGAL] frame gak kebentuk: ${missingFrames.join(", ")} dari total ${img.frames.length}. Isi folder: ${dirContents.join(", ") || "(kosong)"}`);
      cleanup();
      return m.reply(fail("Gagal mengubah stiker jadi video — proses pembongkaran frame gak menghasilkan file yang diharapkan. Detail sudah tercatat di log server."));
    }

    const lines = [];
    img.frames.forEach((frame, i) => {
      const delayMs = frame.delay || 100;
      const durationSec = Math.max(delayMs, 20) / 1000;
      lines.push(`file 'frame_${i}.webp'`);
      lines.push(`duration ${durationSec}`);
    });
    lines.push(`file 'frame_${img.frames.length - 1}.webp'`);
    fs.writeFileSync(concatListPath, lines.join("\n"));

    const cmd = `ffmpeg -y -hide_banner -loglevel error -f concat -safe 0 -i list.txt -vsync vfr -pix_fmt yuv420p -c:v libx264 -preset veryfast -crf 23 -vf "scale=trunc(iw/2)*2:trunc(ih/2)*2" -movflags +faststart output.mp4`;
    await execAsync(cmd, { cwd: workDir, maxBuffer: 1024 * 1024 * 50 });

    await sock.sendMessage(m.chat, { video: fs.readFileSync(output), mimetype: "video/mp4" }, { quoted: m });
  } catch (err) {
    console.error("[TOVID GAGAL]", err?.stderr || err?.message || err);
    return m.reply(fail("Gagal mengubah stiker jadi video. Error lengkap sudah tercatat di log server."));
  } finally {
    cleanup();
  }
};

handler.command = ["tovid"];
handler.help = ["tovid"];
handler.tags = ["converter"];

module.exports = handler;
