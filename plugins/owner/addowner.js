const { usage, ok, fail, card } = require("../../lib/theme");

let handler = async (m, { sock, text, command }) => {
  let data = global.db.settings.owner || (global.db.settings.owner = []);

  let target = m.quoted?.sender
    ? m.quoted.sender
    : m.mentionedJid?.[0]
    ? m.mentionedJid[0]
    : text
    ? text.replace(/[^0-9]/g, "") + "@s.whatsapp.net"
    : null;

  if (target && /@s\.whatsapp\.net/.test(target)) {
    target = await sock.toLid(target);
  }

  switch (command) {
    case "addowner":
    case "addown": {
      if (!target) return m.reply(usage(`${m.cmd} @tag/6283xxx`));

      if (data.includes(target)) {
        return m.reply(fail("Nomor itu sudah menjadi owner!"));
      }

      data.push(target);
      return sock.sendMessage(m.chat, {
        text: ok(`@${target.split("@")[0]} berhasil ditambahkan sebagai owner`),
        mentions: [target],
      }, { quoted: m });
    }

    case "delowner":
    case "delown": {
      if (!target) return m.reply(usage(`${m.cmd} @tag/6283xxx`));

      if (!data.includes(target)) {
        return m.reply(fail("Nomor itu bukan owner!"));
      }

      global.db.settings.owner = data.filter((v) => v !== target);
      return sock.sendMessage(m.chat, {
        text: ok(`@${target.split("@")[0]} berhasil dihapus dari owner`),
        mentions: [target],
      }, { quoted: m });
    }

    case "listowner":
    case "listown": {
      if (data.length < 1) return m.reply(fail("Belum ada owner tambahan."));

      const lines = data.map((i) => `@${i.split("@")[0]}`);
      return sock.sendMessage(m.chat, {
        text: card("DAFTAR OWNER", lines, "👤"),
        mentions: data,
      }, { quoted: m });
    }
  }
};

handler.owner = true;
handler.tags = ["owner"];
handler.help = ["addowner", "delowner", "listowner"];
handler.command = ["addowner", "addown", "delowner", "delown", "listowner", "listown"];

module.exports = handler;
