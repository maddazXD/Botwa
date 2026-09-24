const fs = require("fs")
const { usage, ok, fail } = require("../../lib/theme")
const { resolveSafePluginPath } = require("../../lib/safePluginPath")

let handler = async (m, { sock, text }) => {

  if (!text) {
    return sock.sendMessage(
      m.chat,
      { text: usage(`${m.cmd} ping.js`) },
      { quoted: m }
    )
  }

  // FIX PATH TRAVERSAL: dulu bisa dipake buat HAPUS file APAPUN di server
  // (misal "../../config.js") — lihat lib/safePluginPath.js.
  const filePath = resolveSafePluginPath(text)
  if (!filePath) {
    return sock.sendMessage(
      m.chat,
      { text: fail("Nama file gak valid (gak boleh ada '../' buat keluar dari folder plugins).") },
      { quoted: m }
    )
  }

  if (!fs.existsSync(filePath)) {
    return sock.sendMessage(
      m.chat,
      { text: fail(`File plugin *${text}* tidak ditemukan!\nKetik .listplugin untuk melihat semua file plugin`) },
      { quoted: m }
    )
  }

  fs.unlinkSync(filePath)

  await sock.sendMessage(
    m.chat,
    { text: ok(`Plugin *${text.trim()}* berhasil dihapus`) },
    { quoted: m }
  )
}

handler.tags = "owner"
handler.help = "delplugin"
handler.command = ["delplugin", "delp"]
handler.owner = true

module.exports = handler
