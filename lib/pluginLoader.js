const fs = require("fs")
const path = require("path")
const chalk = require("chalk")

const pluginFolder = path.join(__dirname, "../plugins")
const libFolder = path.join(__dirname, "../lib")

// FIX: require.cache di Node itu per-absolute-path, bukan cuma buat file
// plugin. Sebelumnya hot-reload cuma delete cache punya FILE PLUGIN itu
// sendiri — file di lib/ (helper yang dipakai bareng-bareng banyak plugin,
// misal nexrayClient.js) gak pernah ke-invalidate. Akibatnya kalau lib/
// diupdate (nambah fungsi baru dll) sementara bot masih jalan dari sebelum
// update, plugin yang baru di-reload tetep dapet versi LAMA dari lib/ itu
// (yang udah kepalang ke-cache dari load pertama), padahal isi filenya di
// disk udah bener — jadi error semacam "xxx is not a function" walau
// kodenya udah "seharusnya" ada. Sekarang tiap kali ada plugin yang
// direload, seluruh cache di bawah lib/ ikut dibersihin juga.
function clearLibCache() {
  for (const modPath of Object.keys(require.cache)) {
    if (modPath.startsWith(libFolder)) delete require.cache[modPath]
  }
}

function getAllPlugins(dir) {
  let results = []
  const list = fs.readdirSync(dir)

  for (let file of list) {
    const fullPath = path.join(dir, file)

    if (fs.existsSync(fullPath) && fs.lstatSync(fullPath).isDirectory()) {
      results = results.concat(getAllPlugins(fullPath))
    } else if (file.endsWith(".js") || file.endsWith(".cjs")) {
      results.push(fullPath)
    }
  }

  return results
}

function loadPlugins() {
  let plugins = {}
  const files = getAllPlugins(pluginFolder)
  // FIX: sebelumnya gak ada pengecekan tabrakan nama command sama sekali.
  // Kalau 2 file plugin beda kebetulan daftar command yang sama (typo
  // copy-paste, alias yang gak sengaja overlap, dll), handler.js bakal
  // MENJALANKAN KEDUANYA buat 1 command yang sama — persis gejala "jalanin
  // 2 perintah sekaligus" yang bikin fitur berasa bentrok. Sekarang setiap
  // command dicatet siapa "pemilik" pertamanya; kalau ada plugin lain yang
  // coba daftar command yang sama, langsung diwarning KERAS di console pas
  // startup — biar ketauan dari awal, bukan nebak-nebak dari gejala di WA.
  const commandOwner = {}

  for (let filePath of files) {
    try {
      if (!fs.existsSync(filePath)) continue

      delete require.cache[require.resolve(filePath)]

      const pluginName = path.relative(pluginFolder, filePath)

      plugins[pluginName] = require(filePath)

      const cmds = plugins[pluginName]?.command
        ? (Array.isArray(plugins[pluginName].command) ? plugins[pluginName].command : [plugins[pluginName].command])
        : []
      for (const c of cmds) {
        if (commandOwner[c] && commandOwner[c] !== pluginName) {
          console.log(
            chalk.bgRed.white(" TABRAKAN COMMAND! "),
            chalk.red(`"${c}" dipakai di DUA plugin sekaligus: "${commandOwner[c]}" dan "${pluginName}". `) +
            chalk.red(`Cuma "${commandOwner[c]}" yang bakal kepanggil (plugin yang di-load duluan) — plugin yang satunya SILENT gak pernah jalan sampai ini dibenerin.`)
          )
        } else {
          commandOwner[c] = pluginName
        }
      }

      console.log(chalk.greenBright("Plugin Loaded:"), pluginName)
    } catch (e) {
      console.log(chalk.redBright("Plugin Error:"), filePath)
      console.log(e)
    }
  }

  return plugins
}

let debounce = {}

function watchPlugins(dir) {
  fs.watch(dir, (eventType, filename) => {
    if (!filename) return

    if (!filename.endsWith(".js") && !filename.endsWith(".cjs")) return

    const fullPath = path.join(dir, filename)
    const pluginName = path.relative(pluginFolder, fullPath)

    if (debounce[fullPath]) clearTimeout(debounce[fullPath])

    debounce[fullPath] = setTimeout(() => {
      if (!fs.existsSync(fullPath)) {
        console.log(chalk.redBright(`Plugin Deleted: ${pluginName}`))

        try {
          delete require.cache[require.resolve(fullPath)]
        } catch {}

        delete global.plugins[pluginName]
        return
      }

      console.log(chalk.yellowBright(`Plugin Updated: ${pluginName}`))

      try {
        delete require.cache[require.resolve(fullPath)]
        clearLibCache()

        global.plugins[pluginName] = require(fullPath)

        console.log(chalk.greenBright(`Plugin Reloaded: ${pluginName}`))
      } catch (err) {
        console.log(chalk.redBright(`Error Reload Plugin: ${pluginName}`))
        console.log(err)
      }
    }, 200)
  })

  fs.readdirSync(dir).forEach((file) => {
    const full = path.join(dir, file)

    if (fs.existsSync(full) && fs.lstatSync(full).isDirectory()) {
      watchPlugins(full)
    }
  })
}

module.exports = { loadPlugins, watchPlugins }