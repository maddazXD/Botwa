// plugins/game/cangkulan.js
//
// Game kartu multiplayer "Cangkulan" — diadaptasi dari plugin `cangkulan`
// bot XAYNC_MD. Lihat lib/gameCangkulan.js buat penjelasan aturan main &
// kenapa sesi disimpan di memori (bukan database.json).

const { Cangkulan } = require("../../lib/gameCangkulan");
const { sendInteractiveCard } = require("../../lib/interactiveMessage");
const { quickReplyButtons, usage, fail } = require("../../lib/theme");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const normalizeCard = (str) => String(str).replace(/\uFE0F|\s/g, "").trim().toLowerCase();

// Sesi aktif per-chat grup, disimpan di memori proses bot (lihat catatan
// di lib/gameCangkulan.js soal kenapa gak ditaruh di database.json).
const sessions = {};

async function sendCardPrompt(sock, m, playerId, headerText, sess) {
  const p = sess.players.find((x) => x.id === playerId);
  if (!p || !p.cards.length) return;
  const hasStart = Object.keys(sess.startCard).length > 0;

  const buttons = p.cards.map((c) => ({ label: `${c.rank}${c.suit}`, id: `${m.prefix}cangkulan play ${c.rank}${c.suit}` }));
  if (hasStart && !sess.hasMatching(playerId)) {
    buttons.push({ label: "🍺 Minum", id: `${m.prefix}cangkulan minum` });
  }

  const sent = await sendInteractiveCard(sock, m, {
    jid: playerId,
    bodyText: headerText,
    footer: `Kartumu (${p.cards.length}): ${p.cards.map((c) => c.rank + c.suit).join(", ")}`,
    buttons: quickReplyButtons(buttons),
  });
  if (!sent) {
    await m.reply(`${headerText}\n\nKartumu: ${p.cards.map((c) => c.rank + c.suit).join(", ")}`, { chat: playerId });
  }
}

async function endGame(sock, m, sess) {
  const loser = sess.players[0];
  const winnerList = sess.winner.length ? sess.winner.map((w, i) => `${i + 1}. @${w.id.split("@")[0]}`).join("\n") : "-";
  await m.reply(
    `🃏 *GAME CANGKULAN SELESAI!* 🃏\n\n` +
      `🏆 *Urutan Pemenang:*\n${winnerList}\n\n` +
      `💀 *Pecundang:* @${loser?.id.split("@")[0] ?? "?"}`
  );
  delete sessions[sess.id];
}

async function finalizeRound(sock, m, sess) {
  if (!sess.isRoundComplete()) return false;
  const resultMsg = sess.resolveRound();
  if (!resultMsg) return false;
  await m.reply(resultMsg);

  for (let i = sess.players.length - 1; i >= 0; i--) {
    const p = sess.players[i];
    if (p.cards.length === 0) {
      sess.winner.push({ id: p.id });
      sess.players.splice(i, 1);
      const rank = sess.winner.length;
      await m.reply(`🎉 @${p.id.split("@")[0]} mengeluarkan semua kartu! Posisi ke-${rank}! 🏆`);
    }
  }

  if (sess.players.length <= 1) {
    await endGame(sock, m, sess);
    return true;
  }
  if (!sess.players.find((p) => p.id === sess.leader)) {
    sess.leader = sess.players[0].id;
  }
  await sleep(500);
  await sendCardPrompt(sock, m, sess.leader, `🃏 Giliranmu memulai ronde baru!\nMainkan kartu pertama:`, sess);
  return true;
}

let handler = async (m, { sock, args, prefix }) => {
  m.prefix = prefix; // dipakai di sendCardPrompt buat nyusun id tombol
  const sub = args[0];

  const session = sessions[m.chat];
  // Cari juga sesi lain (di grup lain) yang si pengirim lagi ikut, buat
  // command yang dijalanin dari private chat (play/minum/info/deck).
  let mySession = session;
  if (!mySession || !mySession.players.some((p) => p.id === m.sender)) {
    mySession = Object.values(sessions).find((s) => s.players.some((p) => p.id === m.sender));
  }

  switch (sub) {
    case "create":
    case "join": {
      if (!m.isGroup) return m.reply(fail("Game Cangkulan cuma bisa dimainkan di grup."));
      if (session?.players?.some((a) => a.id === m.sender)) return m.reply(fail("Kamu sudah bergabung di sesi ini!"));
      if (mySession && mySession.id !== m.chat) return m.reply(fail("Kamu sudah ada di sesi grup lain! Selesaikan/keluar dulu sebelum join di sini."));

      if (session) {
        if (session.started) return m.reply(fail("Game sudah berjalan! Tunggu sesi berikutnya."));
        if (session.players.length >= 10) return m.reply(fail(`Pemain sudah penuh (maks 10).\nMulai dengan: ${prefix}cangkulan start`));
        session.players.push({ id: m.sender, cards: [] });
        return m.reply(`✅ *Berhasil join Game Cangkulan!*\n👥 Total pemain: ${session.players.length}\nTunggu host memulai: ${prefix}cangkulan start`);
      }

      sessions[m.chat] = new Cangkulan({ id: m.chat, host: m.sender });
      sessions[m.chat].players.push({ id: m.sender, cards: [] });
      return m.reply(`✅ *Room Cangkulan berhasil dibuat!*\nAjak teman: ${prefix}cangkulan join\nMulai game: ${prefix}cangkulan start`);
    }

    case "start": {
      if (!m.isGroup) return m.reply(fail("Game Cangkulan cuma bisa dimainkan di grup."));
      if (!session) return m.reply(fail(`Belum ada sesi. Buat dulu: ${prefix}cangkulan create`));
      if (session.host !== m.sender) return m.reply(fail(`Hanya host @${session.host.split("@")[0]} yang bisa memulai!`));
      if (session.players.length < 2) return m.reply(fail("Minimal 2 pemain!"));
      if (session.started) return m.reply(fail("Game sudah dimulai!"));

      session.distributeCards();
      // m.botNumber udah dalam format LID, sedangkan link wa.me butuh nomor
      // telepon asli (PN) biar bisa dibuka — makanya di-convert balik dulu.
      // getPNForLID balikin JID mentah lengkap device id (mis. "628xxx:0@s.whatsapp.net"),
      // jadi device id-nya (":0") harus dibuang juga, bukan cuma domainnya.
      const botNumber = (await sock.toPn(m.botNumber))?.split("@")[0]?.split(":")[0];
      await m.reply(
        `🃏 *GAME CANGKULAN DIMULAI!* ♦️\n\n` +
          `📌 Start Card: ${session.startCard.rank}${session.startCard.suit}\n` +
          `📦 Sisa Deck: ${session.deck.length} kartu\n` +
          `🎯 Leader: @${session.leader.split("@")[0]}\n\n` +
          `👥 *Pemain:*\n${session.players.map((p) => `• @${p.id.split("@")[0]} (${p.cards.length} kartu)`).join("\n")}\n\n` +
          `Cek private chat untuk kartumu! 👇\nwa.me/${botNumber}`
      );

      for (const p of session.players) {
        await sleep(400);
        const isLeader = p.id === session.leader;
        await sendCardPrompt(
          sock,
          m,
          p.id,
          isLeader
            ? `🃏 Game dimulai! Kamu adalah 🎯 Leader ronde pertama.\nStart Card: ${session.startCard.rank}${session.startCard.suit}\nMainkan kartu suit ${session.startCard.suit} untuk memulai!`
            : `🃏 Game dimulai!\nStart Card: ${session.startCard.rank}${session.startCard.suit}\nMainkan kartu suit ${session.startCard.suit} atau tekan Minum jika tidak ada.`,
          session
        );
      }
      return;
    }

    case "minum":
    case "hit": {
      if (!mySession) return m.reply(fail("Tidak ada sesi aktif!"));
      if (!mySession.started) return m.reply(fail("Game belum dimulai!"));
      if (!mySession.players.some((a) => a.id === m.sender)) return m.reply(fail("Kamu belum bergabung!"));
      if (!Object.keys(mySession.startCard).length) return m.reply("⏳ Belum ada Start Card! Tunggu leader memulai ronde.");
      if (mySession.submitCard.some((s) => s.id === m.sender) || mySession.skip.includes(m.sender)) return m.reply(fail("Kamu sudah bermain di ronde ini!"));
      if (mySession.hasMatching(m.sender)) return m.reply(fail(`Kamu masih punya kartu suit *${mySession.startCard.suit}*!\nMainkan dulu sebelum minum.`));

      const player = mySession.players.find((p) => p.id === m.sender);
      if (mySession.deck.length > 0) {
        const newCard = mySession.deck.shift();
        player.cards.push(newCard);
        await m.reply(`@${m.sender.split("@")[0]} minum 🍺 dan mengambil kartu dari deck! (sisa deck: ${mySession.deck.length})`, { chat: mySession.id });
        await sleep(400);
        await sendCardPrompt(sock, m, m.sender, `🃏 Kartumu setelah minum:\nStart Card: ${mySession.startCard.rank}${mySession.startCard.suit}`, mySession);
      } else {
        await m.reply(`⚠️ @${m.sender.split("@")[0]} terpaksa skip karena deck kosong. Waspada hukuman kartu meja!`, { chat: mySession.id });
        if (!mySession.skip.includes(m.sender)) mySession.skip.push(m.sender);
        await finalizeRound(sock, m, mySession);
      }
      return;
    }

    case "play": {
      if (!mySession) return m.reply(fail("Tidak ada sesi aktif!"));
      if (!mySession.started) return m.reply(fail("Game belum dimulai!"));
      if (!mySession.players.some((a) => a.id === m.sender)) return m.reply(fail("Kamu belum bergabung!"));
      if (!args[1]) return m.reply(usage(`${prefix}cangkulan play <kartu>`, `${prefix}cangkulan play 3♥️`));
      if (mySession.submitCard.some((s) => s.id === m.sender) || mySession.skip.includes(m.sender)) return m.reply(fail("Kamu sudah bermain di ronde ini!"));

      const player = mySession.players.find((p) => p.id === m.sender);
      const idx = player.cards.findIndex((c) => normalizeCard(c.rank + c.suit) === normalizeCard(args[1]));
      if (idx === -1) return m.reply(fail("Kartu tidak valid atau tidak ada di tanganmu!"));
      const card = player.cards[idx];
      const hasStartCard = Object.keys(mySession.startCard).length > 0;

      if (hasStartCard) {
        if (card.suit !== mySession.startCard.suit) {
          if (mySession.hasMatching(m.sender)) return m.reply(fail(`Harus memainkan kartu suit *${mySession.startCard.suit}*!`));
          return m.reply(fail(`Kartu tidak sesuai suit *${mySession.startCard.suit}*!\nKarena tidak punya kartu cocok, gunakan: ${prefix}cangkulan minum`));
        }
      } else if (m.sender !== mySession.leader) {
        return m.reply(`⏳ Tunggu dulu! Hanya 🎯 @${mySession.leader.split("@")[0]} (leader) yang bisa memulai ronde baru.`);
      }

      player.cards.splice(idx, 1);
      mySession.secondDeck.push(card);
      mySession.submitCard.push({ id: m.sender, card });
      await m.reply(`✅ Kamu memainkan *${card.rank}${card.suit}*`);

      if (!hasStartCard) {
        mySession.startCard = card;
        await m.reply(`🎯 @${m.sender.split("@")[0]} memulai ronde dengan *${card.rank}${card.suit}*\nSemua pemain harus memainkan kartu suit *${card.suit}*!`, { chat: mySession.id });
        for (const s of mySession.players) {
          if (s.id === mySession.leader) continue;
          await sleep(300);
          await sendCardPrompt(sock, m, s.id, `🃏 Ronde baru dimulai!\nStart Card: *${card.rank}${card.suit}*\nMainkan kartu suit ${card.suit} atau tekan Minum.`, mySession);
        }
        await finalizeRound(sock, m, mySession);
        return;
      }

      await m.reply(`@${m.sender.split("@")[0]} memainkan *${card.rank}${card.suit}* (sisa: ${player.cards.length} kartu)`, { chat: mySession.id });
      await finalizeRound(sock, m, mySession);
      return;
    }

    case "info": {
      const infoSess = mySession || session;
      if (!infoSess) return m.reply(fail("Tidak ada sesi aktif!"));
      if (!infoSess.players.some((a) => a.id === m.sender)) return m.reply(fail("Kamu belum bergabung!"));
      const hasStart = Object.keys(infoSess.startCard).length > 0;
      const startStr = hasStart ? `${infoSess.startCard.rank}${infoSess.startCard.suit}` : "-";
      const playerList = infoSess.players
        .map((p, i) => {
          let tag = "";
          if (p.id === infoSess.host) tag += " 👑HOST";
          if (p.id === infoSess.leader) tag += " 🎯Leader";
          return `${i + 1}. @${p.id.split("@")[0]}${tag} — ${p.cards.length} kartu`;
        })
        .join("\n");

      let msg =
        `🃏 *INFO GAME CANGKULAN* ♦️\n` +
        `┏━━━━━━━━━━━━━━━━━━\n` +
        `👥 Pemain : ${infoSess.players.length}\n` +
        `👑 Host : @${infoSess.host.split("@")[0]}\n` +
        `🎯 Leader : ${infoSess.leader ? "@" + infoSess.leader.split("@")[0] : "-"}\n` +
        `📊 Status : ${infoSess.started ? "🟢 Berjalan" : "🔴 Belum Mulai"}\n` +
        `🃏 Start Card: ${startStr}\n` +
        `📦 Sisa Deck: ${infoSess.deck.length} kartu\n` +
        `┗━━━━━━━━━━━━━━━━━━\n` +
        `*Daftar Pemain:*\n${playerList}`;

      if (!m.isGroup) {
        const myCards = infoSess.players.find((p) => p.id === m.sender)?.cards?.map((c) => c.rank + c.suit).join(", ") || "-";
        msg += `\n┏━━━━━━━━━━━━━━━━━━\n*Kartu kamu:*\n${myCards}`;
      }
      if (infoSess.winner.length) {
        msg += `\n┏━━━━━━━━━━━━━━━━━━\n*🏆 Sudah Menang:*\n${infoSess.winner.map((w, i) => `${i + 1}. @${w.id.split("@")[0]}`).join("\n")}`;
      }
      return m.reply(msg);
    }

    case "deck": {
      const deckSess = mySession || session;
      if (!deckSess) return m.reply(fail("Tidak ada sesi aktif!"));
      if (!deckSess.players.some((a) => a.id === m.sender)) return m.reply(fail("Kamu belum bergabung!"));
      const submittedNow = deckSess.submitCard.length ? deckSess.submitCard.map((s) => `@${s.id.split("@")[0]}: ${s.card.rank}${s.card.suit}`).join(", ") : "-";
      const skipNow = deckSess.skip.length ? deckSess.skip.map((s) => `@${s.split("@")[0]}`).join(", ") : "-";
      const lastCards = deckSess.secondDeck.slice(-10).map((c) => c.rank + c.suit).join(", ") || "-";
      return m.reply(
        `🃏 *INFO DECK* ♦️\n` +
          `┏━━━━━━━━━━━━━━━━━━\n` +
          `📦 Sisa Deck : ${deckSess.deck.length} kartu\n` +
          `🔄 Kartu Terpakai: ${deckSess.secondDeck.length} kartu\n` +
          `┗━━━━━━━━━━━━━━━━━━\n` +
          `*Ronde Ini:*\n` +
          `▶️ Submit : ${submittedNow}\n` +
          `⏩ Skip : ${skipNow}\n` +
          `┏━━━━━━━━━━━━━━━━━━\n` +
          `*10 Kartu Terakhir:*\n${lastCards}`
      );
    }

    case "end": {
      if (!m.isGroup) return m.reply(fail("Game Cangkulan cuma bisa dimainkan di grup."));
      if (!session) return m.reply(fail("Tidak ada sesi aktif!"));
      if (session.host !== m.sender) return m.reply(fail(`Hanya host @${session.host.split("@")[0]} yang bisa menghapus sesi!`));
      delete sessions[m.chat];
      return m.reply("🗑️ Sesi Game Cangkulan telah dihapus.");
    }

    default:
      return m.reply(
        `🃏 *GAME CANGKULAN* ♦️\n\n` +
          `*Cara Main:*\n` +
          `Mainkan kartu dengan suit yang sama dengan Start Card.\n` +
          `Tidak punya? Tekan Minum 🍺 — ambil kartu penalti & skip ronde.\n` +
          `Pemain pertama yang habis kartunya menang!\n\n` +
          `*Commands:*\n` +
          `• \`${prefix}cangkulan create\` — Buat room baru\n` +
          `• \`${prefix}cangkulan join\` — Gabung room\n` +
          `• \`${prefix}cangkulan start\` — Mulai game (host)\n` +
          `• \`${prefix}cangkulan play\` _kartu_ — Main kartu (cth: play 3♥️)\n` +
          `• \`${prefix}cangkulan minum\` — Minum & skip ronde\n` +
          `• \`${prefix}cangkulan info\` — Info game & pemain\n` +
          `• \`${prefix}cangkulan deck\` — Info deck & ronde ini\n` +
          `• \`${prefix}cangkulan end\` — Hapus sesi (host)\n\n` +
          `*Suit:* ♥️ ♦️ ♣️ ♠️`
      );
  }
};

handler.command = ["cangkulan", "ck"];
handler.help = ["cangkulan create/join/start/play/minum/info/deck/end"];
handler.tags = ["game"];

module.exports = handler;
