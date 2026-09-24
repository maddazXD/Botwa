// plugins/swgcv2all.js — Status Grup V2 (Ring Pink) ke SEMUA grup, dari Ourin MD 3.1
const { getBaileys } = require("../../lib/baileysLoader");
const { fromBuffer } = require("file-type");
const { usage, ok, fail, processing, card } = require("../../lib/theme");
const { getMediaSource } = require("../../lib/mediaHelper");

function buildSyntheticSwGcRawMessage(sock, remoteJid, innerMessage, messageId) {
  const botJid = sock.user?.id?.split(":")[0] + "@s.whatsapp.net";
  return {
    key: { remoteJid, fromMe: true, id: messageId, participant: botJid },
    message: { groupStatusMessageV2: { message: innerMessage } },
    messageTimestamp: Math.floor(Date.now() / 1000),
  };
}

let handler = async (m, { sock, text }) => {
  const media = getMediaSource(m);
  const mime = media?.mimetype || "";
  let rawContent = null;

  if (media && /image|video|audio/.test(mime)) {
    let buffer;
    try {
      buffer = await media.download();
    } catch {}
    if (!buffer) return m.reply(fail("Gagal mengunduh media. Silakan coba lagi."));

    const fileType = await fromBuffer(buffer);
    const detectedMime = fileType ? fileType.mime : mime;

    if (detectedMime.startsWith("image/")) {
      rawContent = { image: buffer, caption: text };
    } else if (detectedMime.startsWith("video/")) {
      rawContent = { video: buffer, caption: text };
    } else if (detectedMime.startsWith("audio/")) {
      rawContent = { audio: buffer, mimetype: "audio/mpeg", ptt: m.quoted?.ptt || m.msg?.ptt || false };
    } else {
      return m.reply(fail("Format media tidak didukung untuk SW GC."));
    }
  } else if (text) {
    rawContent = { text };
  } else {
    return m.reply(
      usage(`Kirim pesan Status Grup V2 (Ring Pink) ke SEMUA grup sekaligus.\n\n${m.cmd} Halo semua!`, `atau reply gambar/video dengan caption ${m.cmd}`)
    );
  }

  await m.react("🕕");

  try {
    const groups = await sock.groupFetchAllParticipating();
    const groupIds = Object.keys(groups);

    if (groupIds.length === 0) {
      await m.react("❌");
      return m.reply(fail("Bot tidak berada di grup manapun."));
    }

    await m.reply(processing(`Memulai broadcast Status Grup V2 ke ${groupIds.length} grup... proses ini mungkin memakan waktu beberapa saat.`));

    let successCount = 0, failCount = 0;

    for (const targetGroupId of groupIds) {
      try {
        let baseContent = {};
        if (rawContent.image) baseContent = { image: rawContent.image, caption: rawContent.caption || "" };
        else if (rawContent.video) baseContent = { video: rawContent.video, caption: rawContent.caption || "" };
        else if (rawContent.audio) baseContent = { audio: rawContent.audio, mimetype: rawContent.mimetype || "audio/mpeg", ptt: rawContent.ptt || false };
        else if (rawContent.text) baseContent = { text: rawContent.text };

        const { generateWAMessage } = await getBaileys();
        const genMsg = await generateWAMessage(targetGroupId, baseContent, {
          userJid: sock.user.id,
          upload: sock.waUploadToServer,
        });

        const msgType = Object.keys(genMsg.message).find(
          (k) => k.endsWith("Message") && k !== "senderKeyDistributionMessage"
        );

        let mediaMessage = {};
        if (msgType) {
          mediaMessage[msgType] = genMsg.message[msgType];
          const newContextInfo = {
            isGroupStatus: true,
            statusSourceType: rawContent.text ? 4 : rawContent.audio ? 3 : rawContent.video ? 1 : 0,
            featureEligibilities: { canBeReshared: true, canBeSentToParticipants: true },
            statusAttributions: [{ type: 10 }],
            statusAudienceMetadata: { audienceType: 1 },
          };
          if (mediaMessage[msgType].contextInfo) {
            Object.assign(mediaMessage[msgType].contextInfo, newContextInfo);
          } else {
            mediaMessage[msgType].contextInfo = newContextInfo;
          }
        }

        const messageId = genMsg.key.id;
        const finalMessage = buildSyntheticSwGcRawMessage(sock, targetGroupId, mediaMessage, messageId);

        await sock.relayMessage(targetGroupId, finalMessage.message, { messageId });
        successCount++;
      } catch {
        failCount++;
      }
    }

    await m.react("✅");
    await m.reply(card("SWGCV2 ALL SELESAI", [
      `🌐 Total Grup: ${groupIds.length}`,
      `✅ Sukses: ${successCount}`,
      `❌ Gagal: ${failCount}`,
    ], "📊"));
  } catch (error) {
    console.error("[SwgcV2All] Error:", error.message);
    await m.react("☢");
    await m.reply(fail("Gagal broadcast: " + error.message));
  }
};

handler.command = ["swgcv2all", "swgcall", "swgcv2semua", "statusgrupv2all"];
handler.tags = ["admin"];
handler.help = ["swgcv2all <teks>", "swgcv2all (reply media)"];
handler.admin = true;
module.exports = handler;
