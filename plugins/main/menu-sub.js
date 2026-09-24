// plugins/main/menu-sub.js — List Menu Handler
const { bold: toMonoUpperBold, header, card, footer } = require("../../lib/theme");

const CAT_EMOJI = {
  owner:"👑", main:"🏠", download:"📥",
  sticker:"🖼️", info:"ℹ️", converter:"🔄", koleksi:"🎓",
  tools:"🛠️", upload:"📦", ai:"🧠", anime:"🎌", admin:"🛡️",
  // FIX BUG: kategori ini eksis dan udah ada plugin beneran yang pakai tag-nya
  // (plugins/fun/*.js pakai tags: ["fun"]; plugins/tools/kbbi.js, doa.js,
  // wikipedia.js pakai tags: ["internet"]) — TAPI sebelumnya gak ada di sini,
  // padahal menu.js (buat .menu, UI "Jump ke Kategori" yang nampilin "FUN" dan
  // "INTERNET" beneran ada isinya) udah lama nyantumin keduanya. Karena
  // ALL_CATS di bawah diambil dari Object.keys(CAT_EMOJI), command
  // ".cat_fun"/".cat_internet" GAK PERNAH KEDAFTAR sama sekali (bukan cuma
  // "kategori kosong", tapi command-nya sendiri gak exist) — makanya bot diem
  // aja gak respon apa-apa pas dicoba, bukan ngasih pesan "kategori gak
  // ditemukan". search & maker turut ditambahin biar konsisten sama menu.js,
  // meski saat ini belum ada plugin yang makein tag itu (gak masalah — kalau
  // kosong, kategorinya otomatis gak muncul di list, sama kayak sebelumnya).
  internet:"📌", search:"🔍", fun:"📌", maker:"🎨",
  // FIX SAMA PERSIS kayak fun/internet di atas: tag "game" dipakai plugins/game/*.js
  // (cangkulan) tapi belum kedaftar di sini, jadi ".cat_game" bakal ke-treat
  // sebagai command yang gak exist sama sekali kalau gak ditambahin.
  game:"🎮",
};

const CAT_ORDER = ["main","koleksi","owner","admin","download","sticker","converter","info","tools","internet","search","fun","maker","game","anime","upload","ai"];

// Sama kayak di menu.js — kategori "admin" isinya command yang cuma bisa
// dipakai admin grup, jadi disembunyiin dari non-admin (kecuali owner, yang selalu
// bisa lihat semua kategori).
const ADMIN_GATED_CATS = new Set(["admin"]);

function collectCategories(ownerMode = false, adminMode = false) {
  const toArr = v => !v ? [] : Array.isArray(v) ? v : [v];
  let cats = {};
  for (let file in global.plugins) {
    const plug = global.plugins[file];
    if (!plug) continue;
    const tags = toArr(plug.tags);
    const cmds = plug.help ? toArr(plug.help) : toArr(plug.command);
    // FIX BUG: sebelumnya kalau ada plugin TANPA handler.tags, fungsi ini langsung skip
    // (gak ditampilin sama sekali) — padahal menu.js (buat .menu) punya fallback yang
    // nebak kategori dari nama foldernya, jadi plugin itu tetap muncul di .menu. Akibatnya
    // .listmenu dan .menu bisa punya total command yang beda tanpa ketauan. Sekarang
    // fallback-nya disamain persis.
    if (!tags.length && cmds.length) {
      let defaultTag = "main";
      if (file.includes("owner")) defaultTag = "owner";
      else if (file.includes("group")) defaultTag = "admin";
      else if (file.includes("download")) defaultTag = "download";
      else if (file.includes("sticker")) defaultTag = "sticker";
      else if (file.includes("converter")) defaultTag = "converter";
      else if (file.includes("koleksi")) defaultTag = "koleksi";
      tags.push(defaultTag);
    }
    if (!tags.length || !cmds.length) continue;
    for (const rawTag of tags) {
      const key = String(rawTag).toLowerCase();
      if (key === "owner" && !ownerMode) continue;
      if (ADMIN_GATED_CATS.has(key) && !adminMode) continue;
      if (!cats[key]) cats[key] = new Set();
      cmds.forEach(c => { if (c) cats[key].add(c.toString().split(" ")[0]); });
    }
  }
  return cats;
}

function getSortedCats(cats) {
  return [
    ...CAT_ORDER.filter(k => cats[k]),
    ...Object.keys(cats).filter(k => !CAT_ORDER.includes(k)).sort(),
  ];
}

let handler = async (m, { sock, command, args }) => {
  // Sama kayak menu.js: owner selalu lihat semua, user biasa cuma lihat kategori
  // admin-gated ("admin"/"group") kalau dia beneran admin di chat ini.
  const adminMode = m.isOwner || m.isAdmin;
  const cats = collectCategories(m.isOwner, adminMode);
  const sorted = getSortedCats(cats);

  // ── .listmenu — tampilkan semua command per kategori ──
  if (command === "listmenu" || command === "allcmd") {
    let txt = header("SEMUA MENU", "📋") + "\n\n";

    for (const key of sorted) {
      const emoji = CAT_EMOJI[key] || "📁";
      const cmds = Array.from(cats[key]).sort();
      txt += card(toMonoUpperBold(key), cmds.map(c => `✦ ${global.prefix}${c}`), emoji);
      txt += `\n_${cmds.length} command_\n\n`;
    }

    txt += `🌐 ${global.linkChannel || "-"}\n👥 ${global.linkGrup || "-"}` + footer();

    return sock.sendMessage(m.chat, {
      text: txt,
      contextInfo: {
        isForwarded: true,
        forwardingScore: 9,
        forwardedNewsletterMessageInfo: {
          newsletterJid: global.idChannel || "",
          newsletterName: global.botname,
          serverMessageId: 127,
        },
      },
    }, { quoted: m.verifiedQuoted });
  }

  // ── .kategori — tampilkan list kategori interaktif ──
  if (command === "kategori") {
    const totalCmd = sorted.reduce((a, k) => a + cats[k].size, 0);
    const rows = sorted.map(key => {
      const emoji = CAT_EMOJI[key] || "📁";
      return {
        title: `${emoji} ${toMonoUpperBold(key)}`,
        description: `✦ ${cats[key].size} command tersedia`,
        id: `${global.prefix}cat_${key}`,
      };
    });

    const body =
      header("KATEGORI MENU", "📋") + "\n\n" +
      card("INFO", [
        `✦ Total Kategori : *${sorted.length}*`,
        `✦ Total Command  : *${totalCmd}*`,
        `✦ Prefix         : *${global.prefix}*`,
      ], "📊") + "\n\n" +
      sorted.map(key => {
        const emoji = CAT_EMOJI[key] || "📁";
        return `${emoji} *${toMonoUpperBold(key)}* — ${cats[key].size} cmd`;
      }).join("\n") +
      `\n\nPilih kategori dari tombol di bawah 👇`;

    try {
      await sock.relayMessage(m.chat, {
        viewOnceMessage: {
          message: {
            messageContextInfo: {},
            interactiveMessage: {
              header: { title: "📋 Kategori Menu", hasMediaAttachment: false },
              body: { text: body },
              footer: { text: `${global.botname} v${global.versibot}` },
              contextInfo: {
                isForwarded: true,
                forwardingScore: 9,
                participant: "081915483630@s.whatsapp.net",
                quotedMessage: { conversation: global.botname },
                mentionedJid: [m.sender],
                forwardedNewsletterMessageInfo: {
                  newsletterJid: global.idChannel || "",
                  newsletterName: global.botname,
                  serverMessageId: 127,
                },
              },
              nativeFlowMessage: {
                messageParamsJson: "",
                buttons: [
                  {
                    name: "single_select",
                    buttonParamsJson: JSON.stringify({
                      title: "📂 Pilih Kategori",
                      sections: [{ title: "Daftar Kategori", rows }],
                    }),
                  },
                  {
                    name: "quick_reply",
                    buttonParamsJson: JSON.stringify({
                      display_text: "📋 Lihat Semua Menu",
                      id: `${global.prefix}listmenu`,
                    }),
                  },
                ],
              },
            },
          },
        },
      }, {});
    } catch {
      // Fallback teks
      let txt = header("KATEGORI MENU", "📋") + "\n\n";
      sorted.forEach(key => {
        const emoji = CAT_EMOJI[key] || "📁";
        txt += `${emoji} *${toMonoUpperBold(key)}* — ${cats[key].size} cmd\n`;
        txt += `   › \`${global.prefix}cat_${key}\`\n`;
      });
      txt += footer();
      await sock.sendMessage(m.chat, { text: txt }, { quoted: m.verifiedQuoted });
    }
  }

  // ── .cat_xxx — tampilkan isi 1 kategori ──
  if (command.startsWith("cat_")) {
    const key = command.replace("cat_", "").toLowerCase();
    if (!cats[key]) return m.reply(`❌ Kategori *${key}* tidak ditemukan!`);

    const emoji = CAT_EMOJI[key] || "📁";
    const cmds = Array.from(cats[key]).sort();

    let txt =
      card(toMonoUpperBold(key), cmds.map(c => `▸ ${global.prefix}${c}`), emoji) +
      `\n_Total: ${cmds.length} command_` +
      footer();

    return sock.sendMessage(m.chat, {
      text: txt,
      contextInfo: {
        isForwarded: true,
        forwardingScore: 9,
        forwardedNewsletterMessageInfo: {
          newsletterJid: global.idChannel || "",
          newsletterName: global.botname,
          serverMessageId: 127,
        },
      },
    }, { quoted: m.verifiedQuoted });
  }
};

const ALL_CATS = Object.keys(CAT_EMOJI);
handler.command = [
  "listmenu", "allcmd", "kategori",
  ...ALL_CATS.map(k => `cat_${k}`),
];
handler.tags = ["main"];
handler.help = ["listmenu", "kategori"];
module.exports = handler;
