# Setup di Berbagai Platform

Bot ini butuh 2 hal di semua environment:
1. **Node.js** versi 20 ke atas
2. **ffmpeg** (dipakai buat convert audio/video — TANPA ini fitur download/converter/sticker video gagal semua dengan error `ffmpeg: not found`)

Session login (`session/`) dan database (`database/db.json`) TIDAK ikut di-commit ke Git (lihat `.gitignore`) — jadi tiap kali pindah/deploy ke environment baru, kamu harus login ulang (scan QR/pairing code) dan mulai dari database kosong, KECUALI kamu copy manual folder `session/` dan file `database/db.json` dari environment lama.

---

## Termux (Android)

```bash
pkg update && pkg upgrade -y
pkg install nodejs-lts ffmpeg git -y

git clone https://github.com/maddazXD/Botwa.git
cd Botwa
npm install
npm start
```

Kalau `npm install` error karena butuh Python/build tools buat native module:
```bash
pkg install python make clang -y
```

---

## VPS (Ubuntu/Debian)

```bash
# Install Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash -
sudo apt install -y nodejs ffmpeg git

git clone https://github.com/maddazXD/Botwa.git
cd Botwa
npm install

# Jalankan permanen (auto-restart kalau crash, tetap hidup walau SSH ditutup)
sudo npm install -g pm2
pm2 start index.js --name botwa
pm2 save
pm2 startup   # ikuti instruksi yang muncul biar auto-start pas VPS reboot
```

Cek log: `pm2 logs botwa`

---

## Panel Hosting (Pterodactyl dan sejenisnya)

Kebanyakan panel Node.js **tidak** menyediakan `ffmpeg` secara default. Yang perlu dicek/dilakukan:
1. Pilih egg/template yang sudah termasuk `ffmpeg`, ATAU
2. Kalau panel kasih akses shell/console, coba install manual (tergantung base image panel — biasanya `apt-get install ffmpeg` kalau berbasis Debian/Ubuntu)
3. Startup command diarahkan ke `npm start` atau `node index.js`

Kalau panel pakai Docker image kustom, opsi paling reliable adalah bikin image sendiri berbasis `node:20-bookworm` yang sudah termasuk ffmpeg (lihat contoh Dockerfile di bawah).

---

## Railway

Sudah otomatis lewat `nixpacks.toml` yang ada di root project ini — `ffmpeg` ikut ter-install saat build. Tidak perlu setup manual, tinggal connect repo GitHub ke Railway.

---

## Docker (opsional, paling portable — jalan sama persis di semua tempat)

Kalau platform kamu support Docker (VPS dengan Docker, sebagian panel modern), ini cara paling konsisten karena environment-nya selalu identik:

```dockerfile
FROM node:20-bookworm-slim

RUN apt-get update && apt-get install -y ffmpeg && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

CMD ["node", "index.js"]
```

Build & run:
```bash
docker build -t botwa .
docker run -d --name botwa -v $(pwd)/session:/app/session -v $(pwd)/database:/app/database botwa
```

Flag `-v` di atas penting — supaya `session/` dan `database/` tetap tersimpan di luar container (persist), jadi gak hilang kalau container di-restart/rebuild.

---

## Troubleshooting cepat

| Error | Penyebab | Fix |
|---|---|---|
| `ffmpeg: not found` | ffmpeg belum ter-install di environment itu | Install ffmpeg sesuai platform di atas |
| Bot gagal connect / minta scan QR terus | `session/` kosong/corrupt | Hapus folder `session/`, scan ulang |
| Owner access hilang setelah pindah environment | `database/db.json` gak ikut dipindah (memang di-gitignore) | Bot auto-addowner nomor dirinya sendiri saat connect pertama kali — tunggu proses itu selesai, atau copy manual `database/db.json` dari environment lama |
