// lib/didYouMean.js — Cari command terdaftar yang paling MIRIP sama command
// yang diketik user (buat fitur "did you mean" pas command-nya typo/gak
// ketemu). Dipakai dari handler.js, BUKAN dipanggil sebagai command sendiri
// — ini jalan otomatis di belakang layar.

// Levenshtein distance klasik: jumlah minimum edit (tambah/hapus/ganti 1
// karakter) buat ngubah string `a` jadi `b`. Makin kecil = makin mirip.
function levenshtein(a, b) {
  const dp = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) dp[i][0] = i;
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[a.length][b.length];
}

// Kumpulin SEMUA nama command yang terdaftar (termasuk semua alias) dari
// seluruh plugin yang di-load.
function collectAllCommands(plugins) {
  const all = new Set();
  for (const name in plugins) {
    const plugin = plugins[name];
    if (!plugin?.command) continue;
    const cmds = Array.isArray(plugin.command) ? plugin.command : [plugin.command];
    for (const c of cmds) if (c) all.add(String(c).toLowerCase());
  }
  return all;
}

// Cari command terdaftar paling mirip sama `typed` (nama command TANPA
// prefix, udah lowercase). Balikin null kalau gak ada command lain yang
// cukup mirip (threshold: jarak edit maksimal setengah panjang kata yang
// diketik, minimal toleransi 2) — biar gak nyaranin command yang jauh beda
// sama sekali cuma karena kebetulan agak mirip.
function findClosestCommand(typed, plugins) {
  if (!typed) return null;
  const allCommands = collectAllCommands(plugins);

  let best = null;
  let bestDist = Infinity;
  for (const cmd of allCommands) {
    const dist = levenshtein(typed, cmd);
    if (dist < bestDist) {
      bestDist = dist;
      best = cmd;
    }
  }

  if (best === null || bestDist === 0) return null;
  const threshold = Math.max(2, Math.ceil(typed.length / 2));
  if (bestDist > threshold) return null;
  return best;
}

module.exports = { levenshtein, findClosestCommand };
