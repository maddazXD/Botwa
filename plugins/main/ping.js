// plugins/ping.js — MaddazXD V2
const { performance } = require("perf_hooks");
const os = require("os");
const fs = require("fs");
const path = require("path");
const v8 = require("v8");
const { header, card, footer } = require("../../lib/theme");

const BAILEYS_PKG = "@itsliaaa/baileys";

// Ukur CPU usage % BENERAN (bukan cuma load average) — ambil snapshot times tiap core,
// tunggu sebentar, ambil snapshot lagi, hitung delta idle vs total. Ini teknik standar
// buat ngukur CPU usage instan di Node.js karena os.cpus() gak nyediain % langsung.
function snapshotCpuTimes() {
  return os.cpus().map((c) => ({ ...c.times, total: Object.values(c.times).reduce((a, b) => a + b, 0) }));
}
function cpuUsagePercent(before, after) {
  const perCore = before.map((b, i) => {
    const a = after[i];
    const totalDiff = a.total - b.total;
    const idleDiff = a.idle - b.idle;
    return totalDiff > 0 ? (100 - (100 * idleDiff) / totalDiff) : 0;
  });
  const avg = perCore.reduce((a, b) => a + b, 0) / (perCore.length || 1);
  return { avg: avg.toFixed(1), perCore: perCore.map((n) => n.toFixed(0)) };
}

// Sisa disk di partisi tempat bot jalan. fs.statfsSync baru ada di Node 18.15+ / 20+,
// dibungkus try/catch karena statusnya masih relatif baru (bisa gak ada di semua host).
function getDiskInfo() {
  try {
    const s = fs.statfsSync(process.cwd());
    const total = s.blocks * s.bsize;
    const free = s.bfree * s.bsize;
    return {
      total: (total / 1024 / 1024 / 1024).toFixed(2),
      free: (free / 1024 / 1024 / 1024).toFixed(2),
      used: ((total - free) / 1024 / 1024 / 1024).toFixed(2),
    };
  } catch {
    return null;
  }
}
// Baca /proc/meminfo langsung (Linux doang) buat dapetin MemAvailable — ini angka yang
// LEBIH AKURAT dibanding os.freemem(), karena os.freemem() di Linux cuma laporan MemFree
// (RAM yang bener-bener nganggur), padahal sebagian besar "RAM kepake" itu buffer/cache
// yang sebenarnya bisa direclaim kapan aja. MemAvailable udah ngitung itu semua.
function getProcMeminfo() {
  try {
    const raw = fs.readFileSync("/proc/meminfo", "utf8");
    const get = (key) => {
      const m = raw.match(new RegExp(`^${key}:\\s+(\\d+)`, "m"));
      return m ? (parseInt(m[1]) / 1024 / 1024).toFixed(2) : null; // kB -> GB
    };
    return {
      memAvailable: get("MemAvailable"),
      buffers: get("Buffers"),
      cached: get("Cached"),
    };
  } catch {
    return null;
  }
}

// Interface jaringan aktif (non-internal). Ditampilin karena ini pemakaian PRIBADI,
// bukan bot publik — kalau nanti bot ini dipakai publik, sebaiknya bagian ini dicabut
// biar IP internal server gak kelihatan orang lain.
function getNetworkInfo() {
  const nets = os.networkInterfaces();
  const result = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (!net.internal && net.family === "IPv4") result.push(`${name}: ${net.address}`);
    }
  }
  return result;
}

// Ambil versi baileys yang BENERAN ke-install (bukan dari package.json yang isinya cuma
// "latest" — itu bukan versi asli, cuma pointer). Baca package.json di node_modules
// langsung biar akurat sesuai yang jalan sekarang.
function getInstalledVersion(pkgName) {
  try {
    return require(`${pkgName}/package.json`).version;
  } catch {
    return "?";
  }
}

function fmtMB(bytes) {
  return (bytes / 1024 / 1024).toFixed(1);
}

// Ukuran folder database (rekursif) — buat liat storage yang beneran dipake bot,
// bukan cuma RAM doang. Sync tapi cepat karena file databasenya kecil (JSON).
function getFolderSize(dir) {
  let total = 0;
  try {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) total += getFolderSize(p);
      else if (entry.isFile()) total += fs.statSync(p).size;
    }
  } catch {}
  return total;
}

let handler = async (m, { sock }) => {
  const cpuBefore = snapshotCpuTimes();
  const t0 = performance.now();
  const msg = await sock.sendMessage(m.chat, { text: "⏳ *Pinging...*" }, { quoted: m });
  const t1 = performance.now();
  const latency = (t1 - t0).toFixed(2);
  // Delay 300ms yang dulu ada di sini DIHAPUS (cuma kosmetik buat majangin angka
  // CPU% biar keliatan lebih stabil, gak ngaruh ke fungsi lain) — sekarang CPU%
  // diambil langsung tanpa nunggu. Konsekuensinya: window sampling CPU jadi lebih
  // pendek (cuma seukuran round-trip network di atas), jadi angka CPU%-nya bisa
  // keliatan lebih goyang/kekecilan dibanding sebelumnya. Kalau nanti kebaca kurang
  // akurat, itu trade-off yang emang sengaja diambil demi respons instan.
  const cpuAfter = snapshotCpuTimes();
  const cpuUsage = cpuUsagePercent(cpuBefore, cpuAfter);

  // ── Memori proses BOT ini sendiri (akurat — bukan RAM total server/host) ──
  const mem = process.memoryUsage();
  const rss = fmtMB(mem.rss);
  const heapUsed = fmtMB(mem.heapUsed);
  const heapTotal = fmtMB(mem.heapTotal);
  const external = fmtMB(mem.external);
  const arrayBuffers = fmtMB(mem.arrayBuffers || 0);

  // ── CPU & sistem host, detail penuh ──
  const cpus = os.cpus() || [];
  const cpuModel = cpus[0]?.model?.trim() || "?";
  const cpuSpeed = cpus[0]?.speed ? `${cpus[0].speed} MHz` : "?";
  const loadAvg = os.loadavg ? os.loadavg().map((n) => n.toFixed(2)).join(" / ") : "n/a";
  const sysTotalBytes = os.totalmem();
  const sysFreeBytes = os.freemem();
  const sysTotal = (sysTotalBytes / 1024 / 1024 / 1024).toFixed(2);
  const sysUsed = ((sysTotalBytes - sysFreeBytes) / 1024 / 1024 / 1024).toFixed(2);

  // ── Resource usage detail proses (CPU time asli yang dipakai bot, bukan estimasi) ──
  const ru = process.resourceUsage ? process.resourceUsage() : null;
  const userCpuMs = ru ? (ru.userCPUTime / 1000).toFixed(0) : "?";
  const sysCpuMs = ru ? (ru.systemCPUTime / 1000).toFixed(0) : "?";
  const maxRss = ru ? fmtMB(ru.maxRSS * 1024) : "?"; // maxRSS dari OS dilaporin dalam KB
  const majorFault = ru ? ru.majorPageFault : "?";
  const minorFault = ru ? ru.minorPageFault : "?";
  const ctxVoluntary = ru ? ru.voluntaryContextSwitches : "?";
  const ctxInvoluntary = ru ? ru.involuntaryContextSwitches : "?";

  // ── V8 heap detail (lapisan lebih dalam dari process.memoryUsage() biasa) ──
  const heapStats = v8.getHeapStatistics();
  const heapSizeLimit = fmtMB(heapStats.heap_size_limit);
  const mallocedMem = fmtMB(heapStats.malloced_memory);
  const nativeContexts = heapStats.number_of_native_contexts;
  const detachedContexts = heapStats.number_of_detached_contexts;

  const diskInfo = getDiskInfo();
  const meminfo = getProcMeminfo();
  const netInfo = getNetworkInfo();
  const hostUptime = global.runtime(os.uptime());

  // ── Info plugin & command (dihitung LIVE dari global.plugins yang beneran ke-load) ──
  const pluginFiles = Object.keys(global.plugins || {});
  let totalCommands = 0;
  for (const key of pluginFiles) {
    const h = global.plugins[key];
    if (h?.command) totalCommands += Array.isArray(h.command) ? h.command.length : 1;
  }

  const dbSize = fmtMB(getFolderSize(path.join(process.cwd(), "database")));
  const sessionSize = fmtMB(getFolderSize(path.join(process.cwd(), "session")));

  const nodeVer = process.version;
  const v8Ver = process.versions.v8;
  const baileysVer = getInstalledVersion(BAILEYS_PKG);
  const platform = `${os.platform()} ${os.arch()}`;
  const osRelease = os.release();
  const hostname = os.hostname();
  const botNumber = sock?.user?.id ? sock.user.id.split(":")[0].split("@")[0] : "-";
  const botPushName = sock?.user?.name || sock?.user?.verifiedName || "-";

  await sock.sendMessage(m.chat, {
    text:
      `${header("Server Info", "💻")}\n\n` +
      card("KONEKSI", [
        `⌬ Latency     : *${latency} ms*`,
        `⌬ Status      : *Online ✅*`,
        `⌬ Nomor Bot   : *${botNumber}*`,
        `⌬ Nama Device : *${botPushName}*`,
        `⌬ PID Proses  : *${process.pid}*`,
      ], "📡") + "\n\n" +
      card("RESOURCE BOT (proses ini)", [
        `⌬ RAM (RSS)   : *${rss} MB*`,
        `⌬ Heap Node   : *${heapUsed} / ${heapTotal} MB*`,
        `⌬ External    : *${external} MB* (+${arrayBuffers} MB buffer)`,
        `⌬ Peak RAM    : *${maxRss} MB*`,
        `⌬ CPU Time    : *${userCpuMs}ms user / ${sysCpuMs}ms sys*`,
        `⌬ Page Fault  : *${majorFault} major / ${minorFault} minor*`,
        `⌬ Ctx Switch  : *${ctxVoluntary} voluntary / ${ctxInvoluntary} involuntary*`,
        `⌬ Uptime      : *${global.runtime(process.uptime())}*`,
      ], "🧠") + "\n\n" +
      card("V8 HEAP DETAIL", [
        `⌬ Heap Limit  : *${heapSizeLimit} MB*`,
        `⌬ Malloced    : *${mallocedMem} MB*`,
        `⌬ Native Ctx  : *${nativeContexts}*`,
        `⌬ Detached Ctx: *${detachedContexts}*`,
      ], "♻️") + "\n\n" +
      card("CPU & HOST", [
        `⌬ CPU Model   : *${cpuModel}*`,
        `⌬ Clock Speed : *${cpuSpeed}*`,
        `⌬ CPU Cores   : *${cpus.length}*`,
        `⌬ CPU Usage   : *${cpuUsage.avg}%* _(per-core: ${cpuUsage.perCore.join("% / ")}%)_`,
        `⌬ Load Avg    : *${loadAvg}* _(1m/5m/15m)_`,
        `⌬ RAM Server  : *${sysUsed} / ${sysTotal} GB*${meminfo?.memAvailable ? ` _(tersedia sungguhan: ${meminfo.memAvailable} GB)_` : ""}`,
        `⌬ Platform    : *${platform}*`,
        `⌬ OS Release  : *${osRelease}*`,
        `⌬ Hostname    : *${hostname}*`,
        `⌬ Host Uptime : *${hostUptime}*`,
        ...(netInfo.length ? [`⌬ Network     : *${netInfo.join(", ")}*`] : []),
      ], "🖥️") + "\n\n" +
      card("STORAGE", [
        `⌬ Database    : *${dbSize} MB*`,
        `⌬ Session     : *${sessionSize} MB*`,
        ...(diskInfo ? [`⌬ Disk        : *${diskInfo.used} / ${diskInfo.total} GB* (sisa ${diskInfo.free} GB)`] : []),
      ], "💾") + "\n\n" +
      card("VERSI & PLUGIN", [
        `⌬ Node.js     : *${nodeVer}*`,
        `⌬ V8 Engine   : *${v8Ver}*`,
        `⌬ Library WA  : *${BAILEYS_PKG}@${baileysVer}*`,
        `⌬ Plugin File : *${pluginFiles.length}*`,
        `⌬ Total Cmd   : *${totalCommands}*`,
        `⌬ Prefix      : *${global.prefix}*`,
        `⌬ Bot         : *${global.botname}*`,
      ], "🧩") +
      `\n\n_RAM Proses = yang beneran dipakai bot. RAM Server = kapasitas host, bukan limit bot._` +
      footer(),
    edit: msg.key,
  });

  await m.react("✅");
};

handler.command = ["ping", "speed", "p"];
handler.tags = ["main"];
handler.help = ["ping"];
module.exports = handler;
