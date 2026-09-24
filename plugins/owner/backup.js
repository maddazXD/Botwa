const fs = require("fs")
const archiver = require("archiver")
const path = require("path")
const { processing, fail } = require("../../lib/theme")

let handler = async (m, { sock }) => {

  try {
    await m.reply(processing("Backup script bot, tunggu sebentar..."))

    // Format tanggal dd-mm-yy
    const today = new Date()
    const dd = String(today.getDate()).padStart(2, "0")
    const mm = String(today.getMonth() + 1).padStart(2, "0")
    const yy = String(today.getFullYear()).slice(-2)
    const date = `${dd}-${mm}-${yy}`

    // Nama bot + tanggal
    const baseName = global.botname.includes(" ")
      ? global.botname.split(" ").join("-")
      : global.botname

    const name = `${baseName}-${date}.zip`

    const output = fs.createWriteStream(name)
    const archive = archiver("zip", { zlib: { level: 9 } })

    const exclude = [
      "node_modules",
      "skyzopedia",
      "session",
      "package-lock.json",
      "yarn.lock",
      ".npm",
      ".cache"
    ]

    archive.pipe(output)

    const addDir = (dir) => {
      const files = fs.readdirSync(dir)
      for (let file of files) {
        const fullPath = path.join(dir, file)

        if (exclude.some(e => fullPath.includes(e))) continue

        if (fs.statSync(fullPath).isDirectory()) {
          addDir(fullPath)
        } else {
          archive.file(fullPath, { name: fullPath })
        }
      }
    }

    addDir(".")

    await archive.finalize()

    output.on("close", async () => {
      await sock.sendMessage(m.sender, {
        document: fs.readFileSync(name),
        fileName: name,
        mimetype: "application/zip"
      }, { quoted: m })

      fs.unlinkSync(name)

      if (m.chat !== m.sender) {
        m.reply("✅ Script bot berhasil dikirim ke private chat.")
      }
    })

  } catch (err) {
    console.error("Backup Error:", err)
    m.reply(fail("Terjadi kesalahan saat melakukan backup."))
  }
}

handler.command = ["backupsc", "backup", "bck"]
handler.tags = ["owner"]
handler.help = ["backup"]
handler.owner = true

module.exports = handler