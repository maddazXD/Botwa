const fs = require("fs")
const path = require("path")
const { uploadImageBuffer } = require("../../lib/screaper.js")
const { usage, processing, ok, fail } = require("../../lib/theme")

let handler = async (m, { sock }) => {
  let mime = m.mime || ""
  if (!/image/.test(mime)) {
    return m.reply(usage(`Reply foto, terus ketik ${m.cmd}`))
  }

  try {
    let qmsg = m?.quoted || m
    let buffer = await qmsg.download()

    m.reply(processing("Uploading thumbnail..."))

    let url = await uploadImageBuffer(buffer)
    if (!url) return m.reply(fail("Upload gagal!"))

    // lokasi config
    let configPath = path.join(process.cwd(), "config.js")
    let config = fs.readFileSync(configPath, "utf8")

    // replace thumbnail lama
    if (/global\.thumbnail\s*=/.test(config)) {
      config = config.replace(
        /global\.thumbnail\s*=\s*["'`](.*?)["'`]/,
        `global.thumbnail = "${url}"`
      )
    } else {
      config += `\nglobal.thumbnail = "${url}"\n`
    }

    fs.writeFileSync(configPath, config)

    global.thumbnail = url

    m.reply(ok(`Thumbnail menu berhasil diubah\n\nURL:\n${url}`))
  } catch (e) {
    console.log(e)
    m.reply(fail("Terjadi error saat set thumbnail"))
  }
}

handler.tags = ["admin"]
handler.help = "setthumbnail"
handler.command = ["setthumbnail", "setthumb"]
handler.admin = true;

module.exports = handler
