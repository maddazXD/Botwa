// lib/gameCangkulan.js
//
// Class buat game kartu "Cangkulan" — diadaptasi dari lib/game.js bot
// XAYNC_MD (versi ESM/class Cangkulan di sana), dikonversi ke CommonJS.
//
// Aturan singkat: tiap ronde ada 1 "Start Card". Semua pemain gantian
// mainkan kartu suit yang SAMA dengan Start Card. Yang gak punya kartu
// suit itu harus "minum" (ambil 1 kartu dari deck & skip ronde ini). Kalau
// deck abis, pemain yang skip malah "makan" kartu-kartu yang dimainkan di
// meja (penalti). Kartu suit tertinggi di ronde itu menang & jadi leader
// ronde berikutnya. Pemain pertama yang kartunya habis = menang.
//
// CATATAN PENTING: instance class ini disimpan di MEMORI proses bot (lihat
// `sessions` di plugins/game/cangkulan.js), BUKAN ditulis ke database.json.
// Sengaja begitu — kalau dipaksa disimpan ke JSON (lib/database.js), method
// class ini (resolveRound, dst) bakal HILANG tiap kali dibaca ulang (JSON
// gak bisa nyimpen method), jadi butuh "rehydrate" manual tiap baca kayak
// di bot asalnya. Nyimpen di memori jauh lebih simpel & gak rawan bug itu.
// Konsekuensinya: kalau bot RESTART di tengah game, sesi yang lagi jalan
// ilang & pemain harus `create` ulang — ini tradeoff yang wajar buat game
// sesi pendek kayak gini.

const SUITS = ["♥️", "♦️", "♣️", "♠️"];
const RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];

class Cangkulan {
  constructor(data = {}) {
    this.id = data.id || "";
    this.host = data.host || "";
    this.leader = data.leader || "";
    this.winner = data.winner || [];
    this.players = data.players || []; // [{ id, cards: [{rank, suit}] }]
    this.started = data.started || false;
    this.startCard = data.startCard || {};
    this.submitCard = data.submitCard || []; // [{ id, card }]
    this.secondDeck = data.secondDeck || []; // kartu yang udah pernah dimainkan
    this.skip = data.skip || []; // id pemain yang "minum" di ronde ini
    this.deck = data.deck || this.generateDeck();
  }

  generateDeck() {
    return SUITS.flatMap((suit) => RANKS.map((rank) => ({ rank, suit })));
  }

  shuffleDeck() {
    for (let i = this.deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
    }
  }

  distributeCards() {
    this.shuffleDeck();
    const perPlayer = { 2: 10, 3: 7, 4: 7, 5: 6, 6: 6, 7: 5, 8: 5, 9: 4, 10: 4 }[this.players.length] ?? 4;
    for (const player of this.players) {
      player.cards.push(...this.deck.splice(0, perPlayer));
    }
    this.startCard = this.deck.shift();
    this.secondDeck.push(this.startCard);
    this.leader = this.host;
    this.started = true;
  }

  hasMatching(playerId) {
    if (!this.startCard || !Object.keys(this.startCard).length) return false;
    return this.players.find((p) => p.id === playerId)?.cards?.some((c) => c.suit === this.startCard.suit) ?? false;
  }

  cardValue(rank) {
    return rank === "A" ? 14 : rank === "K" ? 13 : rank === "Q" ? 12 : rank === "J" ? 11 : parseInt(rank) || 0;
  }

  // Nentuin pemenang ronde (kartu suit-cocok dengan nilai tertinggi), kasih
  // penalti "makan kartu meja" ke pemain yang minum kalau deck udah abis,
  // terus reset state buat ronde berikutnya. Return teks hasil ronde, atau
  // null kalau belum ada kartu yang dimainkan sama sekali (semua minum).
  resolveRound() {
    if (!this.submitCard.length) {
      this.skip = [];
      return null;
    }
    const validCards = this.submitCard.filter((c) => c.card.suit === this.startCard.suit);
    if (validCards.length === 0) validCards.push(this.submitCard[0]);
    const best = validCards.reduce((hi, c) => (this.cardValue(c.card.rank) > this.cardValue(hi.card.rank) ? c : hi));
    this.leader = best.id;

    let penaltyMsg = "";
    if (this.skip.length > 0) {
      const skipPlayers = this.skip.map((id) => this.players.find((p) => p.id === id)).filter(Boolean);
      skipPlayers.sort((a, b) => a.cards.length - b.cards.length); // yang kartunya paling sedikit kena duluan

      const penaltyCards = this.submitCard.map((s) => s.card);
      const punished = {};
      penaltyCards.forEach((card, i) => {
        if (!skipPlayers.length) return;
        const targetPlayer = skipPlayers[i % skipPlayers.length];
        targetPlayer.cards.push(card);
        punished[targetPlayer.id] = (punished[targetPlayer.id] || 0) + 1;
      });

      if (Object.keys(punished).length) {
        const punishedList = Object.entries(punished)
          .map(([id, count]) => `@${id.split("@")[0]} (+${count})`)
          .join(", ");
        penaltyMsg = `\n\n⚠️ Deck kosong! Pemain berikut harus MAKAN kartu meja karena jumlah kartunya paling sedikit: ${punishedList}`;
      }

      const currentPlayed = this.submitCard.map((s) => s.card);
      this.secondDeck = this.secondDeck.filter(
        (c) => !currentPlayed.some((played) => played.rank === c.rank && played.suit === c.suit)
      );
    }

    this.startCard = {};
    this.submitCard = [];
    this.skip = [];
    return `🏆 @${this.leader.split("@")[0]} memenangkan ronde dan memimpin ronde berikutnya!${penaltyMsg}`;
  }

  isRoundComplete() {
    return this.submitCard.length + this.skip.length >= this.players.length;
  }
}

module.exports = { Cangkulan };
