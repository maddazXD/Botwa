// plugins/owner/eval.js — Jalanin kode JavaScript LANGSUNG dari chat, buat
// debug cepat (cek isi variable, tes potongan kode, dll) tanpa perlu buka
// editor/MT Manager dulu.
//
// ⚠️ PERINGATAN: fitur ini powerful & BERBAHAYA kalau bocor ke orang lain —
// siapapun yang bisa jalanin .eval otomatis bisa ngontrol PENUH bot ini
// (baca/hapus semua chat, akses session WA, dsb), sama kayak megang akses
// penuh ke servernya. Makanya di-gembok ketat cuma buat OWNER (dicek dari
// daftar owner di database, BUKAN dari command ini sendiri) — jangan pernah
// pindahin/copy fitur ini ke luar folder owner/ atau dibuka ke publik.
const util = require("util");
const { usage, fail } = require("../../lib/theme");

let handler = async (m, { text, sock }) => {
  if (!text) return m.reply(usage(`${m.cmd} <kode JS>`, `${m.cmd} m.chat`));

  try {
    // eslint-disable-next-line no-eval
    let result = await eval(`(async () => { ${text} })()`);
    if (typeof result !== "string") {
      result = util.inspect(result, { depth: 2 });
    }
    if (!result) result = "(kosong / undefined)";
    if (result.length > 4000) result = result.slice(0, 4000) + "\n... (dipotong, kepanjangan)";
    m.reply("```" + result + "```");
  } catch (err) {
    let out = err?.stack || err?.message || String(err);
    if (out.length > 4000) out = out.slice(0, 4000) + "\n... (dipotong)";
    m.reply(fail("Error:\n```" + out + "```"));
  }
};

handler.help = "eval <kode JS> — DEBUG, owner only, HATI-HATI dipakainya";
handler.command = ["eval", "ev"];
handler.tags = "owner";
handler.owner = true;

module.exports = handler;
