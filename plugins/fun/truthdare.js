// plugins/fun/truthdare.js — Truth or Dare random
const axios = require("axios");

let handler = async (m, { command }) => {
  const url = command === "dare"
    ? "https://raw.githubusercontent.com/BochilTeam/database/master/kata-kata/dare.json"
    : "https://raw.githubusercontent.com/BochilTeam/database/master/kata-kata/truth.json";

  try {
    const { data } = await axios.get(url);
    const pick = data[Math.floor(Math.random() * data.length)];
    m.reply(pick);
  } catch (e) {
    m.reply("❌ Gagal mengambil pertanyaan.");
  }
};

handler.command = ["dare", "truth"];
handler.tags = ["fun"];
handler.help = ["dare", "truth"];

module.exports = handler;
