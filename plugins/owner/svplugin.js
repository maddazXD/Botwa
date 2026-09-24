const fs = require("fs")
const { usage, ok, fail } = require("../../lib/theme")
const { resolveSafePluginPath } = require("../../lib/safePluginPath")

let handler = async (m, { sock, text }) => {

  if (!text || !m.quoted) {
    return m.reply(usage(`${m.cmd} namafile.js`, `Reply code atau file .js, terus ketik ${m.cmd} namafile.js`))
  }

  let filename = text.trim()
  if (!filename.endsWith(".js") && !filename.endsWith(".cjs")) {
    return sock.sendMessage(
      m.chat,
      { text: fail("Format file wajib .js atau .cjs") },
      { quoted: m }
    )
  }

  // FIX PATH TRAVERSAL (paling berbahaya dari 3 command ini karena ini
  // WRITE): dulu "../../index.js" bisa NIMPA file APAPUN yang berakhiran
  // .js/.cjs di server, bukan cuma di folder plugins/ — lihat
  // lib/safePluginPath.js.
  const filePath = resolveSafePluginPath(filename)
  if (!filePath) {
    return sock.sendMessage(
      m.chat,
      { text: fail("Nama file gak valid (gak boleh ada '../' buat keluar dari folder plugins).") },
      { quoted: m }
    )
  }

  if (m.quoted || m) {
    let downloader = m?.quoted?.text || m?.quoted?.download() || m?.download() || null
    if (!downloader) return m.reply(usage(`${m.cmd} namafile.js`, `Reply code atau file .js, terus ketik ${m.cmd} namafile.js`))
    let buffer = downloader

    fs.writeFileSync(filePath, buffer)
    await sock.sendMessage(
      m.chat,
      { text: ok(`Plugin *${filename}* berhasil disimpan`) },
      { quoted: m }
    )
    return
  }

  if (!m.quoted || !m.quoted.text) {
    return sock.sendMessage(
      m.chat,
      { text: fail("Reply pesan kode plugin atau kirim file plugin.") },
      { quoted: m }
    )
  }

  fs.writeFileSync(filePath, m.quoted.text)
  await sock.sendMessage(
    m.chat,
    { text: ok(`Plugin ${filename} berhasil disimpan`) },
    { quoted: m }
  )
}

handler.tags = "owner"
handler.help = "saveplugin"
handler.command = ["saveplugin", "sp", "sv", "svp"]
handler.owner = true

module.exports = handler
