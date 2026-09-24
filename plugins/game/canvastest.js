// plugins/game/canvastest.js
//
// FILE DIAGNOSTIK SEMENTARA — bukan game, cuma buat isolasi masalah kenapa
// flappy/mario/kage gagal render (layar gelap/hitam dari awal). Cuma
// menggambar 1 kotak merah solid pakai canvas API paling dasar, tanpa game
// logic apapun. Kalau kotak merah ini MUNCUL -> berarti canvas API-nya
// sendiri didukung WhatsApp WebView, dan masalah di game2 itu ada di tempat
// lain (kompleksitas kode, localStorage, dll). Kalau TETAP gelap/kosong ->
// bukti kuat WhatsApp WebView untuk fitur ini memang tidak mendukung elemen
// <canvas> sama sekali.
const { AIRich } = require("../../lib/aiRich");

const htmlPayload = `<style>
*{-webkit-tap-highlight-color:transparent;box-sizing:border-box;}
body{margin:0;background:#111;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;}
canvas{border:2px solid #fff;}
#label{color:#0f0;font-family:monospace;font-size:13px;margin-bottom:8px;text-align:center;}
</style><body>
<div id="label">loading...</div>
<canvas id="c" width="200" height="200"></canvas>
<script>
var label = document.getElementById('label');
var frame = 0;
try {
  var c = document.getElementById('c');
  var ctx = c.getContext('2d');
  if (!ctx) {
    label.textContent = 'getContext returned null!';
  } else {
    function loop() {
      try {
        frame++;
        ctx.fillStyle = '#111';
        ctx.fillRect(0, 0, 200, 200);
        ctx.fillStyle = frame % 60 < 30 ? '#ff0000' : '#00ff00';
        ctx.fillRect(20, 20, 160, 160);
        ctx.fillStyle = '#fff';
        ctx.font = '14px sans-serif';
        ctx.fillText('frame ' + frame, 40, 100);
        label.textContent = 'loop running, frame=' + frame;
        requestAnimationFrame(loop);
      } catch (e) {
        label.textContent = 'LOOP CRASHED at frame ' + frame + ': ' + e.message;
      }
    }
    requestAnimationFrame(loop);
  }
} catch (e) {
  label.textContent = 'INIT ERROR: ' + e.message;
}
</script>
</body>`;

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
    console.error("[CANVASTEST GAGAL]", err?.message || err);
    return m.reply("Gagal test canvas.");
  }
};

handler.command = ["canvastest"];
handler.help = ["canvastest"];
handler.tags = ["game"];

module.exports = handler;
