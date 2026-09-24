// plugins/play2.js
// YTMusic Search + LRCLIB Synced Lyrics + SaveTube + FFmpeg Compress + HTML Player

'use strict';

const { createDecipheriv, randomUUID } = require('crypto');
const { spawn } = require('child_process');
const yts = require('yt-search');
const YTMusic = require('ytmusic-api');
const sharp = require('sharp');
const { AIRich } = require('../../lib/aiRich');

/* =========================================================
 * CONFIG
 * ========================================================= */

const METADATA_DECRYPTION_KEY = Buffer.from('C5D58EF67A7584E4A29F6C35BBC4EB12', 'hex');

const HEADERS = {
  'Content-Type': 'application/json',
  'Origin': 'https://yt.savetube.me',
  'User-Agent': 'Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/130 Mobile Safari/537.36'
};

/* =========================================================
 * FFMPEG
 * ========================================================= */

const FFMPEG_BITRATE = '16k';
const FFMPEG_SAMPLE_RATE = '24000';
const FFMPEG_CHANNELS = '1';
const FFMPEG_CODEC = 'libopus';
const FFMPEG_FORMAT = 'ogg';

const MAX_ORIGINAL_AUDIO_SIZE = 25 * 1024 * 1024;
const MAX_COMPRESSED_AUDIO_SIZE = 6 * 1024 * 1024;

/* =========================================================
 * LRCLIB
 * ========================================================= */

const LRCLIB_API = 'https://lrclib.net/api';
const LRCLIB_USER_AGENT = 'AnyaMD-Play2/1.0 (https://github.com/)';

async function getLRCLyrics({ title, artist, duration = 0, album = '' }) {
  try {
    if (!title || !artist) return null;

    const params = new URLSearchParams({
      track_name: String(title).trim(),
      artist_name: String(artist).trim()
    });

    if (album) params.set('album_name', String(album).trim());

    const durationNumber = Number(duration);
    if (Number.isFinite(durationNumber) && durationNumber >= 1 && durationNumber <= 3600) {
      params.set('duration', String(Math.round(durationNumber)));
    }

    const res = await fetch(`${LRCLIB_API}/get?${params.toString()}`, {
      headers: {
        Accept: 'application/json',
        'User-Agent': LRCLIB_USER_AGENT
      }
    });

    if (res.status === 404 || res.status === 429 || !res.ok) return null;

    const data = await res.json();
    if (!data) return null;

    return {
      id: data.id || null,
      trackName: data.trackName || title,
      artistName: data.artistName || artist,
      albumName: data.albumName || '',
      duration: Number(data.duration || duration || 0),
      instrumental: Boolean(data.instrumental),
      plainLyrics: typeof data.plainLyrics === 'string' ? data.plainLyrics : '',
      syncedLyrics: typeof data.syncedLyrics === 'string' ? data.syncedLyrics : ''
    };
  } catch {
    return null;
  }
}

/* =========================================================
 * LRC PARSER
 * ========================================================= */

function parseLrcTimestamp(match) {
  if (!match) return null;

  const minutes = Number(match[1]);
  const seconds = Number(match[2]);
  const fractionText = match[3] || '';

  if (!Number.isFinite(minutes) || !Number.isFinite(seconds) || seconds < 0 || seconds >= 60) {
    return null;
  }

  let milliseconds = 0;
  if (fractionText) {
    if (fractionText.length === 1) milliseconds = Number(fractionText) * 100;
    else if (fractionText.length === 2) milliseconds = Number(fractionText) * 10;
    else milliseconds = Number(fractionText.slice(0, 3));
  }

  return minutes * 60 + seconds + milliseconds / 1000;
}

function parseSyncedLyrics(lrc = '') {
  if (!lrc || typeof lrc !== 'string') return [];

  const result = [];
  const lines = lrc.split(/\r?\n/);
  const timestampRegex = /\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g;

  for (const rawLine of lines) {
    if (!rawLine.trim()) continue;

    const matches = [...rawLine.matchAll(timestampRegex)];
    if (!matches.length) continue;

    const text = rawLine.replace(timestampRegex, '').trim();
    if (!text) continue;

    for (const match of matches) {
      const time = parseLrcTimestamp(match);
      if (time === null || !Number.isFinite(time) || time < 0) continue;
      result.push({ time, text });
    }
  }

  result.sort((a, b) => a.time - b.time);

  const cleaned = [];
  for (const item of result) {
    const last = cleaned[cleaned.length - 1];
    if (last && Math.abs(last.time - item.time) < 0.001 && last.text === item.text) continue;
    cleaned.push(item);
  }

  return cleaned;
}

function plainLyricsToSynced(lyrics = '', duration = 0) {
  if (!lyrics || typeof lyrics !== 'string') return [];
  const lines = lyrics.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  if (!lines.length) return [];

  const totalDuration = Number(duration);
  let interval = 5;
  if (Number.isFinite(totalDuration) && totalDuration > 0 && lines.length > 1) {
    interval = Math.max(2, Math.min(8, totalDuration / lines.length));
  }

  return lines.map((text, index) => ({ time: index * interval, text }));
}

function normalizeLyrics(lyrics = []) {
  if (!Array.isArray(lyrics)) return [];
  return lyrics
    .filter(item => item && Number.isFinite(Number(item.time)) && typeof item.text === 'string')
    .map(item => ({ time: Number(item.time), text: String(item.text).trim() }))
    .filter(item => item.text)
    .sort((a, b) => a.time - b.time);
}

/* =========================================================
 * YT MUSIC
 * ========================================================= */

let ytMusicInstance = null;
async function getYTMusic() {
  if (!ytMusicInstance) {
    ytMusicInstance = new YTMusic();
    await ytMusicInstance.initialize();
  }
  return ytMusicInstance;
}

/* =========================================================
 * HELPERS
 * ========================================================= */

function escapeHtml(text = '') {
  return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}
function escapeAttr(text = '') {
  return escapeHtml(text);
}
function secondsFromTimestamp(timestamp = '') {
  if (!timestamp) return 0;
  const parts = String(timestamp).split(':').map(Number);
  if (parts.some(Number.isNaN)) return 0;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return 0;
}
function formatDuration(seconds = 0) {
  seconds = Number(seconds);
  if (!Number.isFinite(seconds) || seconds <= 0) return '0:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return h + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
  return m + ':' + String(s).padStart(2, '0');
}

/* =========================================================
 * SAVETUBE
 * ========================================================= */

async function savetube(url, { downloadType = 'audio', quality = '128kbps' } = {}) {
  const idMatch = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/|embed\/))([a-zA-Z0-9_-]{11})/);
  if (!idMatch) throw new Error('URL YouTube tidak valid');
  const videoId = idMatch[1];

  const cdnRes = await fetch('https://media.savetube.vip/api/random-cdn', { headers: HEADERS }).then(v => v.json()).catch(() => null);
  if (!cdnRes?.cdn) throw new Error('CDN tidak tersedia');
  const cdn = cdnRes.cdn;

  const info = await fetch(`https://${cdn}/v2/info`, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify({ url: `https://www.youtube.com/watch?v=${videoId}` })
  }).then(v => v.json()).catch(() => null);
  if (!info?.data) throw new Error('Metadata kosong');

  let metadata;
  try {
    const encrypted = Buffer.from(info.data, 'base64');
    const decipher = createDecipheriv('aes-128-cbc', METADATA_DECRYPTION_KEY, encrypted.subarray(0, 16));
    const decrypted = Buffer.concat([decipher.update(encrypted.subarray(16)), decipher.final()]);
    metadata = JSON.parse(decrypted.toString('utf8'));
  } catch {
    throw new Error('Decrypt metadata gagal');
  }

  if (!metadata?.key) throw new Error('Key download tidak ditemukan');

  const dl = await fetch(`https://${cdn}/download`, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify({ id: videoId, downloadType, quality, key: metadata.key })
  }).then(v => v.json()).catch(() => null);

  if (!dl?.data?.downloadUrl) throw new Error(dl?.message || 'Download gagal');

  return { title: metadata.title, duration: metadata.durationLabel, thumbnail: metadata.thumbnail, url: dl.data.downloadUrl };
}

async function savetubeRetry(url, opts, retry = 3) {
  let lastErr;
  for (let i = 0; i < retry; i++) {
    try { return await savetube(url, opts); } catch (e) { lastErr = e; if (i < retry - 1) await new Promise(resolve => setTimeout(resolve, 1000)); }
  }
  throw lastErr;
}

/* =========================================================
 * DOWNLOAD AUDIO
 * ========================================================= */

async function downloadAudioBuffer(url) {
  if (!url) throw new Error('URL audio kosong');
  const res = await fetch(url, { headers: { 'User-Agent': HEADERS['User-Agent'] } });
  if (!res.ok) throw new Error(`Download audio gagal (${res.status})`);
  const buffer = Buffer.from(await res.arrayBuffer());
  if (!buffer.length || buffer.length > MAX_ORIGINAL_AUDIO_SIZE) throw new Error('Buffer audio bermasalah');
  return buffer;
}

/* =========================================================
 * FFMPEG COMPRESS
 * ========================================================= */

async function compressAudio(inputBuffer) {
  if (!Buffer.isBuffer(inputBuffer) || !inputBuffer.length) throw new Error('Input buffer kosong');
  return new Promise((resolve, reject) => {
    let ffmpeg;
    try {
      ffmpeg = spawn('ffmpeg', [
        '-hide_banner', '-loglevel', 'error', '-i', 'pipe:0', '-vn',
        '-c:a', FFMPEG_CODEC, '-b:a', FFMPEG_BITRATE, '-ar', FFMPEG_SAMPLE_RATE, '-ac', FFMPEG_CHANNELS,
        '-application', 'audio', '-f', FFMPEG_FORMAT, 'pipe:1'
      ], { stdio: ['pipe', 'pipe', 'pipe'] });
    } catch (error) { return reject(error); }

    const chunks = [];
    let outputSize = 0;
    let finished = false;

    const fail = error => {
      if (finished) return;
      finished = true;
      try { ffmpeg.kill('SIGKILL'); } catch {}
      reject(error);
    };

    ffmpeg.stdout.on('data', chunk => {
      outputSize += chunk.length;
      if (outputSize > MAX_COMPRESSED_AUDIO_SIZE) return fail(new Error('Audio compress terlalu besar'));
      chunks.push(chunk);
    });
    ffmpeg.stderr.on('data', () => {});
    ffmpeg.on('error', error => fail(error?.code === 'ENOENT' ? new Error('FFmpeg tidak ditemukan.') : error));
    ffmpeg.on('close', code => {
      if (finished) return;
      if (code !== 0) return fail(new Error(`FFmpeg gagal (${code})`));
      const output = Buffer.concat(chunks);
      if (!output.length) return fail(new Error('FFmpeg menghasilkan audio kosong'));
      finished = true;
      resolve(output);
    });
    ffmpeg.stdin.on('error', error => { if (error?.code !== 'EPIPE') fail(error); });
    ffmpeg.stdin.end(inputBuffer);
  });
}

/* =========================================================
 * THUMBNAIL
 * ========================================================= */

async function getThumb(url) {
  try {
    if (!url) return Buffer.alloc(0);
    const res = await fetch(url);
    if (!res.ok) throw new Error('Thumbnail gagal diambil');
    const raw = Buffer.from(await res.arrayBuffer());
    return await sharp(raw).resize(250, 250, { fit: 'cover', position: 'center' }).jpeg({ quality: 50 }).toBuffer();
  } catch { return Buffer.alloc(0); }
}

/* =========================================================
 * HTML MUSIC PLAYER (YT Music & Spotify Vibe)
 * ========================================================= */

function createMusicPlayer({ title, artist, duration, audioSrc, imageSrc, lyrics }) {
  const safeTitle = escapeHtml(title);
  const safeArtist = escapeHtml(artist);
  const safeDuration = escapeHtml(duration || '0:00');
  const safeImage = imageSrc || 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MDAiIGhlaWdodD0iNDAwIj48cmVjdCB3aWR0aD0iNDAwIiBoZWlnaHQ9IjQwMCIgZmlsbD0iIzFhMGQxMiIvPjx0ZXh0IHg9IjIwMCIgeT0iMjEwIiBmb250LXNpemU9IjM0IiBmb250LWZhbWlseT0ic2Fucy1zZXJpZiIgZmlsbD0iI2ZmZiIgdGV4dC1hbmNob3I9Im1pZGRsZSI+TUFJTiBQQ0xAYVlFUlI8L3RleHQ+PC9zdmc+';

  const lyricsJson = Buffer.from(
    JSON.stringify(Array.isArray(lyrics) ? lyrics : []),
    'utf8'
  ).toString('base64');

  return `
<style>
  :root {
    --ink: #ffffff;
    --muted: #a0a0a0;
    --sys: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    --bg-dark: #121212;
    --accent: #ffffff;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
  html, body { background: transparent; color: var(--ink); font-family: var(--sys); -webkit-font-smoothing: antialiased; }
  .wrap { display: flex; align-items: center; justify-content: center; padding: 10px; }
  
  .player { 
    position: relative; width: 100%; max-width: 340px; border-radius: 12px; 
    overflow: hidden; background: var(--bg-dark); box-shadow: 0 10px 30px rgba(0,0,0,.5); 
  }
  
  /* Latar belakang blur */
  .bg-blur { position: absolute; inset: -50%; width: 200%; height: 200%; object-fit: cover; filter: blur(40px) brightness(0.6); z-index: 0; }
  .veil { position: absolute; inset: 0; z-index: 1; background: linear-gradient(180deg, rgba(18,18,18,0.3) 0%, rgba(18,18,18,0.8) 70%, rgba(18,18,18,1) 100%); }
  
  /* Container utama */
  .content { position: relative; z-index: 2; padding: 20px; }
  
  /* Header */
  .head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; }
  .head svg { width: 22px; height: 22px; color: var(--ink); cursor: pointer; }
  .head-center { text-align: center; }
  .head-center .sub { font-size: 10px; font-weight: 500; letter-spacing: 1px; color: var(--muted); text-transform: uppercase; }
  .head-center .artist { font-size: 13px; font-weight: 600; margin-top: 2px; }

  /* Album Art */
  .poster { width: 100%; aspect-ratio: 1; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 20px rgba(0,0,0,.4); margin-bottom: 24px; }
  .poster img { width: 100%; height: 100%; object-fit: cover; display: block; }
  
  /* Info Lagu */
  .info { display: flex; align-items: center; justify-content: space-between; margin-bottom: 15px; }
  .info-text { min-width: 0; flex: 1; }
  .title { font-size: 20px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 4px; }
  .artist { font-size: 14px; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .heart { width: 24px; height: 24px; color: var(--muted); cursor: pointer; margin-left: 10px; }
  .heart.active { color: #1db954; fill: #1db954; }

  /* Progress Bar */
  .progress-container { margin-bottom: 15px; }
  .bar-wrapper { position: relative; height: 12px; display: flex; align-items: center; cursor: pointer; }
  .bar { width: 100%; height: 4px; background: rgba(255,255,255,0.2); border-radius: 2px; position: relative; }
  .bar-fill { position: absolute; left: 0; top: 0; bottom: 0; width: 0%; background: var(--accent); border-radius: 2px; }
  .bar-dot { position: absolute; right: -5px; top: 50%; transform: translateY(-50%); width: 10px; height: 10px; border-radius: 50%; background: var(--accent); opacity: 0; transition: opacity 0.2s; }
  .bar-wrapper:active .bar-dot { opacity: 1; }
  .time { display: flex; justify-content: space-between; font-size: 11px; color: var(--muted); font-weight: 500; margin-top: 6px; }

  /* Controls */
  .controls { display: flex; align-items: center; justify-content: space-between; margin-bottom: 15px; }
  .ctrl-btn { background: none; border: none; color: var(--ink); display: flex; align-items: center; justify-content: center; cursor: pointer; padding: 8px; border-radius: 50%; transition: transform 0.1s; }
  .ctrl-btn:active { transform: scale(0.9); }
  .ctrl-btn svg { width: 24px; height: 24px; }
  .ctrl-btn.lyrics-btn { background: rgba(255,255,255,0.1); } /* Lingkaran hijau di SS lu */
  
  .play-btn { width: 60px; height: 60px; background: var(--accent); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: var(--bg-dark); cursor: pointer; border: none; transition: transform 0.1s; }
  .play-btn:active { transform: scale(0.95); }
  .play-btn svg { width: 28px; height: 28px; }

  .footer-text { text-align: center; font-size: 11px; color: var(--muted); padding-top: 10px; }

  /* ================== LYRICS OVERLAY ================== */
  .lyrics-overlay {
    position: absolute; inset: 0; background: rgba(18,18,18,0.95); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
    z-index: 10; display: flex; flex-direction: column;
    transform: translateY(100%); transition: transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
  }
  .player.show-lyrics .lyrics-overlay { transform: translateY(0); }
  
  .ly-head { display: flex; justify-content: space-between; align-items: center; padding: 20px; padding-bottom: 10px; }
  .ly-title h3 { font-size: 16px; font-weight: 700; letter-spacing: 1px; }
  .ly-title p { font-size: 11px; color: var(--muted); margin-top: 2px; }
  .ly-close { background: rgba(255,255,255,0.1); border: none; width: 30px; height: 30px; border-radius: 50%; display: flex; justify-content: center; align-items: center; color: #fff; cursor: pointer; }
  
  .ly-scroll { 
    flex: 1; overflow-y: auto; padding: 0 20px 60px; 
    scrollbar-width: none; -ms-overflow-style: none; scroll-behavior: smooth;
    mask-image: linear-gradient(180deg, transparent 0%, black 10%, black 90%, transparent 100%);
    -webkit-mask-image: linear-gradient(180deg, transparent 0%, black 10%, black 90%, transparent 100%);
  }
  .ly-scroll::-webkit-scrollbar { display: none; }
  
  .ly-lines { display: flex; flex-direction: column; gap: 16px; padding: 50% 0; }
  .ly-line { 
    font-size: 16px; font-weight: 600; color: rgba(255,255,255,0.4); text-align: center; 
    transition: all 0.3s ease; transform-origin: center; cursor: pointer;
  }
  .ly-line.active { font-size: 22px; color: #ffffff; font-weight: 700; transform: scale(1.05); text-shadow: 0 0 10px rgba(255,255,255,0.3); }
  .ly-empty { text-align: center; color: var(--muted); margin-top: 50%; font-size: 14px; }

  .ly-bottom { padding: 15px 20px 25px; }
</style>

<div class="wrap">
  <div class="player" id="player">
    <img class="bg-blur" src="${escapeAttr(safeImage)}" alt="">
    <div class="veil"></div>
    
    <!-- MAIN VIEW -->
    <div class="content">
      <div class="head">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
        <div class="head-center">
          <div class="sub">YT Music Audio</div>
          <div class="artist">${safeArtist}</div>
        </div>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"></circle><circle cx="12" cy="5" r="1"></circle><circle cx="12" cy="19" r="1"></circle></svg>
      </div>

      <div class="poster"><img src="${escapeAttr(safeImage)}" alt="Cover"></div>

      <div class="info">
        <div class="info-text">
          <div class="title">${safeTitle}</div>
          <div class="artist">${safeArtist}</div>
        </div>
        <svg class="heart" id="heart-btn" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
      </div>

      <div class="progress-container">
        <div class="bar-wrapper" id="seek-bar">
          <div class="bar"><div class="bar-fill" id="bar-fill"><div class="bar-dot"></div></div></div>
        </div>
        <div class="time">
          <span id="time-cur">0:00</span>
          <span id="time-dur">${safeDuration}</span>
        </div>
      </div>

      <div class="controls">
        <button class="ctrl-btn lyrics-btn" id="btn-open-lyrics">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path><line x1="9" y1="9" x2="15" y2="9"></line><line x1="9" y1="13" x2="15" y2="13"></line></svg>
        </button>
        <button class="ctrl-btn" id="btn-prev">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"></path></svg>
        </button>
        <button class="play-btn" id="btn-play">
          <svg id="icon-play" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"></path></svg>
          <svg id="icon-pause" viewBox="0 0 24 24" fill="currentColor" style="display:none;"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"></path></svg>
        </button>
        <button class="ctrl-btn" id="btn-next">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"></path></svg>
        </button>
        <button class="ctrl-btn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 1 21 5 17 9"></polyline><path d="M3 11V9a4 4 0 0 1 4-4h14"></path><polyline points="7 23 3 19 7 15"></polyline><path d="M21 13v2a4 4 0 0 1-4 4H3"></path></svg>
        </button>
      </div>
      <div class="footer-text">support terus kami yaaa</div>
    </div>

    <!-- LYRICS OVERLAY -->
    <div class="lyrics-overlay">
      <div class="ly-head">
        <div class="ly-title">
          <h3>LYRICS</h3>
          <p>Synced lyrics • LRCLIB</p>
        </div>
        <button class="ly-close" id="btn-close-lyrics">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </div>
      <div class="ly-scroll" id="ly-scroll">
        <div class="ly-lines" id="ly-lines"></div>
      </div>
      <div class="ly-bottom">
        <div class="bar-wrapper" id="ly-seek-bar">
          <div class="bar"><div class="bar-fill" id="ly-bar-fill"><div class="bar-dot"></div></div></div>
        </div>
      </div>
    </div>

  </div>
</div>

<audio id="audio" preload="metadata" src="${escapeAttr(audioSrc)}"></audio>

<script>
(function() {
  'use strict';

  const audio = document.getElementById('audio');
  const player = document.getElementById('player');
  const btnPlay = document.getElementById('btn-play');
  const iconPlay = document.getElementById('icon-play');
  const iconPause = document.getElementById('icon-pause');
  
  const seekBar = document.getElementById('seek-bar');
  const barFill = document.getElementById('bar-fill');
  const curTime = document.getElementById('time-cur');
  const durTime = document.getElementById('time-dur');
  
  const lySeekBar = document.getElementById('ly-seek-bar');
  const lyBarFill = document.getElementById('ly-bar-fill');
  
  const heartBtn = document.getElementById('heart-btn');
  const btnPrev = document.getElementById('btn-prev');
  const btnNext = document.getElementById('btn-next');
  
  const btnOpenLyrics = document.getElementById('btn-open-lyrics');
  const btnCloseLyrics = document.getElementById('btn-close-lyrics');
  const lyScroll = document.getElementById('ly-scroll');
  const lyLines = document.getElementById('ly-lines');

  // Load Lyrics
  let lyrics = [];
  try {
    const encoded = '${lyricsJson}';
    const json = decodeURIComponent(escape(atob(encoded)));
    const parsed = JSON.parse(json);
    if (Array.isArray(parsed)) {
      lyrics = parsed.filter(i => i && Number.isFinite(Number(i.time)))
                     .map(i => ({ time: Number(i.time), text: String(i.text || '♪') }))
                     .sort((a, b) => a.time - b.time);
    }
  } catch(e) { lyrics = []; }

  const lyricEls = [];
  if (!lyrics.length) {
    lyLines.innerHTML = '<div class="ly-empty">Lirik belum tersedia untuk lagu ini.</div>';
  } else {
    lyrics.forEach(line => {
      const el = document.createElement('div');
      el.className = 'ly-line';
      el.textContent = line.text;
      el.onclick = () => { audio.currentTime = line.time; audio.play(); };
      lyLines.appendChild(el);
      lyricEls.push(el);
    });
  }

  // Toggle Lyrics View
  btnOpenLyrics.onclick = () => player.classList.add('show-lyrics');
  btnCloseLyrics.onclick = () => player.classList.remove('show-lyrics');
  heartBtn.onclick = () => heartBtn.classList.toggle('active');

  // Control Logic
  btnPlay.onclick = () => { audio.paused ? audio.play() : audio.pause(); };
  btnPrev.onclick = () => { audio.currentTime = Math.max(0, audio.currentTime - 10); };
  btnNext.onclick = () => { audio.currentTime = Math.min(audio.duration, audio.currentTime + 10); };

  function formatTime(s) {
    if (!s || s < 0) return '0:00';
    let m = Math.floor(s / 60), sec = Math.floor(s % 60);
    return m + ':' + (sec < 10 ? '0' : '') + sec;
  }

  function handleSeek(e, barElement) {
    const rect = barElement.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    audio.currentTime = (x / rect.width) * audio.duration;
  }
  seekBar.onpointerdown = (e) => handleSeek(e, seekBar);
  lySeekBar.onpointerdown = (e) => handleSeek(e, lySeekBar);

  audio.onplay = () => { iconPlay.style.display = 'none'; iconPause.style.display = 'block'; };
  audio.onpause = () => { iconPlay.style.display = 'block'; iconPause.style.display = 'none'; };
  audio.onloadedmetadata = () => { durTime.textContent = formatTime(audio.duration); };

  // Sync Progress & Lyrics
  let activeIdx = -1;
  audio.ontimeupdate = () => {
    const p = (audio.currentTime / audio.duration) * 100 || 0;
    barFill.style.width = p + '%';
    lyBarFill.style.width = p + '%';
    curTime.textContent = formatTime(audio.currentTime);

    if (!lyrics.length) return;
    
    // Cari index lirik saat ini
    let idx = -1;
    for (let i = 0; i < lyrics.length; i++) {
      if (audio.currentTime >= lyrics[i].time - 0.3) idx = i;
      else break;
    }

    if (idx !== activeIdx && idx !== -1) {
      if (activeIdx !== -1 && lyricEls[activeIdx]) lyricEls[activeIdx].classList.remove('active');
      lyricEls[idx].classList.add('active');
      activeIdx = idx;
      
      // Auto Scroll
      const activeEl = lyricEls[idx];
      const scrollPos = activeEl.offsetTop - (lyScroll.clientHeight / 2) + (activeEl.clientHeight / 2);
      lyScroll.scrollTo({ top: scrollPos, behavior: 'smooth' });
    }
  };

  audio.onended = () => {
    barFill.style.width = '0%'; lyBarFill.style.width = '0%';
    curTime.textContent = '0:00';
    if(activeIdx !== -1 && lyricEls[activeIdx]) lyricEls[activeIdx].classList.remove('active');
    activeIdx = -1;
    lyScroll.scrollTo({ top: 0, behavior: 'smooth' });
  };
})();
</script>
`;
}

/* =========================================================
 * HANDLER
 * ========================================================= */

let handler = async (m, { sock, text, prefix, command }) => {
    if (!text) {
        return m.reply(`Masukkan judul lagu atau link YouTube-nya cuy!`);
    }

    try {

            let ytUrl = text.trim();
            let title = 'Unknown';
            let artist = 'Unknown Artist';
            let duration = '0:00';
            let durationSec = 0;
            let thumbUrl = '';
            let trackIdForLyrics = null;
            let album = '';

            // Cari lagu via YTMusic atau YTSearch
            if (!/youtube\.com|youtu\.be/i.test(text)) {
                const ytm = await getYTMusic();
                const songs = await ytm.search(text);
                const track = songs.find(s => s.type === 'SONG') || songs[0];

                if (!track || !track.videoId) {
                    throw new Error('Lagu tidak ditemukan di YT Music');
                }

                trackIdForLyrics = track.videoId;
                ytUrl = `https://www.youtube.com/watch?v=${track.videoId}`;
                title = track.name || track.title || 'Unknown';
                artist = track.artists?.length
                    ? track.artists.map(a => a.name).join(', ')
                    : (track.artist?.name || 'Unknown Artist');

                durationSec = Number(track.duration || 0);
                duration = formatDuration(durationSec);

                if (track.thumbnails?.length) {
                    thumbUrl = track.thumbnails[track.thumbnails.length - 1].url;
                }

                album = track.album?.name || track.album?.title || '';
            } else {
                const detail = await yts(ytUrl);
                const vid = detail?.videos?.[0];

                if (!vid) throw new Error('Video tidak ditemukan');

                title = vid.title || 'Unknown';
                artist = vid.author?.name || 'YouTube';
                duration = vid.timestamp || '0:00';
                durationSec = secondsFromTimestamp(duration);
                thumbUrl = vid.thumbnail;

                const match = ytUrl.match(/(?:v=|shorts\/|youtu\.be\/|embed\/)([a-zA-Z0-9_-]{11})/);
                if (match) trackIdForLyrics = match[1];
            }

            // Cari Lirik via LRCLib & YTMusic Fallback
            let syncedLyrics = [];
            const lrclib = await getLRCLyrics({ title, artist, duration: durationSec, album });

            if (lrclib?.syncedLyrics) {
                syncedLyrics = parseSyncedLyrics(lrclib.syncedLyrics);
            }

            if (!syncedLyrics.length && lrclib?.plainLyrics) {
                syncedLyrics = plainLyricsToSynced(lrclib.plainLyrics, durationSec);
            }

            if (!syncedLyrics.length && trackIdForLyrics) {
                try {
                    const ytm = await getYTMusic();
                    const lyricsData = await ytm.getLyrics(trackIdForLyrics);
                    let fallbackLyrics = '';

                    if (typeof lyricsData === 'string') {
                        fallbackLyrics = lyricsData;
                    } else if (Array.isArray(lyricsData)) {
                        fallbackLyrics = lyricsData
                            .map(item => (typeof item === 'string' ? item : item?.lyrics || item?.text || item?.content || ''))
                            .filter(Boolean)
                            .join('\n');
                    } else {
                        fallbackLyrics = lyricsData?.lyrics || lyricsData?.text || lyricsData?.content || '';
                    }

                    if (fallbackLyrics) {
                        syncedLyrics = parseSyncedLyrics(fallbackLyrics);
                        if (!syncedLyrics.length) {
                            syncedLyrics = plainLyricsToSynced(fallbackLyrics, durationSec);
                        }
                    }
                } catch {}
            }
            
            syncedLyrics = normalizeLyrics(syncedLyrics);

            const thumb = await getThumb(thumbUrl);
            const imageSrc = thumb?.length ? `data:image/jpeg;base64,${thumb.toString('base64')}` : '';

            const audio = await savetubeRetry(ytUrl, { downloadType: 'audio', quality: '128kbps' });
            if (!audio?.url) throw new Error('URL audio tidak tersedia');

            const originalBuffer = await downloadAudioBuffer(audio.url);
            const compressedBuffer = await compressAudio(originalBuffer);
            const audioSrc = `data:audio/ogg;base64,${compressedBuffer.toString('base64')}`;

            if (Buffer.byteLength(audioSrc, 'utf8') > 8 * 1024 * 1024) {
                throw new Error('Audio Base64 masih terlalu besar, coba lagu dengan durasi lebih pendek.');
            }

            const htmlPayload = createMusicPlayer({
                title,
                artist,
                duration,
                audioSrc,
                imageSrc,
                lyrics: syncedLyrics
            });

            const rich = new AIRich(sock, {
                dynamic: true,
                unsupportedTypeAlert: false
            });

            rich.addSection({
                view_model: {
                    primitive: {
                        __typename: 'GenAIaeacdsnwHtmlPrimitive',
                        payload: htmlPayload,
                        trusted_sources: []
                    },
                    __typename: 'GenAISingleLayoutViewModel'
                }
            });

            await rich.send(m.chat, {
                quoted: m,
                includesUnifiedResponse: true,
                includesSubmessages: false,
                forwarded: true,
                notification: false,
                bypassDownload: false
            });

        } catch (error) {
            console.error("[PLAY3 GAGAL]", error?.message || error);
            m.reply(`Gagal: ${error?.message || 'Unknown error'}`);
        }
};

handler.command = ["play3"];
handler.help = ["play3 <judul lagu / link YouTube>"];
handler.tags = ["music"];

module.exports = handler;
