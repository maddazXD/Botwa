// plugins/owner/swgcv2.js — Status Grup V2 dengan pemilihan grup tujuan
//
// ─── PERUBAHAN DARI VERSI LAMA ───────────────────────────────────────────────
// Versi lama: langsung posting ke grup TEMPAT command dijalankan (m.chat).
// Versi baru: bisa dijalankan dari mana saja (grup ATAU private chat), lalu
//   bot tampilkan daftar SEMUA grup tempat bot berada → user pilih satu via
//   tombol quickReply → bot posting ke grup itu.
//
// ─── FLOW ────────────────────────────────────────────────────────────────────
//   1. Owner jalankan .swgcv2 [media/teks] dari grup atau DM
//   2. Bot parse konten, fetch daftar grup, simpan pending state per sender
//   3. Bot tampilkan picker grup (5 per halaman) dengan tombol interaktif
//   4. User tap grup → command .swgcv2 pilih <groupId> terkirim otomatis
//   5. Bot posting ke grup target → hapus pending → reply sukses
//
// ─── SUBCOMMAND ──────────────────────────────────────────────────────────────
//   .swgcv2 [media/teks]        — mulai flow, tampil halaman 1
//   .swgcv2 next                — halaman berikutnya
//   .swgcv2 prev                — halaman sebelumnya
//   .swgcv2 pilih <groupId>     — posting ke grup (dari tap tombol / manual)
//   .swgcv2 batal               — batalkan sesi pending
//
// ─── STATE ───────────────────────────────────────────────────────────────────
//   global.pendingSwgcV2[sender] = { rawContent, groups, page, expireAt }
//   Expire otomatis setelah PENDING_TTL_MS (default: 5 menit).
// ─────────────────────────────────────────────────────────────────────────────

const { getBaileys }         = require("../../lib/baileysLoader");
const { fromBuffer }         = require("file-type");
const { usage, ok, fail, processing } = require("../../lib/theme");
const { getMediaSource }     = require("../../lib/mediaHelper");
const { sendInteractiveCard } = require("../../lib/interactiveMessage");
const { quickReplyButtons }  = require("../../lib/theme");

const GROUPS_PER_PAGE = 5;
const PENDING_TTL_MS  = 5 * 60 * 1000; // 5 menit

// ── Helper: buang pending yang sudah expire ───────────────────────────────
function purgePending() {
  if (!global.pendingSwgcV2) return;
  const now = Date.now();
  for (const key of Object.keys(global.pendingSwgcV2)) {
    if ((global.pendingSwgcV2[key]?.expireAt || 0) < now) {
      delete global.pendingSwgcV2[key];
    }
  }
}

// ── Helper: render satu halaman daftar grup sebagai interactive message ───
async function showGroupPage(sock, m, pending, prefix) {
  const { groups, page } = pending;
  const totalPages  = Math.ceil(groups.length / GROUPS_PER_PAGE);
  const startIdx    = page * GROUPS_PER_PAGE;
  const pageGroups  = groups.slice(startIdx, startIdx + GROUPS_PER_PAGE);

  // ── Teks daftar grup ──────────────────────────────────────────────────
  let bodyText = `📋 *Pilih Grup Tujuan SW GC V2*\n`;
  bodyText    += `┈ Halaman ${page + 1} dari ${totalPages}  •  ${groups.length} grup total\n\n`;
  pageGroups.forEach((g, i) => {
    bodyText += `${startIdx + i + 1}. *${g.subject}*\n`;
    bodyText += `   👥 ${g.memberCount} member\n`;
  });
  bodyText += `\n⏱️ _Sesi aktif 5 menit. Tap nama grup untuk langsung posting._`;

  // ── Tombol grup (maks GROUPS_PER_PAGE tombol per halaman) ─────────────
  const btns = pageGroups.map((g, i) => {
    // Potong nama grup agar label tombol tidak terlalu panjang
    const shortName = g.subject.length > 22
      ? g.subject.substring(0, 22) + "…"
      : g.subject;
    return {
      label: `${startIdx + i + 1}. ${shortName}`,
      id: `${prefix}swgcv2 pilih ${g.id}`,
    };
  });

  // ── Tombol navigasi (muncul hanya jika ada halaman lain) ──────────────
  if (page > 0) {
    btns.push({ label: "◀ Sebelumnya", id: `${prefix}swgcv2 prev` });
  }
  if (page < totalPages - 1) {
    btns.push({ label: "▶ Berikutnya", id: `${prefix}swgcv2 next` });
  }
  btns.push({ label: "❌ Batal", id: `${prefix}swgcv2 batal` });

  // ── Kirim interactive card; fallback ke teks biasa ────────────────────
  const sent = await sendInteractiveCard(sock, m, {
    bodyText,
    footer: `Gunakan tombol di bawah untuk pilih grup tujuan.`,
    buttons: quickReplyButtons(btns),
  });

  if (!sent) {
    // Fallback teks polos jika interactive message gagal
    let fallback = bodyText + `\n\n*Cara pilih:*\n`;
    pageGroups.forEach((g, i) => {
      fallback += `› ${prefix}swgcv2 pilih ${g.id}\n`;
    });
    if (page < totalPages - 1) fallback += `\nHalaman berikutnya: ${prefix}swgcv2 next`;
    if (page > 0) fallback += `\nHalaman sebelumnya: ${prefix}swgcv2 prev`;
    fallback += `\nBatal: ${prefix}swgcv2 batal`;
    await m.reply(fallback);
  }
}

// ── Handler utama ─────────────────────────────────────────────────────────
let handler = async (m, { sock, text, args, prefix }) => {
  // Inisialisasi global store sekali
  if (!global.pendingSwgcV2) global.pendingSwgcV2 = {};
  // Bersihkan sesi kedaluwarsa di setiap invokasi (low-cost housekeeping)
  purgePending();

  // args[0] = subcommand / kata pertama konten teks
  const sub = (args[0] || "").toLowerCase();

  // ════════════════════════════════════════════════════════════════════════
  // SUBCOMMAND: navigasi halaman (next / prev)
  // ════════════════════════════════════════════════════════════════════════
  if (sub === "next" || sub === "prev" || sub === "berikutnya" || sub === "sebelumnya") {
    const pending = global.pendingSwgcV2[m.sender];
    if (!pending) {
      return m.reply(fail("Tidak ada sesi .swgcv2 aktif.\nJalankan ulang dengan media atau teks dulu."));
    }
    const totalPages = Math.ceil(pending.groups.length / GROUPS_PER_PAGE);
    if (sub === "next" || sub === "berikutnya") {
      if (pending.page >= totalPages - 1) {
        return m.reply(fail("Sudah di halaman terakhir."));
      }
      pending.page++;
    } else {
      if (pending.page <= 0) {
        return m.reply(fail("Sudah di halaman pertama."));
      }
      pending.page--;
    }
    // Reset timer saat user masih aktif navigasi
    pending.expireAt = Date.now() + PENDING_TTL_MS;
    return showGroupPage(sock, m, pending, prefix);
  }

  // ════════════════════════════════════════════════════════════════════════
  // SUBCOMMAND: batal / cancel
  // ════════════════════════════════════════════════════════════════════════
  if (sub === "batal" || sub === "cancel") {
    if (!global.pendingSwgcV2[m.sender]) {
      return m.reply(fail("Tidak ada sesi .swgcv2 aktif yang bisa dibatalkan."));
    }
    delete global.pendingSwgcV2[m.sender];
    return m.reply(ok("Sesi .swgcv2 dibatalkan."));
  }

  // ════════════════════════════════════════════════════════════════════════
  // SUBCOMMAND: pilih <groupId>  — dijalankan otomatis saat user tap tombol
  // ════════════════════════════════════════════════════════════════════════
  if (sub === "pilih") {
    const targetId = args[1];
    if (!targetId) {
      return m.reply(fail(`Format: ${prefix}swgcv2 pilih <group_id>`));
    }

    const pending = global.pendingSwgcV2[m.sender];
    if (!pending) {
      return m.reply(
        fail(
          "Sesi .swgcv2 kamu sudah expire atau belum dimulai.\n" +
          `Jalankan \`${prefix}swgcv2\` lagi dengan media/teks terlebih dahulu.`
        )
      );
    }

    // Validasi: grup target harus ada di daftar yang tersimpan
    const targetGroup = pending.groups.find((g) => g.id === targetId);
    if (!targetGroup) {
      return m.reply(
        fail(`Grup tidak ditemukan di daftar. Group ID: ${targetId}`)
      );
    }

    await m.react("🕕");

    try {
      const rc = pending.rawContent;

      // ── Bangun baseContent sesuai tipe konten ───────────────────────
      let baseContent = {};
      if (rc.image)      baseContent = { image: rc.image, caption: rc.caption || "" };
      else if (rc.video) baseContent = { video: rc.video, caption: rc.caption || "" };
      else if (rc.audio) baseContent = { audio: rc.audio, mimetype: rc.mimetype || "audio/mpeg", ptt: rc.ptt || false };
      else if (rc.text)  baseContent = { text: rc.text };

      // ── Generate pesan & upload media ────────────────────────────────
      const { generateWAMessage } = await getBaileys();
      const genMsg = await generateWAMessage(targetId, baseContent, {
        userJid: sock.user.id,
        upload:  sock.waUploadToServer,
      });

      const msgType = Object.keys(genMsg.message).find(
        (k) => k.endsWith("Message") && k !== "senderKeyDistributionMessage"
      );

      // ── Set konteks Group Status V2 ──────────────────────────────────
      let mediaMessage = {};
      if (msgType) {
        mediaMessage[msgType] = genMsg.message[msgType];
        const newContextInfo = {
          isGroupStatus:    true,
          statusSourceType: rc.text ? 4 : rc.audio ? 3 : rc.video ? 1 : 0,
          featureEligibilities: { canBeReshared: true, canReceiveMultiReact: false },
          // audienceType 0 = status biasa (bukan Close Friends)
          statusAudienceMetadata: { audienceType: 0 },
        };
        if (mediaMessage[msgType].contextInfo) {
          Object.assign(mediaMessage[msgType].contextInfo, newContextInfo);
        } else {
          mediaMessage[msgType].contextInfo = newContextInfo;
        }
      }

      // ── Relay sebagai groupStatusMessageV2 ───────────────────────────
      const payload = { groupStatusMessageV2: { message: mediaMessage } };
      await sock.relayMessage(targetId, payload, { messageId: genMsg.key.id });

      // ── Hapus pending setelah berhasil ───────────────────────────────
      delete global.pendingSwgcV2[m.sender];

      await m.react("✅");
      await m.reply(
        ok(`Berhasil posting SW GC V2 ke *${targetGroup.subject}*! ✅\n\n` +
           `👥 ${targetGroup.memberCount} member akan melihat story ini.`)
      );
    } catch (error) {
      console.error("[SwgcV2] Error posting ke", targetId, ":", error.message);
      await m.react("☢");
      await m.reply(fail(`Gagal posting story V2 ke grup tersebut.\n_${error.message}_`));
    }
    return;
  }

  // ════════════════════════════════════════════════════════════════════════
  // FLOW UTAMA: Parse konten media/teks → tampilkan picker grup
  // ════════════════════════════════════════════════════════════════════════
  let rawContent = null;
  const media = getMediaSource(m);
  const mime  = media?.mimetype || "";

  if (media && /image|video|audio/.test(mime)) {
    // ── Media: download & deteksi tipe ────────────────────────────────
    let buffer;
    try {
      buffer = await media.download();
    } catch (e) {
      return m.reply(fail("Gagal mengunduh media: " + e.message));
    }
    if (!buffer) return m.reply(fail("Gagal mengambil media. Coba lagi."));

    const fileType     = await fromBuffer(buffer);
    const detectedMime = fileType?.mime || mime;

    if (detectedMime.startsWith("image/")) {
      // caption = semua teks setelah command (termasuk args[0] jika bukan keyword)
      rawContent = { image: buffer, caption: text || "" };
    } else if (detectedMime.startsWith("video/")) {
      rawContent = { video: buffer, caption: text || "" };
    } else if (detectedMime.startsWith("audio/")) {
      rawContent = {
        audio: buffer,
        mimetype: detectedMime || "audio/mpeg",
        ptt: m.quoted?.ptt || m.msg?.ptt || false,
      };
    } else {
      return m.reply(fail("Format media tidak didukung untuk SW GC V2."));
    }
  } else if (text && text.trim()) {
    // ── Konten teks murni ─────────────────────────────────────────────
    rawContent = { text: text.trim() };
  } else {
    // ── Tidak ada konten: tampilkan usage ─────────────────────────────
    return m.reply(
      usage(
        `${prefix}swgcv2 <teks>                   — story teks\n` +
        `${prefix}swgcv2 (reply gambar/video)      — story media\n` +
        `Kirim media dengan caption ${prefix}swgcv2  — story media + caption`,
        `${prefix}swgcv2 Selamat pagi semua! ☀️`
      ) +
      `\n\n💡 Setelah konten diterima, bot akan tampilkan daftar grup untuk dipilih.`
    );
  }

  await m.react("🔍");
  await m.reply(processing("Mengambil daftar grup..."));

  // ── Fetch semua grup tempat bot berada ────────────────────────────────
  let groups;
  try {
    const allGroups = await sock.groupFetchAllParticipating();
    groups = Object.values(allGroups).map((g) => ({
      id:          g.id,
      subject:     g.subject || "(Tanpa Nama)",
      memberCount: g.participants?.length || 0,
    }));
    // Sort alphabetical biar lebih mudah dicari
    groups.sort((a, b) => a.subject.localeCompare(b.subject));
  } catch (e) {
    console.error("[SwgcV2] Gagal fetch grup:", e.message);
    await m.react("☢");
    return m.reply(fail("Gagal mengambil daftar grup: " + e.message));
  }

  if (!groups.length) {
    await m.react("❌");
    return m.reply(fail("Bot tidak berada di grup manapun."));
  }

  // ── Simpan pending state ──────────────────────────────────────────────
  global.pendingSwgcV2[m.sender] = {
    rawContent,
    groups,
    page:     0,
    expireAt: Date.now() + PENDING_TTL_MS,
  };

  // ── Tampilkan halaman pertama dari picker ─────────────────────────────
  return showGroupPage(sock, m, global.pendingSwgcV2[m.sender], prefix);
};

handler.command = ["swgcv2", "swgc", "statusgrup", "statusgrupv2"];
handler.tags    = ["owner"];
handler.help    = ["swgcv2 <teks>", "swgcv2 (reply media)"];
// ⚠️ Diubah dari admin+group menjadi owner-only tanpa batasan grup:
// Fitur broadcast status GC adalah aksi besar (bisa kirim ke semua grup sekaligus),
// terlalu berisiko jika bisa diakses admin sembarang. Owner saja yang bisa.
// Tidak ada handler.group = true → bisa dijalankan dari DM maupun grup.
handler.owner   = true;
module.exports  = handler;
