const fs = require("fs");
const path = require("path");

// ═══════════════════════════════════════════

const DB_PATH = path.join(process.cwd(), "database", "db.json");

class Database {
  constructor() {
    this.path = DB_PATH;
    this._data = null;
    this._lastWritten = null; // string JSON terakhir yang berhasil ditulis
    this._writing = false; // cegah dua write() tumpang tindih bersamaan
  }

  get defaultData() {
    return {
      users: {},
      groups: {},
      chats: {},
      settings: {
        totalhit: 0,
        owner: [],
        banned: [],
        namaSaveContact: "Buyer",
        jedaPushkontak: 4000,
        bljpm: [],
        antiCall: false,
      },
    };
  }

  async read() {
    try {
      if (!fs.existsSync(path.dirname(this.path))) {
        fs.mkdirSync(path.dirname(this.path), { recursive: true });
      }
      if (!fs.existsSync(this.path)) {
        await this.write(this.defaultData);
        return this.defaultData;
      }
      // readFileSync di sini AMAN (bukan bug) — cuma jalan SEKALI pas startup,
      // sebelum bot mulai nerima pesan, jadi gak ada yang keblokir.
      const raw = fs.readFileSync(this.path, "utf-8");
      return JSON.parse(raw);
    } catch {
      return this.defaultData;
    }
  }

  // FIX PERFORMA: sebelumnya pakai fs.writeFileSync (SYNCHRONOUS) dipanggil
  // tiap 5 detik lewat setInterval (lihat index.js) — karena Node.js
  // single-thread, nulis file besar secara sync itu ngeBLOK SELURUH proses
  // bot (gak bisa balesin pesan masuk sama sekali) sampe tulisannya kelar,
  // berulang tiap 5 detik selama bot nyala. Sekarang:
  // 1. Pakai fs.promises.writeFile (ASYNC) — gak ngeblok event loop, bot
  //    tetep responsif proses pesan lain sambil nulis jalan di background.
  // 2. Skip nulis kalau isinya PERSIS SAMA kayak terakhir ditulis (dicek pake
  //    perbandingan string) — kalau gak ada perubahan data sejak 5 detik
  //    lalu, ngapain nulis ulang, buang-buang I/O disk.
  // 3. JSON.stringify TANPA pretty-print (spasi indent) — file lebih kecil,
  //    proses serialize/tulis lebih cepet. (Kalau butuh baca manual buat
  //    debug, tinggal format ulang pakai `jq` atau semacamnya di server.)
  async write(data) {
    if (this._writing) return; // udah ada write lain jalan, skip round ini
    const json = JSON.stringify(data);
    if (json === this._lastWritten) return; // gak ada perubahan, skip

    this._writing = true;
    try {
      if (!fs.existsSync(path.dirname(this.path))) {
        fs.mkdirSync(path.dirname(this.path), { recursive: true });
      }
      await fs.promises.writeFile(this.path, json);
      this._lastWritten = json;
    } catch (e) {
      console.error("DB write error:", e);
    } finally {
      this._writing = false;
    }
  }
}

module.exports = Database;
