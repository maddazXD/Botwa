// plugins/tools/cuaca.js — cek cuaca kota pakai Open-Meteo (API publik resmi, gratis
// unlimited, gak butuh API key). Gambar headernya diusahain pake FOTO ASLI kotanya
// (diambil dari Wikipedia lewat lib/cityImage.js, biar identik sama kota yang dicari);
// kalau gak ketemu foto yang layak, fallback ke kartu gradient generik yang di-generate
// sendiri pakai ffmpeg (nyesuain kondisi cuaca + siang/malam). Ada juga tombol buat buka
// lokasinya langsung di Google Maps.
const fs = require("fs");
const os = require("os");
const path = require("path");
const axios = require("axios");
const { exec } = require("child_process");
const { promisify } = require("util");
const execAsync = promisify(exec);
const { geocodeCity } = require("../../lib/geocode");
const { getCityImageBuffer } = require("../../lib/cityImage");
const { getMemeFont } = require("../../lib/memeText");
const { sendInteractiveCard } = require("../../lib/interactiveMessage");
const { usage, card, fail } = require("../../lib/theme");

// Kode cuaca WMO -> deskripsi + grup (grup dipake buat milih warna gradient header)
const WEATHER_CODES = {
  0: ["Cerah", "☀️", "clear"], 1: ["Cerah berawan sebagian", "🌤️", "partly"], 2: ["Berawan sebagian", "⛅", "partly"], 3: ["Mendung", "☁️", "cloudy"],
  45: ["Berkabut", "🌫️", "cloudy"], 48: ["Kabut es", "🌫️", "cloudy"],
  51: ["Gerimis ringan", "🌦️", "rain"], 53: ["Gerimis sedang", "🌦️", "rain"], 55: ["Gerimis lebat", "🌧️", "rain"],
  61: ["Hujan ringan", "🌧️", "rain"], 63: ["Hujan sedang", "🌧️", "rain"], 65: ["Hujan lebat", "🌧️", "rain"],
  71: ["Salju ringan", "🌨️", "rain"], 73: ["Salju sedang", "🌨️", "rain"], 75: ["Salju lebat", "🌨️", "rain"],
  80: ["Hujan lokal ringan", "🌦️", "rain"], 81: ["Hujan lokal sedang", "🌧️", "rain"], 82: ["Hujan lokal lebat", "⛈️", "storm"],
  95: ["Badai petir", "⛈️", "storm"], 96: ["Badai petir + hujan es ringan", "⛈️", "storm"], 99: ["Badai petir + hujan es lebat", "⛈️", "storm"],
};

// Gradient (atas -> bawah) per grup cuaca, versi siang & malam masing-masing.
const GRADIENTS = {
  clear:   { day: ["0x2b6cb0", "0xffd27f"], night: ["0x0f2027", "0x2c5364"] },
  partly:  { day: ["0x4a6fa5", "0xd7e3ef"], night: ["0x232526", "0x414345"] },
  cloudy:  { day: ["0x5b6b73", "0x9aa5ab"], night: ["0x141e30", "0x243b55"] },
  rain:    { day: ["0x2c3e50", "0x57708a"], night: ["0x0f0c29", "0x302b63"] },
  storm:   { day: ["0x232526", "0x4a3f6b"], night: ["0x000000", "0x2c003e"] },
};

const COMPASS = ["U", "TL", "T", "TG", "S", "BD", "B", "BL"];
function degToCompass(deg) {
  return COMPASS[Math.round(((deg % 360) / 45)) % 8];
}

function uvLabel(uv) {
  if (uv >= 11) return "Ekstrem";
  if (uv >= 8) return "Sangat Tinggi";
  if (uv >= 6) return "Tinggi";
  if (uv >= 3) return "Sedang";
  return "Rendah";
}

function cloudLabel(pct) {
  if (pct < 20) return "Cerah";
  if (pct < 50) return "Cerah Berawan";
  if (pct < 80) return "Berawan";
  return "Mendung";
}

// current.time & daily.sunrise/sunset dari Open-Meteo semuanya dalam format
// "YYYY-MM-DDTHH:MM" dan udah di-adjust ke timezone yang diminta (bukan UTC),
// jadi cukup dibandingin sebagai string aja (format-nya fixed-width & sortable).
function isDaytime(nowStr, sunriseStr, sunsetStr) {
  return nowStr >= sunriseStr && nowStr < sunsetStr;
}

// Rapiin foto asli kota (dari Wikipedia, ukuran/rasio bisa macem-macem) jadi
// ukuran header yang konsisten (1280x720), di-crop tengah biar bagian penting
// fotonya (biasanya landmark-nya) gak kepotong aneh.
async function prepareCityPhoto(buffer) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cuaca_photo_"));
  const input = path.join(dir, "in");
  const output = path.join(dir, "out.jpg");
  fs.writeFileSync(input, buffer);
  try {
    await execAsync(
      `ffmpeg -y -hide_banner -loglevel error -i "${input}" -vf "scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720" -q:v 3 "${output}"`,
      { maxBuffer: 1024 * 1024 * 20 }
    );
    return fs.readFileSync(output);
  } finally {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
  }
}

async function generateWeatherCard({ cityLabel, tempC, condDesc, dateLabel, timeLabel, group, daytime }) {
  const fontFile = getMemeFont();
  const [top, bottom] = (GRADIENTS[group] || GRADIENTS.cloudy)[daytime ? "day" : "night"];

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cuaca_card_"));
  const cityFile = path.join(dir, "city.txt");
  const tempFile = path.join(dir, "temp.txt");
  const condFile = path.join(dir, "cond.txt");
  const dtFile = path.join(dir, "dt.txt");
  const output = path.join(dir, "card.jpg");

  fs.writeFileSync(cityFile, cityLabel.toUpperCase());
  fs.writeFileSync(tempFile, `${tempC.toFixed(1)}°C`);
  fs.writeFileSync(condFile, condDesc.toUpperCase());
  fs.writeFileSync(dtFile, `${dateLabel}  •  ${timeLabel}`);

  const ff = fontFile ? `fontfile='${fontFile}':` : "";
  const textFilter = [
    `drawtext=${ff}textfile='${cityFile}':fontcolor=white:fontsize=54:x=(w-text_w)/2:y=90:shadowcolor=black@0.5:shadowx=2:shadowy=2`,
    `drawtext=${ff}textfile='${tempFile}':fontcolor=white:fontsize=170:x=(w-text_w)/2:y=250:shadowcolor=black@0.5:shadowx=4:shadowy=4`,
    `drawtext=${ff}textfile='${condFile}':fontcolor=white:fontsize=48:x=(w-text_w)/2:y=460:shadowcolor=black@0.5:shadowx=2:shadowy=2`,
    `drawtext=${ff}textfile='${dtFile}':fontcolor=white@0.85:fontsize=30:x=(w-text_w)/2:y=630:shadowcolor=black@0.5:shadowx=1:shadowy=1`,
  ].join(",");

  try {
    // "gradients" itu filter SOURCE (ngasilin frame sendiri, gak butuh input gambar
    // lain), jadi dia harus jadi input (-f lavfi -i "gradients=...") — BUKAN
    // dicampur ke dalam chain -vf bareng input lain (itu bikin ffmpeg bingung
    // "punya 0 input tapi diharepin 1 input").drawtext-drawtext overlay teksnya baru
    // masuk lewat -vf setelahnya.
    await execAsync(
      `ffmpeg -y -hide_banner -loglevel error -f lavfi -i "gradients=s=1280x720:c0=${top}:c1=${bottom}:x0=0:y0=0:x1=0:y1=720" -vf "${textFilter}" -frames:v 1 -q:v 2 "${output}"`,
      { maxBuffer: 1024 * 1024 * 20 }
    );
    return fs.readFileSync(output);
  } finally {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
  }
}

let handler = async (m, { sock, text, prefix, command }) => {
  const city = text?.trim();
  if (!city) return m.reply(usage(`${prefix}${command} <nama kota>`, `${prefix}${command} Jakarta`));

  try {
    const loc = await geocodeCity(city);
    if (!loc) return m.reply(fail(`Kota "${city}" gak ketemu, coba nama lain/lebih spesifik.`));

    const res = await axios.get("https://api.open-meteo.com/v1/forecast", {
      params: {
        latitude: loc.latitude,
        longitude: loc.longitude,
        current: [
          "temperature_2m", "relative_humidity_2m", "apparent_temperature",
          "weather_code", "wind_speed_10m", "wind_direction_10m",
          "surface_pressure", "cloud_cover", "precipitation",
        ].join(","),
        daily: ["temperature_2m_max", "temperature_2m_min", "uv_index_max", "sunrise", "sunset"].join(","),
        timezone: loc.timezone,
      },
      timeout: 10000,
    });

    const c = res.data.current;
    const d = res.data.daily;
    const [desc, emoji, group] = WEATHER_CODES[c.weather_code] || ["Tidak diketahui", "🌡️", "cloudy"];
    const lokasiLabel = [loc.name, loc.admin1, loc.country].filter(Boolean).join(", ");

    const sunrise = (d.sunrise?.[0] || "").slice(11, 16);
    const sunset = (d.sunset?.[0] || "").slice(11, 16);
    const waktuNow = (c.time || "").slice(11, 16);
    const daytime = isDaytime(c.time, d.sunrise?.[0] || "", d.sunset?.[0] || "");

    const now = new Date();
    const dateLabel = now.toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" });

    const mapsUrl = `https://www.google.com/maps?q=${loc.latitude},${loc.longitude}`;

    const lines = [
      `☀️ *Kondisi:* ${emoji} ${desc}`,
      `📍 *Lokasi:* ${lokasiLabel}`,
      `🕐 *Waktu:* ${waktuNow} (${loc.timezone})`,
      "",
      `🌡️ *Suhu:* ${c.temperature_2m}°C (terasa ${c.apparent_temperature}°C)`,
      `📈 *Maks:* ${d.temperature_2m_max?.[0]}°C  |  📉 *Min:* ${d.temperature_2m_min?.[0]}°C`,
      "",
      `💧 *Kelembapan:* ${c.relative_humidity_2m}%`,
      `💨 *Angin:* ${c.wind_speed_10m} km/jam arah ${degToCompass(c.wind_direction_10m)}`,
      `🇬 *Tekanan:* ${c.surface_pressure} hPa`,
      `☁️ *Awan:* ${c.cloud_cover}% (${cloudLabel(c.cloud_cover)})`,
      `☔ *Curah Hujan:* ${c.precipitation} mm`,
      `🔆 *UV Indeks:* ${d.uv_index_max?.[0]} (${uvLabel(d.uv_index_max?.[0] || 0)})`,
      "",
      `🌅 *Matahari Terbit:* ${sunrise}`,
      `🌇 *Matahari Terbenam:* ${sunset}`,
      "",
      `🔗 ${mapsUrl}`,
      `📡 _Sumber: Open-Meteo & OpenStreetMap_`,
    ];

    const bodyText = `☀️ *LAPORAN CUACA*\n\n${lines.join("\n")}`;

    let imageBuffer = null;
    // 1) COBA dulu foto ASLI kotanya dari Wikipedia (landmark/skyline beneran).
    try {
      const rawPhoto = await getCityImageBuffer(loc.name, loc.admin1, loc.country, loc.latitude, loc.longitude);
      if (rawPhoto) imageBuffer = await prepareCityPhoto(rawPhoto);
    } catch (e) {
      console.error("[CUACA] gagal ambil/olah foto kota:", e?.message || e);
    }
    // 2) Kalau gak ketemu foto aslinya (kota kurang terkenal / gak ada artikel
    //    Wikipedia dengan foto yang layak), fallback ke kartu gradient generik
    //    yang di-generate sendiri, biar tetep ada gambar & infonya kebaca.
    if (!imageBuffer) {
      try {
        imageBuffer = await generateWeatherCard({
          cityLabel: loc.name,
          tempC: c.temperature_2m,
          condDesc: desc,
          dateLabel,
          timeLabel: `${waktuNow} ${loc.timezone.split("/").pop()}`,
          group,
          daytime,
        });
      } catch (e) {
        console.error("[CUACA] gagal generate gambar header:", e?.message || e);
      }
    }

    const buttons = [
      {
        name: "cta_url",
        buttonParamsJson: JSON.stringify({
          display_text: "📍 Lihat Peta (Google Maps)",
          url: mapsUrl,
          merchant_url: mapsUrl,
        }),
      },
    ];

    const sent = await sendInteractiveCard(sock, m, {
      bodyText,
      footer: "Laporan Cuaca",
      imageBuffer,
      buttons,
    });

    // Fallback kalau device/versi WA si penerima gak dukung pesan interaktif
    // (nativeFlowMessage) — tetep kirim info lengkapnya, gambar + teks biasa.
    if (!sent) {
      if (imageBuffer) {
        await sock.sendMessage(m.chat, { image: imageBuffer, caption: bodyText }, { quoted: m });
      } else {
        m.reply(card(`Cuaca ${lokasiLabel}`, lines.filter(Boolean), "🌍"));
      }
    }
  } catch (err) {
    console.error("[CUACA GAGAL]", err?.message || err);
    m.reply(fail("Gagal mengambil data cuaca, coba lagi."));
  }
};

handler.command = ["cuaca", "weather"];
handler.help = ["cuaca <kota>"];
handler.tags = ["tools"];

module.exports = handler;
