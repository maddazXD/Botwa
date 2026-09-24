const fs = require("fs")
const { usage, ok, fail } = require("../../lib/theme")

let handler = async (m, { sock, mime, isOwner }) => {
  if (!mime || !/image/.test(mime)) {
    return m.reply(usage(`Kirim/reply gambar, terus ketik ${m.cmd}`))
  }

  try {
    const qmsg = m.qmsg
    const bufferPath = await sock.downloadAndSaveMediaMessage(qmsg)
    const { img } = await global.generateProfilePicture(bufferPath)

    await sock.query({
      tag: "iq",
      attrs: {
        to: "@s.whatsapp.net",
        type: "set",
        xmlns: "w:profile:picture",
      },
      content: [
        {
          tag: "picture",
          attrs: { type: "image" },
          content: img,
        },
      ],
    })

    await m.reply(ok("Berhasil mengganti profile bot"))

    fs.unlinkSync(bufferPath)

  } catch (err) {
    console.error(err)
    m.reply(fail("Gagal mengganti profile bot"))
  }
}

handler.help = ["setppbot"]
handler.tags = ["admin"]
handler.command = ["setpp", "setppbot"]
handler.admin = true;

module.exports = handler
