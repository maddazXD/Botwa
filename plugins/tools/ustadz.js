// plugins/tools/ustadz.js — Template meme teks-di-atas-gambar ("Soalan"),
// pakai gambar base LOKAL (bukan nyari/nge-scrape foto orang tertentu dari
// internet). Endpoint /maker/ustadz dari Nexray udah gak ada (404, dicek
// langsung ke API-nya juga), jadi command ini dibikin sendiri: teksnya
// dirender pakai ffmpeg (pola sama kayak lib/memeText.js yang dipakai
// plugins/sticker/smeme.js), gambarnya HARUS kamu taruh sendiri di path
// di bawah ini.
//
// Dulu command ini ada di plugins/sticker/ (output-nya stiker), sekarang
// dipindah ke plugins/tools/ dan output-nya GAMBAR biasa. Karena gak perlu
// muat ke kanvas sticker 512x512, gambarnya dipakai apa adanya di resolusi
// asli — hasilnya jadi lebih tajam dan gak ada crop/letterbox sama sekali.
//
// CARA PASANG GAMBARNYA:
//   1. Siapin file gambar yang mau dipakai (JPG/PNG).
//   2. Taruh/upload ke:  assets/ustadz.jpg
//      (folder "assets" bikin sendiri kalau belum ada, sejajar sama folder "plugins")
//   3. Command langsung bisa dipakai, gak perlu restart (ffmpeg baca file
//      itu tiap kali command dijalanin, bukan di-cache).
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");
const { promisify } = require("util");
const execAsync = promisify(exec);
const { getMemeFont, fitMemeText } = require("../../lib/memeText");
const { usage, fail } = require("../../lib/theme");

const BASE_IMAGE = path.join(__dirname, "../../assets/ustadz.jpg");

let handler = async (m, { sock, text }) => {
  if (!fs.existsSync(BASE_IMAGE)) {
    return m.reply(
      fail(
        `Gambar base belum ada.\n\nTaruh dulu file gambarnya di:\n${path.relative(process.cwd(), BASE_IMAGE)}\n\n(bikin folder "assets" di root project kalau belum ada, terus upload gambarnya ke situ dengan nama persis "ustadz.jpg")`
      )
    );
  }
  if (!text) return m.reply(usage(`${m.cmd} <teks>`, `${m.cmd} Ngopi dulu gaes`));

  if (!fs.existsSync("./tmp")) fs.mkdirSync("./tmp", { recursive: true });
  const workDir = `./tmp/ustadz_${Date.now()}`;
  fs.mkdirSync(workDir);
  const output = `${workDir}/output.jpg`;
  const textFile = `${workDir}/text.txt`;

  const cleanup = () => { try { fs.rmSync(workDir, { recursive: true, force: true }); } catch {} };

  try {
    const fontFile = getMemeFont();

    // Gambar base (assets/ustadz.jpg) itu template "Soalan" — udah ada kotak
    // hitam judul + kotak putih kosong di bagian atas foto. Teksnya harus
    // ditaruh DI DALAM kotak putih itu.
    //
    // Posisi kotak putih diukur manual dari gambar template aslinya
    // (720x1238): x 81-639, y 243-463. Disimpen dalam bentuk pecahan
    // (fraksi dari lebar/tinggi gambar) biar otomatis nyesuain kalau
    // gambar base-nya diganti foto lain dengan resolusi beda (asal
    // template kotaknya sama, posisinya proporsional).
    const FX0 = 81 / 720, FX1 = 639 / 720;
    const FY0 = 243 / 1238, FY1 = 463 / 1238;

    const { stdout: probeOut } = await execAsync(
      `ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0 "${BASE_IMAGE}"`
    );
    const [imgW, imgH] = probeOut.trim().split(",").map(Number);

    const boxX0 = FX0 * imgW;
    const boxX1 = FX1 * imgW;
    const boxY0 = Math.round(FY0 * imgH);
    const boxY1 = FY1 * imgH;
    const boxW = boxX1 - boxX0;
    const boxH = boxY1 - boxY0 - Math.round(imgH * 0.005); // sisain sedikit padding bawah

    // Font di-kecilin otomatis kalau teksnya kepanjangan biar tetep muat di
    // dalam kotak putih (gak numpuk ke foto ustadz-nya). Titik awal font
    // ikut skala lebar gambar biar proporsional kalau base image diganti.
    // fitMemeText BENERAN ngukur hasil render-nya (bukan nebak pake rumus),
    // jadi dijamin gak keluar kotak walau teksnya panjang tanpa spasi sekalipun.
    const startSize = Math.round(imgW * 0.056); // ~40px di gambar 720px lebar
    const minSize = Math.round(imgW * 0.014);
    const marginX = Math.round(imgW * 0.03);
    const { fontSize, lines } = await fitMemeText(
      execAsync,
      fontFile,
      text.toUpperCase(),
      boxW - marginX,
      boxH,
      { startSize, minSize, step: 2, lineSpacing: 6 }
    );
    fs.writeFileSync(textFile, lines.join("\n"));

    const filter = `drawtext=${fontFile ? `fontfile='${fontFile}':` : ""}textfile='${textFile}':fontcolor=black:fontsize=${fontSize}:x=(w-text_w)/2:y=${boxY0}+(${boxH}-text_h)/2:line_spacing=6`;

    await execAsync(
      `ffmpeg -y -hide_banner -loglevel error -i "${BASE_IMAGE}" -vf "${filter}" -q:v 2 "${output}"`,
      { maxBuffer: 1024 * 1024 * 50 }
    );

    await sock.sendMessage(m.chat, { image: fs.readFileSync(output) }, { quoted: m });
  } catch (err) {
    console.error("[USTADZ GAGAL]", err?.stderr || err?.message || err);
    m.reply(fail("Gagal membuat gambar ustadz: " + (err?.message || "error tidak diketahui")));
  } finally {
    cleanup();
  }
};

handler.help = "ustadz <teks>";
handler.command = ["ustadz"];
handler.tags = "tools";

module.exports = handler;
