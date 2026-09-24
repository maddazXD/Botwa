const { fail } = require("../../lib/theme")

let handler = async (m, { sock }) => {
if (!m.quoted) return m.reply(fail("Reply pesan dulu ya!"))
if (!m.quoted?.fakeObj?.message) return m.reply(fail("Code tidak ditemukan"))
const quo = JSON.stringify(m.quoted.fakeObj.message, null, 2)
return m.reply(quo)
}

handler.admin = true;
handler.tags = "admin"
handler.help = "q"
handler.command = ["ambilq", "q", "msg"]

module.exports = handler
