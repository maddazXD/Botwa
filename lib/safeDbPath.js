// lib/safeDbPath.js — FIX PROTOTYPE POLLUTION (dipake plugins/owner/setdb.js
// & plugins/owner/deldb.js). _.set()/_.unset() lodash bisa ditipu nyemarin
// atau ngerusak Object.prototype SELURUH PROSES kalau path-nya ngandung
// "__proto__", "constructor", atau "prototype" — misal ".setdb
// __proto__.polluted true" atau ".deldb constructor.prototype.toString".
// Dicek per-SEGMENT pake _.toPath() (bukan cuma .includes() di string
// mentah, biar gak salah tangkep notasi bracket/titik yang beda-beda).
const _ = require("lodash");

const FORBIDDEN_SEGMENTS = ["__proto__", "constructor", "prototype"];

// Balikin true kalau path AMAN dipake (gak ngandung segment terlarang).
function isPathSafe(pathStr) {
  const segments = _.toPath(pathStr);
  return !segments.some((seg) => FORBIDDEN_SEGMENTS.includes(seg));
}

module.exports = { isPathSafe, FORBIDDEN_SEGMENTS };
