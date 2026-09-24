const fs = require("fs")
const { usage, fail } = require("../../lib/theme")
const { resolveSafePluginPath } = require("../../lib/safePluginPath")

let handler = async (m, { sock, text }) => {

  if (!text) {
    return sock.sendMessage(
      m.chat,
      { text: usage(`${m.cmd} ping.js`) },
      { quoted: m }
    )
  }

  // FIX PATH TRAVERSAL: dulu path.join(pluginDir, text.trim()) doang, gak
  // ada validasi — "../../config.js" bisa kabur dari folder plugins/ dan
  // baca file APAPUN di server. Sekarang dipastiin hasilnya tetep di
  // dalem plugins/ (lihat lib/safePluginPath.js).
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
  
  const fil = await fs.readFileSync(filePath)

  await sock.sendMessage(
    m.chat,
    {
      caption: fil.toString(), 
      document: fil,
      mimetype: "application/javascript",
      fileName: text.trim()
    },
    { quoted: m }
  )
}

handler.tags = "owner"
handler.help = "getplugin"
handler.command = ["getplugin", "getp", "gp"]
handler.owner = true

module.exports = handler
