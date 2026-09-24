// Load & update user/group data per message

module.exports = async (sock, m) => {
  if (!m || !m.chat) return;

  // ── Settings defaults ─────────────────
  if (!global.db.settings) global.db.settings = {};
  if (!global.db.settings.totalhit) global.db.settings.totalhit = 0;
  if (!global.db.settings.owner) global.db.settings.owner = [];
  if (!global.db.settings.banned) global.db.settings.banned = [];
  if (!global.db.settings.namaSaveContact) global.db.settings.namaSaveContact = "Buyer";
  if (!global.db.settings.jedaPushkontak) global.db.settings.jedaPushkontak = 4000;
  if (!global.db.settings.bljpm) global.db.settings.bljpm = [];
  if (typeof global.db.settings.autoaiPC === "undefined") global.db.settings.autoaiPC = false;
  if (typeof global.db.settings.autoaiGroup === "undefined") global.db.settings.autoaiGroup = false;

  // ── User defaults ─────────────────────
  if (m.sender) {
    if (!global.db.users[m.sender]) {
      global.db.users[m.sender] = {
        id: m.sender,
        name: m.pushName || "",
        registered: false,
      };
    }
    // Update name
    if (m.pushName) global.db.users[m.sender].name = m.pushName;
  }

  // ── Group defaults ────────────────────
  if (m.isGroup && m.chat) {
    if (!global.db.groups[m.chat]) {
      global.db.groups[m.chat] = {
        id: m.chat,
        welcome: global.welcomeDefault || false,
        goodbye: global.goodbyeDefault || false,
        antilink: false,
        antitagsw: false,
        antitoxic: false,
        antidocument: false,
        antisticker: false,
        antimedia: false,
        antibot: false,
        autodl: false,
        hidetag: false,
      };
    }
  }

  // ── Chat defaults (grup & pribadi — sekarang cuma buat nyimpen session_id
  // percakapan Auto AI per chat, lihat plugins/tools/autoai.js. Toggle
  // autoai sendiri UDAH GLOBAL & DIPISAH per kategori chat, disimpen di
  // db.settings.autoaiPC (chat pribadi) & db.settings.autoaiGroup (grup) di
  // atas, bukan per-chat lagi) ───────────
  if (!global.db.chats) global.db.chats = {};
  if (m.chat && !global.db.chats[m.chat]) {
    global.db.chats[m.chat] = { id: m.chat };
  }
};
