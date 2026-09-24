const fs = require("fs")
const path = require("path")
const { header, card, footer } = require("../../lib/theme")

function scanPlugins(dir) {
  let results = []
  let files = fs.readdirSync(dir)

  for (let file of files) {
    let fullPath = path.join(dir, file)

    if (fs.lstatSync(fullPath).isDirectory()) {
      results = results.concat(scanPlugins(fullPath))
    } else if (file.endsWith(".js") || file.endsWith(".cjs")) {
      results.push(fullPath)
    }
  }

  return results
}

let handler = async (m, { sock, isOwner }) => {
  if (!isOwner) return

  let pluginDir = "./plugins"
  let plugins = scanPlugins(pluginDir)

  if (!plugins.length) {
    return sock.sendMessage(
      m.chat,
      { text: "❌ Tidak ada plugin ditemukan." },
      { quoted: m }
    )
  }

  let lines = plugins.map((p, i) => `${i + 1}. ${path.relative(pluginDir, p)}`)
  let text = `${header("Daftar Plugin", "🧩")}\n\n` + card(`TOTAL ${plugins.length} FILE`, lines, "📄") + footer()

  await sock.sendMessage(
    m.chat,
    { text },
    { quoted: m }
  )
}

handler.tags = "admin"
handler.help = "listplugin"
handler.command = ["listplugin", "listp"]
handler.admin = true;

module.exports = handler