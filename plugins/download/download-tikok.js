// API TikTok diganti ke tikwm.com — endpoint xemoz buat tiktok sekarang minta bayar
// ("Payment required"), sedangkan tikwm.com API publik yang udah lama dipakai luas di
// komunitas developer (banyak proyek independen pakai struktur respons yang sama persis).
const axios = require("axios")
const { downloadAndReencodeVideo } = require("../../lib/videoReencode")
const { footer } = require("../../lib/theme")

let handler = async (m, { sock, text }) => {
  if (!text || !text.includes("tiktok.com")) return m.reply(`*example:*\n${m.cmd} https://vt.tiktok.com/xxx`)

  await m.reply("⏳ Diproses dulu ya...")

  try {
    // FIX 403: tikwm.com nolak request yang gak keliatan kayak dari browser
    // (gak ada User-Agent/Referer), jadi baliknya HTTP 403 body kosong.
    // Tambahin header ini biar keliatan legit.
    const resApi = await axios.get(`https://www.tikwm.com/api/?url=${encodeURIComponent(text.trim())}`, {
      validateStatus: () => true,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Referer": "https://www.tikwm.com/",
      },
    })
    const resData = resApi.data
    console.log(`[TIKTOK DEBUG] status: ${resApi.status}, data:`, JSON.stringify(resData)?.slice(0, 500))

    if (resApi.status !== 200) {
      return m.reply(`Gagal mengambil data dari API TikTok (HTTP ${resApi.status}). Detail ada di log server.`)
    }

    // TikWM sukses ditandain code === 0 (BUKAN status:true / HTTP 200 doang)
    if (resData?.code !== 0 || !resData?.data) {
      console.error("[TIKTOK GAGAL] Respons gak sukses:", JSON.stringify(resData)?.slice(0, 500))
      return m.reply(`Gagal mengambil data dari API TikTok: ${resData?.msg || "alasan tidak diketahui"}. Detail ada di log server.`)
    }

    const d = resData.data
    const caption = d.title || ""

    // FIX BUG: post TikTok yang isinya slide/foto (bukan video) tetep punya field
    // play/hdplay dari tikwm, tapi itu cuma slideshow "kosong" (video item foto yang
    // di-render jadi klip gelap + audio doang) — bukan foto aslinya. Foto asli ada di
    // field `images` (array URL). Makanya harus dicek DULUAN sebelum jatoh ke jalur
    // video, kalau enggak bakal selalu ke-render sebagai video gelap kayak yang dialami.
    const images = Array.isArray(d.images) ? d.images : []

    if (images.length > 0) {
      await m.reply(`📸 Post ini slide foto (${images.length} gambar), diproses...`)

      for (let i = 0; i < images.length; i++) {
        try {
          const imgRes = await axios.get(images[i], { responseType: "arraybuffer" })
          await sock.sendMessage(m.chat, {
            image: Buffer.from(imgRes.data),
            caption: i === 0 ? caption : undefined,
          }, { quoted: m })
        } catch (e) {
          console.error(`[TIKTOK SLIDE GAGAL] gambar ke-${i + 1}:`, e.message)
        }
      }

      // Slide TikTok biasanya ada musik latar, dikirim juga biar lengkap
      if (d.music) {
        try {
          const audioRes = await axios.get(d.music, { responseType: "arraybuffer" })
          await sock.sendMessage(m.chat, { audio: Buffer.from(audioRes.data), mimetype: "audio/mpeg" }, { quoted: m })
        } catch (e) {
          console.error("[TIKTOK SLIDE MUSIC GAGAL]", e.message)
        }
      }

      return
    }

    // hdplay (HD no-watermark) diprioritasin, fallback ke play (no-watermark biasa)
    const videoUrl = d.hdplay || d.play || d.wmplay

    if (!videoUrl) {
      console.error("[TIKTOK GAGAL] Field video URL gak ketemu di respons:", JSON.stringify(resData)?.slice(0, 500))
      return m.reply("Gagal menemukan link video dari respons API. Detail ada di log server.")
    }

    // FIX BUG: kirim langsung dari URL CDN kadang gagal diputer di WA ("Video ini tidak
    // tersedia karena ada masalah dengan file video") karena format/moov atom-nya gak
    // streaming-ready. Sekarang di-download + re-encode dulu biar dijamin kompatibel.
    const { buffer, duration } = await downloadAndReencodeVideo(videoUrl, "tiktok")
    await sock.sendMessage(m.chat, { video: buffer, caption: (duration ? `${caption}\n⏱ Durasi: ${duration}` : caption) + footer() }, { quoted: m })

    // Kirim MP3-nya juga (audio asli/backsound dari post video-nya)
    if (d.music) {
      try {
        const audioRes = await axios.get(d.music, { responseType: "arraybuffer" })
        await sock.sendMessage(m.chat, {
          audio: Buffer.from(audioRes.data),
          mimetype: "audio/mpeg",
          fileName: `${(d.music_info?.title || caption || "tiktok-audio").slice(0, 60)}.mp3`,
        }, { quoted: m })
      } catch (e) {
        console.error("[TIKTOK AUDIO GAGAL]", e.message)
      }
    }
  } catch (err) {
    console.error("[TIKTOK GAGAL]", err?.response?.status, err?.message)
    m.reply("Terjadi error saat memproses video TikTok: " + err.message)
  }
}

handler.tags = ["Download"]
handler.help = "tiktok"
handler.command = ["tiktok", "ttdl", "tt"]

module.exports = handler
