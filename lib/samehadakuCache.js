// lib/samehadakuCache.js — cache sementara per-user buat nyambungin alur
// .samesearch/.samelist -> .samedetail -> .samestream TANPA user perlu
// copas URL panjang (https://v2.samehadaku.how/...) manual. User tinggal
// ketik NOMOR urut dari hasil sebelumnya.
const TTL_MS = 15 * 60 * 1000; // 15 menit

if (!global.samehadakuCache) global.samehadakuCache = new Map();

function setCache(sender, items) {
  global.samehadakuCache.set(sender, { items, timestamp: Date.now() });
}

function getCache(sender) {
  const entry = global.samehadakuCache.get(sender);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > TTL_MS) {
    global.samehadakuCache.delete(sender);
    return null;
  }
  return entry.items;
}

// Input dari user (args[0]) bisa berupa:
// - nomor urut (ngerujuk ke cache hasil command sebelumnya)
// - URL https://v2.samehadaku.how/... langsung (buat yang udah tau/nyimpen sendiri)
// Balikin { url, label } atau null kalau gak valid/gak ketemu.
function resolveRef(sender, ref) {
  const trimmed = (ref || "").trim();
  if (!trimmed) return null;

  if (/^https?:\/\//i.test(trimmed)) {
    return { url: trimmed, label: trimmed };
  }

  const n = parseInt(trimmed, 10);
  if (!Number.isInteger(n) || n < 1) return null;

  const items = getCache(sender);
  if (!items || !items[n - 1]) return null;
  return items[n - 1];
}

module.exports = { setCache, getCache, resolveRef, TTL_MS };
