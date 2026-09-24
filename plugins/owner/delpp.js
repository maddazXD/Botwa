const { ok, fail } = require("../../lib/theme")

let handler = async (m, { sock, isOwner }) => {

  try {
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
          content: Buffer.alloc(0)
        },
      ],
    })

    await m.reply(ok("Berhasil menghapus profile bot"))

  } catch (err) {
    console.error(err)
    m.reply(fail("Gagal menghapus profile bot"))
  }
}

handler.help = ["delppbot"]
handler.tags = ["admin"]
handler.command = ["delpp", "delppbot"]
handler.admin = true;

module.exports = handler
