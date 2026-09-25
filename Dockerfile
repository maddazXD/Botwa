# Dockerfile — environment identik di platform manapun yang support Docker
# (VPS, panel modern, dst). Base image Debian slim + ffmpeg, biar semua
# fitur download/converter/sticker video langsung jalan tanpa setup manual.
FROM node:20-bookworm-slim

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      ffmpeg \
      python3 \
      make \
      g++ \
      build-essential && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json .npmrc ./
RUN npm install --omit=dev

COPY . .

# session/ dan database/ di-mount sebagai volume saat `docker run` (lihat
# SETUP.md) biar data login & database gak hilang tiap container di-rebuild.

CMD ["node", "index.js"]
