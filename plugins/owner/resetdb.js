const { getBaileys } = require("../../lib/baileysLoader")
const { warn, ok, fail } = require("../../lib/theme")

let handler = async (m, { sock, command }) => {

  // ====== COMMAND UTAMA ======
  if (command === "resetdb") {
    let teks = warn(`*Reset Database*\n\nApakah kamu yakin ingin mereset database bot?\n\nSemua data akan terhapus permanen dan tidak bisa dikembalikan!`)

    const { generateWAMessageFromContent } = await getBaileys()
    let msg = await generateWAMessageFromContent(m.chat, {
      viewOnceMessage: {
        message: {
          interactiveMessage: {
            body: { text: teks },
            nativeFlowMessage: {
              buttons: [
                {
                  name: "quick_reply",
                  buttonParamsJson: JSON.stringify({
                    display_text: "✅ Konfirmasi",
                    id: ".resetdb_confirm"
                  })
                },
                {
                  name: "quick_reply",
                  buttonParamsJson: JSON.stringify({
                    display_text: "❌ Batal",
                    id: ".resetdb_cancel"
                  })
                }
              ]
            }
          }
        }
      }
    }, { userJid: m.sender, quoted: m })

    return await sock.relayMessage(m.chat, msg.message, { messageId: msg.key.id })
  }

  // ====== KONFIRMASI ======
  if (command === "resetdb_confirm") {
    global.db = {}
    return m.reply(ok("Database berhasil direset!"))
  }

  // ====== BATAL ======
  if (command === "resetdb_cancel") {
    return m.reply(fail("Reset database dibatalkan."))
  }
}

handler.help = ["resetdb"]
handler.tags = ["owner"]
handler.command = ["resetdb", "resetdb_confirm", "resetdb_cancel"]
handler.owner = true

module.exports = handler
