require("./lib/myfunction.js");
require("./config.js");

const chalk = require("chalk");

// Auto-download font emoji (NotoColorEmoji) kalau belum ada di server —
// dibutuhkan oleh .smeme buat render emoji di teks meme.
// Dijalanin non-blocking biar gak nunda proses bot nyambung ke WA.
require("./lib/ensureEmojiFont").ensureEmojiFont(chalk).catch(() => {});
const Pino = require("pino");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const readline = require("readline");
const { imageToWebp, writeExifImg, videoToWebp, writeExifVid } = require("./lib/sticker.js");
const FileType = require("file-type");
const { loadPlugins, watchPlugins } = require("./lib/pluginLoader");
const serialize = require("./lib/serialize");
const { getBaileys } = require("./lib/baileysLoader");

global.plugins = loadPlugins();
const pluginFolder = path.join(__dirname, "./plugins");
watchPlugins(pluginFolder);
global.loadDatabase = require("./lib/configDatabase.js");
const DataBase = require("./lib/database");
const database = new DataBase();
global.groupMetadataCache = new Map();

async function InputNumber(promptText) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => { rl.question(promptText, (a) => { rl.close(); resolve(a); }); });
}


// ── Load DB ──────────────────────────────
;(async () => {
  const load = (await database.read()) || {};
  global.db = { users: load.users || {}, groups: load.groups || {}, chats: load.chats || {}, settings: load.settings || {} };
  // Prefix custom yang diset lewat .setprefix disimpen di db.settings.prefix —
  // kalau ada, dipakai gantiin default "/" dari config.js, jadi prefix-nya
  // tetep nyantol walau bot di-restart.
  if (global.db.settings.prefix) global.prefix = global.db.settings.prefix;
  // Mode self/public/adminonly yang diset lewat .self/.public/.adminonly
  // (plugins/owner/self.js) disimpen di db.settings.mode — kalau ada,
  // dipakai gantiin default dari config.js. Dibaca SETIAP startBot() jalan,
  // termasuk saat WA reconnect otomatis, jadi mode tidak pernah balik ke
  // default hardcode di config.js tanpa sengaja.
  if (global.db.settings.mode) global.mode = global.db.settings.mode;
  // ── Restore semua persistent bot-level settings dari database ─────────
  // SEBELUMNYA: cuma prefix & mode yang di-restore. Setting lain (autoTyping,
  // antiCall, pconly, gconly) hanya disimpen ke db.settings oleh plugin tapi
  // tidak pernah dibaca balik ke global var — akibatnya balik ke default di
  // config.js tiap restart. SEKARANG: semua di-restore satu kali di sini.
  // Pattern global.X || db.settings.X di handler/index tetap jalan sebagai
  // secondary fallback, tapi restore eksplisit ke global var ini lebih clean.
  const _s = global.db.settings;
  if (typeof _s.autoTyping  !== "undefined") global.autoTyping  = _s.autoTyping;
  if (typeof _s.antiCall    !== "undefined") global.antiCall    = _s.antiCall;
  if (typeof _s.blockIfCall !== "undefined") global.blockIfCall = _s.blockIfCall;
  if (typeof _s.pconly      !== "undefined") global.pconly      = _s.pconly;
  if (typeof _s.gconly      !== "undefined") global.gconly      = _s.gconly;
  // sleepMode SENGAJA tidak di-restore (lihat komentar di plugins/owner/sleepmode.js
  // — ini state sementara dengan timer, restart = bot dibangunin, itu wajar).
  await database.write(global.db);
  setInterval(() => database.write(global.db), 5000);

  // ── Sapuan berkala: buang session_id Andaraz (Auto AI / .vai) yang basi ──
  // Session per-chat udah dicek/dibuang otomatis pas chat itu aktif lagi
  // (lihat plugins/tools/autoai.js & vai.js), TAPI kalau suatu grup/chat
  // pribadi berhenti dipake sama sekali (gak pernah chat lagi), session
  // basinya bakal nyangkut terus di database selamanya karena gak pernah
  // ke-trigger buat dicek. Sapuan ini jalan tiap 1 jam, muter ke SEMUA chat
  // di db.chats dan buang session yang udah > 3 hari gak update — biar
  // database gak numpuk terus biarpun chat-nya diem.
  const ANDARAZ_SESSION_MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000; // 3 hari
  setInterval(() => {
    const now = Date.now();
    let cleaned = 0;
    for (const chatId in global.db.chats || {}) {
      const c = global.db.chats[chatId];
      if (c?.andarazSessionId && c?.andarazSessionAt && now - c.andarazSessionAt > ANDARAZ_SESSION_MAX_AGE_MS) {
        delete c.andarazSessionId;
        delete c.andarazSessionAt;
        cleaned++;
      }
    }
    if (cleaned > 0) console.log(`[AUTOAI] Bersihin ${cleaned} session Andaraz yang udah basi (>3 hari gak dipake).`);

    // Sekalian bersihin cmdCooldown (lihat handler.js — rate limiting
    // anti-spam) yang udah basi, biar Map-nya gak numpuk terus makin lama
    // makin banyak entry lama yang udah gak kepake (satu entry per
    // kombinasi pengirim+command yang PERNAH dipakai).
    if (global.cmdCooldown) {
      const COOLDOWN_STALE_MS = 60 * 60 * 1000; // 1 jam — jauh lebih lama dari cooldown-nya sendiri (3 detik)
      let cleanedCooldown = 0;
      for (const [key, ts] of global.cmdCooldown) {
        if (now - ts > COOLDOWN_STALE_MS) {
          global.cmdCooldown.delete(key);
          cleanedCooldown++;
        }
      }
      if (cleanedCooldown > 0) console.log(`[RATELIMIT] Bersihin ${cleanedCooldown} entry cooldown yang udah basi.`);
    }
  }, 60 * 60 * 1000); // tiap 1 jam
})();

async function startBot() {
  const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    jidDecode,
    generateWAMessage,
    generateWAMessageFromContent,
    downloadContentFromMessage,
    fetchLatestWaWebVersion
  } = await getBaileys();

  const { state, saveCreds } = await useMultiFileAuthState("./session");
  const { version } = await fetchLatestWaWebVersion()

  const sock = makeWASocket({
    logger: Pino({ level: "silent" }),
    auth: state,
    version,
    printQRInTerminal: false,
    cachedGroupMetadata: async (jid) => {
      if (!global.groupMetadataCache.has(jid)) {
        const m = await sock.groupMetadata(jid).catch(() => {});
        global.groupMetadataCache.set(jid, m); return m;
      }
      return global.groupMetadataCache.get(jid);
    },
  });

  if (!sock.authState.creds.registered) {
    let pn = global.pairingNumber || await InputNumber(chalk.blue("\nInput WhatsApp Number:\n"));
    pn = pn.replace(/[^0-9]/g, "");
    setTimeout(async () => {
      const code = await sock.requestPairingCode(pn, "MADDAZXD");
      console.log(chalk.blue("\n📩 Pairing Code:"), chalk.white(code));
    }, 3000);
  }

  // sock.public = true HANYA untuk mode "public".
  // Mode "self" dan "adminonly" keduanya false agar security gate di
  // messages.upsert bisa berjalan (gate membaca global.mode langsung,
  // sock.public ini hanya sebagai flag pendukung untuk kompatibilitas).
  const _botMode = global.mode || global.db?.settings?.mode || "public";
  sock.public = (_botMode === "public");

  // ── Tracking pesan yang dikirim BOT SENDIRI ──────────────
  // Dipakai buat gantiin heuristik "isBaileys" yang lama (nebak dari pola ID
  // pesan kayak "3EB0"/"BAE"/dst) — heuristik itu ternyata SALAH: pola ID
  // "3EB0" itu bukan cuma dipake pesan yang dikirim lewat Baileys, tapi juga
  // dipake pesan ASLI dari WhatsApp Web/app resmi. Efeknya, command yang
  // dikirim orang lewat WA Web ikut kefilter/diabaikan bot, padahal itu
  // command asli, bukan pesan bot sendiri.
  //
  // Sekarang caranya lebih akurat: setiap kali BOT ini manggil
  // sock.sendMessage (buat balesan/notifikasi apapun), ID pesan hasil
  // kirimannya dicatet di sini. Pas ada event pesan masuk (messages.upsert)
  // yang ID-nya cocok sama salah satu yang tercatat, BARU itu diabaikan
  // (karena itu emang "gema" dari pesan yang bot ini kirim sendiri, bukan
  // pesan asli dari orang lain) — lihat pengecekan di messages.upsert di
  // bawah. Set dibatasin ukurannya (buang yang paling lama) biar gak
  // numpuk terus makan memori kalau bot jalan lama.
  global.sentMessageIds = new Set();

  // ═══════════════════════════════════════════════════════════════════════
  // AUTO-DELETE: semua pesan BOT dihapus sendiri setelah AUTO_DELETE_MS
  // ═══════════════════════════════════════════════════════════════════════
  // "Hapus untuk diri sendiri" = bot menghapus PESAN MILIKNYA SENDIRI
  // (fromMe: true) — bukan pesan orang lain. Berlaku di grup DAN private
  // chat sekaligus. Concurrent-safe: setiap setTimeout independen, bot
  // yang ramai pun tetap benar karena tiap pesan punya timer sendiri.
  //
  // Coverage:
  //  ✅ sock.sendMessage  → m.reply(), teks, gambar, video, audio, stiker
  //  ✅ sock.relayMessage → interactive card (tombol), album, pesan relay
  //  ❌ groupStatusMessageV2 → story GC (swgcv2) SENGAJA dikecualikan
  //  ❌ react, delete, edit → dikecualikan (bukan konten chat biasa)
  // ═══════════════════════════════════════════════════════════════════════
  const AUTO_DELETE_MS = 5 * 60 * 1_000;          // 5 menit
  const _origSendMessage = sock.sendMessage.bind(sock);
  const _origRelayMsg    = sock.relayMessage.bind(sock);

  // ── Helper: jadwalkan hapus satu pesan bot ────────────────────────────
  // Pakai _origSendMessage (bukan wrapper) agar pesan "delete" ini TIDAK
  // ikut di-schedule lagi → tidak ada infinite loop.
  const scheduleAutoDelete = (jid, msgId) => {
    if (!jid || !msgId) return;
    setTimeout(async () => {
      try {
        await _origSendMessage(jid, {
          delete: { remoteJid: jid, fromMe: true, id: msgId },
        });
      } catch {
        // Abaikan error: pesan sudah dihapus manual, sudah terlalu lama,
        // atau jaringan sedang down. WA batas revoke ~60 jam — lebih dari
        // cukup untuk timer 60 detik ini.
      }
    }, AUTO_DELETE_MS);
  };

  // ── Helper: generate message ID format Baileys ────────────────────────
  // Format WA: prefix "3EB0" + 16 byte hex uppercase = 36 karakter total.
  // Sama persis dengan Baileys generateMessageID() — tidak perlu import
  // dari sana karena bisa dibuat dengan crypto bawaan Node.js.
  const _crypto = require("crypto");
  const _genMsgId = () => "3EB0" + _crypto.randomBytes(16).toString("hex").toUpperCase();

  // ── Wrap sock.sendMessage ─────────────────────────────────────────────
  sock.sendMessage = async (...sendArgs) => {
    const result = await _origSendMessage(...sendArgs);
    try {
      const id      = result?.key?.id;
      const jid     = sendArgs[0];
      const content = sendArgs[1];

      if (id) {
        // Echo-detection tracking (tidak berubah dari sebelumnya)
        global.sentMessageIds.add(id);
        if (global.sentMessageIds.size > 1000) {
          global.sentMessageIds.delete(global.sentMessageIds.values().next().value);
        }

        // Jadwalkan auto-delete, kecuali untuk tipe aksi non-konten:
        //  "delete" → loop tak terbatas kalau dijadwalkan lagi
        //  "react"  → reaction punya mekanisme hapus sendiri (send react kosong)
        //  "edit"   → bukan pesan baru, hanya patch isi
        if (content && typeof content === "object") {
          const skip = "delete" in content || "react" in content || "edit" in content;
          if (!skip) scheduleAutoDelete(jid, id);
        } else {
          scheduleAutoDelete(jid, id);
        }
      }
    } catch {}
    return result;
  };

  // ── Wrap sock.relayMessage ────────────────────────────────────────────
  // sendInteractiveCard dan album bypass sendMessage dan langsung panggil
  // relayMessage. Kalau messageId tidak ada di opts, kita generate sendiri
  // SEBELUM relay biar WA pakai ID yang sama dan kita bisa track untuk delete.
  sock.relayMessage = async (jid, message, opts = {}) => {
    if (!opts.messageId) {
      opts = { ...opts, messageId: _genMsgId() };
    }
    const result = await _origRelayMsg(jid, message, opts);

    // Story GC (groupStatusMessageV2, dari plugin swgcv2.js) dikecualikan —
    // itu dikirim KE grup sebagai story bukan sebagai pesan chat biasa.
    const isGroupStatus =
      message && typeof message === "object" && "groupStatusMessageV2" in message;

    if (!isGroupStatus) {
      scheduleAutoDelete(jid, opts.messageId);
    }
    return result;
  };

  // FIX: sebelumnya toLid/toPn cuma fungsi identitas (return apa adanya),
  // gak beneran convert nomor telepon (@s.whatsapp.net) <-> LID (@lid).
  // Ini bikin m.sender / m.chat / ownerNum kadang beda format sama
  // participant.id di metadata grup (yang sekarang WA kasih dalam format
  // LID), jadi perbandingan admin/owner gagal walau datanya sama-sama
  // merujuk ke orang yang sama. Sekarang beneran convert pakai
  // signalRepository.lidMapping bawaan Baileys.
  sock.toLid = async (i) => {
    if (!i) return i;
    if (/@lid$/.test(i)) return i;
    try {
      const lid = await sock.signalRepository?.lidMapping?.getLIDForPN(i);
      return lid || i;
    } catch { return i; }
  };
  sock.toPn = async (i) => {
    if (!i) return i;
    if (/@s\.whatsapp\.net$/.test(i)) return i;
    try {
      const pn = await sock.signalRepository?.lidMapping?.getPNForLID(i);
      return pn || i;
    } catch { return i; }
  };
  sock.ev.on("creds.update", await saveCreds);

  // ── Messages ─────────────────────────
  sock.ev.on("messages.upsert", async ({ messages }) => {
    let m = messages[0];
    if (!m.message) return;
    m = await serialize(sock, m);
    // ── Security Gate: Self / Admin Only / Public ────────────────────────
    // Dibaca LANGSUNG dari global.mode dan db.settings.mode setiap pesan
    // masuk — bukan dari sock.public saja — biar selalu sinkron bahkan
    // saat WA reconnect otomatis sebelum sock.public sempat di-update ulang.
    if (!m.isOwner) {
      const _mode = global.mode || global.db?.settings?.mode || "public";

      if (_mode === "self") {
        // ── SELF MODE ──────────────────────────────────────────────────
        // HANYA owner yang diizinkan. TIDAK ada bypass untuk siapapun,
        // termasuk admin grup. Ini perbaikan dari versi sebelumnya yang
        // masih membiarkan admin grup melewati mode self.
        return;
      }

      if (_mode === "adminonly") {
        // ── ADMIN ONLY MODE ────────────────────────────────────────────
        // Owner sudah lolos di cek !m.isOwner di atas.
        // Admin grup diizinkan bypass; member biasa dan non-admin di-block.
        // Status admin dihitung di sini (bukan menunggu handler.js) pakai
        // cache yang sama agar tidak ada double-fetch groupMetadata.
        let isAdminBypass = false;
        if (m.chat?.endsWith("g.us")) {
          let meta = global.groupMetadataCache.get(m.chat);
          if (!meta) meta = await sock.groupMetadata(m.chat).catch(() => {});
          const p = meta?.participants || [];
          // Fix sama kayak handler.js: participant.id WA versi baru bisa
          // format @lid, jadi cek juga phoneNumber/lid dan m.senderAlt.
          const matches = (i, jid) =>
            !!jid && (i.id === jid || i.jid === jid || i.phoneNumber === jid || i.lid === jid);
          isAdminBypass = p.some(
            (i) => (matches(i, m.sender) || matches(i, m.senderAlt)) && i.admin !== null
          );
        }
        if (!isAdminBypass) return;
      }

      // ── PUBLIC MODE ────────────────────────────────────────────────
      // Semua pengguna diizinkan — tidak ada filter, lanjut ke handler.
    }
    // FIX BUG: dulu di sini `if (m.isBaileys) return;` — nebak dari pola ID
    // pesan ("3EB0"/"BAE"/dst, lihat lib/serialize.js). Ternyata pola itu
    // JUGA dipake pesan ASLI dari WhatsApp Web/app resmi, bukan cuma pesan
    // yang bot ini kirim sendiri — akibatnya command yang dikirim orang
    // lewat WA Web ikut ke-skip/diabaikan bot sama sekali. Sekarang dicek
    // dari tracking sock.sendMessage di atas: cuma di-skip kalau ID-nya
    // BENERAN pernah dikirim sama bot ini sendiri (echo dari balesan bot),
    // bukan cuma nebak dari pola ID.
    if (m.key?.id && global.sentMessageIds?.has(m.key.id)) return;
    require("./handler")(sock, m);
  });

  // ── Anti Call ────────────────────────
  sock.ev.on("call", async (calls) => {
    for (const call of calls) {
      if (call.status !== "offer") continue;
      if (global.antiCall || global.db?.settings?.antiCall) {
        await sock.rejectCall(call.id, call.from).catch(() => {});
        await sock.sendMessage(call.from, { text: "🚫 JANGAN TELEPON NOMOR INI!" }).catch(() => {});
        if (global.blockIfCall) await sock.updateBlockStatus(call.from, "block").catch(() => {});
      }
    }
  });

  // ── Group Participant Update (Welcome/Goodbye) ─
  // FIX PERFORMA: sebelumnya download foto profil jalan SATU PER SATU di dalam
  // for...of loop — kalau ada 5 orang join sekaligus, download ke-5 nunggu ke-4
  // kelar duluan, dst. Sekarang pakai Promise.all: semua participant diproses
  // PARALEL, total waktu = waktu download yang PALING LAMA (bukan jumlah semua).
  // axios juga dipindah ke luar loop — require() tidak perlu dipanggil berulang.
  const _axios = require("axios");
  sock.ev.on("group-participants.update", async ({ id, participants, action, author }) => {
    try {
      const meta = await sock.groupMetadata(id);
      global.groupMetadataCache.set(id, meta);
      const cfg = global.db.groups?.[id] || {};
      const totalMember = meta.participants.length;

      // Proses semua participant secara paralel
      await Promise.all(participants.map(async (ptcp) => {
        let participant = ptcp?.phoneNumber || ptcp?.id || ptcp?.lid || ptcp || "";
        const userTag = `@${participant.split("@")[0]}`;
        let text = "", title = "";

        // Download foto profil secara paralel (bukan berurutan)
        let thumbBuf = null;
        try {
          const ppUrl = await sock.profilePictureUrl(participant, "image");
          const res = await _axios.get(ppUrl, { responseType: "arraybuffer", timeout: 5000 });
          thumbBuf = Buffer.from(res.data);
        } catch {
          // Fallback ke thumbnail global
          try {
            const res = await _axios.get(global.thumbnail, { responseType: "arraybuffer", timeout: 5000 });
            thumbBuf = Buffer.from(res.data);
          } catch {}
        }

        if (action === "add" && cfg.welcome) {
          text = `Haii ${userTag} 👋\nSelamat datang di *${meta.subject}*!\nTotal Member: *${totalMember}*`;
          title = "Welcome";
        } else if (action === "remove" && cfg.goodbye) {
          text = `Selamat tinggal ${userTag} 👋\nTotal Member: *${totalMember}*`;
          title = "Goodbye";
        } else if (action === "promote") {
          text = `@${(author||"").split("@")[0]} menjadikan ${userTag} sebagai Admin ✅`;
          title = "Promote";
        } else if (action === "demote") {
          text = `@${(author||"").split("@")[0]} menurunkan ${userTag} dari Admin ❌`;
          title = "Demote";
        }

        if (!text) return; // skip (bukan continue, karena ini di dalam .map callback)

        const externalAdReply = {
          title,
          renderLargerThumbnail: true,
          mediaType: 1,
        };
        if (thumbBuf) externalAdReply.thumbnail = thumbBuf;

        await sock.sendMessage(id, {
          text,
          contextInfo: {
            mentionedJid: [participant, author].filter(Boolean),
            externalAdReply,
          },
        });
      }));
    } catch {}
  });

  // ── Connection ────────────────────────
  sock.ev.on("connection.update", async ({ connection, lastDisconnect }) => {
    if (connection === "close") {
      if (lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut) {
        console.log(chalk.yellow("Reconnecting...")); startBot();
      } else {
        console.log(chalk.red("Logged Out"));
      }
    }
   if (connection === "open") {
      console.log(chalk.green(`\n✅ ${global.botname} Connected!\n`));

      // Auto-addowner: karena global.owner sengaja dikosongin (gak hardcode
      // lagi di config), bot nambahin nomornya sendiri ke daftar owner
      // (global.db.settings.owner) tiap connect kalau belum ada. Ini yang
      // dipakai m.isOwner buat nentuin siapa yang boleh akses command owner.
      try {
        let ownData = global.db.settings.owner || (global.db.settings.owner = []);
        let selfNum = sock.user.id.split(":")[0].split("@")[0] + "@s.whatsapp.net";
        let selfLid = /@s\.whatsapp\.net/.test(selfNum) ? await sock.toLid(selfNum) : selfNum;
        if (!ownData.includes(selfLid) && !ownData.includes(selfNum)) {
          ownData.push(selfLid);
          console.log(chalk.green(`✅ Nomor bot (${selfNum.split("@")[0]}) otomatis ditambahkan sebagai owner.`));
        }
      } catch (e) {
        console.log(chalk.red("Gagal auto-addowner:"), e.message);
      }
    }
  });

  // ── Helper methods ────────────────────
  sock.decodeJid = (jid) => {
    if (!jid) return jid;
    if (/:\d+@/gi.test(jid)) { const d = jidDecode(jid)||{}; return d.user && d.server ? `${d.user}@${d.server}` : jid; }
    return jid;
  };

  sock.downloadMediaMessage = async (m, type, filename = "") => {
    if (!m || !(m.url || m.directPath)) return Buffer.alloc(0);
    const stream = await downloadContentFromMessage(m, type);
    let buffer = Buffer.from([]);
    for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
    if (filename) await fs.promises.writeFile(filename, buffer);
    return filename && fs.existsSync(filename) ? filename : buffer;
  };

  sock.downloadAndSaveMediaMessage = async (message, filename, attachExtension = true) => {
    const quoted = message.msg ? message.msg : message;
    const mime = (message.msg || message).mimetype || "";
    const messageType = message.mtype ? message.mtype.replace(/Message/gi, "") : mime.split("/")[0];
    const fil = Date.now();
    const stream = await downloadContentFromMessage(quoted, messageType);
    let buffer = Buffer.from([]);
    for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
    // FIX BUG: FileType.fromBuffer() bisa balikin undefined kalau isi filenya gak dikenali
    // (misalnya media yang gak lazim/rusak) — sebelumnya langsung diakses `.ext`-nya tanpa
    // cek dulu, jadi crash (TypeError) kalau kejadian. Sekarang ada fallback ke ekstensi dari
    // mimetype asli pesannya, atau "bin" kalau itu juga gak ada.
    const type = await FileType.fromBuffer(buffer);
    const ext = type?.ext || mime.split("/")[1] || "bin";
    const trueFileName = attachExtension ? `./tmp/${fil}.${ext}` : filename;
    if (!fs.existsSync("./tmp")) fs.mkdirSync("./tmp", { recursive: true });
    // FIX PERFORMA: writeFileSync MEMBLOKIR event loop selama proses tulis —
    // semua pesan lain tidak bisa diproses sampai file kelar ditulis ke disk.
    // Diganti ke fs.promises.writeFile (async) agar event loop tetap jalan.
    await fs.promises.writeFile(trueFileName, buffer);
    return trueFileName;
  };

  sock.sendSticker = async (jid, p, quoted, options = {}) => {
    let buff = Buffer.isBuffer(p) ? p
      : /^https?:\/\//.test(p) ? await global.getBuffer(p)
      : fs.existsSync(p) ? fs.readFileSync(p) : Buffer.alloc(0);

    // FIX BUG: sebelumnya fungsi ini SELALU nganggep buffer-nya gambar diam (imageToWebp/
    // writeExifImg), gak peduli aslinya video/gif. Akibatnya .sticker dari video/gif hasilnya
    // rusak/gagal, karena buffer video di-encode pakai pipeline yang didesain buat JPEG.
    // Sekarang dicek dulu isi aslinya lewat FileType (bukan nebak dari nama file/mimetype
    // yang bisa aja salah), baru dipilih pipeline yang sesuai (videoToWebp vs imageToWebp).
    const detected = await FileType.fromBuffer(buff).catch(() => null);
    const isVideo = !!detected && /^video\//.test(detected.mime);

    const buffer = (options.packname || options.author)
      ? (isVideo ? await writeExifVid(buff, options) : await writeExifImg(buff, options))
      : (isVideo ? await videoToWebp(buff) : await imageToWebp(buff));
    const tmpPath = `./tmp/${crypto.randomBytes(6).readUIntLE(0,6).toString(36)}.webp`;
    if (!fs.existsSync("./tmp")) fs.mkdirSync("./tmp", { recursive: true });
    await fs.promises.writeFile(tmpPath, buffer);
    await sock.sendMessage(jid, { sticker: { url: tmpPath }, ...options }, { quoted });
    fs.unlink(tmpPath, () => {}); // async unlink, tidak perlu await
    return buffer;
  };

  sock.sendAlbum = async function(jid, content, quoted) {
    const array = content.albumMessage;
    const album = await generateWAMessageFromContent(jid, {
      messageContextInfo: { messageSecret: crypto.randomBytes(32) },
      albumMessage: { expectedImageCount: array.filter(a=>a.image).length, expectedVideoCount: array.filter(a=>a.video).length },
    }, { userJid: quoted.sender, quoted, upload: sock.waUploadToServer });
    await sock.relayMessage(jid, album.message, { messageId: album.key.id });
    for (let item of array) {
      const img = await generateWAMessage(jid, item, { upload: sock.waUploadToServer });
      img.message.messageContextInfo = {
        messageSecret: crypto.randomBytes(32),
        messageAssociation: { associationType: 1, parentMessageKey: album.key },
      };
      await sock.relayMessage(jid, img.message, { messageId: img.key.id });
    }
    return album;
  };

  return sock;
}

startBot();
process.on("uncaughtException", (err) => { console.error("Caught:", err); });
