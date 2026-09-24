// plugins/game/flappy.js
//
// PORTING dari project referensi XAYNC_MD ke CommonJS, pola yang sudah
// terbukti jalan di tictactoe.js: trusted_sources kosong (HTML self-contained,
// gak butuh network), bypassDownload:false (biar render stabil, gak
// kedap-kedip). htmlPayload SALINAN PERSIS dari file asli, gak ada modifikasi
// HTML/CSS/JS.
const { AIRich } = require("../../lib/aiRich");

const htmlPayload = `<style>
* { -webkit-tap-highlight-color: transparent; -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; box-sizing: border-box; }
body { margin: 0; background: transparent; font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #eee; touch-action: manipulation; cursor: pointer; }
.wrap { width: 100%; max-width: 560px; margin: auto; padding: 12px; }
.card { background: rgba(15, 18, 28, 0.88); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); border: 1px solid rgba(0, 243, 255, 0.25); border-radius: 16px; overflow: hidden; box-shadow: 0 8px 32px rgba(0, 243, 255, 0.15), 0 0 15px rgba(157, 78, 221, 0.2); }
.head { padding: 12px 16px; border-bottom: 1px solid rgba(255, 255, 255, 0.1); display: flex; justify-content: space-between; align-items: center; background: linear-gradient(90deg, rgba(0,243,255,0.05), rgba(157,78,221,0.05)); }
.brand { font-size: 10px; letter-spacing: 2px; color: #00f3ff; font-weight: 700; text-transform: uppercase; }
.title { font-size: 19px; font-weight: 900; color: #fff; text-shadow: 0 0 10px rgba(0, 243, 255, 0.6); letter-spacing: 1px; }
.stats { text-align: right; display: flex; align-items: center; gap: 12px; }
.label { font-size: 9px; color: rgba(255, 255, 255, 0.5); font-weight: 600; }
.value { font-size: 16px; font-weight: 900; color: #00f3ff; text-shadow: 0 0 10px rgba(0, 243, 255, 0.8); }
.main { padding: 12px; position: relative; }
.board { position: relative; width: 100%; border-radius: 12px; overflow: hidden; border: 1px solid rgba(0, 243, 255, 0.2); background: #080b12; }
canvas#game { width: 100%; height: auto; display: block; touch-action: none; }
.overlay { position: absolute; inset: 0; background: rgba(6, 9, 17, 0.85); display: flex; flex-direction: column; align-items: center; justify-content: center; z-index: 10; transition: opacity 0.2s ease; }
.overlay { backdrop-filter: blur(6px); }
.overlay.hidden { opacity: 0; pointer-events: none; }
.overlay-title { font-size: 28px; font-weight: 900; color: #ff0055; text-shadow: 0 0 15px rgba(255,0,85,0.5); margin-bottom: 5px; }
.overlay-sub { font-size: 12px; color: rgba(255,255,255,0.7); font-weight: 600; letter-spacing: 1px; }
.button { background: linear-gradient(135deg, #00f3ff, #7209b7); border: none; border-radius: 8px; color: #fff; font-weight: 900; padding: 10px 24px; cursor: pointer; font-size: 12px; box-shadow: 0 4px 15px rgba(0,243,255,0.3); }
.button:active { transform: scale(0.95); }
.status { text-align: center; margin-top: 8px; font-size: 11px; color: rgba(255, 255, 255, 0.6); font-weight: 600; letter-spacing: 1px; }
</style><body>
<div class="wrap">
  <div class="card">
    <div class="head">
      <div>
        <div class="brand">ARCADE</div>
        <div class="title">FLAPPY</div>
      </div>
      <div class="stats">
        <div>
          <div class="label">SCORE</div>
          <div class="value" id="score">00000</div>
        </div>
        <div>
          <div class="label">BEST</div>
          <div class="value" id="best">00000</div>
        </div>
      </div>
    </div>
    <div class="main">
      <div class="board" id="board">
        <canvas id="game" width="560" height="300"></canvas>
        <div class="overlay" id="overlay">
          <div class="overlay-title" id="overTitle">FLAPPY</div>
          <div class="overlay-sub" id="overSub">TAP TO FLY</div>
          <button class="button primary" id="start" style="margin-top:15px">START</button>
        </div>
      </div>
      <div class="status" id="status">TAP THE SCREEN TO RISE</div>
    </div>
  </div>
</div>
<script>
const c=document.getElementById('game'),x=c.getContext('2d'),boardEl=document.getElementById('board'),overlay=document.getElementById('overlay'),scoreEl=document.getElementById('score'),bestEl=document.getElementById('best');let bird,pipes,score=0,best=0,playing=false,last=0,spawn=0;
try{best=parseInt(localStorage.getItem('megumin_flappy_best')||'0',10)||0}catch(e){}
function pad(v){return String(Math.floor(v)).padStart(5,'0')}function updateUI(){scoreEl.textContent=pad(score);bestEl.textContent=pad(best)}
function reset(){bird={x:120,y:145,vy:0};pipes=[];score=0;spawn=30;playing=true;last=0;overlay.classList.add('hidden');updateUI()}
function flap(){if(!playing)return;bird.vy=-7.4}
function addPipe(){const gap=92,top=38+Math.random()*122;pipes.push({x:590,top,bottom:top+gap,passed:false})}
function gameOver(){playing=false;best=Math.max(best,Math.floor(score));try{localStorage.setItem('megumin_flappy_best',String(best))}catch(e){}document.getElementById('overTitle').textContent='GAME OVER';document.getElementById('overSub').textContent='SCORE '+Math.floor(score);document.getElementById('start').textContent='PLAY AGAIN';overlay.classList.remove('hidden');updateUI()}
function update(dt){bird.vy+=.42*dt;bird.y+=bird.vy*dt;spawn-=dt;if(spawn<=0){addPipe();spawn=95}for(const p of pipes){p.x-=3.1*dt;if(!p.passed&&p.x+46<bird.x){p.passed=true;score++;updateUI()}if(bird.x+13>p.x&&bird.x-13<p.x+46&&(bird.y-12<p.top||bird.y+12>p.bottom))return gameOver()}pipes=pipes.filter(p=>p.x>-55);if(bird.y<10||bird.y>290)gameOver()}
function draw(){const bg=x.createLinearGradient(0,0,0,300);bg.addColorStop(0,'#18333e');bg.addColorStop(1,'#101b22');x.fillStyle=bg;x.fillRect(0,0,560,300);x.fillStyle='rgba(255,255,255,.08)';for(let i=0;i<7;i++)x.fillRect((i*97+score*9)%600-20,38+(i%3)*30,42,4);for(const p of pipes){x.fillStyle='#2f9b78';x.fillRect(p.x,0,46,p.top);x.fillRect(p.x,p.bottom,46,300-p.bottom);x.fillStyle='#57c99f';x.fillRect(p.x-4,p.top-12,54,12);x.fillRect(p.x-4,p.bottom,54,12)}x.save();x.translate(bird.x,bird.y);x.rotate(Math.max(-.35,Math.min(.6,bird.vy*.05)));x.fillStyle=playing?'#ffd166':'#a16d72';x.beginPath();x.arc(0,0,13,0,Math.PI*2);x.fill();x.fillStyle='#ff8b5e';x.fillRect(8,-2,12,5);x.fillStyle='#26343a';x.fillRect(3,-6,3,3);x.restore()}
function loop(t){try{if(!last)last=t;const dt=Math.min((t-last)/16.67,2);last=t;if(playing)update(dt);draw();}catch(e){console.error('[FLAPPY] Loop crash:',e&&e.message);return;}requestAnimationFrame(loop)}
document.getElementById('start').addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();reset()});boardEl.addEventListener('pointerdown',e=>{if(e.target===document.getElementById('start'))return;e.preventDefault();flap()});document.addEventListener('keydown',e=>{if(e.code==='Space'){e.preventDefault();flap()}});bird={x:120,y:145,vy:0};pipes=[];updateUI();requestAnimationFrame(loop);
</script></body>`;

let handler = async (m, { sock }) => {
  try {
    const rich = new AIRich(sock, {
      dynamic: true,
      unsupportedTypeAlert: false,
    });

    rich.addSection({
      view_model: {
        primitive: {
          __typename: "GenAIaeacdsnwHtmlPrimitive",
          payload: htmlPayload,
          trusted_sources: [],
        },
        __typename: "GenAISingleLayoutViewModel",
      },
    });

    await rich.send(m.chat, {
      quoted: m,
      includesUnifiedResponse: true,
      includesSubmessages: false,
      forwarded: true,
      notification: false,
      bypassDownload: false,
    });
  } catch (err) {
    console.error("[FLAPPY GAGAL]", err?.message || err);
    return m.reply("Gagal mengirim game. Kemungkinan fitur rich-message ini belum/tidak didukung di versi WhatsApp app kamu.");
  }
};

handler.command = ["flappy"];
handler.help = ["flappy"];
handler.tags = ["game"];

module.exports = handler;
