// plugins/main/afk.js — Fitur AFK
//
// Alur:
// - "<prefix>afk [alasan]" -> nandain pengirim lagi AFK. Alasan opsional;
//   kalau dikosongin, yang KETAMPIL pas ada orang nge-tag dia = "Tanpa
//   Alasan" (literal, bukan random).
// - Ada yang nge-tag (mention) orang yang lagi AFK -> bot negur PENGE-TAG
//   duluan (di-mention), bilang jangan nge-tag dulu + alasan AFK-nya.
// - Orang yang AFK ngirim pesan APAPUN (command atau bukan) -> otomatis
//   dianggep udah balik, AFK dimatiin, bot ngumumin "berhenti AFK" + berapa
//   lama dia AFK. Alasan yang ditampilin di pesan INI beda dikit: kalau pas
//   .afk tadi dikasih alasan (misal "nyuci piring"), alasan itu yang
//   ditampilin lagi. Tapi kalau tadi DIKOSONGIN, di sini BUKAN "Tanpa
//   Alasan" lagi, melainkan alasan random lucu-lucuan (minimal 10 variasi).
const { ok } = require("../../lib/theme");

const RANDOM_ALASAN = [
  "Gak tau, mungkin lagi berak",
  "Ketiduran gak sengaja",
  "Lagi mandi kayaknya",
  "Kepeleset di kamar mandi",
  "Lupa naro HP di mana",
  "Baterai HP abis pas lagi asik ngobrol",
  "Lagi ngasih makan kucing tetangga",
  "Kesambet, sinyal ilang",
  "Lagi ngintilin distraksi random di YouTube",
  "Gak jelas juga sih, pokoknya ngilang aja",
  "Mungkin lagi rebutan remot sama adek",
  "Sok sibuk padahal rebahan doang",
];

function randomAlasan() {
  return RANDOM_ALASAN[Math.floor(Math.random() * RANDOM_ALASAN.length)];
}

function formatDurasi(ms) {
  const detik = Math.floor(ms / 1000);
  const menit = Math.floor(detik / 60);
  const jam = Math.floor(menit / 60);
  const hari = Math.floor(jam / 24);
  if (hari > 0) return `${hari} hari ${jam % 24} jam`;
  if (jam > 0) return `${jam} jam ${menit % 60} menit`;
  if (menit > 0) return `${menit} menit ${detik % 60} detik`;
  return `${detik} detik`;
}

let handler = async (m, { text }) => {
  const reason = (text || "").trim(); // "" kalau dikosongin, ditangani beda pas ditampilin (lihat catatan di atas)

  if (!global.db.users[m.sender]) global.db.users[m.sender] = { id: m.sender };
  global.db.users[m.sender].afk = true;
  global.db.users[m.sender].afkReason = reason;
  global.db.users[m.sender].afkAt = Date.now();

  return m.reply(ok(`Kamu sekarang AFK.\n\n📝 Alasan: ${reason || "Tanpa Alasan"}`));
};

handler.before = async (m, { sock }) => {
  if (m.fromMe || !m.sender) return;

  // 1) Pengirim pesan INI lagi AFK -> otomatis dimatiin + diumumin balik.
  const senderData = global.db.users?.[m.sender];
  if (senderData?.afk) {
    const afkAt = senderData.afkAt || Date.now();
    const reasonGiven = senderData.afkReason;
    const durasi = formatDurasi(Date.now() - afkAt);

    senderData.afk = false;
    delete senderData.afkReason;
    delete senderData.afkAt;

    const alasanTampil = reasonGiven ? reasonGiven : randomAlasan();

    await sock
      .sendMessage(
        m.chat,
        {
          text: `👋 @${m.sender.split("@")[0]} telah berhenti AFK.\n\n📝 Alasan: ${alasanTampil}\n⏱️ Selama: ${durasi}`,
          mentions: [m.sender],
        },
        { quoted: m }
      )
      .catch(() => {});
    // Sengaja gak `return true` di sini — biar pesan ini tetep lanjut diproses
    // normal (command dispatch/before-hook lain), gak ke-block cuma gara2
    // trigger notif AFK.
  }

  // 2) Pesan ini nge-tag (mention) orang yang lagi AFK -> tegor si penge-tag.
  if (m.mentionedJid && m.mentionedJid.length) {
    for (const jid of m.mentionedJid) {
      if (jid === m.sender) continue;
      const target = global.db.users?.[jid];
      if (!target?.afk) continue;

      const reason = target.afkReason || "Tanpa Alasan";
      await sock
        .sendMessage(
          m.chat,
          {
            text: `⚠️ @${m.sender.split("@")[0]}, jangan nge-tag @${jid.split("@")[0]} dulu ya — dia lagi AFK.\n\n📝 Alasan: ${reason}`,
            mentions: [m.sender, jid],
          },
          { quoted: m }
        )
        .catch(() => {});
    }
  }
};

handler.command = ["afk"];
handler.tags = "main";
handler.help = ["afk <alasan> (kosongin alasan kalau males mikir)"];

module.exports = handler;
