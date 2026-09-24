// lib/serialize.js — Serialize Message (MaddazXD V2)
/**
 * ───「 MaddazXD V2 」───
 * 📝 Module     : Message Serializer
 * 🔧 Fungsi     : Parse & serialize pesan WA
 * 📦 Version    : 1.2
 * ⚡ By MaddazXD
 * ─────────────────────────
 */

"use strict";

require("../config.js");
const { getBaileys } = require("./baileysLoader");
const axios = require("axios");
const fs = require("fs");
const path = require("path");

// ==================== SALURAN CONTEXT ====================
function saluranCtx() {
  return {
    forwardingScore: 9,
    isForwarded: true,
    forwardedNewsletterMessageInfo: {
      newsletterJid: global.idChannel || "1",
      newsletterName: global.botname || "Bot",
      serverMessageId: 127,
    },
  };
}

// ==================== PP CACHE ====================
const _ppCache = new Map();
const PP_CACHE_TTL = 5 * 60 * 1000;

// ==================== MAIN SERIALIZE ====================
const serialize = async (conn, m) => {
  if (!m) return m;
  const {
    extractMessageContent,
    jidNormalizedUser,
    proto,
    delay,
    getContentType,
    areJidsSameUser,
    generateWAMessage
  } = await getBaileys();
  const { WebMessageInfo } = proto;

  // ===== KEY INFO =====
  if (m.key) {
    m.id = m.key.id;
    m.chat = /@s.whatsapp.net/.test(m.key.remoteJid)
      ? await conn.toLid(m.key.remoteJid)
      : m.key.remoteJid;
    m.isBaileys = m.id
      ? (m.id.startsWith("3EB0") || m.id.startsWith("B1E") ||
         m.id.startsWith("BAE") || m.id.startsWith("3F8") ||
         m.id.length < 32 || m.id.length == 18)
      : false;
    m.fromMe = m.key.fromMe;
    
    let botNumber = conn.user.id.split(":")[0] + "@s.whatsapp.net";
    if (/@s.whatsapp.net/.test(botNumber)) botNumber = await conn.toLid(botNumber);
    m.botNumber = botNumber;
    
    // global.owner sengaja bisa dikosongin (status owner disimpan di
    // database lewat auto-addowner / command addowner), jadi ownerNum cuma
    // dihitung kalau memang diisi — biar gak nyoba toLid("@s.whatsapp.net")
    // yang gak valid.
    let ownerNum = global.owner ? await conn.toLid(global.owner + "@s.whatsapp.net") : null;
    let own = global.db?.settings?.owner || [];
    
    m.isChannel = m.chat.endsWith("@newsletter");
    m.isGroup = m.chat.endsWith("@g.us");
    
    let sender = await conn.decodeJid(
      m.fromMe ? conn.user.id : (m.participant || m.key.participant || m.chat)
    );
    m.sender = /@s.whatsapp.net/.test(sender) ? await conn.toLid(sender) : sender;

    // FIX PENTING: WA ngirim bentuk "alternatif" dari sender langsung di
    // key.participantAlt (LID kalau participant-nya PN, atau PN kalau
    // participant-nya LID) — ini dari data pesan itu sendiri, gak perlu
    // nunggu lidMapping ke-cache lewat toLid/toPn. Dipakai sebagai
    // pembanding tambahan pas cek isAdmin/isOwner biar gak gagal gara-gara
    // mapping belum ke-pelajarin Baileys.
    m.senderAlt = m.key.participantAlt
      ? await conn.decodeJid(m.key.participantAlt)
      : null;

    m.isOwner =
      m.sender == m.botNumber || m.sender == ownerNum || own.includes(m.sender) ||
      (m.senderAlt && (m.senderAlt == m.botNumber || m.senderAlt == ownerNum || own.includes(m.senderAlt)));
    
    if (m.isGroup) {
      m.participant = m.key.participant && /@s.whatsapp.net/.test(m.key.participant)
        ? await conn.toLid(m.key.participant)
        : m.key.participant;
    }
  }

  // ===== MESSAGE CONTENT =====
  if (m.message) {
    m.mtype = await getContentType(m.message);
    m.prefix = global.prefix;
    
    const content = m.message[m.mtype];
    m.msg = m.mtype === "viewOnceMessage"
      ? m.message[m.mtype].message[getContentType(m.message[m.mtype].message)]
      : content;
    
    m.body =
      m?.message?.conversation ||
      m?.msg?.caption ||
      m?.msg?.text ||
      (m.mtype === "extendedTextMessage" && m.msg.text) ||
      (m.mtype === "buttonsResponseMessage" && m.msg.selectedButtonId) ||
      (m.mtype === "interactiveResponseMessage" &&
        JSON.parse(m.msg.nativeFlowResponseMessage?.paramsJson || "{}")?.id) ||
      (m.mtype === "templateButtonReplyMessage" && m.msg.selectedId) ||
      (m.mtype === "listResponseMessage" && m.msg.singleSelectReply?.selectedRowId) ||
      "";

    // ===== QUOTED MESSAGE =====
    const quotedMessage = (m.quoted = m.msg?.contextInfo?.quotedMessage || null);
    m.mentionedJid = m.msg?.contextInfo?.mentionedJid || [];

    if (quotedMessage) {
      let qType = getContentType(quotedMessage);
      let quotedContent = quotedMessage[qType];
      let isViewOnce = false;

      // FIX PENTING: view-once (foto/video/dokumen/voice note "Lihat sekali")
      // dibungkus satu layer ekstra: {viewOnceMessage(V2/V2Extension): {message:
      // {imageMessage: {...}}}}. Sebelumnya layer ini GAK di-unwrap kalau yang
      // view-once itu pesan yang DI-QUOTE (beda dari pesan utama yang emang
      // udah di-unwrap di atas) — akibatnya m.quoted.mtype jadi nama wrapper-nya
      // sendiri ("viewOnceMessageV2"), bukan tipe media asli, jadi getMediaSource()
      // /download() SEMUA command yang reply ke pesan view-once (termasuk .rvo)
      // gagal nemuin field media (url/mediaKey/dll) karena nyari di objek yang
      // salah. Di-unwrap manual di sini biar m.quoted balik normal kayak media
      // biasa buat SEMUA command, plus ditandain isViewOnce buat yang butuh tau.
      if (["viewOnceMessage", "viewOnceMessageV2", "viewOnceMessageV2Extension"].includes(qType)) {
        isViewOnce = true;
        const wrapped = quotedContent?.message;
        qType = getContentType(wrapped);
        quotedContent = wrapped?.[qType];
      }

      // FIX TAMBAHAN: WhatsApp versi lebih baru kadang GAK bungkus pakai wrapper
      // viewOnceMessage sama sekali — foto/video/audio-nya dikirim LANGSUNG
      // sebagai imageMessage/videoMessage/audioMessage biasa, cuma dikasih flag
      // boolean `viewOnce: true` di dalam objeknya sendiri. Kalau cuma ngecek
      // wrapper doang (di atas), kasus ini kelewat dan isViewOnce tetep false
      // padahal medianya beneran view-once.
      if (quotedContent?.viewOnce) isViewOnce = true;

      m.quoted = quotedContent;
      
      if (qType === "productMessage") {
        qType = getContentType(m.quoted);
        m.quoted = m.quoted[qType];
      }
      
      if (typeof m.quoted === "string") m.quoted = { text: m.quoted };
      
      if (m.quoted) {
        m.quoted.key = {
          remoteJid: m.msg.contextInfo.remoteJid || m.from,
          participant: m.msg.contextInfo.participant && /@s.whatsapp.net/.test(m.msg.contextInfo.participant)
            ? await conn.toLid(m.msg.contextInfo.participant)
            : m.msg.contextInfo.participant,
          // FIX BUG: sebelumnya pakai areJidsSameUser(jidNormalizedUser(...), ...)
          // — jidNormalizedUser itu fungsi bawaan Baileys yang cuma menormalisasi
          // bentuk PN (@s.whatsapp.net), BUKAN LID (@lid). Bot ini beroperasi dalam
          // bentuk LID (lihat m.sender/m.botNumber di atas yang di-toLid-kan), jadi
          // kalau contextInfo.participant datang dalam bentuk LID sedangkan
          // conn.user.id dalam bentuk PN (nomor:device@s.whatsapp.net), keduanya
          // TIDAK PERNAH dianggap sama walau itu beneran akun yang sama — hasilnya
          // selalu false, bahkan buat pesan bot sendiri. Sekarang dibandingkan
          // pakai m.quoted.sender (dihitung di bawah, sudah di-decodeJid) vs
          // m.botNumber (dihitung di atas, sudah di-toLid-kan) — dua-duanya udah
          // dinormalisasi ke bentuk yang sama sebelum dibanding.
          fromMe: false, // placeholder, diisi ulang di bawah setelah m.quoted.sender ada
          id: m.msg.contextInfo.stanzaId,
        };
        
        m.quoted.mtype = qType;
        m.quoted.isViewOnce = isViewOnce;
        m.quoted.chat = /@s.whatsapp.net/.test(m.quoted.key.remoteJid)
          ? await conn.toLid(m.quoted.key.remoteJid)
          : m.quoted.key.remoteJid;
        m.quoted.id = m.quoted.key.id;
        m.quoted.isBaileys = m.quoted.id
          ? (m.quoted.id.startsWith("3EB0") || m.quoted.id.startsWith("B1E") ||
             m.quoted.id.startsWith("3F8") || m.quoted.id.startsWith("BAE") ||
             m.quoted.id.length < 32)
          : false;
        m.quoted.sender = await conn.decodeJid(m.quoted.key.participant);
        // m.quoted.sender di atas udah melewati decodeJid (dan participant di key
        // udah di-toLid-kan kalau asalnya PN), jadi sekarang berbentuk sama kayak
        // m.botNumber (yang juga LID) — perbandingan ini baru apple-to-apple.
        m.quoted.fromMe = m.quoted.sender === m.botNumber;
        m.quoted.key.fromMe = m.quoted.fromMe;
        m.quoted.text =
          m.quoted.text || m.quoted.caption || m.quoted.conversation ||
          m.quoted.contentText || m.quoted.selectedDisplayText ||
          m.quoted.title || "";
        m.quoted.mentionedJid = m.msg.contextInfo?.mentionedJid || [];
        
        const fakeObj = (m.quoted.fakeObj = WebMessageInfo.fromObject({
          key: m.quoted.key,
          message: quotedMessage,
          ...(m.isGroup ? { participant: m.quoted.sender } : {}),
        }));
        
        m.quoted.download = (saveToFile = false) =>
          conn.downloadMediaMessage(m.quoted, m.quoted.mtype.replace(/message/i, ""), saveToFile);
      }
    }
  }

  // ===== DOWNLOAD =====
  if (m.msg?.url) {
    m.download = (saveToFile = false) =>
      conn.downloadMediaMessage(m.msg, m.mtype.replace(/message/i, ""), saveToFile);
  }

  m.text = m.body;

  // ==================== VERIFIED QUOTED ====================
  const userNum = (m.sender || "").split("@")[0];
  const botName = global.botname || "Bot";

  // Variant 1: Contact Message (verifiedQuoted)
  m.verifiedQuoted = {
    key: { 
      fromMe: false, 
      participant: "0@s.whatsapp.net", 
      remoteJid: "status@broadcast" 
    },
    message: {
      contactMessage: {
        displayName: botName,
        vcard: `BEGIN:VCARD\nVERSION:3.0\nN:;${m.pushName || "User"};;;\nFN:${m.pushName || "User"}\nTEL;type=CELL;type=VOICE;waid=${userNum}:${userNum}\nEND:VCARD`,
      },
    },
  };

  // Variant 2: Order Message (shopping bag icon)
  m.orderQuoted = {
    key: { 
      fromMe: false, 
      participant: "0@s.whatsapp.net", 
      remoteJid: "status@broadcast" 
    },
    message: {
      orderMessage: {
        orderId: "1337",
        itemCount: "BOT READY",
        status: "INQUIRY",
        surface: "CATALOG",
        message: botName,
        orderTitle: "WhatsApp Bot Multi-Device",
        sellerJid: m.botNumber || "081915483630@s.whatsapp.net",
        token: "maddazxd-v2",
        totalAmount1000: 0,
        totalCurrencyCode: "IDR",
        contextInfo: {
          isForwarded: true,
          forwardingScore: 9,
          forwardedNewsletterMessageInfo: {
            newsletterJid: global.idChannel || "",
            newsletterName: botName,
            serverMessageId: 127,
          },
        },
      },
    },
  };

  // Variant 3: Payment Message
  m.paymentQuoted = {
    key: { 
      remoteJid: "0@s.whatsapp.net", 
      fromMe: false, 
      id: "maddazxd", 
      participant: "0@s.whatsapp.net" 
    },
    message: {
      requestPaymentMessage: {
        currencyCodeIso4217: "USD",
        amount1000: 999999999,
        requestFrom: "0@s.whatsapp.net",
        noteMessage: { extendedTextMessage: { text: botName } },
        expiryTimestamp: 999999999,
        amount: { value: 91929291929, offset: 1000, currencyCode: "USD" },
      },
    },
  };

  // ==================== REPLY FUNCTION ====================
  m.reply = async (text, options = {}) => {
    if (text === null || text === undefined) return null;
    
    const chatId = options.chat || m.chat;
    const str = text.toString();
    const mentions = [...str.matchAll(/@(\d{0,19})/g)].map(v => v[1] + "@lid");

    return conn.sendMessage(
      chatId,
      {
        text: str,
        mentions,
        contextInfo: {
          mentionedJid: mentions,
          ...saluranCtx(),
          ...(options.contextInfo || {}),
        },
        ...options,
      },
      { quoted: m.verifiedQuoted }
    );
  };

  // ==================== REACT FUNCTION ====================
  m.react = async (emoji) => {
    return conn.sendMessage(m.chat, {
      react: {
        text: emoji,
        key: m.key,
      },
    });
  };

  return m;
};

module.exports = serialize;
