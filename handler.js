// handler.js — MaddazXD V2
const fs = require("fs");
const util = require("util");
const chalk = require("chalk");
const { findClosestCommand } = require("./lib/didYouMean");
const { sendInteractiveCard } = require("./lib/interactiveMessage");
const { quickReplyButtons } = require("./lib/theme");

module.exports = async (sock, m) => {
  try {
    let plugins = global.plugins;
    await global.loadDatabase(sock, m);

    const prefix = m.prefix;
    const isCmd = m?.body?.startsWith(prefix);
    const args = isCmd ? m.body.trim().split(/ +/).slice(1) : [];
    const text = args.join(" ");
    const q = text;
    const command = isCmd
      ? m.body.slice(prefix.length).trim().split(" ").shift().toLowerCase()
      : "";
    const cmd = prefix + command;
    const quoted = m.quoted ? m.quoted : m;
    const mime = quoted?.msg?.mimetype || quoted?.mimetype || null;
    const qmsg = m.quoted || m;
    const botNumber = m.botNumber;
    const isOwner = m.isOwner;

    m.cmd = cmd;
    m.mime = mime;
    m.qmsg = qmsg;
    m.args = args;
    // FIX BUG BESAR: dulu ada `m.text = text;` di sini, nimpa m.text yang
    // udah BENER di-set = m.body (teks mentah LENGKAP pesan) di
    // lib/serialize.js. `text` di atas cuma ARGS command doang (args.join(" "))
    // — buat command jadinya cuma isi argumennya tanpa prefix/nama command,
    // dan buat pesan BIASA (bukan command) selalu jadi STRING KOSONG.
    // Ini diam-diam ngerusak SEMUA plugin yang ngandelin m.text buat baca
    // teks pesan biasa: antilink/antitoxic/antivirtex (moderasi grup gak
    // pernah kedeteksi), sleepmode (notif "bot lagi tidur" gak pernah keluar),
    // stickerpack (balas angka buat pilih pack gak pernah kepilih), autoai
    // (auto-reply AI gak pernah jawab pesan biasa). m.text sekarang DIBIARIN
    // apa adanya dari serialize.js (teks mentah lengkap) — plugin command
    // yang butuh cuma argumennya tetep pakai context `text`/`args` yang
    // di-pass ke plugin(m, {...}) di bawah, itu gak kepengaruh sama sekali.
    m.isGroup = m.chat.endsWith("g.us");
    m.metadata = {};
    m.isAdmin = false;
    m.isBotAdmin = false;
    m.example = (teks, cmds = cmd) => m.reply(`*Contoh:*\n${cmds} ${teks}`);

    // ── Catat aktivitas terakhir user (buat fitur .sider di grup) ─────
    if (!global.db.users[m.sender]) global.db.users[m.sender] = {};
    global.db.users[m.sender].lastseen = Date.now();

    // ── Cek grup yang di-mute (.bangc) ─────
    // Bot diem TOTAL di grup ini (gak proses command/before-hook apapun) kecuali buat
    // command .bangc/.unbangc/.listbangc sendiri, biar owner tetap bisa buka mute-nya lagi.
    if (m.isGroup && global.db?.groups?.[m.chat]?.mute) {
      const bangcCommands = ["bangc", "unbangc", "listbangc"];
      if (!isCmd || !bangcCommands.includes(command)) return;
    }

    // ── Cek mode pconly/gconly ─────────────
    // Owner selalu dikecualikan biar tetap bisa akses bot dari mode manapun.
    // Dicek dari global.X ATAU db.settings.X (sama polanya kayak antiCall di
    // index.js) — biar settingnya kebaca langsung dari database, gak
    // ngandelin restore-sekali-pas-boot yang gampang gak sinkron.
    if (!isOwner) {
      if ((global.pconly || global.db?.settings?.pconly) && m.isGroup) return;
      if ((global.gconly || global.db?.settings?.gconly) && !m.isGroup) return;
    }

    // ── React helper ─────────────────────
    m.react = async (emoji) => {
      await sock.sendMessage(m.chat, {
        react: { text: emoji, key: m.key },
      }).catch(() => {});
    };

    // ── Cek banned ────────────────────────
    // FIX BUG: dulu gak ada pengecualian buat owner sama sekali. Kalau
    // owner ke-ban (salah target pas .ban, atau di-ban owner lain di bot
    // multi-owner), mereka permanen kekunci dari bot-nya SENDIRI — command
    // ".unbanuser" pun gak akan pernah kepanggil soalnya udah keblokir di
    // sini duluan, gak ada jalan pemulihan lewat bot sama sekali (cuma bisa
    // edit database.json manual). Sekarang owner selalu dikecualikan.
    const settings = global.db?.settings || {};
    const senderClean = (m.sender || "").split("@")[0];

    m.isBanned = !isOwner && (settings.banned || []).some(
      (b) => (b || "").split("@")[0] === senderClean
    );

    if (m.isBanned) {
      await m.react("🚫");
      return m.reply("🚫 Kamu dibanned dari bot ini.");
    }

    // (Mode bot public/self udah difilter di index.js sebelum handler.js dipanggil,
    // jadi gak perlu dicek ulang di sini)

    // ── Group metadata ───────────────────
    if (m.isGroup) {
      let meta = global.groupMetadataCache.get(m.chat);
      if (!meta) meta = await sock.groupMetadata(m.chat).catch(() => {});
      m.metadata = meta;
      const p = meta?.participants || [];
      // FIX PENTING: WhatsApp versi baru ngasih participant.id dalam format
      // LID (misal "123456789@lid"), BUKAN nomor telepon (@s.whatsapp.net)
      // lagi — sedangkan m.sender di bot ini masih format nomor telepon
      // (toLid di index.js masih placeholder identity, belum konversi
      // beneran). Perbandingan yang cuma ngecek i.id/i.jid jadi SELALU GAGAL
      // buat akun yang WA-nya udah pakai LID, walau orangnya beneran admin.
      // Sekarang dicek juga i.phoneNumber & i.lid (field tambahan yang
      // disediain Baileys buat kasus kayak gini).
      // FIX: sekarang juga cek m.senderAlt (bentuk PN/LID alternatif yang WA
      // kirim langsung di key.participantAlt), bukan cuma m.sender — soalnya
      // toLid/toPn butuh lidMapping yang mungkin belum ke-cache pas grup ini
      // pertama kali diproses, sedangkan participantAlt selalu ada di pesan.
      const matchesJid = (i, jid) =>
        !!jid && (i.id === jid || i.jid === jid || i.phoneNumber === jid || i.lid === jid);
      const isSameParticipant = (i) =>
        matchesJid(i, m.sender) || matchesJid(i, m.senderAlt);
      // FIX BUG (sama kayak index.js security gate): `i.admin !== null` salah
      // kalau Baileys ngasih `undefined` (bukan `null`) buat non-admin —
      // undefined !== null tetap true, jadi non-admin ikut lolos. Dicek
      // eksplisit "admin"/"superadmin" biar aman dari dua kemungkinan itu.
      const isRealAdmin = (i) => i.admin === "admin" || i.admin === "superadmin";
      m.isAdmin = p.some((i) => isSameParticipant(i) && isRealAdmin(i));
      m.isBotAdmin = p.some(
        (i) => matchesJid(i, botNumber) && isRealAdmin(i)
      );
    }

    // ── Before hooks ─────────────────────
    for (let name in plugins) {
      let plugin = plugins[name];
      if (typeof plugin?.before !== "function") continue;
      let stop = await plugin.before(m, {
        sock, isOwner,
        isAdmin: m.isAdmin,
        isBotAdmin: m.isBotAdmin,
        metadata: m.metadata,
      });
      if (stop) return;
    }

    // ── All hooks ────────────────────────
    for (let name in plugins) {
      let plugin = plugins[name];
      if (typeof plugin?.all !== "function") continue;
      await plugin.all(m, {
        sock, isOwner,
        isAdmin: m.isAdmin,
        isBotAdmin: m.isBotAdmin,
        metadata: m.metadata,
      });
    }

    if (!isCmd) return;

    console.log(
      chalk.black.bgMagenta("\n 〄 𝙼𝚊𝚍𝚍𝚊𝚣𝚇𝙳 \n"),
      chalk.magenta(`From : ${m?.pushName || m.sender}\n`),
      chalk.magenta(`CMD  : ${cmd}`)
    );

    // ── Auto typing ──────────────────────
    if (global.autoTyping || global.db?.settings?.autoTyping) {
      await sock.sendPresenceUpdate("composing", m.chat).catch(() => {});
    }

    // ── Plugin executor ──────────────────
    let matched = false; // buat fitur "did you mean" — dicek setelah loop ini
    for (let name in plugins) {
      let plugin = plugins[name];
      if (!plugin?.command) continue;
      const cmds = Array.isArray(plugin.command) ? plugin.command : [plugin.command];
      if (!cmds.includes(command)) continue;
      matched = true;

      // ── Rate limiting sederhana (anti-spam) ──
      // Dulu SAMA SEKALI gak ada pembatasan — command berat (encode video,
      // generate gambar AI, dst) bisa di-spam bebas siapapun, resiko DoS
      // server & ngabisin kuota API key yang notabene shared. Sekarang
      // dibatesin 1 command yang SAMA dari orang yang SAMA cuma boleh
      // sekali per 3 detik. Owner dikecualiin (buat testing/development).
      if (!isOwner) {
        if (!global.cmdCooldown) global.cmdCooldown = new Map();
        const cooldownKey = `${m.sender}:${command}`;
        const lastUsed = global.cmdCooldown.get(cooldownKey);
        const COOLDOWN_MS = 3000;
        if (lastUsed && Date.now() - lastUsed < COOLDOWN_MS) {
          return; // diem aja, gak perlu reply/react — biar gak berisik kalau kepencet dobel
        }
        global.cmdCooldown.set(cooldownKey, Date.now());
      }

      // ── React ⏱️ saat mulai proses ──────
      await m.react("⏳");

      // ── Permission checks ─────────────
      if (plugin.owner && !isOwner) {
        await m.react("❌");
        return m.reply("👑 *Owner Only!*\nFitur ini cuma bisa dipakai owner bot.");
      }
      if (plugin.group && !m.isGroup) {
        await m.react("❌");
        return m.reply("👥 *Grup Only!*\nFitur ini hanya bisa digunakan di grup.");
      }
      if (plugin.private && m.isGroup) {
        await m.react("❌");
        return m.reply("💬 *Private Only!*\nFitur ini hanya bisa di chat pribadi.");
      }
      // FIX BUG: owner bot harusnya SELALU lolos syarat "admin grup" — soalnya
      // owner itu pemegang kekuasaan tertinggi bot, gak masuk akal kalau
      // fitur admin-only malah nge-block owner sendiri cuma gara-gara nomornya
      // kebetulan belum di-jadiin admin WhatsApp di grup itu. Dulu di sini
      // cuma ngecek m.isAdmin doang, jadi owner pun ikut ke-block.
      if (plugin.admin && !m.isAdmin && !isOwner) {
        await m.react("❌");
        return m.reply("🛡️ *Admin Only!*\nKamu harus admin grup untuk menggunakan ini.");
      }
      if (plugin.botAdmin && !m.isBotAdmin) {
        await m.react("❌");
        return m.reply("🤖 *Bot Bukan Admin!*\nJadikan bot sebagai admin grup dulu.");
      }

      global.db.settings.totalhit = (global.db.settings.totalhit || 0) + 1;

      try {
        await plugin(m, {
          sock, args, text, q,
          quoted: m.quoted || m,
          mime, command, cmd, prefix,
          isOwner,
          isAdmin: m.isAdmin,
          isBotAdmin: m.isBotAdmin,
          metadata: m.metadata,
        });

        // ── React ✅ setelah selesai ────
        await m.react("✅");

      } catch (err) {
        console.error(chalk.red(`[Error] Plugin ${name}:`), err);
        // ── React ❌ kalau error ─────────
        await m.react("❌");
        // FIX: err.message mentah dulu dibales ke SIAPAPUN (bukan cuma
        // owner) buat command apapun yang error — riskan bocorin detail
        // internal (path server, dst) kalau suatu saat ada pesan error
        // yang gak sengaja nyelipin data sensitif. Sekarang detail error
        // cuma ditampilin ke owner; user biasa dapet pesan generik. Error
        // lengkapnya tetep ke-log ke console di atas buat debugging.
        //
        // UPGRADE TAMPILAN: dikasih tombol cepet "🔄 Coba Lagi" (tap ->
        // ngirim ulang persis command yang sama) & "📋 Menu" (tap -> buka
        // menu), biar gak perlu ngetik ulang manual. Kalau tombolnya gagal
        // kekirim (klien WA lama dll), otomatis fallback ke teks polos
        // biasa — sendInteractiveCard sendiri gak pernah throw.
        const bodyText = isOwner
          ? `☢️ *Error!*\n\nCommand \`${cmd}\` mengalami kendala.\n\n\`\`\`${err.message}\`\`\``
          : `☢️ *Error!*\n\nCommand \`${cmd}\` mengalami kendala.`;
        const sentInteractive = await sendInteractiveCard(sock, m, {
          bodyText,
          footer: "Coba lagi nanti kalau masih gagal.",
          buttons: quickReplyButtons([
            { label: "🔄 Coba Lagi", id: m.body },
            { label: "📋 Menu", id: `${prefix}menu` },
          ]),
        });
        if (!sentInteractive) m.reply(bodyText);
      }
    }

    // ── Fitur "did you mean" ──────────────
    // Fitur BUKAN command sendiri (gak bisa dipanggil manual) — jalan
    // otomatis pas command yang diketik user GAK ADA yang cocok sama sekali
    // (matched masih false). Nyari command terdaftar yang PALING MIRIP
    // (Levenshtein distance, lihat lib/didYouMean.js) terus nyaranin itu.
    // Kalau gak ada yang cukup mirip (typo-nya kejauhan), diem aja — gak
    // maksa nyaranin command yang gak nyambung.
    //
    // UPGRADE TAMPILAN: saran command-nya sekarang tombol beneran (tap ->
    // langsung ngirim & ngejalanin command yang disaranin), bukan cuma teks
    // yang mesti diketik ulang manual. Fallback ke teks biasa kalau
    // tombolnya gagal kekirim.
    if (!matched && command) {
      const suggestion = findClosestCommand(command, plugins);
      if (suggestion) {
        const suggestedCmd = `${prefix}${suggestion}`;
        const bodyText = `❓ Command \`${cmd}\` gak ada kak, mungkin yang kakak maksud itu \`${suggestedCmd}\`?`;
        const sentInteractive = await sendInteractiveCard(sock, m, {
          bodyText,
          buttons: quickReplyButtons([{ label: `▶️ Jalanin ${suggestedCmd}`, id: suggestedCmd }]),
        });
        if (!sentInteractive) await m.reply(bodyText);
      }
    }

    if (global.autoTyping || global.db?.settings?.autoTyping) {
      await sock.sendPresenceUpdate("paused", m.chat).catch(() => {});
    }

  } catch (err) {
    console.log(util.format(err));
  }
};

process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
});

let file = require.resolve(__filename);
fs.watchFile(file, () => {
  fs.unwatchFile(file);
  delete require.cache[file];
  require(file);
});
