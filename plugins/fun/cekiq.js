// plugins/fun/cekiq.js — Cek "IQ" random (lucu-lucuan)
// Versi Anya asli pakai `sharp` + fake link-preview buat efek visual mewah;
// di sini disederhanakan jadi reply teks biasa dengan mention, biar gak nambah
// dependency native baru.
function pickRandom(list) {
  return list[Math.floor(list.length * Math.random())];
}

const iqcek = [
  "IQ Level : 50\n\nOtak aplikasi kandang monyet 🐒",
  "IQ Level : 57\n\nOtak aplikasi kandang monyet 🐒",
  "IQ Level : 63\n\nOtak aplikasi kandang monyet 🐒",
  "IQ Level : 71\n\nOtak aplikasi kandang monyet 🐒",
  "IQ Level : 78\n\nOtak aplikasi kandang monyet 🐒",
  "IQ Level : 85\n\nOtak reza arap awokwok 😹",
  "IQ Level : 93\n\nOtak aplikasi kandang monyet 🐒",
  "IQ Level : 100\n\nOtak aplikasi kandang monyet 🐒",
  "IQ Level : 108\n\nStandar manusia bumi",
  "IQ Level : 119\n\nLumayan encer otaknya",
  "IQ Level : 127\n\nCerdas dan berwibawa",
  "IQ Level : 138\n\nIsi kepala bukan kaleng-kaleng",
  "IQ Level : 149\n\nOtak roket",
  "IQ Level : 162\n\nLevel ilmuwan",
  "IQ Level : 174\n\nCalon profesor",
  "IQ Level : 186\n\nDebat auto win",
  "IQ Level : 195\n\nGoogle aja nanya balik",
  "IQ Level : 200\n\nJenius tidak wajar",
];

let handler = async (m, { sock }) => {
  const user = m.sender;
  const hasil = pickRandom(iqcek);

  await sock.sendMessage(m.chat, {
    text: `*── 「 CEK IQ 」 ──*\n\n• *User:* @${user.split("@")[0]}\n• *Hasil:* ${hasil}`,
    mentions: [user],
  }, { quoted: m });
};

handler.command = ["cekiq"];
handler.tags = ["fun"];
handler.help = ["cekiq"];

module.exports = handler;
