// plugins/converter/tomp3.js
const fs = require("fs");
const { exec } = require("child_process");
const { promisify } = require("util");
const execAsync = promisify(exec);
const { getMediaSource } = require("../../lib/mediaHelper");
const { usage, processing, fail } = require("../../lib/theme");

let handler = async (m, { sock, prefix, command }) => {
  const source = getMediaSource(m);
  if (!source || source.mtype !== "videoMessage") {
    return m.reply(usage(`Reply video yang mau diconvert ke audio, terus ketik ${prefix}${command}`));
  }

  await m.reply(processing());
  const buffer = await source.download();

  if (!fs.existsSync("./tmp")) fs.mkdirSync("./tmp", { recursive: true });
  const input = `./tmp/tomp3_${Date.now()}.mp4`;
  const output = `./tmp/tomp3_${Date.now()}.mp3`;
  fs.writeFileSync(input, buffer);

  try {
    await execAsync(`ffmpeg -y -hide_banner -loglevel error -i "${input}" -vn -acodec libmp3lame -q:a 2 "${output}"`, { maxBuffer: 1024 * 1024 * 50 });
    await sock.sendMessage(m.chat, { audio: fs.readFileSync(output), mimetype: "audio/mpeg" }, { quoted: m });
  } catch (err) {
    console.error("[TOMP3 GAGAL]", err?.stderr || err?.message || err);
    return m.reply(fail("Gagal mengconvert video ke audio."));
  } finally {
    try { fs.unlinkSync(input); } catch {}
    try { fs.unlinkSync(output); } catch {}
  }
};

handler.command = ["tomp3"];
handler.help = ["tomp3"];
handler.tags = ["converter"];

module.exports = handler;
