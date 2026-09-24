// plugins/game/kage.js
//
// PORTING dari project referensi XAYNC_MD ke CommonJS, pola yang sudah
// terbukti jalan di tictactoe.js: trusted_sources kosong (HTML self-contained,
// gak butuh network), bypassDownload:false (biar render stabil, gak
// kedap-kedip). htmlPayload SALINAN PERSIS dari file asli, gak ada modifikasi
// HTML/CSS/JS.
const { AIRich } = require("../../lib/aiRich");

const htmlPayload = `<style>
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
                -webkit-tap-highlight-color: transparent;
                -webkit-user-select: none;
                user-select: none;
                touch-action: none;
            }
            body {
                background: #150d0d;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                color: #fff;
                overflow: hidden;
                display: flex;
                justify-content: center;
                align-items: flex-start;
            }
            #nes-case {
                width: 100%;
                max-width: 440px;
                background: rgba(255, 255, 255, 0.05);
                backdrop-filter: blur(16px);
                -webkit-backdrop-filter: blur(16px);
                border: 2px solid rgba(239, 68, 68, 0.4);
                border-radius: 18px;
                overflow: hidden;
                display: flex;
                flex-direction: column;
                box-shadow: 0 10px 40px rgba(0, 0, 0, 0.6);
            }
            #screen-wrap {
                width: 100%;
                height: 270px;
                background: #000;
                display: flex;
                justify-content: center;
                align-items: center;
                position: relative;
            }
            canvas#nes {
                width: 100%;
                height: 100%;
                object-fit: fill;
                display: block;
                image-rendering: pixelated;
            }
            #pad {
                width: 100%;
                padding: clamp(10px, 3vw, 18px) clamp(12px, 4vw, 16px)
                    calc(clamp(14px, 4vw, 18px) + env(safe-area-inset-bottom, 0px));
                background: rgba(0, 0, 0, 0.35);
                display: flex;
                flex-direction: column;
                gap: clamp(8px, 3vw, 14px);
                border-top: 1px solid rgba(239, 68, 68, 0.25);
                position: relative;
            }
            #top-ctrl {
                display: flex;
                justify-content: center;
                gap: clamp(14px, 6vw, 24px);
                align-items: center;
            }
            #top-ctrl button {
                width: clamp(64px, 22vw, 78px);
                height: clamp(32px, 8vw, 36px);
                background: rgba(255, 255, 255, 0.08);
                border: 1px solid rgba(239, 68, 68, 0.35);
                border-radius: 12px;
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.8);
                cursor: pointer;
                color: #fff;
                font-size: clamp(10px, 2.8vw, 12px);
                font-weight: 900;
                letter-spacing: 1px;
                display: flex;
                align-items: center;
                justify-content: center;
                transition:
                    transform 0.06s,
                    background 0.06s;
            }
            #top-ctrl button:active,
            #top-ctrl button.touching {
                transform: translateY(2px);
                background: rgba(239, 68, 68, 0.3);
                box-shadow: 0 0 0 #000;
            }
            #main-row {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 0 4px;
            }
            #dpad {
                display: grid;
                grid-template-columns: repeat(3, clamp(44px, 13vw, 52px));
                grid-template-rows: repeat(3, clamp(44px, 13vw, 52px));
                gap: clamp(3px, 1vw, 5px);
                background: rgba(0, 0, 0, 0.5);
                padding: 6px;
                border-radius: 50%;
                box-shadow: 0 4px 14px rgba(0, 0, 0, 0.6);
                border: 1px solid rgba(239, 68, 68, 0.2);
            }
            #dpad button {
                background: rgba(255, 255, 255, 0.07);
                color: #f1f5f1;
                border: 1px solid rgba(239, 68, 68, 0.25);
                border-radius: 10px;
                font-size: clamp(17px, 5vw, 22px);
                display: flex;
                align-items: center;
                justify-content: center;
                box-shadow: 0 3px 0 rgba(0, 0, 0, 0.6);
                cursor: pointer;
                transition:
                    transform 0.06s,
                    background 0.06s;
            }
            #dpad button:active,
            #dpad button.touching {
                background: #ef4444 !important;
                color: #150d0d !important;
                transform: scale(0.92) translateY(2px);
                box-shadow: 0 0 0 #7f1d1d;
            }
            #act {
                display: flex;
                gap: clamp(10px, 4vw, 16px);
                background: rgba(0, 0, 0, 0.5);
                padding: clamp(8px, 3vw, 12px) clamp(12px, 4vw, 18px);
                border-radius: 36px;
                border: 1px solid rgba(239, 68, 68, 0.2);
                align-items: center;
                box-shadow: 0 4px 14px rgba(0, 0, 0, 0.6);
            }
            #act button {
                width: clamp(48px, 15vw, 58px);
                height: clamp(48px, 15vw, 58px);
                border-radius: 50%;
                border: none;
                color: #fff;
                font-size: clamp(16px, 4.5vw, 20px);
                font-weight: bold;
                display: flex;
                align-items: center;
                justify-content: center;
                background: #ef4444;
                box-shadow: 0 4px #7f1d1d;
                cursor: pointer;
                transition:
                    transform 0.06s,
                    background 0.06s;
            }
            #act button:active,
            #act button.touching {
                transform: scale(0.92) translateY(3px);
                background: #dc2626 !important;
                box-shadow: 0 1px #7f1d1d;
            }
            #pad button:focus-visible {
                outline: 3px solid #ef4444;
                outline-offset: 2px;
            }
        </style>
    <body>
    <script>
(function(){
  try {
    var testKey = '__ls_test__';
    window.localStorage.setItem(testKey, '1');
    window.localStorage.removeItem(testKey);
  } catch (e) {
    // FIX: sama kayak mario.js, shim in-memory buat localStorage yang
    // throw SecurityError di origin buram WebView WhatsApp.
    var mem = {};
    try {
      Object.defineProperty(window, 'localStorage', {
        value: {
          getItem: function(k) { return Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null; },
          setItem: function(k, v) { mem[k] = String(v); },
          removeItem: function(k) { delete mem[k]; },
          clear: function() { mem = {}; },
          key: function(i) { return Object.keys(mem)[i] || null; },
          get length() { return Object.keys(mem).length; }
        },
        configurable: true
      });
    } catch (e2) {
      console.error('[SHIM] Gagal ganti localStorage:', e2 && e2.message);
    }
  }
})();
</script>
        <div id="nes-case">
            <div id="screen-wrap">
                <canvas id="nes" width="256" height="240" role="img" aria-label="Pantalla del juego"></canvas>
            </div>
            <div id="pad" role="group" aria-label="Controles del juego">
                <div id="top-ctrl">
                    <button id="sel" aria-label="Select">SELECT</button
                    ><button id="st" aria-label="Start">START</button>
                </div>
                <div id="main-row">
                    <div id="dpad" role="group" aria-label="Cruceta direccional">
                        <button id="u" style="grid-column: 2" aria-label="Arriba">▲</button
                        ><button id="l" style="grid-column: 1; grid-row: 2" aria-label="Izquierda">◀</button>
                        <div style="grid-column: 2; grid-row: 2; background: rgba(15, 15, 22, 0.8)"></div>
                        <button id="r" style="grid-column: 3; grid-row: 2" aria-label="Derecha">▶</button
                        ><button id="d" style="grid-column: 2; grid-row: 3" aria-label="Abajo">▼</button>
                    </div>
                    <div id="act" role="group" aria-label="Botones de acción">
                        <button id="btn-b" aria-label="Botón B">B</button
                        ><button id="btn-a" aria-label="Botón A">A</button>
                    </div>
                </div>
            </div>
        </div>
        <script>
            !(function (t, e) {
                "object" == typeof exports && "object" == typeof module
                    ? (module.exports = e())
                    : "function" == typeof define && define.amd
                      ? define("jsnes", [], e)
                      : "object" == typeof exports
                        ? (exports.jsnes = e())
                        : (t.jsnes = e());
            })(globalThis, () =>
                (() => {
                    "use strict";
                    var t = {
                            d: (e, s) => {
                                for (var i in s)
                                    t.o(s, i) &&
                                        !t.o(e, i) &&
                                        Object.defineProperty(e, i, { enumerable: !0, get: s[i] });
                            },
                            o: (t, e) => Object.prototype.hasOwnProperty.call(t, e),
                            r: (t) => {
                                "undefined" != typeof Symbol &&
                                    Symbol.toStringTag &&
                                    Object.defineProperty(t, Symbol.toStringTag, { value: "Module" }),
                                    Object.defineProperty(t, "__esModule", { value: !0 });
                            },
                        },
                        e = {};
                    function s(t, e, s, i, r) {
                        for (let h = 0; h < r; ++h) s[i + h] = t[e + h];
                    }
                    function i(t, e) {
                        const s = t.constructor.JSON_PROPERTIES;
                        for (let i = 0; i < s.length; i++) {
                            const r = s[i],
                                h = t[r],
                                a = e[r];
                            ArrayBuffer.isView(h) && Array.isArray(a) ? h.set(a) : (t[r] = a);
                        }
                    }
                    function r(t) {
                        const e = {},
                            s = t.constructor.JSON_PROPERTIES;
                        for (let i = 0; i < s.length; i++) {
                            const r = s[i],
                                h = t[r];
                            e[r] = ArrayBuffer.isView(h) ? Array.from(h) : h;
                        }
                        return e;
                    }
                    t.r(e), t.d(e, { Browser: () => Bt, Controller: () => A, GameGenie: () => x, NES: () => gt });
                    const h = 10,
                        a = 11,
                        n = 17,
                        o = 23,
                        l = 29,
                        c = 33,
                        m = 34,
                        d = 43,
                        u = 47,
                        p = 60,
                        g = 62,
                        R = 63,
                        C = 64,
                        _ = 65,
                        b = 66,
                        y = 67,
                        f = 69,
                        S = { ins: -1, mode: 0, size: 1, cycles: 2 },
                        T = {
                            105: { ins: 0, mode: 5, size: 2, cycles: 2 },
                            101: { ins: 0, mode: 0, size: 2, cycles: 3 },
                            117: { ins: 0, mode: 6, size: 2, cycles: 4 },
                            109: { ins: 0, mode: 3, size: 3, cycles: 4 },
                            125: { ins: 0, mode: 8, size: 3, cycles: 4 },
                            121: { ins: 0, mode: 9, size: 3, cycles: 4 },
                            97: { ins: 0, mode: h, size: 2, cycles: 6 },
                            113: { ins: 0, mode: a, size: 2, cycles: 5 },
                            41: { ins: 1, mode: 5, size: 2, cycles: 2 },
                            37: { ins: 1, mode: 0, size: 2, cycles: 3 },
                            53: { ins: 1, mode: 6, size: 2, cycles: 4 },
                            45: { ins: 1, mode: 3, size: 3, cycles: 4 },
                            61: { ins: 1, mode: 8, size: 3, cycles: 4 },
                            57: { ins: 1, mode: 9, size: 3, cycles: 4 },
                            33: { ins: 1, mode: h, size: 2, cycles: 6 },
                            49: { ins: 1, mode: a, size: 2, cycles: 5 },
                            10: { ins: 2, mode: 4, size: 1, cycles: 2 },
                            6: { ins: 2, mode: 0, size: 2, cycles: 5 },
                            22: { ins: 2, mode: 6, size: 2, cycles: 6 },
                            14: { ins: 2, mode: 3, size: 3, cycles: 6 },
                            30: { ins: 2, mode: 8, size: 3, cycles: 7 },
                            144: { ins: 3, mode: 1, size: 2, cycles: 2 },
                            176: { ins: 4, mode: 1, size: 2, cycles: 2 },
                            240: { ins: 5, mode: 1, size: 2, cycles: 2 },
                            48: { ins: 7, mode: 1, size: 2, cycles: 2 },
                            208: { ins: 8, mode: 1, size: 2, cycles: 2 },
                            16: { ins: 9, mode: 1, size: 2, cycles: 2 },
                            80: { ins: 11, mode: 1, size: 2, cycles: 2 },
                            112: { ins: 12, mode: 1, size: 2, cycles: 2 },
                            36: { ins: 6, mode: 0, size: 2, cycles: 3 },
                            44: { ins: 6, mode: 3, size: 3, cycles: 4 },
                            0: { ins: 10, mode: 2, size: 1, cycles: 7 },
                            24: { ins: 13, mode: 2, size: 1, cycles: 2 },
                            216: { ins: 14, mode: 2, size: 1, cycles: 2 },
                            88: { ins: 15, mode: 2, size: 1, cycles: 2 },
                            184: { ins: 16, mode: 2, size: 1, cycles: 2 },
                            201: { ins: n, mode: 5, size: 2, cycles: 2 },
                            197: { ins: n, mode: 0, size: 2, cycles: 3 },
                            213: { ins: n, mode: 6, size: 2, cycles: 4 },
                            205: { ins: n, mode: 3, size: 3, cycles: 4 },
                            221: { ins: n, mode: 8, size: 3, cycles: 4 },
                            217: { ins: n, mode: 9, size: 3, cycles: 4 },
                            193: { ins: n, mode: h, size: 2, cycles: 6 },
                            209: { ins: n, mode: a, size: 2, cycles: 5 },
                            224: { ins: 18, mode: 5, size: 2, cycles: 2 },
                            228: { ins: 18, mode: 0, size: 2, cycles: 3 },
                            236: { ins: 18, mode: 3, size: 3, cycles: 4 },
                            192: { ins: 19, mode: 5, size: 2, cycles: 2 },
                            196: { ins: 19, mode: 0, size: 2, cycles: 3 },
                            204: { ins: 19, mode: 3, size: 3, cycles: 4 },
                            198: { ins: 20, mode: 0, size: 2, cycles: 5 },
                            214: { ins: 20, mode: 6, size: 2, cycles: 6 },
                            206: { ins: 20, mode: 3, size: 3, cycles: 6 },
                            222: { ins: 20, mode: 8, size: 3, cycles: 7 },
                            202: { ins: 21, mode: 2, size: 1, cycles: 2 },
                            136: { ins: 22, mode: 2, size: 1, cycles: 2 },
                            73: { ins: o, mode: 5, size: 2, cycles: 2 },
                            69: { ins: o, mode: 0, size: 2, cycles: 3 },
                            85: { ins: o, mode: 6, size: 2, cycles: 4 },
                            77: { ins: o, mode: 3, size: 3, cycles: 4 },
                            93: { ins: o, mode: 8, size: 3, cycles: 4 },
                            89: { ins: o, mode: 9, size: 3, cycles: 4 },
                            65: { ins: o, mode: h, size: 2, cycles: 6 },
                            81: { ins: o, mode: a, size: 2, cycles: 5 },
                            230: { ins: 24, mode: 0, size: 2, cycles: 5 },
                            246: { ins: 24, mode: 6, size: 2, cycles: 6 },
                            238: { ins: 24, mode: 3, size: 3, cycles: 6 },
                            254: { ins: 24, mode: 8, size: 3, cycles: 7 },
                            232: { ins: 25, mode: 2, size: 1, cycles: 2 },
                            200: { ins: 26, mode: 2, size: 1, cycles: 2 },
                            76: { ins: 27, mode: 3, size: 3, cycles: 3 },
                            108: { ins: 27, mode: 12, size: 3, cycles: 5 },
                            32: { ins: 28, mode: 3, size: 3, cycles: 6 },
                            169: { ins: l, mode: 5, size: 2, cycles: 2 },
                            165: { ins: l, mode: 0, size: 2, cycles: 3 },
                            181: { ins: l, mode: 6, size: 2, cycles: 4 },
                            173: { ins: l, mode: 3, size: 3, cycles: 4 },
                            189: { ins: l, mode: 8, size: 3, cycles: 4 },
                            185: { ins: l, mode: 9, size: 3, cycles: 4 },
                            161: { ins: l, mode: h, size: 2, cycles: 6 },
                            177: { ins: l, mode: a, size: 2, cycles: 5 },
                            162: { ins: 30, mode: 5, size: 2, cycles: 2 },
                            166: { ins: 30, mode: 0, size: 2, cycles: 3 },
                            182: { ins: 30, mode: 7, size: 2, cycles: 4 },
                            174: { ins: 30, mode: 3, size: 3, cycles: 4 },
                            190: { ins: 30, mode: 9, size: 3, cycles: 4 },
                            160: { ins: 31, mode: 5, size: 2, cycles: 2 },
                            164: { ins: 31, mode: 0, size: 2, cycles: 3 },
                            180: { ins: 31, mode: 6, size: 2, cycles: 4 },
                            172: { ins: 31, mode: 3, size: 3, cycles: 4 },
                            188: { ins: 31, mode: 8, size: 3, cycles: 4 },
                            74: { ins: 32, mode: 4, size: 1, cycles: 2 },
                            70: { ins: 32, mode: 0, size: 2, cycles: 5 },
                            86: { ins: 32, mode: 6, size: 2, cycles: 6 },
                            78: { ins: 32, mode: 3, size: 3, cycles: 6 },
                            94: { ins: 32, mode: 8, size: 3, cycles: 7 },
                            26: { ins: c, mode: 2, size: 1, cycles: 2 },
                            58: { ins: c, mode: 2, size: 1, cycles: 2 },
                            90: { ins: c, mode: 2, size: 1, cycles: 2 },
                            122: { ins: c, mode: 2, size: 1, cycles: 2 },
                            218: { ins: c, mode: 2, size: 1, cycles: 2 },
                            234: { ins: c, mode: 2, size: 1, cycles: 2 },
                            250: { ins: c, mode: 2, size: 1, cycles: 2 },
                            9: { ins: m, mode: 5, size: 2, cycles: 2 },
                            5: { ins: m, mode: 0, size: 2, cycles: 3 },
                            21: { ins: m, mode: 6, size: 2, cycles: 4 },
                            13: { ins: m, mode: 3, size: 3, cycles: 4 },
                            29: { ins: m, mode: 8, size: 3, cycles: 4 },
                            25: { ins: m, mode: 9, size: 3, cycles: 4 },
                            1: { ins: m, mode: h, size: 2, cycles: 6 },
                            17: { ins: m, mode: a, size: 2, cycles: 5 },
                            72: { ins: 35, mode: 2, size: 1, cycles: 3 },
                            8: { ins: 36, mode: 2, size: 1, cycles: 3 },
                            104: { ins: 37, mode: 2, size: 1, cycles: 4 },
                            40: { ins: 38, mode: 2, size: 1, cycles: 4 },
                            42: { ins: 39, mode: 4, size: 1, cycles: 2 },
                            38: { ins: 39, mode: 0, size: 2, cycles: 5 },
                            54: { ins: 39, mode: 6, size: 2, cycles: 6 },
                            46: { ins: 39, mode: 3, size: 3, cycles: 6 },
                            62: { ins: 39, mode: 8, size: 3, cycles: 7 },
                            106: { ins: 40, mode: 4, size: 1, cycles: 2 },
                            102: { ins: 40, mode: 0, size: 2, cycles: 5 },
                            118: { ins: 40, mode: 6, size: 2, cycles: 6 },
                            110: { ins: 40, mode: 3, size: 3, cycles: 6 },
                            126: { ins: 40, mode: 8, size: 3, cycles: 7 },
                            64: { ins: 41, mode: 2, size: 1, cycles: 6 },
                            96: { ins: 42, mode: 2, size: 1, cycles: 6 },
                            233: { ins: d, mode: 5, size: 2, cycles: 2 },
                            235: { ins: d, mode: 5, size: 2, cycles: 2 },
                            229: { ins: d, mode: 0, size: 2, cycles: 3 },
                            245: { ins: d, mode: 6, size: 2, cycles: 4 },
                            237: { ins: d, mode: 3, size: 3, cycles: 4 },
                            253: { ins: d, mode: 8, size: 3, cycles: 4 },
                            249: { ins: d, mode: 9, size: 3, cycles: 4 },
                            225: { ins: d, mode: h, size: 2, cycles: 6 },
                            241: { ins: d, mode: a, size: 2, cycles: 5 },
                            56: { ins: 44, mode: 2, size: 1, cycles: 2 },
                            248: { ins: 45, mode: 2, size: 1, cycles: 2 },
                            120: { ins: 46, mode: 2, size: 1, cycles: 2 },
                            133: { ins: u, mode: 0, size: 2, cycles: 3 },
                            149: { ins: u, mode: 6, size: 2, cycles: 4 },
                            141: { ins: u, mode: 3, size: 3, cycles: 4 },
                            157: { ins: u, mode: 8, size: 3, cycles: 5 },
                            153: { ins: u, mode: 9, size: 3, cycles: 5 },
                            129: { ins: u, mode: h, size: 2, cycles: 6 },
                            145: { ins: u, mode: a, size: 2, cycles: 6 },
                            134: { ins: 48, mode: 0, size: 2, cycles: 3 },
                            150: { ins: 48, mode: 7, size: 2, cycles: 4 },
                            142: { ins: 48, mode: 3, size: 3, cycles: 4 },
                            132: { ins: 49, mode: 0, size: 2, cycles: 3 },
                            148: { ins: 49, mode: 6, size: 2, cycles: 4 },
                            140: { ins: 49, mode: 3, size: 3, cycles: 4 },
                            170: { ins: 50, mode: 2, size: 1, cycles: 2 },
                            168: { ins: 51, mode: 2, size: 1, cycles: 2 },
                            186: { ins: 52, mode: 2, size: 1, cycles: 2 },
                            138: { ins: 53, mode: 2, size: 1, cycles: 2 },
                            154: { ins: 54, mode: 2, size: 1, cycles: 2 },
                            152: { ins: 55, mode: 2, size: 1, cycles: 2 },
                            75: { ins: 56, mode: 5, size: 2, cycles: 2 },
                            11: { ins: 57, mode: 5, size: 2, cycles: 2 },
                            43: { ins: 57, mode: 5, size: 2, cycles: 2 },
                            107: { ins: 58, mode: 5, size: 2, cycles: 2 },
                            203: { ins: 59, mode: 5, size: 2, cycles: 2 },
                            163: { ins: p, mode: h, size: 2, cycles: 6 },
                            167: { ins: p, mode: 0, size: 2, cycles: 3 },
                            175: { ins: p, mode: 3, size: 3, cycles: 4 },
                            179: { ins: p, mode: a, size: 2, cycles: 5 },
                            183: { ins: p, mode: 7, size: 2, cycles: 4 },
                            191: { ins: p, mode: 9, size: 3, cycles: 4 },
                            131: { ins: 61, mode: h, size: 2, cycles: 6 },
                            135: { ins: 61, mode: 0, size: 2, cycles: 3 },
                            143: { ins: 61, mode: 3, size: 3, cycles: 4 },
                            151: { ins: 61, mode: 7, size: 2, cycles: 4 },
                            195: { ins: g, mode: h, size: 2, cycles: 8 },
                            199: { ins: g, mode: 0, size: 2, cycles: 5 },
                            207: { ins: g, mode: 3, size: 3, cycles: 6 },
                            211: { ins: g, mode: a, size: 2, cycles: 8 },
                            215: { ins: g, mode: 6, size: 2, cycles: 6 },
                            219: { ins: g, mode: 9, size: 3, cycles: 7 },
                            223: { ins: g, mode: 8, size: 3, cycles: 7 },
                            227: { ins: R, mode: h, size: 2, cycles: 8 },
                            231: { ins: R, mode: 0, size: 2, cycles: 5 },
                            239: { ins: R, mode: 3, size: 3, cycles: 6 },
                            243: { ins: R, mode: a, size: 2, cycles: 8 },
                            247: { ins: R, mode: 6, size: 2, cycles: 6 },
                            251: { ins: R, mode: 9, size: 3, cycles: 7 },
                            255: { ins: R, mode: 8, size: 3, cycles: 7 },
                            35: { ins: C, mode: h, size: 2, cycles: 8 },
                            39: { ins: C, mode: 0, size: 2, cycles: 5 },
                            47: { ins: C, mode: 3, size: 3, cycles: 6 },
                            51: { ins: C, mode: a, size: 2, cycles: 8 },
                            55: { ins: C, mode: 6, size: 2, cycles: 6 },
                            59: { ins: C, mode: 9, size: 3, cycles: 7 },
                            63: { ins: C, mode: 8, size: 3, cycles: 7 },
                            99: { ins: _, mode: h, size: 2, cycles: 8 },
                            103: { ins: _, mode: 0, size: 2, cycles: 5 },
                            111: { ins: _, mode: 3, size: 3, cycles: 6 },
                            115: { ins: _, mode: a, size: 2, cycles: 8 },
                            119: { ins: _, mode: 6, size: 2, cycles: 6 },
                            123: { ins: _, mode: 9, size: 3, cycles: 7 },
                            127: { ins: _, mode: 8, size: 3, cycles: 7 },
                            3: { ins: b, mode: h, size: 2, cycles: 8 },
                            7: { ins: b, mode: 0, size: 2, cycles: 5 },
                            15: { ins: b, mode: 3, size: 3, cycles: 6 },
                            19: { ins: b, mode: a, size: 2, cycles: 8 },
                            23: { ins: b, mode: 6, size: 2, cycles: 6 },
                            27: { ins: b, mode: 9, size: 3, cycles: 7 },
                            31: { ins: b, mode: 8, size: 3, cycles: 7 },
                            67: { ins: y, mode: h, size: 2, cycles: 8 },
                            71: { ins: y, mode: 0, size: 2, cycles: 5 },
                            79: { ins: y, mode: 3, size: 3, cycles: 6 },
                            83: { ins: y, mode: a, size: 2, cycles: 8 },
                            87: { ins: y, mode: 6, size: 2, cycles: 6 },
                            91: { ins: y, mode: 9, size: 3, cycles: 7 },
                            95: { ins: y, mode: 8, size: 3, cycles: 7 },
                            128: { ins: 68, mode: 5, size: 2, cycles: 2 },
                            130: { ins: 68, mode: 5, size: 2, cycles: 2 },
                            137: { ins: 68, mode: 5, size: 2, cycles: 2 },
                            194: { ins: 68, mode: 5, size: 2, cycles: 2 },
                            226: { ins: 68, mode: 5, size: 2, cycles: 2 },
                            12: { ins: f, mode: 3, size: 3, cycles: 4 },
                            28: { ins: f, mode: 8, size: 3, cycles: 4 },
                            60: { ins: f, mode: 8, size: 3, cycles: 4 },
                            92: { ins: f, mode: 8, size: 3, cycles: 4 },
                            124: { ins: f, mode: 8, size: 3, cycles: 4 },
                            220: { ins: f, mode: 8, size: 3, cycles: 4 },
                            252: { ins: f, mode: 8, size: 3, cycles: 4 },
                            4: { ins: f, mode: 0, size: 2, cycles: 3 },
                            68: { ins: f, mode: 0, size: 2, cycles: 3 },
                            100: { ins: f, mode: 0, size: 2, cycles: 3 },
                            20: { ins: f, mode: 6, size: 2, cycles: 4 },
                            52: { ins: f, mode: 6, size: 2, cycles: 4 },
                            84: { ins: f, mode: 6, size: 2, cycles: 4 },
                            116: { ins: f, mode: 6, size: 2, cycles: 4 },
                            212: { ins: f, mode: 6, size: 2, cycles: 4 },
                            244: { ins: f, mode: 6, size: 2, cycles: 4 },
                            147: { ins: 71, mode: a, size: 2, cycles: 6 },
                            159: { ins: 71, mode: 9, size: 3, cycles: 5 },
                            155: { ins: 72, mode: 9, size: 3, cycles: 5 },
                            156: { ins: 73, mode: 8, size: 3, cycles: 5 },
                            158: { ins: 74, mode: 9, size: 3, cycles: 5 },
                            187: { ins: 75, mode: 9, size: 3, cycles: 4 },
                            139: { ins: 76, mode: 5, size: 2, cycles: 2 },
                            171: { ins: 77, mode: 5, size: 2, cycles: 2 },
                        };
                    const E = class {
                        IRQ_NORMAL = 0;
                        IRQ_NMI = 1;
                        IRQ_RESET = 2;
                        constructor(t) {
                            (this.nes = t), (this.mem = new Uint8Array(65536)), this.mem.fill(255, 0, 8192);
                            for (let t = 0; t < 4; t++) {
                                let e = 2048 * t;
                                (this.mem[e + 8] = 247),
                                    (this.mem[e + 9] = 239),
                                    (this.mem[e + 10] = 223),
                                    (this.mem[e + 15] = 191);
                            }
                            (this.REG_ACC = 0),
                                (this.REG_X = 0),
                                (this.REG_Y = 0),
                                (this.REG_SP = 511),
                                (this.REG_PC = 32767),
                                (this.REG_PC_NEW = 32767),
                                (this.REG_STATUS = 40),
                                this.setStatus(40),
                                (this.F_CARRY = 0),
                                (this.F_DECIMAL = 0),
                                (this.F_INTERRUPT = 1),
                                (this.F_INTERRUPT_NEW = 1),
                                (this.F_OVERFLOW = 0),
                                (this.F_SIGN = 0),
                                (this.F_ZERO = 1),
                                (this.F_NOTUSED = 1),
                                (this.F_NOTUSED_NEW = 1),
                                (this.F_BRK = 1),
                                (this.F_BRK_NEW = 1),
                                (this.cyclesToHalt = 0),
                                (this.crash = !1),
                                (this.irqRequested = !1),
                                (this.irqType = null),
                                (this.nmiRaised = !1),
                                (this.nmiPending = !1),
                                (this.nmiImmediate = !1),
                                (this.dataBus = 0),
                                (this.instrBusCycles = 0),
                                (this.apuCatchupCycles = 0),
                                (this._cpuCycleBase = 0),
                                (this.nmiRaisedAtCycle = 0),
                                (this.nmiDotsRemainingInStep = 0);
                        }
                        emulate() {
                            if (this.nmiImmediate)
                                return (
                                    (this.nmiImmediate = !1),
                                    (this.nmiPending = !1),
                                    (this.nmiRaised = !1),
                                    (this.instrBusCycles = 0),
                                    (this.REG_PC_NEW = this.REG_PC),
                                    (this.F_INTERRUPT_NEW = this.F_INTERRUPT),
                                    this.doNonMaskableInterrupt(239 & this.getStatus()),
                                    (this.REG_PC = this.REG_PC_NEW),
                                    (this.F_INTERRUPT = this.F_INTERRUPT_NEW),
                                    (this.F_BRK = this.F_BRK_NEW),
                                    (this._cpuCycleBase += 7),
                                    7
                                );
                            let t,
                                e,
                                s = 0,
                                i = 0;
                            if (
                                (this.nmiRaised && ((this.nmiPending = !0), (this.nmiRaised = !1)), this.irqRequested)
                            ) {
                                switch (
                                    ((t = this.getStatus()),
                                    (this.REG_PC_NEW = this.REG_PC),
                                    (this.F_INTERRUPT_NEW = this.F_INTERRUPT),
                                    this.irqType)
                                ) {
                                    case 0:
                                        if (0 !== this.F_INTERRUPT) break;
                                        this.doIrq(239 & t), (i = 7);
                                        break;
                                    case 2:
                                        this.doResetInterrupt(), (i = 7);
                                }
                                (this.REG_PC = this.REG_PC_NEW),
                                    (this.F_INTERRUPT = this.F_INTERRUPT_NEW),
                                    (this.F_BRK = this.F_BRK_NEW),
                                    (this.irqRequested = !1);
                            }
                            if (null === this.nes.mmap) return 32;
                            (this.instrBusCycles = 0),
                                (this.apuCatchupCycles = 0),
                                (this.nmiDotsRemainingInStep = 0),
                                (this._dmcFetchCycles = this._cyclesToNextDmcFetch());
                            let r = this.loadFromCartridge(this.REG_PC + 1);
                            (this.dataBus = r), (this.instrBusCycles = 1), this.nes.ppu.advanceDots(3);
                            let h = T[r] ?? S,
                                n = h.cycles,
                                o = 0,
                                l = h.mode,
                                c = this.REG_PC;
                            this.REG_PC += h.size;
                            let m = 0;
                            switch (l) {
                                case 0:
                                    m = this.loadDirect(c + 2);
                                    break;
                                case 1:
                                    (m = this.loadDirect(c + 2)), (m += m < 128 ? this.REG_PC : this.REG_PC - 256);
                                    break;
                                case 2:
                                    this.loadDirect(c + 2);
                                    break;
                                case 3:
                                    m = this.load16bit(c + 2);
                                    break;
                                case 4:
                                    this.loadDirect(c + 2), (m = this.REG_ACC);
                                    break;
                                case 5:
                                    m = this.REG_PC;
                                    break;
                                case 6: {
                                    let t = this.loadDirect(c + 2);
                                    this.loadDirect(t), (m = (t + this.REG_X) & 255);
                                    break;
                                }
                                case 7: {
                                    let t = this.loadDirect(c + 2);
                                    this.loadDirect(t), (m = (t + this.REG_Y) & 255);
                                    break;
                                }
                                case 8:
                                    (m = this.load16bit(c + 2)),
                                        (s = (m >> 8) & 255),
                                        (65280 & m) != ((m + this.REG_X) & 65280) &&
                                            (this.load((65280 & m) | ((m + this.REG_X) & 255)), (o = 1)),
                                        (m += this.REG_X);
                                    break;
                                case 9:
                                    (m = this.load16bit(c + 2)),
                                        (s = (m >> 8) & 255),
                                        (65280 & m) != ((m + this.REG_Y) & 65280) &&
                                            (this.load((65280 & m) | ((m + this.REG_Y) & 255)), (o = 1)),
                                        (m += this.REG_Y);
                                    break;
                                case 10: {
                                    let t = this.loadDirect(c + 2);
                                    this.loadDirect(t);
                                    let e = (t + this.REG_X) & 255;
                                    m = this.loadDirect(e) | (this.loadDirect((e + 1) & 255) << 8);
                                    break;
                                }
                                case 11: {
                                    let t = this.loadDirect(c + 2);
                                    (m = this.loadDirect(t) | (this.loadDirect((t + 1) & 255) << 8)),
                                        (s = (m >> 8) & 255),
                                        (65280 & m) != ((m + this.REG_Y) & 65280) &&
                                            (this.load((65280 & m) | ((m + this.REG_Y) & 255)), (o = 1)),
                                        (m += this.REG_Y);
                                    break;
                                }
                                case 12:
                                    m = this.load16bit(c + 2);
                                    var d = (65280 & m) | ((1 + (255 & m)) & 255);
                                    m = this.load(m) | (this.load(d) << 8);
                            }
                            switch (((m &= 65535), h.ins)) {
                                case 0:
                                    (e = this.load(m)),
                                        (t = this.REG_ACC + e + this.F_CARRY),
                                        !(128 & (this.REG_ACC ^ e)) && 128 & (this.REG_ACC ^ t)
                                            ? (this.F_OVERFLOW = 1)
                                            : (this.F_OVERFLOW = 0),
                                        (this.F_CARRY = t > 255 ? 1 : 0),
                                        (this.F_SIGN = (t >> 7) & 1),
                                        (this.F_ZERO = 255 & t),
                                        (this.REG_ACC = 255 & t),
                                        (n += o);
                                    break;
                                case 1:
                                    (this.REG_ACC = this.REG_ACC & this.load(m)),
                                        (this.F_SIGN = (this.REG_ACC >> 7) & 1),
                                        (this.F_ZERO = this.REG_ACC),
                                        (n += o);
                                    break;
                                case 2:
                                    4 === l
                                        ? ((this.F_CARRY = (this.REG_ACC >> 7) & 1),
                                          (this.REG_ACC = (this.REG_ACC << 1) & 255),
                                          (this.F_SIGN = (this.REG_ACC >> 7) & 1),
                                          (this.F_ZERO = this.REG_ACC))
                                        : (0 !== o || (8 !== l && 9 !== l && l !== a) || this.load(m),
                                          (t = this.load(m)),
                                          this.write(m, t),
                                          (this.F_CARRY = (t >> 7) & 1),
                                          (t = (t << 1) & 255),
                                          (this.F_SIGN = (t >> 7) & 1),
                                          (this.F_ZERO = t),
                                          this.write(m, t));
                                    break;
                                case 3:
                                    0 === this.F_CARRY && (n += this._takeBranch(c, m));
                                    break;
                                case 4:
                                    1 === this.F_CARRY && (n += this._takeBranch(c, m));
                                    break;
                                case 5:
                                    0 === this.F_ZERO && (n += this._takeBranch(c, m));
                                    break;
                                case 6:
                                    (t = this.load(m)),
                                        (this.F_SIGN = (t >> 7) & 1),
                                        (this.F_OVERFLOW = (t >> 6) & 1),
                                        (t &= this.REG_ACC),
                                        (this.F_ZERO = t);
                                    break;
                                case 7:
                                    1 === this.F_SIGN && (n += this._takeBranch(c, m));
                                    break;
                                case 8:
                                    0 !== this.F_ZERO && (n += this._takeBranch(c, m));
                                    break;
                                case 9:
                                    0 === this.F_SIGN && (n += this._takeBranch(c, m));
                                    break;
                                case 10:
                                    (this.REG_PC += 2),
                                        this.push((this.REG_PC >> 8) & 255),
                                        this.push(255 & this.REG_PC),
                                        (this.F_BRK = 1),
                                        this.push(this.getStatus()),
                                        (this.F_INTERRUPT = 1),
                                        (this.REG_PC = this.load16bit(65534)),
                                        this.REG_PC--;
                                    break;
                                case 11:
                                    0 === this.F_OVERFLOW && (n += this._takeBranch(c, m));
                                    break;
                                case 12:
                                    1 === this.F_OVERFLOW && (n += this._takeBranch(c, m));
                                    break;
                                case 13:
                                    this.F_CARRY = 0;
                                    break;
                                case 14:
                                    this.F_DECIMAL = 0;
                                    break;
                                case 15:
                                    this.F_INTERRUPT = 0;
                                    break;
                                case 16:
                                    this.F_OVERFLOW = 0;
                                    break;
                                case 17:
                                    (t = this.REG_ACC - this.load(m)),
                                        (this.F_CARRY = t >= 0 ? 1 : 0),
                                        (this.F_SIGN = (t >> 7) & 1),
                                        (this.F_ZERO = 255 & t),
                                        (n += o);
                                    break;
                                case 18:
                                    (t = this.REG_X - this.load(m)),
                                        (this.F_CARRY = t >= 0 ? 1 : 0),
                                        (this.F_SIGN = (t >> 7) & 1),
                                        (this.F_ZERO = 255 & t);
                                    break;
                                case 19:
                                    (t = this.REG_Y - this.load(m)),
                                        (this.F_CARRY = t >= 0 ? 1 : 0),
                                        (this.F_SIGN = (t >> 7) & 1),
                                        (this.F_ZERO = 255 & t);
                                    break;
                                case 20:
                                    0 !== o || (8 !== l && 9 !== l && l !== a) || this.load(m),
                                        (t = this.load(m)),
                                        this.write(m, t),
                                        (t = (t - 1) & 255),
                                        (this.F_SIGN = (t >> 7) & 1),
                                        (this.F_ZERO = t),
                                        this.write(m, t);
                                    break;
                                case 21:
                                    (this.REG_X = (this.REG_X - 1) & 255),
                                        (this.F_SIGN = (this.REG_X >> 7) & 1),
                                        (this.F_ZERO = this.REG_X);
                                    break;
                                case 22:
                                    (this.REG_Y = (this.REG_Y - 1) & 255),
                                        (this.F_SIGN = (this.REG_Y >> 7) & 1),
                                        (this.F_ZERO = this.REG_Y);
                                    break;
                                case 23:
                                    (this.REG_ACC = 255 & (this.load(m) ^ this.REG_ACC)),
                                        (this.F_SIGN = (this.REG_ACC >> 7) & 1),
                                        (this.F_ZERO = this.REG_ACC),
                                        (n += o);
                                    break;
                                case 24:
                                    0 !== o || (8 !== l && 9 !== l && l !== a) || this.load(m),
                                        (t = this.load(m)),
                                        this.write(m, t),
                                        (t = (t + 1) & 255),
                                        (this.F_SIGN = (t >> 7) & 1),
                                        (this.F_ZERO = t),
                                        this.write(m, t);
                                    break;
                                case 25:
                                    (this.REG_X = (this.REG_X + 1) & 255),
                                        (this.F_SIGN = (this.REG_X >> 7) & 1),
                                        (this.F_ZERO = this.REG_X);
                                    break;
                                case 26:
                                    this.REG_Y++,
                                        (this.REG_Y &= 255),
                                        (this.F_SIGN = (this.REG_Y >> 7) & 1),
                                        (this.F_ZERO = this.REG_Y);
                                    break;
                                case 27:
                                    this.REG_PC = m - 1;
                                    break;
                                case 28:
                                    this.push((this.REG_PC >> 8) & 255),
                                        this.push(255 & this.REG_PC),
                                        this.loadDirect(c + 3),
                                        (this.REG_PC = m - 1);
                                    break;
                                case 29:
                                    (this.REG_ACC = this.load(m)),
                                        (this.F_SIGN = (this.REG_ACC >> 7) & 1),
                                        (this.F_ZERO = this.REG_ACC),
                                        (n += o);
                                    break;
                                case 30:
                                    (this.REG_X = this.load(m)),
                                        (this.F_SIGN = (this.REG_X >> 7) & 1),
                                        (this.F_ZERO = this.REG_X),
                                        (n += o);
                                    break;
                                case 31:
                                    (this.REG_Y = this.load(m)),
                                        (this.F_SIGN = (this.REG_Y >> 7) & 1),
                                        (this.F_ZERO = this.REG_Y),
                                        (n += o);
                                    break;
                                case 32:
                                    4 === l
                                        ? ((t = 255 & this.REG_ACC),
                                          (this.F_CARRY = 1 & t),
                                          (t >>= 1),
                                          (this.REG_ACC = t))
                                        : (0 !== o || (8 !== l && 9 !== l && l !== a) || this.load(m),
                                          (t = 255 & this.load(m)),
                                          this.write(m, t),
                                          (this.F_CARRY = 1 & t),
                                          (t >>= 1),
                                          this.write(m, t)),
                                        (this.F_SIGN = 0),
                                        (this.F_ZERO = t);
                                    break;
                                case 33:
                                case 68:
                                    break;
                                case 34:
                                    (t = 255 & (this.load(m) | this.REG_ACC)),
                                        (this.F_SIGN = (t >> 7) & 1),
                                        (this.F_ZERO = t),
                                        (this.REG_ACC = t),
                                        (n += o);
                                    break;
                                case 35:
                                    this.push(this.REG_ACC);
                                    break;
                                case 36:
                                    (this.F_BRK = 1), this.push(this.getStatus());
                                    break;
                                case 37:
                                    (this.REG_ACC = this.pull()),
                                        (this.F_SIGN = (this.REG_ACC >> 7) & 1),
                                        (this.F_ZERO = this.REG_ACC);
                                    break;
                                case 38:
                                    this.setStatusFromStack(this.pull());
                                    break;
                                case 39:
                                    4 === l
                                        ? ((t = this.REG_ACC),
                                          (e = this.F_CARRY),
                                          (this.F_CARRY = (t >> 7) & 1),
                                          (t = ((t << 1) & 255) + e),
                                          (this.REG_ACC = t))
                                        : (0 !== o || (8 !== l && 9 !== l && l !== a) || this.load(m),
                                          (t = this.load(m)),
                                          this.write(m, t),
                                          (e = this.F_CARRY),
                                          (this.F_CARRY = (t >> 7) & 1),
                                          (t = ((t << 1) & 255) + e),
                                          this.write(m, t)),
                                        (this.F_SIGN = (t >> 7) & 1),
                                        (this.F_ZERO = t);
                                    break;
                                case 40:
                                    4 === l
                                        ? ((e = this.F_CARRY << 7),
                                          (this.F_CARRY = 1 & this.REG_ACC),
                                          (t = (this.REG_ACC >> 1) + e),
                                          (this.REG_ACC = t))
                                        : (0 !== o || (8 !== l && 9 !== l && l !== a) || this.load(m),
                                          (t = this.load(m)),
                                          this.write(m, t),
                                          (e = this.F_CARRY << 7),
                                          (this.F_CARRY = 1 & t),
                                          (t = (t >> 1) + e),
                                          this.write(m, t)),
                                        (this.F_SIGN = (t >> 7) & 1),
                                        (this.F_ZERO = t);
                                    break;
                                case 41:
                                    if (
                                        (this.setStatusFromStack(this.pull()),
                                        (this.REG_PC = this.pull()),
                                        (this.REG_PC += this.pull() << 8),
                                        65535 === this.REG_PC)
                                    )
                                        return;
                                    this.REG_PC--;
                                    break;
                                case 42:
                                    if (
                                        ((this.REG_PC = this.pull()),
                                        (this.REG_PC += this.pull() << 8),
                                        65535 === this.REG_PC)
                                    )
                                        return;
                                    break;
                                case 43:
                                    (e = this.load(m)),
                                        (t = this.REG_ACC - e - (1 - this.F_CARRY)),
                                        (this.F_SIGN = (t >> 7) & 1),
                                        (this.F_ZERO = 255 & t),
                                        128 & (this.REG_ACC ^ t) && 128 & (this.REG_ACC ^ e)
                                            ? (this.F_OVERFLOW = 1)
                                            : (this.F_OVERFLOW = 0),
                                        (this.F_CARRY = t < 0 ? 0 : 1),
                                        (this.REG_ACC = 255 & t),
                                        (n += o);
                                    break;
                                case 44:
                                    this.F_CARRY = 1;
                                    break;
                                case 45:
                                    this.F_DECIMAL = 1;
                                    break;
                                case 46:
                                    this.F_INTERRUPT = 1;
                                    break;
                                case 47:
                                    0 !== o || (8 !== l && 9 !== l && l !== a) || this.load(m),
                                        this.write(m, this.REG_ACC);
                                    break;
                                case 48:
                                    this.write(m, this.REG_X);
                                    break;
                                case 49:
                                    this.write(m, this.REG_Y);
                                    break;
                                case 50:
                                    (this.REG_X = this.REG_ACC),
                                        (this.F_SIGN = (this.REG_ACC >> 7) & 1),
                                        (this.F_ZERO = this.REG_ACC);
                                    break;
                                case 51:
                                    (this.REG_Y = this.REG_ACC),
                                        (this.F_SIGN = (this.REG_ACC >> 7) & 1),
                                        (this.F_ZERO = this.REG_ACC);
                                    break;
                                case 52:
                                    (this.REG_X = 255 & this.REG_SP),
                                        (this.F_SIGN = (this.REG_SP >> 7) & 1),
                                        (this.F_ZERO = this.REG_X);
                                    break;
                                case 53:
                                    (this.REG_ACC = this.REG_X),
                                        (this.F_SIGN = (this.REG_X >> 7) & 1),
                                        (this.F_ZERO = this.REG_X);
                                    break;
                                case 54:
                                    this.REG_SP = 255 & this.REG_X;
                                    break;
                                case 55:
                                    (this.REG_ACC = this.REG_Y),
                                        (this.F_SIGN = (this.REG_Y >> 7) & 1),
                                        (this.F_ZERO = this.REG_Y);
                                    break;
                                case 56:
                                    (t = this.REG_ACC & this.load(m)),
                                        (this.F_CARRY = 1 & t),
                                        (this.REG_ACC = this.F_ZERO = t >> 1),
                                        (this.F_SIGN = 0);
                                    break;
                                case 57:
                                    (this.REG_ACC = this.F_ZERO = this.REG_ACC & this.load(m)),
                                        (this.F_CARRY = this.F_SIGN = (this.REG_ACC >> 7) & 1);
                                    break;
                                case 58:
                                    (t = this.REG_ACC & this.load(m)),
                                        (this.REG_ACC = this.F_ZERO = (t >> 1) + (this.F_CARRY << 7)),
                                        (this.F_SIGN = this.F_CARRY),
                                        (this.F_CARRY = (t >> 7) & 1),
                                        (this.F_OVERFLOW = 1 & ((t >> 7) ^ (t >> 6)));
                                    break;
                                case 59:
                                    (t = (this.REG_X & this.REG_ACC) - this.load(m)),
                                        (this.F_SIGN = (t >> 7) & 1),
                                        (this.F_ZERO = 255 & t),
                                        (this.F_CARRY = t < 0 ? 0 : 1),
                                        (this.REG_X = 255 & t);
                                    break;
                                case 60:
                                    (this.REG_ACC = this.REG_X = this.F_ZERO = this.load(m)),
                                        (this.F_SIGN = (this.REG_ACC >> 7) & 1),
                                        (n += o);
                                    break;
                                case 61:
                                    this.write(m, this.REG_ACC & this.REG_X);
                                    break;
                                case 62:
                                    0 !== o || (8 !== l && 9 !== l && l !== a) || this.load(m),
                                        (t = this.load(m)),
                                        this.write(m, t),
                                        (t = (t - 1) & 255),
                                        this.write(m, t),
                                        (t = this.REG_ACC - t),
                                        (this.F_CARRY = t >= 0 ? 1 : 0),
                                        (this.F_SIGN = (t >> 7) & 1),
                                        (this.F_ZERO = 255 & t);
                                    break;
                                case 63: {
                                    0 !== o || (8 !== l && 9 !== l && l !== a) || this.load(m),
                                        (t = this.load(m)),
                                        this.write(m, t),
                                        (t = (t + 1) & 255),
                                        this.write(m, t);
                                    let e = t;
                                    (t = this.REG_ACC - e - (1 - this.F_CARRY)),
                                        (this.F_SIGN = (t >> 7) & 1),
                                        (this.F_ZERO = 255 & t),
                                        128 & (this.REG_ACC ^ t) && 128 & (this.REG_ACC ^ e)
                                            ? (this.F_OVERFLOW = 1)
                                            : (this.F_OVERFLOW = 0),
                                        (this.F_CARRY = t < 0 ? 0 : 1),
                                        (this.REG_ACC = 255 & t);
                                    break;
                                }
                                case 64:
                                    0 !== o || (8 !== l && 9 !== l && l !== a) || this.load(m),
                                        (t = this.load(m)),
                                        this.write(m, t),
                                        (e = this.F_CARRY),
                                        (this.F_CARRY = (t >> 7) & 1),
                                        (t = ((t << 1) & 255) + e),
                                        this.write(m, t),
                                        (this.REG_ACC = this.REG_ACC & t),
                                        (this.F_SIGN = (this.REG_ACC >> 7) & 1),
                                        (this.F_ZERO = this.REG_ACC);
                                    break;
                                case 65: {
                                    0 !== o || (8 !== l && 9 !== l && l !== a) || this.load(m),
                                        (t = this.load(m)),
                                        this.write(m, t),
                                        (e = this.F_CARRY << 7),
                                        (this.F_CARRY = 1 & t),
                                        (t = (t >> 1) + e),
                                        this.write(m, t);
                                    let s = t;
                                    (t = this.REG_ACC + s + this.F_CARRY),
                                        !(128 & (this.REG_ACC ^ s)) && 128 & (this.REG_ACC ^ t)
                                            ? (this.F_OVERFLOW = 1)
                                            : (this.F_OVERFLOW = 0),
                                        (this.F_CARRY = t > 255 ? 1 : 0),
                                        (this.F_SIGN = (t >> 7) & 1),
                                        (this.F_ZERO = 255 & t),
                                        (this.REG_ACC = 255 & t);
                                    break;
                                }
                                case 66:
                                    0 !== o || (8 !== l && 9 !== l && l !== a) || this.load(m),
                                        (t = this.load(m)),
                                        this.write(m, t),
                                        (this.F_CARRY = (t >> 7) & 1),
                                        (t = (t << 1) & 255),
                                        this.write(m, t),
                                        (this.REG_ACC = this.REG_ACC | t),
                                        (this.F_SIGN = (this.REG_ACC >> 7) & 1),
                                        (this.F_ZERO = this.REG_ACC);
                                    break;
                                case 67:
                                    0 !== o || (8 !== l && 9 !== l && l !== a) || this.load(m),
                                        (t = 255 & this.load(m)),
                                        this.write(m, t),
                                        (this.F_CARRY = 1 & t),
                                        (t >>= 1),
                                        this.write(m, t),
                                        (this.REG_ACC = this.REG_ACC ^ t),
                                        (this.F_SIGN = (this.REG_ACC >> 7) & 1),
                                        (this.F_ZERO = this.REG_ACC);
                                    break;
                                case 69:
                                    this.load(m), (n += o);
                                    break;
                                case 71: {
                                    0 === o && this.load(m);
                                    let t =
                                        this._dmcFetchCycles > 0 && this._dmcFetchCycles <= this.instrBusCycles
                                            ? this.REG_ACC & this.REG_X
                                            : this.REG_ACC & this.REG_X & (s + 1) & 255;
                                    1 === o && (m = (t << 8) | (255 & m)), this.write(m, t);
                                    break;
                                }
                                case 72: {
                                    0 === o && this.load(m);
                                    let t = this._dmcFetchCycles > 0 && this._dmcFetchCycles <= this.instrBusCycles;
                                    this.REG_SP = 256 | (this.REG_ACC & this.REG_X);
                                    let e = t ? 255 & this.REG_SP : 255 & this.REG_SP & (s + 1) & 255;
                                    1 === o && (m = (e << 8) | (255 & m)), this.write(m, e);
                                    break;
                                }
                                case 73: {
                                    0 === o && this.load(m);
                                    let t =
                                        this._dmcFetchCycles > 0 && this._dmcFetchCycles <= this.instrBusCycles
                                            ? this.REG_Y
                                            : this.REG_Y & (s + 1) & 255;
                                    1 === o && (m = (t << 8) | (255 & m)), this.write(m, t);
                                    break;
                                }
                                case 74: {
                                    0 === o && this.load(m);
                                    let t =
                                        this._dmcFetchCycles > 0 && this._dmcFetchCycles <= this.instrBusCycles
                                            ? this.REG_X
                                            : this.REG_X & (s + 1) & 255;
                                    1 === o && (m = (t << 8) | (255 & m)), this.write(m, t);
                                    break;
                                }
                                case 75:
                                    (t = 255 & this.load(m) & this.REG_SP),
                                        (this.REG_ACC = this.REG_X = this.F_ZERO = t),
                                        (this.REG_SP = 256 | t),
                                        (this.F_SIGN = (t >> 7) & 1),
                                        (n += o);
                                    break;
                                case 76:
                                    (this.REG_ACC = this.F_ZERO = (255 | this.REG_ACC) & this.REG_X & this.load(m)),
                                        (this.F_SIGN = (this.REG_ACC >> 7) & 1);
                                    break;
                                case 77:
                                    (this.REG_ACC = this.REG_X = this.F_ZERO = (255 | this.REG_ACC) & this.load(m)),
                                        (this.F_SIGN = (this.REG_ACC >> 7) & 1);
                                    break;
                                default:
                                    throw new Error(\`Game crashed, invalid opcode at address $\${c.toString(16)}\`);
                            }
                            if (this.instrBusCycles < n) {
                                let t = 3 * (n - this.instrBusCycles);
                                (this.instrBusCycles = n), this.nes.ppu.advanceDots(t);
                            }
                            if (this.nmiRaised) {
                                3 * (this.instrBusCycles - this.nmiRaisedAtCycle) + this.nmiDotsRemainingInStep >= 5 &&
                                    ((this.nmiImmediate = !0), (this.nmiRaised = !1));
                            }
                            return (
                                this.nmiPending &&
                                    ((this.REG_PC_NEW = this.REG_PC),
                                    (this.F_INTERRUPT_NEW = this.F_INTERRUPT),
                                    this.doNonMaskableInterrupt(239 & this.getStatus()),
                                    (this.REG_PC = this.REG_PC_NEW),
                                    (this.F_INTERRUPT = this.F_INTERRUPT_NEW),
                                    (this.F_BRK = this.F_BRK_NEW),
                                    (this.nmiPending = !1),
                                    (i = 7)),
                                (this._cpuCycleBase += n + i),
                                n + i
                            );
                        }
                        loadFromCartridge(t) {
                            return this.nes.mmap.load(t);
                        }
                        _loadFromCartridgePlain(t) {
                            return this.nes.mmap.load(t);
                        }
                        _loadFromCartridgeWithGameGenie(t) {
                            let e = this.nes.mmap.load(t);
                            return this.nes.gameGenie.applyCodes(t, e);
                        }
                        _updateCartridgeLoader() {
                            this.nes.gameGenie.enabled && this.nes.gameGenie.patches.length > 0
                                ? (this.loadFromCartridge = this._loadFromCartridgeWithGameGenie)
                                : delete this.loadFromCartridge;
                        }
                        load(t) {
                            if (t < 8192)
                                (this.dataBus = this.mem[2047 & t]), this.instrBusCycles++, this.nes.ppu.advanceDots(3);
                            else if (t >= 16384) {
                                if (16405 === t) {
                                    this.nes.papu.advanceFrameCounter(this.instrBusCycles - this.apuCatchupCycles),
                                        (this.apuCatchupCycles = this.instrBusCycles);
                                    let e = this.loadFromCartridge(t);
                                    return this.instrBusCycles++, this.nes.ppu.advanceDots(3), e;
                                }
                                (this.dataBus = this.loadFromCartridge(t)),
                                    this.instrBusCycles++,
                                    this.nes.ppu.advanceDots(3);
                            } else
                                this.instrBusCycles++,
                                    (this.dataBus = this.loadFromCartridge(t)),
                                    this.nes.ppu.advanceDots(3);
                            return this.dataBus;
                        }
                        loadDirect(t) {
                            return (
                                (this.dataBus = t < 8192 ? this.mem[2047 & t] : this.loadFromCartridge(t)),
                                this.instrBusCycles++,
                                this.nes.ppu.advanceDots(3),
                                this.dataBus
                            );
                        }
                        load16bit(t) {
                            let e;
                            return t < 8191
                                ? ((this.dataBus = this.mem[2047 & t]),
                                  (e = this.dataBus),
                                  this.instrBusCycles++,
                                  this.nes.ppu.advanceDots(3),
                                  (this.dataBus = this.mem[(t + 1) & 2047]),
                                  this.instrBusCycles++,
                                  this.nes.ppu.advanceDots(3),
                                  e | (this.dataBus << 8))
                                : ((this.dataBus = this.loadFromCartridge(t)),
                                  (e = this.dataBus),
                                  this.instrBusCycles++,
                                  this.nes.ppu.advanceDots(3),
                                  (this.dataBus = this.loadFromCartridge(t + 1)),
                                  this.instrBusCycles++,
                                  this.nes.ppu.advanceDots(3),
                                  e | (this.dataBus << 8));
                        }
                        write(t, e) {
                            t >= 8192 && t < 16384
                                ? (this.instrBusCycles++,
                                  (this.dataBus = e),
                                  this.nes.mmap.write(t, e),
                                  this.nes.ppu.advanceDots(3))
                                : ((this.dataBus = e),
                                  t < 8192 ? (this.mem[2047 & t] = e) : this.nes.mmap.write(t, e),
                                  this.instrBusCycles++,
                                  this.nes.ppu.advanceDots(3));
                        }
                        requestIrq(t) {
                            (this.irqRequested && t === this.IRQ_NORMAL) ||
                                ((this.irqRequested = !0), (this.irqType = t));
                        }
                        push(t) {
                            (this.dataBus = t),
                                (this.mem[256 | this.REG_SP] = t),
                                this.REG_SP--,
                                (this.REG_SP = 255 & this.REG_SP),
                                this.instrBusCycles++,
                                this.nes.ppu.advanceDots(3);
                        }
                        pull() {
                            return (
                                this.REG_SP++,
                                (this.REG_SP = 255 & this.REG_SP),
                                (this.dataBus = this.mem[256 | this.REG_SP]),
                                this.instrBusCycles++,
                                this.nes.ppu.advanceDots(3),
                                this.dataBus
                            );
                        }
                        _cyclesToNextDmcFetch() {
                            if (!this.nes.papu) return 2147483647;
                            let t = this.nes.papu.dmc;
                            if (!t || !t.isEnabled || t.dmaFrequency <= 0) return 2147483647;
                            if (!t.hasSample) return 2147483647;
                            let e = t.dmaFrequency >> 3,
                                s = (t.shiftCounter + 7) >> 3;
                            return s <= 0 && (s = e), s + (t.dmaCounter - 1) * e;
                        }
                        _takeBranch(t, e) {
                            let s = (t + 3) & 65535,
                                i = (e + 1) & 65535;
                            if ((this.load(s), (65280 & s) != (65280 & i))) {
                                let t = (65280 & s) | (255 & i);
                                return this.load(t), (this.REG_PC = e), 2;
                            }
                            return (this.REG_PC = e), 1;
                        }
                        pageCrossed(t, e) {
                            return (65280 & t) != (65280 & e);
                        }
                        haltCycles(t) {
                            this.cyclesToHalt += t;
                        }
                        doNonMaskableInterrupt(t) {
                            if (null === this.nes.mmap) return;
                            this.instrBusCycles++,
                                this.nes.ppu.advanceDots(3),
                                this.instrBusCycles++,
                                this.nes.ppu.advanceDots(3),
                                this.REG_PC_NEW++,
                                this.push((this.REG_PC_NEW >> 8) & 255),
                                this.push(255 & this.REG_PC_NEW),
                                (this.F_INTERRUPT_NEW = 1),
                                this.push(t),
                                (this.dataBus = this.loadFromCartridge(65530)),
                                this.instrBusCycles++,
                                this.nes.ppu.advanceDots(3);
                            let e = this.dataBus;
                            (this.dataBus = this.loadFromCartridge(65531)),
                                this.instrBusCycles++,
                                this.nes.ppu.advanceDots(3),
                                (this.REG_PC_NEW = e | (this.dataBus << 8)),
                                this.REG_PC_NEW--;
                        }
                        doResetInterrupt() {
                            (this.dataBus = this.loadFromCartridge(65532)),
                                this.instrBusCycles++,
                                this.nes.ppu.advanceDots(3);
                            let t = this.dataBus;
                            (this.dataBus = this.loadFromCartridge(65533)),
                                this.instrBusCycles++,
                                this.nes.ppu.advanceDots(3),
                                (this.REG_PC_NEW = t | (this.dataBus << 8)),
                                this.REG_PC_NEW--;
                        }
                        doIrq(t) {
                            this.REG_PC_NEW++,
                                this.push((this.REG_PC_NEW >> 8) & 255),
                                this.push(255 & this.REG_PC_NEW),
                                this.push(t),
                                (this.F_INTERRUPT_NEW = 1),
                                (this.F_BRK_NEW = 0),
                                (this.dataBus = this.loadFromCartridge(65534)),
                                this.instrBusCycles++,
                                this.nes.ppu.advanceDots(3);
                            let e = this.dataBus;
                            (this.dataBus = this.loadFromCartridge(65535)),
                                this.instrBusCycles++,
                                this.nes.ppu.advanceDots(3),
                                (this.REG_PC_NEW = e | (this.dataBus << 8)),
                                this.REG_PC_NEW--;
                        }
                        getStatus() {
                            return (
                                this.F_CARRY |
                                ((0 === this.F_ZERO ? 1 : 0) << 1) |
                                (this.F_INTERRUPT << 2) |
                                (this.F_DECIMAL << 3) |
                                (this.F_BRK << 4) |
                                (this.F_NOTUSED << 5) |
                                (this.F_OVERFLOW << 6) |
                                (this.F_SIGN << 7)
                            );
                        }
                        setStatus(t) {
                            (this.F_CARRY = 1 & t),
                                (this.F_ZERO = 1 == ((t >> 1) & 1) ? 0 : 1),
                                (this.F_INTERRUPT = (t >> 2) & 1),
                                (this.F_DECIMAL = (t >> 3) & 1),
                                (this.F_BRK = (t >> 4) & 1),
                                (this.F_NOTUSED = (t >> 5) & 1),
                                (this.F_OVERFLOW = (t >> 6) & 1),
                                (this.F_SIGN = (t >> 7) & 1);
                        }
                        setStatusFromStack(t) {
                            (this.F_CARRY = 1 & t),
                                (this.F_ZERO = 1 == ((t >> 1) & 1) ? 0 : 1),
                                (this.F_INTERRUPT = (t >> 2) & 1),
                                (this.F_DECIMAL = (t >> 3) & 1),
                                (this.F_OVERFLOW = (t >> 6) & 1),
                                (this.F_SIGN = (t >> 7) & 1);
                        }
                        static JSON_PROPERTIES = [
                            "mem",
                            "cyclesToHalt",
                            "dataBus",
                            "irqRequested",
                            "irqType",
                            "nmiRaised",
                            "nmiPending",
                            "nmiImmediate",
                            "REG_ACC",
                            "REG_X",
                            "REG_Y",
                            "REG_SP",
                            "REG_PC",
                            "REG_PC_NEW",
                            "REG_STATUS",
                            "F_CARRY",
                            "F_DECIMAL",
                            "F_INTERRUPT",
                            "F_INTERRUPT_NEW",
                            "F_OVERFLOW",
                            "F_SIGN",
                            "F_ZERO",
                            "F_NOTUSED",
                            "F_NOTUSED_NEW",
                            "F_BRK",
                            "F_BRK_NEW",
                            "_cpuCycleBase",
                        ];
                        toJSON() {
                            return r(this);
                        }
                        fromJSON(t) {
                            i(this, t);
                        }
                    };
                    class k {
                        static BUTTON_A = 0;
                        static BUTTON_B = 1;
                        static BUTTON_SELECT = 2;
                        static BUTTON_START = 3;
                        static BUTTON_UP = 4;
                        static BUTTON_DOWN = 5;
                        static BUTTON_LEFT = 6;
                        static BUTTON_RIGHT = 7;
                        static BUTTON_TURBO_A = 8;
                        static BUTTON_TURBO_B = 9;
                        static JSON_PROPERTIES = ["state", "baseA", "baseB", "turboA", "turboB", "turboToggle"];
                        constructor() {
                            this.state = new Array(8);
                            for (let t = 0; t < this.state.length; t++) this.state[t] = 64;
                            (this.baseA = 64),
                                (this.baseB = 64),
                                (this.turboA = !1),
                                (this.turboB = !1),
                                (this.turboToggle = !1);
                        }
                        buttonDown(t) {
                            t === k.BUTTON_TURBO_A
                                ? (this.turboA = !0)
                                : t === k.BUTTON_TURBO_B
                                  ? (this.turboB = !0)
                                  : ((this.state[t] = 65),
                                    t === k.BUTTON_A && (this.baseA = 65),
                                    t === k.BUTTON_B && (this.baseB = 65));
                        }
                        buttonUp(t) {
                            t === k.BUTTON_TURBO_A
                                ? ((this.turboA = !1), (this.state[k.BUTTON_A] = this.baseA))
                                : t === k.BUTTON_TURBO_B
                                  ? ((this.turboB = !1), (this.state[k.BUTTON_B] = this.baseB))
                                  : ((this.state[t] = 64),
                                    t === k.BUTTON_A && (this.baseA = 64),
                                    t === k.BUTTON_B && (this.baseB = 64));
                        }
                        clock() {
                            (this.turboA || this.turboB) &&
                                ((this.turboToggle = !this.turboToggle),
                                this.turboA && (this.state[k.BUTTON_A] = this.turboToggle ? 65 : 64),
                                this.turboB && (this.state[k.BUTTON_B] = this.turboToggle ? 65 : 64));
                        }
                        toJSON() {
                            return r(this);
                        }
                        fromJSON(t) {
                            i(this, t);
                        }
                    }
                    const A = k;
                    const B = class {
                        constructor() {
                            (this.pix = new Uint8Array(64)), (this.initialized = !1), (this.opaque = new Uint8Array(8));
                        }
                        setBuffer(t) {
                            for (let e = 0; e < 8; e++) this.setScanline(e, t[e], t[e + 8]);
                        }
                        setScanline(t, e, s) {
                            this.initialized = !0;
                            let i = t << 3;
                            for (let r = 0; r < 8; r++)
                                (this.pix[i + r] = ((e >> (7 - r)) & 1) + (((s >> (7 - r)) & 1) << 1)),
                                    0 === this.pix[i + r] && (this.opaque[t] = !1);
                        }
                        render(t, e, s, i, r, h, a, n, o, l, c, m, d) {
                            if (h < -7 || h >= 256 || a < -7 || a >= 240) return;
                            let u, p, g, R;
                            if (
                                (h < 0 && (e -= h),
                                h + i >= 256 && (i = 256 - h),
                                a < 0 && (s -= a),
                                a + r >= 240 && (r = 240 - a),
                                l || c)
                            )
                                if (l && !c) {
                                    (u = (a << 8) + h), (p = 7);
                                    for (let h = 0; h < 8; h++) {
                                        for (let a = 0; a < 8; a++)
                                            a >= e &&
                                                a < i &&
                                                h >= s &&
                                                h < r &&
                                                ((g = this.pix[p]),
                                                (R = d[u]),
                                                0 !== g &&
                                                    m <= (255 & R) &&
                                                    ((t[u] = o[g + n]), (R = (3840 & R) | m), (d[u] = R))),
                                                u++,
                                                p--;
                                        (u -= 8), (u += 256), (p += 16);
                                    }
                                } else if (c && !l) {
                                    (u = (a << 8) + h), (p = 56);
                                    for (let h = 0; h < 8; h++) {
                                        for (let a = 0; a < 8; a++)
                                            a >= e &&
                                                a < i &&
                                                h >= s &&
                                                h < r &&
                                                ((g = this.pix[p]),
                                                (R = d[u]),
                                                0 !== g &&
                                                    m <= (255 & R) &&
                                                    ((t[u] = o[g + n]), (R = (3840 & R) | m), (d[u] = R))),
                                                u++,
                                                p++;
                                        (u -= 8), (u += 256), (p -= 16);
                                    }
                                } else {
                                    (u = (a << 8) + h), (p = 63);
                                    for (let h = 0; h < 8; h++) {
                                        for (let a = 0; a < 8; a++)
                                            a >= e &&
                                                a < i &&
                                                h >= s &&
                                                h < r &&
                                                ((g = this.pix[p]),
                                                (R = d[u]),
                                                0 !== g &&
                                                    m <= (255 & R) &&
                                                    ((t[u] = o[g + n]), (R = (3840 & R) | m), (d[u] = R))),
                                                u++,
                                                p--;
                                        (u -= 8), (u += 256);
                                    }
                                }
                            else {
                                (u = (a << 8) + h), (p = 0);
                                for (let h = 0; h < 8; h++) {
                                    for (let a = 0; a < 8; a++)
                                        a >= e &&
                                            a < i &&
                                            h >= s &&
                                            h < r &&
                                            ((g = this.pix[p]),
                                            (R = d[u]),
                                            0 !== g &&
                                                m <= (255 & R) &&
                                                ((t[u] = o[g + n]), (R = (3840 & R) | m), (d[u] = R))),
                                            u++,
                                            p++;
                                    (u -= 8), (u += 256);
                                }
                            }
                        }
                        isTransparent(t, e) {
                            return 0 === this.pix[(e << 3) + t];
                        }
                        toJSON() {
                            return { opaque: Array.from(this.opaque), pix: Array.from(this.pix) };
                        }
                        fromJSON(t) {
                            this.opaque.set(t.opaque), this.pix.set(t.pix);
                        }
                    };
                    const M = class {
                        constructor(t, e, s) {
                            (this.width = t),
                                (this.height = e),
                                (this.name = s),
                                (this.tile = new Uint8Array(t * e)),
                                (this.attrib = new Uint8Array(t * e));
                        }
                        getTileIndex(t, e) {
                            return this.tile[e * this.width + t];
                        }
                        getAttrib(t, e) {
                            return this.attrib[e * this.width + t];
                        }
                        writeAttrib(t, e) {
                            let s,
                                i,
                                r,
                                h,
                                a = (t % 8) * 4,
                                n = 4 * Math.floor(t / 8);
                            for (let t = 0; t < 2; t++)
                                for (let o = 0; o < 2; o++) {
                                    s = (e >> (2 * (2 * t + o))) & 3;
                                    for (let e = 0; e < 2; e++)
                                        for (let l = 0; l < 2; l++)
                                            (i = a + 2 * o + l),
                                                (r = n + 2 * t + e),
                                                (h = r * this.width + i),
                                                (this.attrib[h] = (s << 2) & 12);
                                }
                        }
                        toJSON() {
                            return { tile: Array.from(this.tile), attrib: Array.from(this.attrib) };
                        }
                        fromJSON(t) {
                            this.tile.set(t.tile), this.attrib.set(t.attrib);
                        }
                    };
                    const F = class {
                        constructor() {
                            (this.curTable = new Uint32Array(64)),
                                (this.emphTable = new Array(8)),
                                (this.currentEmph = -1);
                        }
                        loadNTSCPalette() {
                            (this.curTable = new Uint32Array([
                                5395026, 11796480, 10485760, 11599933, 7602281, 91, 95, 6208, 12048, 543240, 26368,
                                1196544, 7153664, 0, 0, 0, 12899815, 16728064, 14421538, 16729963, 14090399, 6818519,
                                6588, 21681, 27227, 35843, 43776, 2918400, 10777088, 0, 0, 0, 16316664, 16755516,
                                16742785, 16735173, 16730354, 14633471, 4681215, 46327, 57599, 58229, 259115, 7911470,
                                15065624, 7895160, 0, 0, 16777215, 16773822, 16300216, 16300248, 16758527, 16761855,
                                13095423, 10148607, 8973816, 8650717, 12122296, 16119980, 16777136, 16308472, 0, 0,
                            ])),
                                this.makeTables(),
                                this.setEmphasis(0);
                        }
                        loadPALPalette() {
                            (this.curTable = new Uint32Array([
                                5395026, 11796480, 10485760, 11599933, 7602281, 91, 95, 6208, 12048, 543240, 26368,
                                1196544, 7153664, 0, 0, 0, 12899815, 16728064, 14421538, 16729963, 14090399, 6818519,
                                6588, 21681, 27227, 35843, 43776, 2918400, 10777088, 0, 0, 0, 16316664, 16755516,
                                16742785, 16735173, 16730354, 14633471, 4681215, 46327, 57599, 58229, 259115, 7911470,
                                15065624, 7895160, 0, 0, 16777215, 16773822, 16300216, 16300248, 16758527, 16761855,
                                13095423, 10148607, 8973816, 8650717, 12122296, 16119980, 16777136, 16308472, 0, 0,
                            ])),
                                this.makeTables(),
                                this.setEmphasis(0);
                        }
                        makeTables() {
                            let t, e, s, i, r, h, a, n;
                            for (let o = 0; o < 8; o++)
                                for (
                                    h = 1,
                                        a = 1,
                                        n = 1,
                                        1 & o && ((a = 0.75), (n = 0.75)),
                                        2 & o && ((h = 0.75), (n = 0.75)),
                                        4 & o && ((h = 0.75), (a = 0.75)),
                                        this.emphTable[o] = new Uint32Array(64),
                                        r = 0;
                                    r < 64;
                                    r++
                                )
                                    (i = this.curTable[r]),
                                        (t = Math.floor(this.getRed(i) * h)),
                                        (e = Math.floor(this.getGreen(i) * a)),
                                        (s = Math.floor(this.getBlue(i) * n)),
                                        (this.emphTable[o][r] = this.getRgb(t, e, s));
                        }
                        setEmphasis(t) {
                            if (t !== this.currentEmph) {
                                this.currentEmph = t;
                                for (let e = 0; e < 64; e++) this.curTable[e] = this.emphTable[t][e];
                            }
                        }
                        getEntry(t) {
                            return this.curTable[t];
                        }
                        getRed(t) {
                            return (t >> 16) & 255;
                        }
                        getGreen(t) {
                            return (t >> 8) & 255;
                        }
                        getBlue(t) {
                            return 255 & t;
                        }
                        getRgb(t, e, s) {
                            return (t << 16) | (e << 8) | s;
                        }
                        loadDefaultPalette() {
                            (this.curTable[0] = this.getRgb(117, 117, 117)),
                                (this.curTable[1] = this.getRgb(39, 27, 143)),
                                (this.curTable[2] = this.getRgb(0, 0, 171)),
                                (this.curTable[3] = this.getRgb(71, 0, 159)),
                                (this.curTable[4] = this.getRgb(143, 0, 119)),
                                (this.curTable[5] = this.getRgb(171, 0, 19)),
                                (this.curTable[6] = this.getRgb(167, 0, 0)),
                                (this.curTable[7] = this.getRgb(127, 11, 0)),
                                (this.curTable[8] = this.getRgb(67, 47, 0)),
                                (this.curTable[9] = this.getRgb(0, 71, 0)),
                                (this.curTable[10] = this.getRgb(0, 81, 0)),
                                (this.curTable[11] = this.getRgb(0, 63, 23)),
                                (this.curTable[12] = this.getRgb(27, 63, 95)),
                                (this.curTable[13] = this.getRgb(0, 0, 0)),
                                (this.curTable[14] = this.getRgb(0, 0, 0)),
                                (this.curTable[15] = this.getRgb(0, 0, 0)),
                                (this.curTable[16] = this.getRgb(188, 188, 188)),
                                (this.curTable[17] = this.getRgb(0, 115, 239)),
                                (this.curTable[18] = this.getRgb(35, 59, 239)),
                                (this.curTable[19] = this.getRgb(131, 0, 243)),
                                (this.curTable[20] = this.getRgb(191, 0, 191)),
                                (this.curTable[21] = this.getRgb(231, 0, 91)),
                                (this.curTable[22] = this.getRgb(219, 43, 0)),
                                (this.curTable[23] = this.getRgb(203, 79, 15)),
                                (this.curTable[24] = this.getRgb(139, 115, 0)),
                                (this.curTable[25] = this.getRgb(0, 151, 0)),
                                (this.curTable[26] = this.getRgb(0, 171, 0)),
                                (this.curTable[27] = this.getRgb(0, 147, 59)),
                                (this.curTable[28] = this.getRgb(0, 131, 139)),
                                (this.curTable[29] = this.getRgb(0, 0, 0)),
                                (this.curTable[30] = this.getRgb(0, 0, 0)),
                                (this.curTable[31] = this.getRgb(0, 0, 0)),
                                (this.curTable[32] = this.getRgb(255, 255, 255)),
                                (this.curTable[33] = this.getRgb(63, 191, 255)),
                                (this.curTable[34] = this.getRgb(95, 151, 255)),
                                (this.curTable[35] = this.getRgb(167, 139, 253)),
                                (this.curTable[36] = this.getRgb(247, 123, 255)),
                                (this.curTable[37] = this.getRgb(255, 119, 183)),
                                (this.curTable[38] = this.getRgb(255, 119, 99)),
                                (this.curTable[39] = this.getRgb(255, 155, 59)),
                                (this.curTable[40] = this.getRgb(243, 191, 63)),
                                (this.curTable[41] = this.getRgb(131, 211, 19)),
                                (this.curTable[42] = this.getRgb(79, 223, 75)),
                                (this.curTable[43] = this.getRgb(88, 248, 152)),
                                (this.curTable[44] = this.getRgb(0, 235, 219)),
                                (this.curTable[45] = this.getRgb(0, 0, 0)),
                                (this.curTable[46] = this.getRgb(0, 0, 0)),
                                (this.curTable[47] = this.getRgb(0, 0, 0)),
                                (this.curTable[48] = this.getRgb(255, 255, 255)),
                                (this.curTable[49] = this.getRgb(171, 231, 255)),
                                (this.curTable[50] = this.getRgb(199, 215, 255)),
                                (this.curTable[51] = this.getRgb(215, 203, 255)),
                                (this.curTable[52] = this.getRgb(255, 199, 255)),
                                (this.curTable[53] = this.getRgb(255, 199, 219)),
                                (this.curTable[54] = this.getRgb(255, 191, 179)),
                                (this.curTable[55] = this.getRgb(255, 219, 171)),
                                (this.curTable[56] = this.getRgb(255, 231, 163)),
                                (this.curTable[57] = this.getRgb(227, 255, 163)),
                                (this.curTable[58] = this.getRgb(171, 243, 191)),
                                (this.curTable[59] = this.getRgb(179, 255, 207)),
                                (this.curTable[60] = this.getRgb(159, 255, 243)),
                                (this.curTable[61] = this.getRgb(0, 0, 0)),
                                (this.curTable[62] = this.getRgb(0, 0, 0)),
                                (this.curTable[63] = this.getRgb(0, 0, 0)),
                                this.makeTables(),
                                this.setEmphasis(0);
                        }
                    };
                    const v = class {
                        STATUS_VRAMWRITE = 4;
                        STATUS_SLSPRITECOUNT = 5;
                        STATUS_SPRITE0HIT = 6;
                        STATUS_VBLANK = 7;
                        constructor(t) {
                            let e;
                            for (
                                this.nes = t,
                                    this.showSpr0Hit = !1,
                                    this.clipToTvSize = !0,
                                    this.vramMem = new Uint8Array(32768),
                                    this.spriteMem = new Uint8Array(256),
                                    this.vramAddress = null,
                                    this.vramTmpAddress = null,
                                    this.vramBufferedReadValue = 0,
                                    this.firstWrite = !0,
                                    this.openBusLatch = 0,
                                    this.openBusDecayFrames = 0,
                                    this.sramAddress = 0,
                                    this.currentMirroring = -1,
                                    this.nmiOutput = !1,
                                    this.nmiSuppressed = !1,
                                    this.vblankPending = !1,
                                    this.frameEnded = !1,
                                    this.dummyCycleToggle = !1,
                                    this.validTileData = !1,
                                    this.scanlineAlreadyRendered = null,
                                    this.f_nmiOnVblank = 0,
                                    this.f_spriteSize = 0,
                                    this.f_bgPatternTable = 0,
                                    this.f_spPatternTable = 0,
                                    this.f_addrInc = 0,
                                    this.f_nTblAddress = 0,
                                    this.f_color = 0,
                                    this.f_spVisibility = 0,
                                    this.f_bgVisibility = 0,
                                    this.f_spClipping = 0,
                                    this.f_bgClipping = 0,
                                    this.f_dispType = 0,
                                    this.cntFV = 0,
                                    this.cntV = 0,
                                    this.cntH = 0,
                                    this.cntVT = 0,
                                    this.cntHT = 0,
                                    this.regFV = 0,
                                    this.regV = 0,
                                    this.regH = 0,
                                    this.regVT = 0,
                                    this.regHT = 0,
                                    this.regFH = 0,
                                    this.regS = 0,
                                    this.curNt = null,
                                    this.attrib = new Uint8Array(32),
                                    this.buffer = new Uint32Array(61440),
                                    this.bgbuffer = new Uint32Array(61440),
                                    this.pixrendered = new Uint32Array(61440),
                                    this.validTileData = null,
                                    this.scantile = new Array(32),
                                    this.scanline = 0,
                                    this.lastRenderedScanline = -1,
                                    this.curX = 0,
                                    this.sprX = new Uint8Array(64),
                                    this.sprY = new Uint8Array(64),
                                    this.sprTile = new Uint8Array(64),
                                    this.sprCol = new Uint8Array(64),
                                    this.vertFlip = new Uint8Array(64),
                                    this.horiFlip = new Uint8Array(64),
                                    this.bgPriority = new Uint8Array(64),
                                    this.spr0HitX = 0,
                                    this.spr0HitY = 0,
                                    this.hitSpr0 = !1,
                                    this.secondaryOAM = new Uint8Array(32),
                                    this.secondaryOAM.fill(255),
                                    this.spritesFound = 0,
                                    this.sprite0InSecondary = !1,
                                    this.scanlineSpriteCount = new Uint8Array(241),
                                    this.scanlineSecondaryOAM = new Uint8Array(7712),
                                    this.scanlineSprite0 = new Uint8Array(241),
                                    this.sprPalette = new Uint32Array(16),
                                    this.imgPalette = new Uint32Array(16),
                                    this.ptTile = new Array(512),
                                    e = 0;
                                e < 512;
                                e++
                            )
                                this.ptTile[e] = new B();
                            for (
                                this.ntable1 = new Array(4),
                                    this.currentMirroring = -1,
                                    this.nameTable = new Array(4),
                                    e = 0;
                                e < 4;
                                e++
                            )
                                this.nameTable[e] = new M(32, 32, \`Nt\${e}\`);
                            for (this.vramMirrorTable = new Uint16Array(32768), e = 0; e < 32768; e++)
                                this.vramMirrorTable[e] = e;
                            (this.palTable = new F()),
                                this.palTable.loadNTSCPalette(),
                                this.updateControlReg1(0),
                                this.updateControlReg2(0);
                        }
                        setMirroring(t) {
                            if (t !== this.currentMirroring) {
                                (this.currentMirroring = t),
                                    this.triggerRendering(),
                                    null === this.vramMirrorTable && (this.vramMirrorTable = new Uint16Array(32768));
                                for (let t = 0; t < 32768; t++) this.vramMirrorTable[t] = t;
                                this.defineMirrorRegion(16160, 16128, 32),
                                    this.defineMirrorRegion(16192, 16128, 32),
                                    this.defineMirrorRegion(16256, 16128, 32),
                                    this.defineMirrorRegion(16320, 16128, 32),
                                    this.defineMirrorRegion(12288, 8192, 3840),
                                    this.defineMirrorRegion(16384, 0, 16384),
                                    t === this.nes.rom.HORIZONTAL_MIRRORING
                                        ? ((this.ntable1[0] = 0),
                                          (this.ntable1[1] = 0),
                                          (this.ntable1[2] = 1),
                                          (this.ntable1[3] = 1),
                                          this.defineMirrorRegion(9216, 8192, 1024),
                                          this.defineMirrorRegion(11264, 10240, 1024))
                                        : t === this.nes.rom.VERTICAL_MIRRORING
                                          ? ((this.ntable1[0] = 0),
                                            (this.ntable1[1] = 1),
                                            (this.ntable1[2] = 0),
                                            (this.ntable1[3] = 1),
                                            this.defineMirrorRegion(10240, 8192, 1024),
                                            this.defineMirrorRegion(11264, 9216, 1024))
                                          : t === this.nes.rom.SINGLESCREEN_MIRRORING
                                            ? ((this.ntable1[0] = 0),
                                              (this.ntable1[1] = 0),
                                              (this.ntable1[2] = 0),
                                              (this.ntable1[3] = 0),
                                              this.defineMirrorRegion(9216, 8192, 1024),
                                              this.defineMirrorRegion(10240, 8192, 1024),
                                              this.defineMirrorRegion(11264, 8192, 1024))
                                            : t === this.nes.rom.SINGLESCREEN_MIRRORING2
                                              ? ((this.ntable1[0] = 1),
                                                (this.ntable1[1] = 1),
                                                (this.ntable1[2] = 1),
                                                (this.ntable1[3] = 1),
                                                this.defineMirrorRegion(9216, 9216, 1024),
                                                this.defineMirrorRegion(10240, 9216, 1024),
                                                this.defineMirrorRegion(11264, 9216, 1024))
                                              : ((this.ntable1[0] = 0),
                                                (this.ntable1[1] = 1),
                                                (this.ntable1[2] = 2),
                                                (this.ntable1[3] = 3));
                            }
                        }
                        defineMirrorRegion(t, e, s) {
                            for (let i = 0; i < s; i++) this.vramMirrorTable[t + i] = e + i;
                        }
                        startVBlank() {
                            this.openBusDecayFrames > 0 &&
                                (this.openBusDecayFrames--, 0 === this.openBusDecayFrames && (this.openBusLatch = 0)),
                                this.lastRenderedScanline < 239 &&
                                    this.renderFramePartially(
                                        this.lastRenderedScanline + 1,
                                        240 - this.lastRenderedScanline
                                    ),
                                this.endFrame(),
                                (this.lastRenderedScanline = -1);
                        }
                        _fireVblankSet(t, e) {
                            (this.vblankPending = !1),
                                this.nmiSuppressed ||
                                    (this.setStatusFlag(this.STATUS_VBLANK, !0),
                                    this._updateNmiOutput(),
                                    t.nmiRaised && (t.nmiDotsRemainingInStep = e)),
                                (this.nmiSuppressed = !1),
                                this.startVBlank(),
                                (this.frameEnded = !0);
                        }
                        _fireVblankClear(t, e) {
                            t.nmiRaised && e && ((t.nmiPending = !0), (t.nmiRaised = !1)),
                                this.setStatusFlag(this.STATUS_VBLANK, !1),
                                this.setStatusFlag(this.STATUS_SPRITE0HIT, !1),
                                this.setStatusFlag(this.STATUS_SLSPRITECOUNT, !1),
                                (this.hitSpr0 = !1),
                                (this.spr0HitX = -1),
                                (this.spr0HitY = -1),
                                this._updateNmiOutput();
                        }
                        advanceDots(t) {
                            let e = this.curX + t;
                            if (
                                e < 341 &&
                                !(0 === this.scanline && this.vblankPending && this.curX <= 1 && e >= 1) &&
                                !(20 === this.scanline && this.curX <= 1 && e >= 1) &&
                                (this.spr0HitX < this.curX || this.spr0HitX >= e)
                            )
                                return void (this.curX = e);
                            let s = this.nes.cpu;
                            for (let e = 0; e < t; e++)
                                0 === this.scanline && 1 === this.curX && this.vblankPending
                                    ? (this._fireVblankSet(s, t - e), this.curX++)
                                    : (20 === this.scanline && 1 === this.curX && this._fireVblankClear(s, e === t - 1),
                                      this.curX === this.spr0HitX &&
                                          1 === this.f_bgVisibility &&
                                          1 === this.f_spVisibility &&
                                          this.scanline - 21 === this.spr0HitY &&
                                          this.setStatusFlag(this.STATUS_SPRITE0HIT, !0),
                                      this.curX++,
                                      341 === this.curX && ((this.curX = 0), this.endScanline()));
                            0 === this.scanline && 1 === this.curX && this.vblankPending && this._fireVblankSet(s, 0),
                                20 === this.scanline && 1 === this.curX && this._fireVblankClear(s, !0);
                        }
                        endScanline() {
                            switch (this.scanline) {
                                case 19:
                                    this.dummyCycleToggle &&
                                        ((this.curX = 1), (this.dummyCycleToggle = !this.dummyCycleToggle));
                                    break;
                                case 20:
                                    if (
                                        (this.performOAMCorruption(),
                                        1 === this.f_bgVisibility || 1 === this.f_spVisibility)
                                    ) {
                                        (this.cntFV = this.regFV),
                                            (this.cntV = this.regV),
                                            (this.cntH = this.regH),
                                            (this.cntVT = this.regVT),
                                            (this.cntHT = this.regHT),
                                            (1 !== this.f_bgVisibility && 1 !== this.f_spVisibility) ||
                                                this.renderBgScanline(!1, 0),
                                            (this.scanlineSpriteCount[0] = 0),
                                            (this.scanlineSprite0[0] = 0);
                                        for (let t = 0; t < 32; t++) this.scanlineSecondaryOAM[t] = 255;
                                        let t = 32;
                                        for (let e = 0; e < 32; e++)
                                            this.scanlineSecondaryOAM[t + e] = this.secondaryOAM[e];
                                        (this.scanlineSpriteCount[1] = this.spritesFound),
                                            (this.scanlineSprite0[1] = this.sprite0InSecondary ? 1 : 0),
                                            (this.sramAddress = 0);
                                    }
                                    1 === this.f_bgVisibility && 1 === this.f_spVisibility && this.checkSprite0(0),
                                        this.hitSpr0 ||
                                            1 !== this.f_bgVisibility ||
                                            1 !== this.f_spVisibility ||
                                            (this._precomputeSprite0Hit(1) && (this.hitSpr0 = !0)),
                                        (1 !== this.f_bgVisibility && 1 !== this.f_spVisibility) ||
                                            this.nes.mmap.clockIrqCounter();
                                    break;
                                case 261:
                                    (this.vblankPending = !0), (this.scanline = -1);
                                    break;
                                default:
                                    if (this.scanline >= 21 && this.scanline <= 260) {
                                        let t = this.scanline + 1 - 21;
                                        this.performOAMCorruption(),
                                            (1 !== this.f_bgVisibility && 1 !== this.f_spVisibility) ||
                                                (this.scanlineAlreadyRendered ||
                                                    ((this.cntHT = this.regHT),
                                                    (this.cntH = this.regH),
                                                    this.renderBgScanline(!0, t)),
                                                (this.scanlineAlreadyRendered = !1),
                                                !this.hitSpr0 &&
                                                    1 === this.f_bgVisibility &&
                                                    1 === this.f_spVisibility &&
                                                    this.scanlineSprite0[t] &&
                                                    this.checkSprite0(t) &&
                                                    (this.hitSpr0 = !0)),
                                            t < 240 && this.evaluateSprites(t + 1),
                                            this.hitSpr0 ||
                                                1 !== this.f_bgVisibility ||
                                                1 !== this.f_spVisibility ||
                                                (this._precomputeSprite0Hit(t + 1),
                                                -1 !== this.spr0HitX && (this.hitSpr0 = !0)),
                                            (1 !== this.f_bgVisibility && 1 !== this.f_spVisibility) ||
                                                this.nes.mmap.clockIrqCounter();
                                    }
                            }
                            this.scanline++, this.regsToAddress(), this.cntsToAddress();
                        }
                        startFrame() {
                            let t;
                            if ((this.scanlineSpriteCount.fill(0), this.scanlineSprite0.fill(0), 0 === this.f_dispType))
                                t = this.imgPalette[0];
                            else
                                switch (this.f_color) {
                                    case 0:
                                    case 3:
                                    default:
                                        t = 0;
                                        break;
                                    case 1:
                                        t = 65280;
                                        break;
                                    case 2:
                                        t = 255;
                                        break;
                                    case 4:
                                        t = 16711680;
                                }
                            this.buffer.fill(t), this.pixrendered.fill(65);
                        }
                        endFrame() {
                            let t,
                                e,
                                s = this.buffer;
                            if (this.showSpr0Hit) {
                                if (
                                    this.sprX[0] >= 0 &&
                                    this.sprX[0] < 256 &&
                                    this.sprY[0] >= 0 &&
                                    this.sprY[0] < 240
                                ) {
                                    for (t = 0; t < 256; t++) s[(this.sprY[0] << 8) + t] = 16733525;
                                    for (t = 0; t < 240; t++) s[(t << 8) + this.sprX[0]] = 16733525;
                                }
                                if (
                                    this.spr0HitX >= 0 &&
                                    this.spr0HitX < 256 &&
                                    this.spr0HitY >= 0 &&
                                    this.spr0HitY < 240
                                ) {
                                    for (t = 0; t < 256; t++) s[(this.spr0HitY << 8) + t] = 5635925;
                                    for (t = 0; t < 240; t++) s[(t << 8) + this.spr0HitX] = 5635925;
                                }
                            }
                            if (this.clipToTvSize || 0 === this.f_bgClipping || 0 === this.f_spClipping)
                                for (e = 0; e < 240; e++) s.fill(0, e << 8, 8 + (e << 8));
                            if (this.clipToTvSize) {
                                for (e = 0; e < 240; e++) s.fill(0, 248 + (e << 8), 256 + (e << 8));
                                s.fill(0, 0, 2048), s.fill(0, 59392, 61440);
                            }
                            this.nes.ui.writeFrame(s);
                        }
                        updateControlReg1(t) {
                            this.triggerRendering(),
                                (this.f_nmiOnVblank = (t >> 7) & 1),
                                (this.f_spriteSize = (t >> 5) & 1),
                                (this.f_bgPatternTable = (t >> 4) & 1),
                                (this.f_spPatternTable = (t >> 3) & 1),
                                (this.f_addrInc = (t >> 2) & 1),
                                (this.f_nTblAddress = 3 & t),
                                (this.regV = (t >> 1) & 1),
                                (this.regH = 1 & t),
                                (this.regS = (t >> 4) & 1),
                                this._updateNmiOutput();
                        }
                        _updateNmiOutput() {
                            let t = !!(128 & this.nes.cpu.mem[8194]),
                                e = 0 !== this.f_nmiOnVblank && t;
                            if (e && !this.nmiOutput)
                                (this.nes.cpu.nmiRaised = !0),
                                    (this.nes.cpu.nmiRaisedAtCycle = this.nes.cpu.instrBusCycles);
                            else if (!e && this.nmiOutput && this.nes.cpu.nmiRaised) {
                                let t = this.nes.cpu.instrBusCycles - this.nes.cpu.nmiRaisedAtCycle;
                                (0 === t || (1 === t && 0 === this.nes.cpu.nmiDotsRemainingInStep)) &&
                                    (this.nes.cpu.nmiRaised = !1);
                            }
                            this.nmiOutput = e;
                        }
                        updateControlReg2(t) {
                            if (
                                (this.triggerRendering(),
                                (this.f_color = (t >> 5) & 7),
                                (this.f_spVisibility = (t >> 4) & 1),
                                (this.f_bgVisibility = (t >> 3) & 1),
                                (this.f_spClipping = (t >> 2) & 1),
                                (this.f_bgClipping = (t >> 1) & 1),
                                (this.f_dispType = 1 & t),
                                !this.hitSpr0 &&
                                    1 === this.f_bgVisibility &&
                                    1 === this.f_spVisibility &&
                                    this.scanline >= 21 &&
                                    this.scanline <= 260)
                            ) {
                                let t = this.scanline + 1 - 21;
                                this.scanlineSprite0[t] && this.checkSprite0(t) && (this.hitSpr0 = !0);
                            }
                            0 === this.f_dispType && this.palTable.setEmphasis(this.f_color), this.updatePalettes();
                        }
                        setStatusFlag(t, e) {
                            let s = 1 << t;
                            this.nes.cpu.mem[8194] = (this.nes.cpu.mem[8194] & (255 - s)) | (e ? s : 0);
                        }
                        readStatusRegister() {
                            let t = this.nes.cpu.mem[8194];
                            return (
                                (this.firstWrite = !0),
                                0 === this.scanline && 0 === this.curX && (this.nmiSuppressed = !0),
                                this.setStatusFlag(this.STATUS_VBLANK, !1),
                                this._updateNmiOutput(),
                                (t = (224 & t) | (31 & this.openBusLatch)),
                                (this.openBusLatch = t),
                                (this.openBusDecayFrames = 36),
                                t
                            );
                        }
                        writeSRAMAddress(t) {
                            this.sramAddress = t;
                        }
                        sramLoad() {
                            if (
                                (1 === this.f_spVisibility || 1 === this.f_bgVisibility) &&
                                this.scanline >= 20 &&
                                this.scanline <= 260
                            ) {
                                let t = this.curX;
                                if (t <= 64) return 255;
                                if (t <= 256) {
                                    let t = this.spriteMem[this.sramAddress];
                                    return 2 == (3 & this.sramAddress) && (t &= 227), t;
                                }
                                return 255;
                            }
                            let t = this.spriteMem[this.sramAddress];
                            return 2 == (3 & this.sramAddress) && (t &= 227), t;
                        }
                        sramWrite(t) {
                            (1 === this.f_spVisibility || 1 === this.f_bgVisibility) &&
                            this.scanline >= 20 &&
                            this.scanline <= 260
                                ? (this.sramAddress = (this.sramAddress + 4) & 252)
                                : ((this.spriteMem[this.sramAddress] = t),
                                  this.spriteRamWriteUpdate(this.sramAddress, t),
                                  this.sramAddress++,
                                  (this.sramAddress %= 256));
                        }
                        scrollWrite(t) {
                            this.triggerRendering(),
                                this.firstWrite
                                    ? ((this.regHT = (t >> 3) & 31), (this.regFH = 7 & t))
                                    : ((this.regFV = 7 & t), (this.regVT = (t >> 3) & 31)),
                                (this.firstWrite = !this.firstWrite);
                        }
                        writeVRAMAddress(t) {
                            this.firstWrite
                                ? ((this.regFV = (t >> 4) & 3),
                                  (this.regV = (t >> 3) & 1),
                                  (this.regH = (t >> 2) & 1),
                                  (this.regVT = (7 & this.regVT) | ((3 & t) << 3)))
                                : (this.triggerRendering(),
                                  (this.regVT = (24 & this.regVT) | ((t >> 5) & 7)),
                                  (this.regHT = 31 & t),
                                  (this.cntFV = this.regFV),
                                  (this.cntV = this.regV),
                                  (this.cntH = this.regH),
                                  (this.cntVT = this.regVT),
                                  (this.cntHT = this.regHT),
                                  this.checkSprite0(this.scanline + 1 - 21)),
                                (this.firstWrite = !this.firstWrite),
                                this.cntsToAddress(),
                                this.vramAddress < 8192 && this.nes.mmap.latchAccess(this.vramAddress);
                        }
                        vramLoad() {
                            let t;
                            if ((this.cntsToAddress(), this.regsToAddress(), this.vramAddress <= 16127))
                                return (
                                    (t = this.vramBufferedReadValue),
                                    this.vramAddress < 8192
                                        ? (this.vramBufferedReadValue = this.vramMem[this.vramAddress])
                                        : (this.vramBufferedReadValue = this.mirroredLoad(this.vramAddress)),
                                    this.vramAddress < 8192 && this.nes.mmap.latchAccess(this.vramAddress),
                                    this._incrementVramAddress(),
                                    this.cntsFromAddress(),
                                    this.regsFromAddress(),
                                    t
                                );
                            let e = 31 & this.vramAddress;
                            return (
                                16 == (19 & e) && (e &= 15),
                                (t = (63 & this.vramMem[16128 + e]) | (192 & this.openBusLatch)),
                                (this.vramBufferedReadValue = this.mirroredLoad(12287 & this.vramAddress)),
                                this._incrementVramAddress(),
                                this.cntsFromAddress(),
                                this.regsFromAddress(),
                                t
                            );
                        }
                        vramWrite(t) {
                            this.triggerRendering(),
                                this.cntsToAddress(),
                                this.regsToAddress(),
                                this.vramAddress >= 8192
                                    ? this.mirroredWrite(this.vramAddress, t)
                                    : (this.nes.mmap.canWriteChr(this.vramAddress) &&
                                          this.writeMem(this.vramAddress, t),
                                      this.nes.mmap.latchAccess(this.vramAddress)),
                                this._incrementVramAddress(),
                                this.regsFromAddress(),
                                this.cntsFromAddress();
                        }
                        sramDMA(t) {
                            let e,
                                s = 256 * t;
                            for (let t = 0; t < 256; t++) {
                                e = this.nes.cpu.mem[s + t];
                                let i = (this.sramAddress + t) & 255;
                                (this.spriteMem[i] = e), this.spriteRamWriteUpdate(i, e);
                            }
                            let i = this.nes.cpu,
                                r = (i._cpuCycleBase + i.instrBusCycles) % 2 == 0 ? 514 : 513;
                            i.haltCycles(r);
                        }
                        regsFromAddress() {
                            let t = (this.vramTmpAddress >> 8) & 255;
                            (this.regFV = (t >> 4) & 7),
                                (this.regV = (t >> 3) & 1),
                                (this.regH = (t >> 2) & 1),
                                (this.regVT = (7 & this.regVT) | ((3 & t) << 3)),
                                (t = 255 & this.vramTmpAddress),
                                (this.regVT = (24 & this.regVT) | ((t >> 5) & 7)),
                                (this.regHT = 31 & t);
                        }
                        _incrementVramAddress() {
                            let t = 1 === this.f_spVisibility || 1 === this.f_bgVisibility,
                                e = this.scanline >= 20 && this.scanline <= 260;
                            if (t && e)
                                if (
                                    (31 & ~this.vramAddress
                                        ? (this.vramAddress += 1)
                                        : ((this.vramAddress &= -32), (this.vramAddress ^= 1024)),
                                    28672 & ~this.vramAddress)
                                )
                                    this.vramAddress += 4096;
                                else {
                                    this.vramAddress &= -28673;
                                    let t = (this.vramAddress >> 5) & 31;
                                    29 === t ? ((t = 0), (this.vramAddress ^= 2048)) : 31 === t ? (t = 0) : (t += 1),
                                        (this.vramAddress = (-993 & this.vramAddress) | (t << 5));
                                }
                            else this.vramAddress += 1 === this.f_addrInc ? 32 : 1;
                        }
                        cntsFromAddress() {
                            let t = (this.vramAddress >> 8) & 255;
                            (this.cntFV = (t >> 4) & 3),
                                (this.cntV = (t >> 3) & 1),
                                (this.cntH = (t >> 2) & 1),
                                (this.cntVT = (7 & this.cntVT) | ((3 & t) << 3)),
                                (t = 255 & this.vramAddress),
                                (this.cntVT = (24 & this.cntVT) | ((t >> 5) & 7)),
                                (this.cntHT = 31 & t);
                        }
                        regsToAddress() {
                            let t = (7 & this.regFV) << 4;
                            (t |= (1 & this.regV) << 3), (t |= (1 & this.regH) << 2), (t |= (this.regVT >> 3) & 3);
                            let e = (7 & this.regVT) << 5;
                            (e |= 31 & this.regHT), (this.vramTmpAddress = 32767 & ((t << 8) | e));
                        }
                        cntsToAddress() {
                            let t = (7 & this.cntFV) << 4;
                            (t |= (1 & this.cntV) << 3), (t |= (1 & this.cntH) << 2), (t |= (this.cntVT >> 3) & 3);
                            let e = (7 & this.cntVT) << 5;
                            (e |= 31 & this.cntHT), (this.vramAddress = 32767 & ((t << 8) | e));
                        }
                        incTileCounter(t) {
                            for (let e = t; 0 !== e; e--)
                                this.cntHT++,
                                    32 === this.cntHT &&
                                        ((this.cntHT = 0),
                                        this.cntVT++,
                                        this.cntVT >= 30 &&
                                            (this.cntH++,
                                            2 === this.cntH &&
                                                ((this.cntH = 0),
                                                this.cntV++,
                                                2 === this.cntV &&
                                                    ((this.cntV = 0), this.cntFV++, (this.cntFV &= 7)))));
                        }
                        mirroredLoad(t) {
                            return this.vramMem[this.vramMirrorTable[t]];
                        }
                        mirroredWrite(t, e) {
                            if (t >= 16128 && t < 16160)
                                16128 === t || 16144 === t
                                    ? (this.writeMem(16128, e), this.writeMem(16144, e))
                                    : 16132 === t || 16148 === t
                                      ? (this.writeMem(16132, e), this.writeMem(16148, e))
                                      : 16136 === t || 16152 === t
                                        ? (this.writeMem(16136, e), this.writeMem(16152, e))
                                        : 16140 === t || 16156 === t
                                          ? (this.writeMem(16140, e), this.writeMem(16156, e))
                                          : this.writeMem(t, e);
                            else {
                                if (!(t < this.vramMirrorTable.length))
                                    throw new Error(\`Invalid VRAM address: \${t.toString(16)}\`);
                                this.writeMem(this.vramMirrorTable[t], e);
                            }
                        }
                        triggerRendering() {
                            this._inRendering ||
                                (this.scanline >= 21 &&
                                    this.scanline <= 260 &&
                                    (this.renderFramePartially(
                                        this.lastRenderedScanline + 1,
                                        this.scanline - 21 - this.lastRenderedScanline
                                    ),
                                    (this.lastRenderedScanline = this.scanline - 21)));
                        }
                        renderFramePartially(t, e) {
                            if (
                                ((this._inRendering = !0),
                                this.nes.mmap.onSpriteRender(),
                                1 === this.f_spVisibility && this.renderSpritesPartially(t, e, 1),
                                1 === this.f_bgVisibility)
                            ) {
                                let s = t << 8,
                                    i = (t + e) << 8;
                                i > 61440 && (i = 61440);
                                let r = this.buffer,
                                    h = this.bgbuffer,
                                    a = this.pixrendered;
                                for (let t = s; t < i; t++) a[t] > 255 && (r[t] = h[t]);
                            }
                            1 === this.f_spVisibility && this.renderSpritesPartially(t, e, 0),
                                this.nes.mmap.onBgRender(),
                                (this._inRendering = !1),
                                (this.validTileData = !1);
                        }
                        renderBgScanline(t, e) {
                            let s = 0 === this.regS ? 0 : 256,
                                i = 0 === this.regS ? 0 : 4096,
                                r = (e << 8) - this.regFH;
                            if (
                                ((this.curNt = this.ntable1[this.cntV + this.cntV + this.cntH]),
                                (this.cntHT = this.regHT),
                                (this.cntH = this.regH),
                                (this.curNt = this.ntable1[this.cntV + this.cntV + this.cntH]),
                                e < 240 && e - this.cntFV >= 0)
                            ) {
                                let h,
                                    a,
                                    n,
                                    o,
                                    l = this.cntFV << 3,
                                    c = this.scantile,
                                    m = this.attrib,
                                    d = this.ptTile,
                                    u = this.nameTable,
                                    p = this.imgPalette,
                                    g = this.pixrendered,
                                    R = t ? this.bgbuffer : this.buffer,
                                    C = this.nes.mmap;
                                (this._inRendering = !0),
                                    this.nes.mmap.onBgRender(),
                                    1 === this.f_spriteSize && C.latchAccess(8168);
                                for (let t = 0; t < 32; t++) {
                                    if (e >= 0) {
                                        let e = u[this.curNt].getTileIndex(this.cntHT, this.cntVT);
                                        if (this.validTileData) {
                                            if (((h = c[t]), void 0 === h)) continue;
                                            (a = h.pix), (n = m[t]);
                                        } else {
                                            if (((h = d[s + e]), void 0 === h)) continue;
                                            if (
                                                ((a = h.pix),
                                                (n = u[this.curNt].getAttrib(this.cntHT, this.cntVT)),
                                                C.bgTileOverride)
                                            ) {
                                                let t = C.getBgTileData(s, e, this.cntHT, this.cntVT);
                                                t && ((h = t.tile), (a = h.pix), (n = t.attrib));
                                            }
                                            (c[t] = h), (m[t] = n);
                                        }
                                        let _ = 0,
                                            b = (t << 3) - this.regFH;
                                        if (b > -8)
                                            if ((b < 0 && ((r -= b), (_ = -b)), h.opaque[this.cntFV]))
                                                for (; _ < 8; _++) (R[r] = p[a[l + _] + n]), (g[r] |= 256), r++;
                                            else
                                                for (; _ < 8; _++)
                                                    (o = a[l + _]), 0 !== o && ((R[r] = p[o + n]), (g[r] |= 256)), r++;
                                        C.latchAccess(i + 16 * e + this.cntFV + 8);
                                    }
                                    32 === ++this.cntHT &&
                                        ((this.cntHT = 0),
                                        this.cntH++,
                                        (this.cntH %= 2),
                                        (this.curNt = this.ntable1[(this.cntV << 1) + this.cntH]));
                                }
                                (this._inRendering = !1), (this.validTileData = !0);
                            }
                            this.cntFV++,
                                8 === this.cntFV &&
                                    ((this.cntFV = 0),
                                    this.cntVT++,
                                    30 === this.cntVT
                                        ? ((this.cntVT = 0),
                                          this.cntV++,
                                          (this.cntV %= 2),
                                          (this.curNt = this.ntable1[(this.cntV << 1) + this.cntH]))
                                        : 32 === this.cntVT && (this.cntVT = 0),
                                    (this.validTileData = !1));
                        }
                        performOAMCorruption() {
                            if (!(1 === this.f_spVisibility || 1 === this.f_bgVisibility)) return;
                            if (0 === this.sramAddress) return;
                            let t = 248 & this.sramAddress;
                            for (let e = 0; e < 8; e++) this.spriteMem[e] = this.spriteMem[(t + e) & 255];
                            for (let t = 0; t < 8; t++) this.spriteRamWriteUpdate(t, this.spriteMem[t]);
                        }
                        evaluateSprites(t) {
                            if (!(1 === this.f_spVisibility || 1 === this.f_bgVisibility)) return;
                            let e = 32 * t;
                            for (let t = 0; t < 32; t++) this.scanlineSecondaryOAM[e + t] = 255;
                            (this.scanlineSpriteCount[t] = 0), (this.scanlineSprite0[t] = 0);
                            let s = 0 === this.f_spriteSize ? 8 : 16,
                                i = 0,
                                r = 0,
                                h = (this.sramAddress >> 2) & 63,
                                a = 3 & this.sramAddress,
                                n = 0,
                                o = h,
                                l = !0,
                                c = 0;
                            do {
                                let h;
                                (h = i >= 8 ? n : l ? a : 0), (l = !1);
                                let m = this.spriteMem[(4 * o + h) & 255];
                                if (t > m && t <= m + s) {
                                    if (!(i < 8)) {
                                        this.setStatusFlag(this.STATUS_SLSPRITECOUNT, !0);
                                        break;
                                    }
                                    for (let t = 0; t < 4; t++)
                                        this.scanlineSecondaryOAM[e + r + t] = this.spriteMem[(4 * o + h + t) & 255];
                                    0 === c && (this.scanlineSprite0[t] = 1), i++, (r += 4);
                                } else i >= 8 && (n = (n + 1) & 3);
                                (o = (o + 1) & 63), c++;
                            } while (0 !== o);
                            this.scanlineSpriteCount[t] = i;
                            for (let t = 0; t < 32; t++) this.secondaryOAM[t] = this.scanlineSecondaryOAM[e + t];
                            (this.spritesFound = i),
                                (this.sprite0InSecondary = 1 === this.scanlineSprite0[t]),
                                (this.sramAddress = 0);
                        }
                        renderSpritesPartially(t, e, s) {
                            if (1 !== this.f_spVisibility) return;
                            let i = this.nes.mmap,
                                r = this.ptTile,
                                h = this.buffer,
                                a = this.sprPalette,
                                n = this.pixrendered;
                            for (let o = t; o < t + e; o++) {
                                if (o < 0 || o >= 240) continue;
                                let t = this.scanlineSpriteCount[o],
                                    e = 32 * o;
                                for (let l = 0; l < t; l++) {
                                    let t = this.scanlineSecondaryOAM[e + 4 * l + 0],
                                        c = this.scanlineSecondaryOAM[e + 4 * l + 1],
                                        m = this.scanlineSecondaryOAM[e + 4 * l + 2],
                                        d = this.scanlineSecondaryOAM[e + 4 * l + 3],
                                        u = (m >> 7) & 1,
                                        p = (m >> 6) & 1,
                                        g = (3 & m) << 2;
                                    if (((m >> 5) & 1) === s)
                                        if (0 === this.f_spriteSize) {
                                            let e = 0 === this.f_spPatternTable ? c : c + 256,
                                                s = 0 === this.f_spPatternTable ? 0 : 4096,
                                                m = t + 1,
                                                R = o - m;
                                            if (R < 0 || R >= 8) continue;
                                            r[e].render(h, 0, R, 8, R + 1, d, m, g, a, p, u, l, n),
                                                i.latchAccess(s + 16 * c + 8);
                                        } else {
                                            let e,
                                                s,
                                                m = 1 & c ? 4096 : 0,
                                                R = 254 & c,
                                                C = 1 & c ? R - 1 + 256 : R,
                                                _ = t + 1,
                                                b = o - _;
                                            if (b < 0 || b >= 16) continue;
                                            b < 8 ? ((e = u ? 1 : 0), (s = b)) : ((e = u ? 0 : 1), (s = b - 8)),
                                                r[C + e].render(
                                                    h,
                                                    0,
                                                    s,
                                                    8,
                                                    s + 1,
                                                    d,
                                                    _ + (b < 8 ? 0 : 8),
                                                    g,
                                                    a,
                                                    p,
                                                    u,
                                                    l,
                                                    n
                                                ),
                                                i.latchAccess(m + 16 * R + 8),
                                                i.latchAccess(m + 16 * (R + 1) + 8);
                                        }
                                }
                            }
                        }
                        checkSprite0(t) {
                            if (((this.spr0HitX = -1), (this.spr0HitY = -1), t < 0 || t >= 240)) return !1;
                            if (!this.scanlineSprite0[t]) return !1;
                            if (0 === this.scanlineSpriteCount[t]) return !1;
                            let e,
                                s,
                                i = 32 * t,
                                r = this.scanlineSecondaryOAM[i + 0],
                                h = this.scanlineSecondaryOAM[i + 1],
                                a = this.scanlineSecondaryOAM[i + 2],
                                n = this.scanlineSecondaryOAM[i + 3],
                                o = r + 1,
                                l = (a >> 7) & 1,
                                c = (a >> 6) & 1,
                                m = 0 === this.f_spClipping || 0 === this.f_bgClipping,
                                d = this.nes.mmap;
                            if (0 === this.f_spriteSize) {
                                let i = 0 === this.f_spPatternTable ? 0 : 256;
                                if (o <= t && o + 8 > t && n < 256)
                                    return (
                                        (s = d.getSpritePatternTile(h + i)),
                                        (e = l ? 7 - (t - o) : t - o),
                                        (e *= 8),
                                        this._checkSpr0Pixels(s, e, n, c, t, m)
                                    );
                            } else if (o <= t && o + 16 > t && n < 256)
                                return (
                                    (e = l ? 15 - (t - o) : t - o),
                                    e < 8
                                        ? (s = d.getSpritePatternTile(h + (l ? 1 : 0) + (1 & h ? 255 : 0)))
                                        : ((s = d.getSpritePatternTile(h + (l ? 0 : 1) + (1 & h ? 255 : 0))),
                                          (e = l ? 15 - e : e - 8)),
                                    (e *= 8),
                                    this._checkSpr0Pixels(s, e, n, c, t, m)
                                );
                            return !1;
                        }
                        _checkSpr0Pixels(t, e, s, i, r, h) {
                            let a = 256 * r + s;
                            for (let n = 0; n < 8; n++) {
                                let o = i ? 7 - n : n,
                                    l = s + n;
                                if (l >= 0 && l < 255) {
                                    if (h && l < 8) {
                                        a++;
                                        continue;
                                    }
                                    if (a >= 0 && a < 61440 && this.pixrendered[a] > 255 && 0 !== t.pix[e + o])
                                        return (this.spr0HitX = l), (this.spr0HitY = r), !0;
                                }
                                a++;
                            }
                            return !1;
                        }
                        _precomputeSprite0Hit(t) {
                            if (t < 1 || t > 239) return !1;
                            if (!this.scanlineSprite0[t]) return !1;
                            if (0 === this.scanlineSpriteCount[t]) return !1;
                            let e = 32 * t,
                                s = this.scanlineSecondaryOAM[e + 0],
                                i = this.scanlineSecondaryOAM[e + 1],
                                r = this.scanlineSecondaryOAM[e + 2],
                                h = this.scanlineSecondaryOAM[e + 3],
                                a = s + 1,
                                n = (r >> 7) & 1,
                                o = (r >> 6) & 1,
                                l = 0 === this.f_spClipping || 0 === this.f_bgClipping,
                                c = 0 === this.f_spriteSize ? 8 : 16;
                            if (!(a <= t && a + c > t)) return !1;
                            if (h >= 256) return !1;
                            let m,
                                d,
                                u = n ? c - 1 - (t - a) : t - a;
                            if (0 === this.f_spriteSize) {
                                let t = 0 === this.f_spPatternTable ? 0 : 256;
                                (m = this.ptTile[i + t]), (d = 8 * u);
                            } else {
                                let t = 1 & i ? 256 : 0,
                                    e = -2 & i;
                                u < 8
                                    ? ((m = this.ptTile[e + t + (n ? 1 : 0)]), (d = 8 * u))
                                    : ((m = this.ptTile[e + t + (n ? 0 : 1)]), (d = 8 * (u - 8)));
                            }
                            if (!m) return !1;
                            let p = this.cntFV,
                                g = this.cntVT,
                                R = this.cntV,
                                C = 0 === this.regS ? 0 : 256;
                            for (let e = 0; e < 8; e++) {
                                let s = h + e;
                                if (s >= 255) continue;
                                if (l && s < 8) continue;
                                let i = o ? 7 - e : e;
                                if (0 === m.pix[d + i]) continue;
                                let r = (s + this.regFH) >> 3,
                                    a = this.regHT + r,
                                    n = this.regH;
                                a >= 32 && ((a -= 32), (n ^= 1));
                                let c = this.ntable1[(R << 1) + n],
                                    u = this.nameTable[c].getTileIndex(a, g),
                                    _ = this.ptTile[C + u];
                                if (!_) continue;
                                let b = (s + this.regFH) & 7;
                                if (0 !== _.pix[8 * p + b]) return (this.spr0HitX = s), (this.spr0HitY = t - 1), !0;
                            }
                            return !1;
                        }
                        writeMem(t, e) {
                            (this.vramMem[t] = e),
                                t < 8192
                                    ? ((this.vramMem[t] = e), this.patternWrite(t, e))
                                    : t >= 8192 && t < 9152
                                      ? this.nameTableWrite(this.ntable1[0], t - 8192, e)
                                      : t >= 9152 && t < 9216
                                        ? this.attribTableWrite(this.ntable1[0], t - 9152, e)
                                        : t >= 9216 && t < 10176
                                          ? this.nameTableWrite(this.ntable1[1], t - 9216, e)
                                          : t >= 10176 && t < 10240
                                            ? this.attribTableWrite(this.ntable1[1], t - 10176, e)
                                            : t >= 10240 && t < 11200
                                              ? this.nameTableWrite(this.ntable1[2], t - 10240, e)
                                              : t >= 11200 && t < 11264
                                                ? this.attribTableWrite(this.ntable1[2], t - 11200, e)
                                                : t >= 11264 && t < 12224
                                                  ? this.nameTableWrite(this.ntable1[3], t - 11264, e)
                                                  : t >= 12224 && t < 12288
                                                    ? this.attribTableWrite(this.ntable1[3], t - 12224, e)
                                                    : t >= 16128 && t < 16160 && this.updatePalettes();
                        }
                        updatePalettes() {
                            let t;
                            for (t = 0; t < 16; t++)
                                0 === this.f_dispType
                                    ? (this.imgPalette[t] = this.palTable.getEntry(63 & this.vramMem[16128 + t]))
                                    : (this.imgPalette[t] = this.palTable.getEntry(48 & this.vramMem[16128 + t]));
                            for (t = 0; t < 16; t++)
                                0 === this.f_dispType
                                    ? (this.sprPalette[t] = this.palTable.getEntry(63 & this.vramMem[16144 + t]))
                                    : (this.sprPalette[t] = this.palTable.getEntry(48 & this.vramMem[16144 + t]));
                        }
                        patternWrite(t, e) {
                            let s = t >> 4,
                                i = 15 & t;
                            i < 8
                                ? this.ptTile[s].setScanline(i, e, this.vramMem[t + 8])
                                : this.ptTile[s].setScanline(i - 8, this.vramMem[t - 8], e);
                        }
                        nameTableWrite(t, e, s) {
                            this.nameTable[t].tile[e] = s;
                            let i = this.scanline + 1 - 21;
                            this.checkSprite0(i);
                        }
                        attribTableWrite(t, e, s) {
                            this.nameTable[t].writeAttrib(e, s), (this.nameTable[t].tile[960 + e] = s);
                        }
                        spriteRamWriteUpdate(t, e) {
                            let s = t >> 2;
                            if (0 === s) {
                                let t = this.scanline + 1 - 21;
                                this.checkSprite0(t);
                            }
                            switch (3 & t) {
                                case 0:
                                    this.sprY[s] = e;
                                    break;
                                case 1:
                                    this.sprTile[s] = e;
                                    break;
                                case 2:
                                    (this.vertFlip[s] = (e >> 7) & 1),
                                        (this.horiFlip[s] = (e >> 6) & 1),
                                        (this.bgPriority[s] = (e >> 5) & 1),
                                        (this.sprCol[s] = (3 & e) << 2);
                                    break;
                                case 3:
                                    this.sprX[s] = e;
                            }
                        }
                        isPixelWhite(t, e) {
                            return this.triggerRendering(), 16777215 === this.nes.ppu.buffer[(e << 8) + t];
                        }
                        toJSON() {
                            let t,
                                e = r(this);
                            for (e.nameTable = [], t = 0; t < this.nameTable.length; t++)
                                e.nameTable[t] = this.nameTable[t].toJSON();
                            for (e.ptTile = [], t = 0; t < this.ptTile.length; t++)
                                e.ptTile[t] = this.ptTile[t].toJSON();
                            return e;
                        }
                        fromJSON(t) {
                            let e;
                            for (i(this, t), e = 0; e < this.nameTable.length; e++)
                                this.nameTable[e].fromJSON(t.nameTable[e]);
                            for (e = 0; e < this.ptTile.length; e++) this.ptTile[e].fromJSON(t.ptTile[e]);
                            for (e = 0; e < this.spriteMem.length; e++) this.spriteRamWriteUpdate(e, this.spriteMem[e]);
                        }
                        static JSON_PROPERTIES = [
                            "vramMem",
                            "spriteMem",
                            "cntFV",
                            "cntV",
                            "cntH",
                            "cntVT",
                            "cntHT",
                            "regFV",
                            "regV",
                            "regH",
                            "regVT",
                            "regHT",
                            "regFH",
                            "regS",
                            "vramAddress",
                            "vramTmpAddress",
                            "f_nmiOnVblank",
                            "f_spriteSize",
                            "f_bgPatternTable",
                            "f_spPatternTable",
                            "f_addrInc",
                            "f_nTblAddress",
                            "f_color",
                            "f_spVisibility",
                            "f_bgVisibility",
                            "f_spClipping",
                            "f_bgClipping",
                            "f_dispType",
                            "vramBufferedReadValue",
                            "firstWrite",
                            "openBusLatch",
                            "openBusDecayFrames",
                            "currentMirroring",
                            "vramMirrorTable",
                            "ntable1",
                            "sramAddress",
                            "hitSpr0",
                            "secondaryOAM",
                            "spritesFound",
                            "sprite0InSecondary",
                            "sprPalette",
                            "imgPalette",
                            "curX",
                            "scanline",
                            "lastRenderedScanline",
                            "curNt",
                            "scantile",
                            "attrib",
                            "buffer",
                            "bgbuffer",
                            "pixrendered",
                            "nmiOutput",
                            "nmiSuppressed",
                            "vblankPending",
                            "dummyCycleToggle",
                            "validTileData",
                            "scanlineAlreadyRendered",
                        ];
                    };
                    class O {
                        static MODE_NORMAL = 0;
                        static MODE_LOOP = 1;
                        static MODE_IRQ = 2;
                        static JSON_PROPERTIES = [
                            "isEnabled",
                            "hasSample",
                            "irqGenerated",
                            "playMode",
                            "dmaFrequency",
                            "dmaCounter",
                            "deltaCounter",
                            "playStartAddress",
                            "playAddress",
                            "playLength",
                            "playLengthCounter",
                            "shiftCounter",
                            "reg4012",
                            "reg4013",
                            "sample",
                            "dacLsb",
                            "data",
                            "lastFetchedByte",
                        ];
                        constructor(t) {
                            (this.papu = t),
                                (this.isEnabled = !1),
                                (this.hasSample = !1),
                                (this.irqGenerated = !1),
                                (this.playMode = O.MODE_NORMAL),
                                (this.dmaFrequency = 0),
                                (this.dmaCounter = 0),
                                (this.deltaCounter = 0),
                                (this.playStartAddress = 0),
                                (this.playAddress = 0),
                                (this.playLength = 0),
                                (this.playLengthCounter = 0),
                                (this.sample = 0),
                                (this.dacLsb = 0),
                                (this.shiftCounter = 0),
                                (this.reg4012 = 0),
                                (this.reg4013 = 0),
                                (this.data = 0),
                                (this.lastFetchedByte = 0);
                        }
                        clockDmc() {
                            this.hasSample &&
                                (1 & this.data
                                    ? this.deltaCounter < 63 && this.deltaCounter++
                                    : this.deltaCounter > 0 && this.deltaCounter--,
                                (this.sample = this.isEnabled ? (this.deltaCounter << 1) + this.dacLsb : 0),
                                (this.data >>= 1)),
                                this.dmaCounter--,
                                this.dmaCounter <= 0 &&
                                    ((this.hasSample = !1), this.endOfSample(), (this.dmaCounter = 8)),
                                this.irqGenerated && this.papu.nes.cpu.requestIrq(this.papu.nes.cpu.IRQ_NORMAL);
                        }
                        endOfSample() {
                            0 === this.playLengthCounter &&
                                this.playMode === O.MODE_LOOP &&
                                ((this.playAddress = this.playStartAddress),
                                (this.playLengthCounter = this.playLength)),
                                this.playLengthCounter > 0 &&
                                    (this.nextSample(),
                                    0 === this.playLengthCounter &&
                                        this.playMode === O.MODE_IRQ &&
                                        (this.irqGenerated = !0));
                        }
                        nextSample() {
                            (this.data = this.papu.nes.mmap.load(this.playAddress)),
                                (this.lastFetchedByte = this.data),
                                this.papu.nes.cpu.haltCycles(4),
                                this.playLengthCounter--,
                                this.playAddress++,
                                this.playAddress > 65535 && (this.playAddress = 32768),
                                (this.hasSample = !0);
                        }
                        writeReg(t, e) {
                            16400 === t
                                ? (e >> 6
                                      ? 1 == ((e >> 6) & 1)
                                          ? (this.playMode = O.MODE_LOOP)
                                          : e >> 6 == 2 && (this.playMode = O.MODE_IRQ)
                                      : (this.playMode = O.MODE_NORMAL),
                                  128 & e || (this.irqGenerated = !1),
                                  (this.dmaFrequency = this.papu.getDmcFrequency(15 & e)))
                                : 16401 === t
                                  ? ((this.deltaCounter = (e >> 1) & 63),
                                    (this.dacLsb = 1 & e),
                                    (this.sample = (this.deltaCounter << 1) + this.dacLsb))
                                  : 16402 === t
                                    ? ((this.playStartAddress = (e << 6) | 49152), (this.reg4012 = e))
                                    : 16403 === t
                                      ? ((this.playLength = 1 + (e << 4)), (this.reg4013 = e))
                                      : 16405 === t &&
                                        ((this.irqGenerated = !1),
                                        (e >> 4) & 1
                                            ? 0 === this.playLengthCounter &&
                                              ((this.playAddress = this.playStartAddress),
                                              (this.playLengthCounter = this.playLength),
                                              !this.hasSample &&
                                                  this.playLengthCounter > 0 &&
                                                  (this.nextSample(),
                                                  (this.dmaCounter = 8),
                                                  (this.shiftCounter = this.dmaFrequency),
                                                  0 === this.playLengthCounter &&
                                                      this.playMode === O.MODE_IRQ &&
                                                      (this.irqGenerated = !0)))
                                            : (this.playLengthCounter = 0));
                        }
                        setEnabled(t) {
                            this.isEnabled = t;
                        }
                        getLengthStatus() {
                            return 0 !== this.playLengthCounter && this.isEnabled ? 1 : 0;
                        }
                        getIrqStatus() {
                            return this.irqGenerated ? 1 : 0;
                        }
                        toJSON() {
                            return r(this);
                        }
                        fromJSON(t) {
                            i(this, t);
                        }
                    }
                    const N = O;
                    const w = class {
                        constructor(t) {
                            (this.papu = t),
                                (this.progTimerCount = 0),
                                (this.progTimerMax = 0),
                                (this.isEnabled = !1),
                                (this.lengthCounter = 0),
                                (this.lengthCounterEnable = !1),
                                (this.envDecayDisable = !1),
                                (this.envDecayLoopEnable = !1),
                                (this.envReset = !1),
                                (this.shiftNow = !1),
                                (this.envDecayRate = 0),
                                (this.envDecayCounter = 0),
                                (this.envVolume = 0),
                                (this.masterVolume = 0),
                                (this.shiftReg = 1),
                                (this.randomBit = 0),
                                (this.randomMode = 0),
                                (this.sampleValue = 0),
                                (this.tmp = 0),
                                (this.accValue = 0),
                                (this.accCount = 1);
                        }
                        clockLengthCounter() {
                            this.lengthCounterEnable &&
                                this.lengthCounter > 0 &&
                                (this.lengthCounter--, 0 === this.lengthCounter && this.updateSampleValue());
                        }
                        clockEnvDecay() {
                            this.envReset
                                ? ((this.envReset = !1),
                                  (this.envDecayCounter = this.envDecayRate + 1),
                                  (this.envVolume = 15))
                                : --this.envDecayCounter <= 0 &&
                                  ((this.envDecayCounter = this.envDecayRate + 1),
                                  this.envVolume > 0
                                      ? this.envVolume--
                                      : (this.envVolume = this.envDecayLoopEnable ? 15 : 0)),
                                this.envDecayDisable
                                    ? (this.masterVolume = this.envDecayRate)
                                    : (this.masterVolume = this.envVolume),
                                this.updateSampleValue();
                        }
                        updateSampleValue() {
                            this.isEnabled &&
                                this.lengthCounter > 0 &&
                                (this.sampleValue = this.randomBit * this.masterVolume);
                        }
                        writeReg(t, e) {
                            16396 === t
                                ? ((this.envDecayDisable = !!(16 & e)),
                                  (this.envDecayRate = 15 & e),
                                  (this.envDecayLoopEnable = !!(32 & e)),
                                  (this.lengthCounterEnable = !(32 & e)),
                                  this.envDecayDisable
                                      ? (this.masterVolume = this.envDecayRate)
                                      : (this.masterVolume = this.envVolume))
                                : 16398 === t
                                  ? ((this.progTimerMax = this.papu.getNoiseWaveLength(15 & e)),
                                    (this.randomMode = e >> 7))
                                  : 16399 === t &&
                                    (this.isEnabled && (this.lengthCounter = this.papu.getLengthMax(248 & e)),
                                    (this.envReset = !0));
                        }
                        setEnabled(t) {
                            (this.isEnabled = t), t || (this.lengthCounter = 0), this.updateSampleValue();
                        }
                        getLengthStatus() {
                            return 0 !== this.lengthCounter && this.isEnabled ? 1 : 0;
                        }
                        toJSON() {
                            return r(this);
                        }
                        fromJSON(t) {
                            i(this, t);
                        }
                        static JSON_PROPERTIES = [
                            "isEnabled",
                            "envDecayDisable",
                            "envDecayLoopEnable",
                            "lengthCounterEnable",
                            "envReset",
                            "shiftNow",
                            "lengthCounter",
                            "progTimerCount",
                            "progTimerMax",
                            "envDecayRate",
                            "envDecayCounter",
                            "envVolume",
                            "masterVolume",
                            "shiftReg",
                            "randomBit",
                            "randomMode",
                            "sampleValue",
                            "accValue",
                            "accCount",
                            "tmp",
                        ];
                    };
                    const V = class {
                        constructor(t, e) {
                            (this.papu = t),
                                (this.dutyLookup = [
                                    0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 1, 0, 0, 1,
                                    1, 1, 1, 1,
                                ]),
                                (this.impLookup = [
                                    1, -1, 0, 0, 0, 0, 0, 0, 1, 0, -1, 0, 0, 0, 0, 0, 1, 0, 0, 0, -1, 0, 0, 0, -1, 0, 1,
                                    0, 0, 0, 0, 0,
                                ]),
                                (this.sqr1 = e),
                                (this.progTimerCount = 0),
                                (this.progTimerMax = 0),
                                (this.lengthCounter = 0),
                                (this.squareCounter = 0),
                                (this.sweepCounter = 0),
                                (this.sweepCounterMax = 0),
                                (this.sweepMode = 0),
                                (this.sweepShiftAmount = 0),
                                (this.envDecayRate = 0),
                                (this.envDecayCounter = 0),
                                (this.envVolume = 0),
                                (this.masterVolume = 0),
                                (this.dutyMode = 0),
                                (this.vol = 0),
                                (this.isEnabled = !1),
                                (this.lengthCounterEnable = !1),
                                (this.sweepActive = !1),
                                (this.sweepCarry = !1),
                                (this.envDecayDisable = !1),
                                (this.envDecayLoopEnable = !1),
                                (this.envReset = !1),
                                (this.updateSweepPeriod = !1),
                                (this.sweepResult = 0),
                                (this.sampleValue = 0);
                        }
                        clockLengthCounter() {
                            this.lengthCounterEnable &&
                                this.lengthCounter > 0 &&
                                (this.lengthCounter--, 0 === this.lengthCounter && this.updateSampleValue());
                        }
                        clockEnvDecay() {
                            this.envReset
                                ? ((this.envReset = !1),
                                  (this.envDecayCounter = this.envDecayRate + 1),
                                  (this.envVolume = 15))
                                : --this.envDecayCounter <= 0 &&
                                  ((this.envDecayCounter = this.envDecayRate + 1),
                                  this.envVolume > 0
                                      ? this.envVolume--
                                      : (this.envVolume = this.envDecayLoopEnable ? 15 : 0)),
                                this.envDecayDisable
                                    ? (this.masterVolume = this.envDecayRate)
                                    : (this.masterVolume = this.envVolume),
                                this.updateSampleValue();
                        }
                        clockSweep() {
                            --this.sweepCounter <= 0 &&
                                ((this.sweepCounter = this.sweepCounterMax + 1),
                                this.sweepActive &&
                                    this.sweepShiftAmount > 0 &&
                                    this.progTimerMax > 7 &&
                                    ((this.sweepCarry = !1),
                                    0 === this.sweepMode
                                        ? ((this.progTimerMax += this.progTimerMax >> this.sweepShiftAmount),
                                          this.progTimerMax > 2047 &&
                                              ((this.progTimerMax = 4095), (this.sweepCarry = !0)))
                                        : (this.progTimerMax =
                                              this.progTimerMax -
                                              ((this.progTimerMax >> this.sweepShiftAmount) + (this.sqr1 ? 1 : 0))))),
                                this.updateSweepPeriod &&
                                    ((this.updateSweepPeriod = !1), (this.sweepCounter = this.sweepCounterMax + 1));
                        }
                        updateSampleValue() {
                            this.isEnabled && this.lengthCounter > 0 && this.progTimerMax > 7
                                ? 0 === this.sweepMode &&
                                  this.progTimerMax + (this.progTimerMax >> this.sweepShiftAmount) > 2047
                                    ? (this.sampleValue = 0)
                                    : (this.sampleValue =
                                          this.masterVolume *
                                          this.dutyLookup[(this.dutyMode << 3) + this.squareCounter])
                                : (this.sampleValue = 0);
                        }
                        writeReg(t, e) {
                            let s = this.sqr1 ? 0 : 4;
                            t === 16384 + s
                                ? ((this.envDecayDisable = !!(16 & e)),
                                  (this.envDecayRate = 15 & e),
                                  (this.envDecayLoopEnable = !!(32 & e)),
                                  (this.dutyMode = (e >> 6) & 3),
                                  (this.lengthCounterEnable = !(32 & e)),
                                  this.envDecayDisable
                                      ? (this.masterVolume = this.envDecayRate)
                                      : (this.masterVolume = this.envVolume),
                                  this.updateSampleValue())
                                : t === 16385 + s
                                  ? ((this.sweepActive = !!(128 & e)),
                                    (this.sweepCounterMax = (e >> 4) & 7),
                                    (this.sweepMode = (e >> 3) & 1),
                                    (this.sweepShiftAmount = 7 & e),
                                    (this.updateSweepPeriod = !0))
                                  : t === 16386 + s
                                    ? ((this.progTimerMax &= 1792), (this.progTimerMax |= e))
                                    : t === 16387 + s &&
                                      ((this.progTimerMax &= 255),
                                      (this.progTimerMax |= (7 & e) << 8),
                                      this.isEnabled && (this.lengthCounter = this.papu.getLengthMax(248 & e)),
                                      (this.envReset = !0));
                        }
                        setEnabled(t) {
                            (this.isEnabled = t), t || (this.lengthCounter = 0), this.updateSampleValue();
                        }
                        getLengthStatus() {
                            return 0 !== this.lengthCounter && this.isEnabled ? 1 : 0;
                        }
                        toJSON() {
                            return r(this);
                        }
                        fromJSON(t) {
                            i(this, t);
                        }
                        static JSON_PROPERTIES = [
                            "isEnabled",
                            "lengthCounterEnable",
                            "sweepActive",
                            "envDecayDisable",
                            "envDecayLoopEnable",
                            "envReset",
                            "sweepCarry",
                            "updateSweepPeriod",
                            "progTimerCount",
                            "progTimerMax",
                            "lengthCounter",
                            "squareCounter",
                            "sweepCounter",
                            "sweepCounterMax",
                            "sweepMode",
                            "sweepShiftAmount",
                            "envDecayRate",
                            "envDecayCounter",
                            "envVolume",
                            "masterVolume",
                            "dutyMode",
                            "sweepResult",
                            "sampleValue",
                            "vol",
                        ];
                    };
                    const P = class {
                            constructor(t) {
                                (this.papu = t),
                                    (this.progTimerCount = 0),
                                    (this.progTimerMax = 0),
                                    (this.triangleCounter = 0),
                                    (this.isEnabled = !1),
                                    (this.sampleCondition = !1),
                                    (this.lengthCounter = 0),
                                    (this.lengthCounterEnable = !1),
                                    (this.linearCounter = 0),
                                    (this.lcLoadValue = 0),
                                    (this.lcHalt = !0),
                                    (this.lcControl = !1),
                                    (this.tmp = 0),
                                    (this.sampleValue = 15);
                            }
                            clockLengthCounter() {
                                this.lengthCounterEnable &&
                                    this.lengthCounter > 0 &&
                                    (this.lengthCounter--, 0 === this.lengthCounter && this.updateSampleCondition());
                            }
                            clockLinearCounter() {
                                this.lcHalt
                                    ? ((this.linearCounter = this.lcLoadValue), this.updateSampleCondition())
                                    : this.linearCounter > 0 && (this.linearCounter--, this.updateSampleCondition()),
                                    this.lcControl || (this.lcHalt = !1);
                            }
                            getLengthStatus() {
                                return 0 !== this.lengthCounter && this.isEnabled ? 1 : 0;
                            }
                            readReg(t) {
                                return 0;
                            }
                            writeReg(t, e) {
                                16392 === t
                                    ? ((this.lcControl = !!(128 & e)),
                                      (this.lcLoadValue = 127 & e),
                                      (this.lengthCounterEnable = !this.lcControl))
                                    : 16394 === t
                                      ? ((this.progTimerMax &= 1792), (this.progTimerMax |= e))
                                      : 16395 === t &&
                                        ((this.progTimerMax &= 255),
                                        (this.progTimerMax |= (7 & e) << 8),
                                        this.isEnabled && (this.lengthCounter = this.papu.getLengthMax(248 & e)),
                                        (this.lcHalt = !0)),
                                    this.updateSampleCondition();
                            }
                            clockProgrammableTimer(t) {
                                if (this.progTimerMax > 0)
                                    for (
                                        this.progTimerCount += t;
                                        this.progTimerMax > 0 && this.progTimerCount >= this.progTimerMax;

                                    )
                                        (this.progTimerCount -= this.progTimerMax),
                                            this.isEnabled &&
                                                this.lengthCounter > 0 &&
                                                this.linearCounter > 0 &&
                                                this.clockTriangleGenerator();
                            }
                            clockTriangleGenerator() {
                                this.triangleCounter++, (this.triangleCounter &= 31);
                            }
                            setEnabled(t) {
                                (this.isEnabled = t), t || (this.lengthCounter = 0), this.updateSampleCondition();
                            }
                            updateSampleCondition() {
                                this.sampleCondition =
                                    this.isEnabled &&
                                    this.progTimerMax > 7 &&
                                    this.linearCounter > 0 &&
                                    this.lengthCounter > 0;
                            }
                            toJSON() {
                                return r(this);
                            }
                            fromJSON(t) {
                                i(this, t);
                            }
                            static JSON_PROPERTIES = [
                                "isEnabled",
                                "sampleCondition",
                                "lengthCounterEnable",
                                "lcHalt",
                                "lcControl",
                                "progTimerCount",
                                "progTimerMax",
                                "triangleCounter",
                                "lengthCounter",
                                "linearCounter",
                                "lcLoadValue",
                                "sampleValue",
                                "tmp",
                            ];
                        },
                        G = [7457, 14913, 22371, 29828, 29829],
                        I = [7457, 14913, 22371, 29829, 37281];
                    const L = class {
                            constructor(t) {
                                (this.nes = t),
                                    (this.square1 = new V(this, !0)),
                                    (this.square2 = new V(this, !1)),
                                    (this.triangle = new P(this)),
                                    (this.noise = new w(this)),
                                    (this.dmc = new N(this)),
                                    (this.startedPlaying = !1),
                                    (this.recordOutput = !1),
                                    (this.triValue = 0),
                                    (this.prevSampleL = 0),
                                    (this.prevSampleR = 0),
                                    (this.smpAccumL = 0),
                                    (this.smpAccumR = 0),
                                    (this.dacRange = 0),
                                    (this.dcValue = 0),
                                    (this.masterVolume = 256),
                                    (this.panning = [80, 170, 100, 150, 128]),
                                    this.setPanning(this.panning),
                                    this.initLengthLookup(),
                                    this.initDmcFrequencyLookup(),
                                    this.initNoiseWavelengthLookup(),
                                    this.initDACtables();
                                for (let t = 0; t < 20; t++)
                                    16 === t ? this.writeReg(16400, 16) : this.writeReg(16384 + t, 0);
                                (this.sampleRate = this.nes.opts.sampleRate),
                                    (this.sampleTimerMax = Math.floor(1832727040 / this.sampleRate)),
                                    (this.sampleTimer = 0),
                                    this.updateChannelEnable(0),
                                    (this.frameCycleCounter = 0),
                                    (this.frameStep = 0),
                                    (this.countSequence = 0),
                                    (this.sampleCount = 0),
                                    (this.frameIrqEnabled = !1),
                                    (this.frameIrqActive = !1),
                                    (this.frameIrqClearPending = !1),
                                    (this.apuCycleParity = 0),
                                    (this.accCount = 0),
                                    (this.smpSquare1 = 0),
                                    (this.smpSquare2 = 0),
                                    (this.smpTriangle = 0),
                                    (this.smpDmc = 0),
                                    (this.channelEnableValue = 255),
                                    (this.extraCycles = 0),
                                    (this.maxSample = -5e5),
                                    (this.minSample = 5e5);
                            }
                            readReg(t) {
                                let e = 0;
                                return (
                                    (e |= this.square1.getLengthStatus()),
                                    (e |= this.square2.getLengthStatus() << 1),
                                    (e |= this.triangle.getLengthStatus() << 2),
                                    (e |= this.noise.getLengthStatus() << 3),
                                    (e |= this.dmc.getLengthStatus() << 4),
                                    (e |= 32 & this.nes.cpu.dataBus),
                                    (e |= (this.frameIrqActive ? 1 : 0) << 6),
                                    (e |= this.dmc.getIrqStatus() << 7),
                                    this.frameIrqActive && (this.frameIrqClearPending = !0),
                                    255 & e
                                );
                            }
                            writeReg(t, e) {
                                if (t >= 16384 && t < 16388) this.square1.writeReg(t, e);
                                else if (t >= 16388 && t < 16392) this.square2.writeReg(t, e);
                                else if (t >= 16392 && t < 16396) this.triangle.writeReg(t, e);
                                else if (t >= 16396 && t <= 16399) this.noise.writeReg(t, e);
                                else if (16400 === t) this.dmc.writeReg(t, e);
                                else if (16401 === t) this.dmc.writeReg(t, e);
                                else if (16402 === t) this.dmc.writeReg(t, e);
                                else if (16403 === t) this.dmc.writeReg(t, e);
                                else if (16405 === t) this.updateChannelEnable(e), this.dmc.writeReg(t, e);
                                else if (16407 === t) {
                                    this.countSequence = (e >> 7) & 1;
                                    let t = this.nes.cpu,
                                        s = t.instrBusCycles + 1 - t.apuCatchupCycles,
                                        i = (this.apuCycleParity + s) & 1;
                                    (this.frameCycleCounter = -7 + i),
                                        (this.frameStep = 0),
                                        64 & e
                                            ? ((this.frameIrqEnabled = !1),
                                              (this.frameIrqActive = !1),
                                              (this.frameIrqClearPending = !1))
                                            : (this.frameIrqEnabled = !0),
                                        1 === this.countSequence && (this.clockQuarterFrame(), this.clockHalfFrame());
                                }
                            }
                            updateChannelEnable(t) {
                                (this.channelEnableValue = 65535 & t),
                                    this.square1.setEnabled(!!(1 & t)),
                                    this.square2.setEnabled(!!(2 & t)),
                                    this.triangle.setEnabled(!!(4 & t)),
                                    this.noise.setEnabled(!!(8 & t)),
                                    this.dmc.setEnabled(!!(16 & t));
                            }
                            clockFrameCounter(t, e) {
                                let s = t - (e || 0);
                                this.processFrameIrqClear(s),
                                    (this.apuCycleParity = (this.apuCycleParity + s) & 1),
                                    (t += this.extraCycles);
                                let i = this.sampleTimerMax - this.sampleTimer;
                                t << 10 > i
                                    ? ((this.extraCycles = ((t << 10) - i) >> 10), (t -= this.extraCycles))
                                    : (this.extraCycles = 0);
                                let r = this.dmc,
                                    h = this.triangle,
                                    a = this.square1,
                                    n = this.square2,
                                    o = this.noise;
                                if (r.isEnabled)
                                    for (r.shiftCounter -= t << 3; r.shiftCounter <= 0 && r.dmaFrequency > 0; )
                                        (r.shiftCounter += r.dmaFrequency), r.clockDmc();
                                if (h.progTimerMax > 0)
                                    for (h.progTimerCount -= t; h.progTimerCount <= 0; )
                                        (h.progTimerCount += h.progTimerMax + 1),
                                            h.linearCounter > 0 &&
                                                h.lengthCounter > 0 &&
                                                (h.triangleCounter++,
                                                (h.triangleCounter &= 31),
                                                h.isEnabled &&
                                                    (h.triangleCounter >= 16
                                                        ? (h.sampleValue = 15 & h.triangleCounter)
                                                        : (h.sampleValue = 15 - (15 & h.triangleCounter)),
                                                    (h.sampleValue <<= 4)));
                                (a.progTimerCount -= t),
                                    a.progTimerCount <= 0 &&
                                        ((a.progTimerCount += (a.progTimerMax + 1) << 1),
                                        a.squareCounter++,
                                        (a.squareCounter &= 7),
                                        a.updateSampleValue()),
                                    (n.progTimerCount -= t),
                                    n.progTimerCount <= 0 &&
                                        ((n.progTimerCount += (n.progTimerMax + 1) << 1),
                                        n.squareCounter++,
                                        (n.squareCounter &= 7),
                                        n.updateSampleValue());
                                let l = t;
                                if (o.progTimerCount - l > 0)
                                    (o.progTimerCount -= l), (o.accCount += l), (o.accValue += l * o.sampleValue);
                                else
                                    for (; l-- > 0; )
                                        --o.progTimerCount <= 0 &&
                                            o.progTimerMax > 0 &&
                                            ((o.shiftReg <<= 1),
                                            (o.tmp =
                                                32768 & ((o.shiftReg << (0 === o.randomMode ? 1 : 6)) ^ o.shiftReg)),
                                            0 !== o.tmp
                                                ? ((o.shiftReg |= 1), (o.randomBit = 0), (o.sampleValue = 0))
                                                : ((o.randomBit = 1),
                                                  o.isEnabled && o.lengthCounter > 0
                                                      ? (o.sampleValue = o.masterVolume)
                                                      : (o.sampleValue = 0)),
                                            (o.progTimerCount += o.progTimerMax)),
                                            (o.accValue += o.sampleValue),
                                            o.accCount++;
                                this.frameIrqEnabled &&
                                    this.frameIrqActive &&
                                    this.nes.cpu.requestIrq(this.nes.cpu.IRQ_NORMAL),
                                    this._advanceFrameSteps(s),
                                    this.accSample(t),
                                    (this.sampleTimer += t << 10),
                                    this.sampleTimer >= this.sampleTimerMax &&
                                        (this.sample(), (this.sampleTimer -= this.sampleTimerMax));
                            }
                            processFrameIrqClear(t) {
                                if (!this.frameIrqClearPending || t <= 0) return;
                                t >= (1 & this.apuCycleParity ? 2 : 1) &&
                                    ((this.frameIrqActive = !1), (this.frameIrqClearPending = !1));
                            }
                            advanceFrameCounter(t) {
                                this.processFrameIrqClear(t),
                                    (this.apuCycleParity = (this.apuCycleParity + t) & 1),
                                    this._advanceFrameSteps(t);
                            }
                            _advanceFrameSteps(t) {
                                this.frameCycleCounter += t;
                                let e = 0 === this.countSequence ? G : I,
                                    s = 0 === this.countSequence ? 29830 : 37282;
                                for (;;)
                                    if (this.frameStep < e.length && this.frameCycleCounter >= e[this.frameStep])
                                        this.fireFrameStep(this.frameStep), this.frameStep++;
                                    else {
                                        if (!(this.frameStep >= e.length && this.frameCycleCounter >= s)) break;
                                        (this.frameStep = 0),
                                            (this.frameCycleCounter -= s),
                                            0 === this.countSequence &&
                                                ((this.frameIrqActive = this.frameIrqEnabled),
                                                (this.frameIrqClearPending = !1));
                                    }
                            }
                            accSample(t) {
                                this.triangle.sampleCondition &&
                                    ((this.triValue = Math.floor(
                                        (this.triangle.progTimerCount << 4) / (this.triangle.progTimerMax + 1)
                                    )),
                                    this.triValue > 16 && (this.triValue = 16),
                                    this.triangle.triangleCounter >= 16 && (this.triValue = 16 - this.triValue),
                                    (this.triValue += this.triangle.sampleValue)),
                                    2 === t
                                        ? ((this.smpTriangle += this.triValue << 1),
                                          (this.smpDmc += this.dmc.sample << 1),
                                          (this.smpSquare1 += this.square1.sampleValue << 1),
                                          (this.smpSquare2 += this.square2.sampleValue << 1),
                                          (this.accCount += 2))
                                        : 4 === t
                                          ? ((this.smpTriangle += this.triValue << 2),
                                            (this.smpDmc += this.dmc.sample << 2),
                                            (this.smpSquare1 += this.square1.sampleValue << 2),
                                            (this.smpSquare2 += this.square2.sampleValue << 2),
                                            (this.accCount += 4))
                                          : ((this.smpTriangle += t * this.triValue),
                                            (this.smpDmc += t * this.dmc.sample),
                                            (this.smpSquare1 += t * this.square1.sampleValue),
                                            (this.smpSquare2 += t * this.square2.sampleValue),
                                            (this.accCount += t));
                            }
                            fireFrameStep(t) {
                                if (0 === this.countSequence)
                                    switch (t) {
                                        case 0:
                                        case 2:
                                            this.clockQuarterFrame();
                                            break;
                                        case 1:
                                            this.clockQuarterFrame(), this.clockHalfFrame();
                                            break;
                                        case 3:
                                            (this.frameIrqActive = !0), (this.frameIrqClearPending = !1);
                                            break;
                                        case 4:
                                            this.clockQuarterFrame(),
                                                this.clockHalfFrame(),
                                                (this.frameIrqActive = !0),
                                                (this.frameIrqClearPending = !1);
                                    }
                                else
                                    switch (t) {
                                        case 0:
                                        case 2:
                                            this.clockQuarterFrame();
                                            break;
                                        case 1:
                                        case 4:
                                            this.clockQuarterFrame(), this.clockHalfFrame();
                                    }
                            }
                            clockQuarterFrame() {
                                this.square1.clockEnvDecay(),
                                    this.square2.clockEnvDecay(),
                                    this.noise.clockEnvDecay(),
                                    this.triangle.clockLinearCounter();
                            }
                            clockHalfFrame() {
                                this.triangle.clockLengthCounter(),
                                    this.square1.clockLengthCounter(),
                                    this.square2.clockLengthCounter(),
                                    this.noise.clockLengthCounter(),
                                    this.square1.clockSweep(),
                                    this.square2.clockSweep();
                            }
                            sample() {
                                let t, e;
                                this.accCount > 0
                                    ? ((this.smpSquare1 <<= 4),
                                      (this.smpSquare1 = Math.floor(this.smpSquare1 / this.accCount)),
                                      (this.smpSquare2 <<= 4),
                                      (this.smpSquare2 = Math.floor(this.smpSquare2 / this.accCount)),
                                      (this.smpTriangle = Math.floor(this.smpTriangle / this.accCount)),
                                      (this.smpDmc <<= 4),
                                      (this.smpDmc = Math.floor(this.smpDmc / this.accCount)),
                                      (this.accCount = 0))
                                    : ((this.smpSquare1 = this.square1.sampleValue << 4),
                                      (this.smpSquare2 = this.square2.sampleValue << 4),
                                      (this.smpTriangle = this.triangle.sampleValue),
                                      (this.smpDmc = this.dmc.sample << 4));
                                let s = Math.floor((this.noise.accValue << 4) / this.noise.accCount);
                                (this.noise.accValue = s >> 4),
                                    (this.noise.accCount = 1),
                                    (t =
                                        (this.smpSquare1 * this.stereoPosLSquare1 +
                                            this.smpSquare2 * this.stereoPosLSquare2) >>
                                        8),
                                    (e =
                                        (3 * this.smpTriangle * this.stereoPosLTriangle +
                                            (s << 1) * this.stereoPosLNoise +
                                            this.smpDmc * this.stereoPosLDMC) >>
                                        8),
                                    t >= this.square_table.length && (t = this.square_table.length - 1),
                                    e >= this.tnd_table.length && (e = this.tnd_table.length - 1);
                                let i = this.square_table[t] + this.tnd_table[e] - this.dcValue;
                                (t =
                                    (this.smpSquare1 * this.stereoPosRSquare1 +
                                        this.smpSquare2 * this.stereoPosRSquare2) >>
                                    8),
                                    (e =
                                        (3 * this.smpTriangle * this.stereoPosRTriangle +
                                            (s << 1) * this.stereoPosRNoise +
                                            this.smpDmc * this.stereoPosRDMC) >>
                                        8),
                                    t >= this.square_table.length && (t = this.square_table.length - 1),
                                    e >= this.tnd_table.length && (e = this.tnd_table.length - 1);
                                let r = this.square_table[t] + this.tnd_table[e] - this.dcValue,
                                    h = i - this.prevSampleL;
                                (this.prevSampleL += h),
                                    (this.smpAccumL += h - (this.smpAccumL >> 10)),
                                    (i = this.smpAccumL);
                                let a = r - this.prevSampleR;
                                (this.prevSampleR += a),
                                    (this.smpAccumR += a - (this.smpAccumR >> 10)),
                                    (r = this.smpAccumR),
                                    i > this.maxSample && (this.maxSample = i),
                                    i < this.minSample && (this.minSample = i),
                                    this.nes.opts.onAudioSample && this.nes.opts.onAudioSample(i / 32768, r / 32768),
                                    (this.smpSquare1 = 0),
                                    (this.smpSquare2 = 0),
                                    (this.smpTriangle = 0),
                                    (this.smpDmc = 0);
                            }
                            getLengthMax(t) {
                                return this.lengthLookup[t >> 3];
                            }
                            getDmcFrequency(t) {
                                return t >= 0 && t < 16 ? this.dmcFreqLookup[t] : 0;
                            }
                            getNoiseWaveLength(t) {
                                return t >= 0 && t < 16 ? this.noiseWavelengthLookup[t] : 0;
                            }
                            setFrameRate(t) {
                                this.sampleTimerMax = Math.floor((1832727040 * t) / (60 * this.sampleRate));
                            }
                            setPanning(t) {
                                for (let e = 0; e < 5; e++) this.panning[e] = t[e];
                                this.updateStereoPos();
                            }
                            setMasterVolume(t) {
                                t < 0 && (t = 0), t > 256 && (t = 256), (this.masterVolume = t), this.updateStereoPos();
                            }
                            updateStereoPos() {
                                (this.stereoPosLSquare1 = (this.panning[0] * this.masterVolume) >> 8),
                                    (this.stereoPosLSquare2 = (this.panning[1] * this.masterVolume) >> 8),
                                    (this.stereoPosLTriangle = (this.panning[2] * this.masterVolume) >> 8),
                                    (this.stereoPosLNoise = (this.panning[3] * this.masterVolume) >> 8),
                                    (this.stereoPosLDMC = (this.panning[4] * this.masterVolume) >> 8),
                                    (this.stereoPosRSquare1 = this.masterVolume - this.stereoPosLSquare1),
                                    (this.stereoPosRSquare2 = this.masterVolume - this.stereoPosLSquare2),
                                    (this.stereoPosRTriangle = this.masterVolume - this.stereoPosLTriangle),
                                    (this.stereoPosRNoise = this.masterVolume - this.stereoPosLNoise),
                                    (this.stereoPosRDMC = this.masterVolume - this.stereoPosLDMC);
                            }
                            initLengthLookup() {
                                this.lengthLookup = [
                                    10, 254, 20, 2, 40, 4, 80, 6, 160, 8, 60, 10, 14, 12, 26, 14, 12, 16, 24, 18, 48,
                                    20, 96, 22, 192, 24, 72, 26, 16, 28, 32, 30,
                                ];
                            }
                            initDmcFrequencyLookup() {
                                (this.dmcFreqLookup = new Array(16)),
                                    (this.dmcFreqLookup[0] = 3424),
                                    (this.dmcFreqLookup[1] = 3040),
                                    (this.dmcFreqLookup[2] = 2720),
                                    (this.dmcFreqLookup[3] = 2560),
                                    (this.dmcFreqLookup[4] = 2288),
                                    (this.dmcFreqLookup[5] = 2032),
                                    (this.dmcFreqLookup[6] = 1808),
                                    (this.dmcFreqLookup[7] = 1712),
                                    (this.dmcFreqLookup[8] = 1520),
                                    (this.dmcFreqLookup[9] = 1280),
                                    (this.dmcFreqLookup[10] = 1136),
                                    (this.dmcFreqLookup[11] = 1024),
                                    (this.dmcFreqLookup[12] = 848),
                                    (this.dmcFreqLookup[13] = 672),
                                    (this.dmcFreqLookup[14] = 576),
                                    (this.dmcFreqLookup[15] = 432);
                            }
                            initNoiseWavelengthLookup() {
                                (this.noiseWavelengthLookup = new Array(16)),
                                    (this.noiseWavelengthLookup[0] = 4),
                                    (this.noiseWavelengthLookup[1] = 8),
                                    (this.noiseWavelengthLookup[2] = 16),
                                    (this.noiseWavelengthLookup[3] = 32),
                                    (this.noiseWavelengthLookup[4] = 64),
                                    (this.noiseWavelengthLookup[5] = 96),
                                    (this.noiseWavelengthLookup[6] = 128),
                                    (this.noiseWavelengthLookup[7] = 160),
                                    (this.noiseWavelengthLookup[8] = 202),
                                    (this.noiseWavelengthLookup[9] = 254),
                                    (this.noiseWavelengthLookup[10] = 380),
                                    (this.noiseWavelengthLookup[11] = 508),
                                    (this.noiseWavelengthLookup[12] = 762),
                                    (this.noiseWavelengthLookup[13] = 1016),
                                    (this.noiseWavelengthLookup[14] = 2034),
                                    (this.noiseWavelengthLookup[15] = 4068);
                            }
                            initDACtables() {
                                let t,
                                    e,
                                    s,
                                    i = 0,
                                    r = 0;
                                for (
                                    this.square_table = new Array(512), this.tnd_table = new Array(3264), s = 0;
                                    s < 512;
                                    s++
                                )
                                    (t = 95.52 / (8128 / (s / 16) + 100)),
                                        (t *= 0.98411),
                                        (t *= 5e4),
                                        (e = Math.floor(t)),
                                        (this.square_table[s] = e),
                                        e > i && (i = e);
                                for (s = 0; s < 3264; s++)
                                    (t = 163.67 / (24329 / (s / 16) + 100)),
                                        (t *= 0.98411),
                                        (t *= 5e4),
                                        (e = Math.floor(t)),
                                        (this.tnd_table[s] = e),
                                        e > r && (r = e);
                                (this.dacRange = i + r), (this.dcValue = this.dacRange / 2);
                            }
                            toJSON() {
                                let t = r(this);
                                return (
                                    (t.dmc = this.dmc.toJSON()),
                                    (t.noise = this.noise.toJSON()),
                                    (t.square1 = this.square1.toJSON()),
                                    (t.square2 = this.square2.toJSON()),
                                    (t.triangle = this.triangle.toJSON()),
                                    t
                                );
                            }
                            fromJSON(t) {
                                i(this, t),
                                    this.dmc.fromJSON(t.dmc),
                                    this.noise.fromJSON(t.noise),
                                    this.square1.fromJSON(t.square1),
                                    this.square2.fromJSON(t.square2),
                                    this.triangle.fromJSON(t.triangle);
                            }
                            static JSON_PROPERTIES = [
                                "channelEnableValue",
                                "sampleRate",
                                "frameIrqEnabled",
                                "frameIrqActive",
                                "frameIrqClearPending",
                                "apuCycleParity",
                                "startedPlaying",
                                "recordOutput",
                                "frameCycleCounter",
                                "frameStep",
                                "countSequence",
                                "sampleTimer",
                                "sampleTimerMax",
                                "sampleCount",
                                "triValue",
                                "smpSquare1",
                                "smpSquare2",
                                "smpTriangle",
                                "smpDmc",
                                "accCount",
                                "prevSampleL",
                                "prevSampleR",
                                "smpAccumL",
                                "smpAccumR",
                                "masterVolume",
                                "stereoPosLSquare1",
                                "stereoPosLSquare2",
                                "stereoPosLTriangle",
                                "stereoPosLNoise",
                                "stereoPosLDMC",
                                "stereoPosRSquare1",
                                "stereoPosRSquare2",
                                "stereoPosRTriangle",
                                "stereoPosRNoise",
                                "stereoPosRDMC",
                                "extraCycles",
                                "maxSample",
                                "minSample",
                                "panning",
                            ];
                        },
                        z = "APZLGITYEOXUKSVN";
                    function q(t) {
                        return z.indexOf(t);
                    }
                    function D(t) {
                        return z[t];
                    }
                    function U(t, e) {
                        const s = t.toString(16);
                        return "0000".substring(0, e - s.length) + s;
                    }
                    const x = class {
                        constructor() {
                            (this.patches = []), (this.enabled = !0), (this.onChange = null);
                        }
                        setEnabled(t) {
                            (this.enabled = t), this.onChange && this.onChange();
                        }
                        addCode(t) {
                            const e = this.decode(t);
                            if (!e) throw new Error(\`Invalid Game Genie code: \${t}\`);
                            this.patches.push(e), this.onChange && this.onChange();
                        }
                        addPatch(t, e, s) {
                            this.patches.push({ addr: t, value: e, key: s }), this.onChange && this.onChange();
                        }
                        removeAllCodes() {
                            (this.patches = []), this.onChange && this.onChange();
                        }
                        applyCodes(t, e) {
                            if (!this.enabled) return e;
                            for (let s = 0; s < this.patches.length; ++s)
                                if (
                                    this.patches[s].addr === (32767 & t) &&
                                    (void 0 === this.patches[s].key || this.patches[s].key === e)
                                )
                                    return this.patches[s].value;
                            return e;
                        }
                        decode(t) {
                            if (t.includes(":")) return this.decodeHex(t);
                            const e = t.toUpperCase().split("").map(q);
                            let s = ((8 & e[0]) << 4) + ((7 & e[1]) << 4) + (7 & e[0]);
                            const i =
                                ((7 & e[3]) << 12) +
                                ((8 & e[4]) << 8) +
                                ((7 & e[5]) << 8) +
                                ((8 & e[1]) << 4) +
                                ((7 & e[2]) << 4) +
                                (8 & e[3]) +
                                (7 & e[4]);
                            let r;
                            8 === e.length
                                ? ((s += 8 & e[7]),
                                  (r = ((8 & e[6]) << 4) + ((7 & e[7]) << 4) + (8 & e[5]) + (7 & e[6])))
                                : (s += 8 & e[5]);
                            return { value: s, addr: i, wantskey: !!(e[2] >> 3), key: r };
                        }
                        encodeHex(t, e, s, i) {
                            let r = U(t, 4) + ":" + U(e, 2);
                            return (void 0 !== s || i) && (r += "?"), void 0 !== s && (r += U(s, 2)), r;
                        }
                        decodeHex(t) {
                            const e = t.match(/([0-9a-fA-F]+):([0-9a-fA-F]+)(\?[0-9a-fA-F]*)?/);
                            if (!e) return null;
                            const s = parseInt(e[1], 16);
                            return {
                                value: parseInt(e[2], 16),
                                addr: s,
                                wantskey: void 0 !== e[3],
                                key: void 0 !== e[3] && e[3].length > 1 ? parseInt(e[3].substring(1), 16) : void 0,
                            };
                        }
                        encode(t, e, s, i) {
                            const r = Array(6);
                            (r[0] = (7 & e) + ((e >> 4) & 8)),
                                (r[1] = ((e >> 4) & 7) + ((t >> 4) & 8)),
                                (r[2] = (t >> 4) & 7),
                                (r[3] = (t >> 12) + (8 & t)),
                                (r[4] = (7 & t) + ((t >> 8) & 8)),
                                (r[5] = (t >> 8) & 7),
                                void 0 === s
                                    ? ((r[5] += 8 & e), i && (r[2] += 8))
                                    : ((r[2] += 8),
                                      (r[5] += 8 & s),
                                      (r[6] = (7 & s) + ((s >> 4) & 8)),
                                      (r[7] = ((s >> 4) & 7) + (8 & e)));
                            return r.map(D).join("");
                        }
                    };
                    const W = class {
                        static mapperName = "NROM";
                        constructor(t) {
                            (this.nes = t),
                                (this.joy1StrobeState = 0),
                                (this.joy2StrobeState = 0),
                                (this.joypadLastWrite = 0),
                                (this.joypadOutputBit0 = 0),
                                (this.joypadLastWriteCycle = -2),
                                (this.zapperFired = !1),
                                (this.zapperX = null),
                                (this.zapperY = null),
                                (this.bgTileOverride = !1);
                        }
                        write(t, e) {
                            t < 8192
                                ? (this.nes.cpu.mem[2047 & t] = e)
                                : t >= 32768 ||
                                  (t >= 24576
                                      ? ((this.nes.cpu.mem[t] = e), this.nes.opts.onBatteryRamWrite(t, e))
                                      : t > 16407
                                        ? (this.nes.cpu.mem[t] = e)
                                        : t > 8199 && t < 16384
                                          ? this.regWrite(8192 + (7 & t), e)
                                          : this.regWrite(t, e));
                        }
                        writelow(t, e) {
                            t < 8192
                                ? (this.nes.cpu.mem[2047 & t] = e)
                                : t >= 32768 ||
                                  (t > 16407
                                      ? (this.nes.cpu.mem[t] = e)
                                      : t > 8199 && t < 16384
                                        ? this.regWrite(8192 + (7 & t), e)
                                        : this.regWrite(t, e));
                        }
                        load(t) {
                            return (t &= 65535) > 16407
                                ? t < 24576
                                    ? this.nes.cpu.dataBus
                                    : this.nes.cpu.mem[t]
                                : t >= 8192
                                  ? this.regLoad(t)
                                  : this.nes.cpu.mem[2047 & t];
                        }
                        regLoad(t) {
                            switch (t >> 12) {
                                case 0:
                                case 1:
                                    break;
                                case 2:
                                case 3:
                                    switch (7 & t) {
                                        case 0:
                                        case 1:
                                        case 3:
                                        case 5:
                                        case 6:
                                            return this.nes.ppu.openBusLatch;
                                        case 2:
                                            return this.nes.ppu.readStatusRegister();
                                        case 4:
                                            return this.nes.ppu.sramLoad();
                                        case 7:
                                            return this.nes.ppu.vramLoad();
                                    }
                                    break;
                                case 4:
                                    switch (t - 16405) {
                                        case 0:
                                            return this.nes.papu.readReg(t);
                                        case 1:
                                            return (31 & this.joy1Read()) | (224 & this.nes.cpu.dataBus);
                                        case 2: {
                                            let t = 0;
                                            return (
                                                null !== this.zapperX &&
                                                    null !== this.zapperY &&
                                                    (this.nes.ppu.isPixelWhite(this.zapperX, this.zapperY) || (t = 8)),
                                                this.zapperFired && (t |= 16),
                                                (31 & (this.joy2Read() | t)) | (224 & this.nes.cpu.dataBus)
                                            );
                                        }
                                    }
                            }
                            let e = this.nes.cpu;
                            if (e._dmcFetchCycles > 0 && e._dmcFetchCycles === e.instrBusCycles + 1) {
                                let t = this.nes.papu.dmc;
                                if (t && t.isEnabled) return t.lastFetchedByte;
                            }
                            return e.dataBus;
                        }
                        regWrite(t, e) {
                            switch (
                                (t >= 8192 &&
                                    t <= 16383 &&
                                    ((this.nes.ppu.openBusLatch = e), (this.nes.ppu.openBusDecayFrames = 36)),
                                t)
                            ) {
                                case 8192:
                                    (this.nes.cpu.mem[t] = e), this.nes.ppu.updateControlReg1(e);
                                    break;
                                case 8193:
                                    (this.nes.cpu.mem[t] = e), this.nes.ppu.updateControlReg2(e);
                                    break;
                                case 8195:
                                    this.nes.ppu.writeSRAMAddress(e);
                                    break;
                                case 8196:
                                    this.nes.ppu.sramWrite(e);
                                    break;
                                case 8197:
                                    this.nes.ppu.scrollWrite(e);
                                    break;
                                case 8198:
                                    this.nes.ppu.writeVRAMAddress(e);
                                    break;
                                case 8199:
                                    this.nes.ppu.vramWrite(e);
                                    break;
                                case 16404:
                                    this.nes.ppu.sramDMA(e);
                                    break;
                                case 16405:
                                case 16407:
                                    this.nes.papu.writeReg(t, e);
                                    break;
                                case 16406: {
                                    let t = this.nes.cpu,
                                        s = t._cpuCycleBase + t.instrBusCycles;
                                    if (s - this.joypadLastWriteCycle > 1) {
                                        let t = 1 & this.joypadLastWrite;
                                        t !== this.joypadOutputBit0 &&
                                            (1 === this.joypadOutputBit0 &&
                                                0 === t &&
                                                ((this.joy1StrobeState = 0), (this.joy2StrobeState = 0)),
                                            (this.joypadOutputBit0 = t));
                                    }
                                    if (((this.joypadLastWrite = e), (this.joypadLastWriteCycle = s), s % 2 == 1)) {
                                        let t = 1 & e;
                                        1 === this.joypadOutputBit0 &&
                                            0 === t &&
                                            ((this.joy1StrobeState = 0), (this.joy2StrobeState = 0)),
                                            (this.joypadOutputBit0 = t);
                                    }
                                    break;
                                }
                                default:
                                    t >= 16384 && t <= 16407 && this.nes.papu.writeReg(t, e);
                            }
                        }
                        _syncJoypadOutput() {
                            let t = 1 & this.joypadLastWrite;
                            t !== this.joypadOutputBit0 &&
                                (1 === this.joypadOutputBit0 &&
                                    0 === t &&
                                    ((this.joy1StrobeState = 0), (this.joy2StrobeState = 0)),
                                (this.joypadOutputBit0 = t));
                        }
                        joy1Read() {
                            if ((this._syncJoypadOutput(), this.joypadOutputBit0))
                                return this.nes.controllers[1].state[0];
                            let t;
                            return (
                                (t =
                                    this.joy1StrobeState < 8 ? this.nes.controllers[1].state[this.joy1StrobeState] : 1),
                                this.joy1StrobeState++,
                                24 === this.joy1StrobeState && (this.joy1StrobeState = 0),
                                t
                            );
                        }
                        joy2Read() {
                            if ((this._syncJoypadOutput(), this.joypadOutputBit0))
                                return this.nes.controllers[2].state[0];
                            let t;
                            return (
                                (t =
                                    this.joy2StrobeState < 8 ? this.nes.controllers[2].state[this.joy2StrobeState] : 1),
                                this.joy2StrobeState++,
                                24 === this.joy2StrobeState && (this.joy2StrobeState = 0),
                                t
                            );
                        }
                        loadROM() {
                            if (!this.nes.rom.valid || this.nes.rom.romCount < 1)
                                throw new Error("NoMapper: Invalid ROM! Unable to load.");
                            this.loadPRGROM(),
                                this.loadCHRROM(),
                                this.loadBatteryRam(),
                                this.nes.cpu.requestIrq(this.nes.cpu.IRQ_RESET);
                        }
                        loadPRGROM() {
                            this.nes.rom.romCount > 1
                                ? (this.loadRomBank(0, 32768), this.loadRomBank(1, 49152))
                                : (this.loadRomBank(0, 32768), this.loadRomBank(0, 49152));
                        }
                        loadCHRROM() {
                            this.nes.rom.vromCount > 0 &&
                                (1 === this.nes.rom.vromCount
                                    ? (this.loadVromBank(0, 0), this.loadVromBank(0, 4096))
                                    : (this.loadVromBank(0, 0), this.loadVromBank(1, 4096)));
                        }
                        loadBatteryRam() {
                            if (this.nes.rom.batteryRam) {
                                let t = this.nes.rom.batteryRam;
                                null !== t && 8192 === t.length && s(t, 0, this.nes.cpu.mem, 24576, 8192);
                            }
                        }
                        loadRomBank(t, e) {
                            (t %= this.nes.rom.romCount), s(this.nes.rom.rom[t], 0, this.nes.cpu.mem, e, 16384);
                        }
                        loadVromBank(t, e) {
                            if (0 === this.nes.rom.vromCount) return;
                            this.nes.ppu.triggerRendering(),
                                s(this.nes.rom.vrom[t % this.nes.rom.vromCount], 0, this.nes.ppu.vramMem, e, 4096),
                                s(
                                    this.nes.rom.vromTile[t % this.nes.rom.vromCount],
                                    0,
                                    this.nes.ppu.ptTile,
                                    e >> 4,
                                    256
                                );
                        }
                        load32kRomBank(t, e) {
                            this.loadRomBank((2 * t) % this.nes.rom.romCount, e),
                                this.loadRomBank((2 * t + 1) % this.nes.rom.romCount, e + 16384);
                        }
                        load8kVromBank(t, e) {
                            0 !== this.nes.rom.vromCount &&
                                (this.nes.ppu.triggerRendering(),
                                this.loadVromBank(t % this.nes.rom.vromCount, e),
                                this.loadVromBank((t + 1) % this.nes.rom.vromCount, e + 4096));
                        }
                        load1kVromBank(t, e) {
                            if (0 === this.nes.rom.vromCount) return;
                            this.nes.ppu.triggerRendering();
                            let i = Math.floor(t / 4) % this.nes.rom.vromCount,
                                r = (t % 4) * 1024;
                            s(this.nes.rom.vrom[i], r, this.nes.ppu.vramMem, e, 1024);
                            let h = this.nes.rom.vromTile[i],
                                a = e >> 4;
                            for (let e = 0; e < 64; e++) this.nes.ppu.ptTile[a + e] = h[(t % 4 << 6) + e];
                        }
                        load2kVromBank(t, e) {
                            if (0 === this.nes.rom.vromCount) return;
                            this.nes.ppu.triggerRendering();
                            let i = Math.floor(t / 2) % this.nes.rom.vromCount,
                                r = (t % 2) * 2048;
                            s(this.nes.rom.vrom[i], r, this.nes.ppu.vramMem, e, 2048);
                            let h = this.nes.rom.vromTile[i],
                                a = e >> 4;
                            for (let e = 0; e < 128; e++) this.nes.ppu.ptTile[a + e] = h[(t % 2 << 7) + e];
                        }
                        load8kRomBank(t, e) {
                            let i = Math.floor(t / 2) % this.nes.rom.romCount,
                                r = (t % 2) * 8192;
                            s(this.nes.rom.rom[i], r, this.nes.cpu.mem, e, 8192);
                        }
                        canWriteChr(t) {
                            return 0 === this.nes.rom.vromCount;
                        }
                        clockIrqCounter() {}
                        latchAccess(t) {}
                        onBgRender() {}
                        onSpriteRender() {}
                        getBgTileData() {
                            return null;
                        }
                        getSpritePatternTile(t) {
                            return this.nes.ppu.ptTile[t];
                        }
                        toJSON() {
                            return {
                                joy1StrobeState: this.joy1StrobeState,
                                joy2StrobeState: this.joy2StrobeState,
                                joypadLastWrite: this.joypadLastWrite,
                                joypadOutputBit0: this.joypadOutputBit0,
                                joypadLastWriteCycle: this.joypadLastWriteCycle,
                            };
                        }
                        fromJSON(t) {
                            (this.joy1StrobeState = t.joy1StrobeState),
                                (this.joy2StrobeState = t.joy2StrobeState),
                                (this.joypadLastWrite = t.joypadLastWrite),
                                (this.joypadOutputBit0 = t.joypadOutputBit0 || 0),
                                (this.joypadLastWriteCycle = t.joypadLastWriteCycle ?? -2);
                        }
                    };
                    const H = class extends W {
                        static mapperName = "MMC1";
                        constructor(t) {
                            super(t),
                                (this.regBuffer = 0),
                                (this.regBufferCounter = 0),
                                (this.mirroring = 0),
                                (this.oneScreenMirroring = 0),
                                (this.prgSwitchingArea = 1),
                                (this.prgSwitchingSize = 1),
                                (this.vromSwitchingSize = 0),
                                (this.romSelectionReg0 = 0),
                                (this.romSelectionReg1 = 0),
                                (this.romBankSelect = 0);
                        }
                        write(t, e) {
                            t < 32768
                                ? super.write(t, e)
                                : 128 & e
                                  ? ((this.regBufferCounter = 0),
                                    (this.regBuffer = 0),
                                    0 === this.getRegNumber(t) &&
                                        ((this.prgSwitchingArea = 1), (this.prgSwitchingSize = 1)))
                                  : ((this.regBuffer =
                                        (this.regBuffer & (255 - (1 << this.regBufferCounter))) |
                                        ((1 & e) << this.regBufferCounter)),
                                    this.regBufferCounter++,
                                    5 === this.regBufferCounter &&
                                        (this.setReg(this.getRegNumber(t), this.regBuffer),
                                        (this.regBuffer = 0),
                                        (this.regBufferCounter = 0)));
                        }
                        setReg(t, e) {
                            let s;
                            switch (t) {
                                case 0:
                                    (s = 3 & e),
                                        s !== this.mirroring &&
                                            ((this.mirroring = s),
                                            2 & this.mirroring
                                                ? 1 & this.mirroring
                                                    ? this.nes.ppu.setMirroring(this.nes.rom.HORIZONTAL_MIRRORING)
                                                    : this.nes.ppu.setMirroring(this.nes.rom.VERTICAL_MIRRORING)
                                                : this.nes.ppu.setMirroring(this.nes.rom.SINGLESCREEN_MIRRORING)),
                                        (this.prgSwitchingArea = (e >> 2) & 1),
                                        (this.prgSwitchingSize = (e >> 3) & 1),
                                        (this.vromSwitchingSize = (e >> 4) & 1);
                                    break;
                                case 1:
                                    (this.romSelectionReg0 = (e >> 4) & 1),
                                        this.nes.rom.vromCount > 0 &&
                                            (0 === this.vromSwitchingSize
                                                ? 0 === this.romSelectionReg0
                                                    ? this.load8kVromBank(15 & e, 0)
                                                    : this.load8kVromBank(
                                                          Math.floor(this.nes.rom.vromCount / 2) + (15 & e),
                                                          0
                                                      )
                                                : 0 === this.romSelectionReg0
                                                  ? this.loadVromBank(15 & e, 0)
                                                  : this.loadVromBank(
                                                        Math.floor(this.nes.rom.vromCount / 2) + (15 & e),
                                                        0
                                                    ));
                                    break;
                                case 2:
                                    (this.romSelectionReg1 = (e >> 4) & 1),
                                        this.nes.rom.vromCount > 0 &&
                                            1 === this.vromSwitchingSize &&
                                            (0 === this.romSelectionReg1
                                                ? this.loadVromBank(15 & e, 4096)
                                                : this.loadVromBank(
                                                      Math.floor(this.nes.rom.vromCount / 2) + (15 & e),
                                                      4096
                                                  ));
                                    break;
                                default: {
                                    let t,
                                        s = 0;
                                    this.nes.rom.romCount >= 32
                                        ? 0 === this.vromSwitchingSize
                                            ? 1 === this.romSelectionReg0 && (s = 16)
                                            : (s = (this.romSelectionReg0 | (this.romSelectionReg1 << 1)) << 3)
                                        : this.nes.rom.romCount >= 16 && 1 === this.romSelectionReg0 && (s = 8),
                                        0 === this.prgSwitchingSize
                                            ? ((t = s + (15 & e)), this.load32kRomBank(t, 32768))
                                            : ((t = 2 * s + (15 & e)),
                                              0 === this.prgSwitchingArea
                                                  ? this.loadRomBank(t, 49152)
                                                  : this.loadRomBank(t, 32768));
                                }
                            }
                        }
                        getRegNumber(t) {
                            return t >= 32768 && t <= 40959
                                ? 0
                                : t >= 40960 && t <= 49151
                                  ? 1
                                  : t >= 49152 && t <= 57343
                                    ? 2
                                    : 3;
                        }
                        loadROM() {
                            if (!this.nes.rom.valid) throw new Error("MMC1: Invalid ROM! Unable to load.");
                            this.loadRomBank(0, 32768),
                                this.loadRomBank(this.nes.rom.romCount - 1, 49152),
                                this.loadCHRROM(),
                                this.loadBatteryRam(),
                                this.nes.cpu.requestIrq(this.nes.cpu.IRQ_RESET);
                        }
                        switchLowHighPrgRom(t) {}
                        switch16to32() {}
                        switch32to16() {}
                        toJSON() {
                            let t = super.toJSON();
                            return (
                                (t.mirroring = this.mirroring),
                                (t.oneScreenMirroring = this.oneScreenMirroring),
                                (t.prgSwitchingArea = this.prgSwitchingArea),
                                (t.prgSwitchingSize = this.prgSwitchingSize),
                                (t.vromSwitchingSize = this.vromSwitchingSize),
                                (t.romSelectionReg0 = this.romSelectionReg0),
                                (t.romSelectionReg1 = this.romSelectionReg1),
                                (t.romBankSelect = this.romBankSelect),
                                (t.regBuffer = this.regBuffer),
                                (t.regBufferCounter = this.regBufferCounter),
                                t
                            );
                        }
                        fromJSON(t) {
                            super.fromJSON(t),
                                (this.mirroring = t.mirroring),
                                (this.oneScreenMirroring = t.oneScreenMirroring),
                                (this.prgSwitchingArea = t.prgSwitchingArea),
                                (this.prgSwitchingSize = t.prgSwitchingSize),
                                (this.vromSwitchingSize = t.vromSwitchingSize),
                                (this.romSelectionReg0 = t.romSelectionReg0),
                                (this.romSelectionReg1 = t.romSelectionReg1),
                                (this.romBankSelect = t.romBankSelect),
                                (this.regBuffer = t.regBuffer),
                                (this.regBufferCounter = t.regBufferCounter);
                        }
                    };
                    const J = class extends W {
                        static mapperName = "UxROM";
                        constructor(t) {
                            super(t);
                        }
                        write(t, e) {
                            t < 32768 ? super.write(t, e) : this.loadRomBank(e, 32768);
                        }
                        loadROM() {
                            if (!this.nes.rom.valid) throw new Error("UNROM: Invalid ROM! Unable to load.");
                            this.loadRomBank(0, 32768),
                                this.loadRomBank(this.nes.rom.romCount - 1, 49152),
                                this.loadCHRROM(),
                                this.nes.cpu.requestIrq(this.nes.cpu.IRQ_RESET);
                        }
                    };
                    const Y = class extends W {
                        static mapperName = "CNROM";
                        constructor(t) {
                            super(t);
                        }
                        write(t, e) {
                            t < 32768 ? super.write(t, e) : this.load8kVromBank(2 * e, 0);
                        }
                    };
                    class X extends W {
                        static mapperName = "MMC3";
                        static CMD_SEL_2_1K_VROM_0000 = 0;
                        static CMD_SEL_2_1K_VROM_0800 = 1;
                        static CMD_SEL_1K_VROM_1000 = 2;
                        static CMD_SEL_1K_VROM_1400 = 3;
                        static CMD_SEL_1K_VROM_1800 = 4;
                        static CMD_SEL_1K_VROM_1C00 = 5;
                        static CMD_SEL_ROM_PAGE1 = 6;
                        static CMD_SEL_ROM_PAGE2 = 7;
                        constructor(t) {
                            super(t),
                                (this.command = 0),
                                (this.prgAddressSelect = 0),
                                (this.chrAddressSelect = 0),
                                (this.pageNumber = 0),
                                (this.irqCounter = 0),
                                (this.irqLatchValue = 0),
                                (this.irqEnable = 0),
                                (this.prgAddressChanged = !1);
                        }
                        write(t, e) {
                            if (t < 32768) super.write(t, e);
                            else
                                switch (57345 & t) {
                                    case 32768: {
                                        this.command = 7 & e;
                                        const t = (e >> 6) & 1;
                                        t !== this.prgAddressSelect && (this.prgAddressChanged = !0),
                                            (this.prgAddressSelect = t),
                                            (this.chrAddressSelect = (e >> 7) & 1);
                                        break;
                                    }
                                    case 32769:
                                        this.executeCommand(this.command, e);
                                        break;
                                    case 40960:
                                        1 & e
                                            ? this.nes.ppu.setMirroring(this.nes.rom.HORIZONTAL_MIRRORING)
                                            : this.nes.ppu.setMirroring(this.nes.rom.VERTICAL_MIRRORING);
                                        break;
                                    case 40961:
                                        break;
                                    case 49152:
                                        this.irqCounter = e;
                                        break;
                                    case 49153:
                                        this.irqLatchValue = e;
                                        break;
                                    case 57344:
                                        this.irqEnable = 0;
                                        break;
                                    case 57345:
                                        this.irqEnable = 1;
                                }
                        }
                        executeCommand(t, e) {
                            switch (t) {
                                case X.CMD_SEL_2_1K_VROM_0000:
                                    0 === this.chrAddressSelect
                                        ? (this.load1kVromBank(e, 0), this.load1kVromBank(e + 1, 1024))
                                        : (this.load1kVromBank(e, 4096), this.load1kVromBank(e + 1, 5120));
                                    break;
                                case X.CMD_SEL_2_1K_VROM_0800:
                                    0 === this.chrAddressSelect
                                        ? (this.load1kVromBank(e, 2048), this.load1kVromBank(e + 1, 3072))
                                        : (this.load1kVromBank(e, 6144), this.load1kVromBank(e + 1, 7168));
                                    break;
                                case X.CMD_SEL_1K_VROM_1000:
                                    0 === this.chrAddressSelect
                                        ? this.load1kVromBank(e, 4096)
                                        : this.load1kVromBank(e, 0);
                                    break;
                                case X.CMD_SEL_1K_VROM_1400:
                                    0 === this.chrAddressSelect
                                        ? this.load1kVromBank(e, 5120)
                                        : this.load1kVromBank(e, 1024);
                                    break;
                                case X.CMD_SEL_1K_VROM_1800:
                                    0 === this.chrAddressSelect
                                        ? this.load1kVromBank(e, 6144)
                                        : this.load1kVromBank(e, 2048);
                                    break;
                                case X.CMD_SEL_1K_VROM_1C00:
                                    0 === this.chrAddressSelect
                                        ? this.load1kVromBank(e, 7168)
                                        : this.load1kVromBank(e, 3072);
                                    break;
                                case X.CMD_SEL_ROM_PAGE1:
                                    this.prgAddressChanged &&
                                        (0 === this.prgAddressSelect
                                            ? this.load8kRomBank(2 * (this.nes.rom.romCount - 1), 49152)
                                            : this.load8kRomBank(2 * (this.nes.rom.romCount - 1), 32768),
                                        (this.prgAddressChanged = !1)),
                                        0 === this.prgAddressSelect
                                            ? this.load8kRomBank(e, 32768)
                                            : this.load8kRomBank(e, 49152);
                                    break;
                                case X.CMD_SEL_ROM_PAGE2:
                                    this.load8kRomBank(e, 40960),
                                        this.prgAddressChanged &&
                                            (0 === this.prgAddressSelect
                                                ? this.load8kRomBank(2 * (this.nes.rom.romCount - 1), 49152)
                                                : this.load8kRomBank(2 * (this.nes.rom.romCount - 1), 32768),
                                            (this.prgAddressChanged = !1));
                            }
                        }
                        loadROM() {
                            if (!this.nes.rom.valid) throw new Error("MMC3: Invalid ROM! Unable to load.");
                            this.load8kRomBank(2 * (this.nes.rom.romCount - 1), 49152),
                                this.load8kRomBank(2 * (this.nes.rom.romCount - 1) + 1, 57344),
                                this.load8kRomBank(0, 32768),
                                this.load8kRomBank(1, 40960),
                                this.loadCHRROM(),
                                this.loadBatteryRam(),
                                this.nes.cpu.requestIrq(this.nes.cpu.IRQ_RESET);
                        }
                        clockIrqCounter() {
                            1 === this.irqEnable &&
                                (this.irqCounter--,
                                this.irqCounter < 0 &&
                                    (this.nes.cpu.requestIrq(this.nes.cpu.IRQ_NORMAL),
                                    (this.irqCounter = this.irqLatchValue)));
                        }
                        toJSON() {
                            let t = super.toJSON();
                            return (
                                (t.command = this.command),
                                (t.prgAddressSelect = this.prgAddressSelect),
                                (t.chrAddressSelect = this.chrAddressSelect),
                                (t.pageNumber = this.pageNumber),
                                (t.irqCounter = this.irqCounter),
                                (t.irqLatchValue = this.irqLatchValue),
                                (t.irqEnable = this.irqEnable),
                                (t.prgAddressChanged = this.prgAddressChanged),
                                t
                            );
                        }
                        fromJSON(t) {
                            super.fromJSON(t),
                                (this.command = t.command),
                                (this.prgAddressSelect = t.prgAddressSelect),
                                (this.chrAddressSelect = t.chrAddressSelect),
                                (this.pageNumber = t.pageNumber),
                                (this.irqCounter = t.irqCounter),
                                (this.irqLatchValue = t.irqLatchValue),
                                (this.irqEnable = t.irqEnable),
                                (this.prgAddressChanged = t.prgAddressChanged);
                        }
                    }
                    const j = X;
                    const Z = class extends W {
                        static mapperName = "MMC5";
                        constructor(t) {
                            super(t),
                                (this.prgMode = 3),
                                (this.prgBankReg = new Uint8Array(5)),
                                (this.prgBankReg[4] = 255),
                                (this.prgRam = new Uint8Array(65536)),
                                (this.prgRamProtectA = 3),
                                (this.prgRamProtectB = 3),
                                (this.chrMode = 3),
                                (this.chrBankA = new Uint16Array(8)),
                                (this.chrBankB = new Uint16Array(4)),
                                (this.chrUpperBits = 0),
                                (this.lastChrWrite = 0),
                                (this.ntMapping = new Uint8Array(4)),
                                (this.exramMode = 0),
                                (this.exram = new Uint8Array(1024)),
                                (this.fillTile = 0),
                                (this.fillAttr = 0),
                                (this.irqTarget = 0),
                                (this.irqEnabled = !1),
                                (this.irqPending = !1),
                                (this.inFrame = !1),
                                (this.irqCounter = 0),
                                (this.multA = 0),
                                (this.multB = 0),
                                (this.splitEnabled = !1),
                                (this.splitRight = !1),
                                (this.splitTile = 0),
                                (this.splitScroll = 0),
                                (this.splitPage = 0),
                                (this.pulse1 = this._initPulse()),
                                (this.pulse2 = this._initPulse()),
                                (this.pcmValue = 0),
                                (this.pcmReadMode = !1),
                                (this.pcmIrqEnabled = !1),
                                (this.audioEnabled = 0),
                                (this._chrBankTarget = -1);
                        }
                        _initPulse() {
                            return {
                                enabled: !1,
                                dutyCycle: 0,
                                lengthHalt: !1,
                                constantVolume: !1,
                                volume: 0,
                                timer: 0,
                                timerCounter: 0,
                                lengthCounter: 0,
                                envelopeCounter: 0,
                                envelopeDecay: 15,
                                envelopeStart: !1,
                                sequencePos: 0,
                            };
                        }
                        load(t) {
                            if ((t &= 65535) < 20480) return super.load(t);
                            if (20501 === t) {
                                let t = 0;
                                return (
                                    this.pulse1.lengthCounter > 0 && (t |= 1),
                                    this.pulse2.lengthCounter > 0 && (t |= 2),
                                    t
                                );
                            }
                            if (20496 === t) return 0;
                            if (t >= 20736 && t <= 20740) return this.nes.cpu.dataBus;
                            if (20741 === t) return this.nes.cpu.dataBus;
                            if (20996 === t) {
                                let t = this.nes.ppu;
                                (t.scanline >= 20 &&
                                    t.scanline <= 260 &&
                                    (1 === t.f_bgVisibility || 1 === t.f_spVisibility)) ||
                                    (this.inFrame = !1);
                                let e = 0;
                                return (
                                    this.irqPending && (e |= 128), this.inFrame && (e |= 64), (this.irqPending = !1), e
                                );
                            }
                            if (20997 === t) return (this.multA * this.multB) & 255;
                            if (20998 === t) return ((this.multA * this.multB) >> 8) & 255;
                            if (t >= 23552 && t <= 24575)
                                return this.exramMode >= 2 ? this.exram[t - 23552] : this.nes.cpu.dataBus;
                            if (t < 24576) return this.nes.cpu.dataBus;
                            if (t < 32768) {
                                let e = 8192 * (7 & this.prgBankReg[0]) + (t - 24576);
                                return this.prgRam[65535 & e];
                            }
                            return this._readPrg(t);
                        }
                        _readPrg(t) {
                            let e, s, i, r, h;
                            switch (this.prgMode) {
                                case 0:
                                    return (
                                        (s = this.prgBankReg[4]),
                                        (r = (124 & s) >> 2),
                                        this._readPrgRom32k(r, t - 32768)
                                    );
                                case 1:
                                    return t < 49152
                                        ? ((s = this.prgBankReg[2]),
                                          (i = !(128 & s)),
                                          i
                                              ? ((r = (6 & s) >> 1), this.prgRam[16384 * r + (t - 32768)])
                                              : ((r = (126 & s) >> 1), this._readPrgRom16k(r, t - 32768)))
                                        : ((s = this.prgBankReg[4]),
                                          (r = (126 & s) >> 1),
                                          this._readPrgRom16k(r, t - 49152));
                                case 2:
                                    return t < 49152
                                        ? ((s = this.prgBankReg[2]),
                                          (i = !(128 & s)),
                                          i
                                              ? ((r = (6 & s) >> 1), this.prgRam[16384 * r + (t - 32768)])
                                              : ((r = (126 & s) >> 1), this._readPrgRom16k(r, t - 32768)))
                                        : t < 57344
                                          ? ((s = this.prgBankReg[3]),
                                            (i = !(128 & s)),
                                            i
                                                ? ((r = 7 & s), this.prgRam[8192 * r + (t - 49152)])
                                                : ((r = 127 & s), this._readPrgRom8k(r, t - 49152)))
                                          : ((s = this.prgBankReg[4]), (r = 127 & s), this._readPrgRom8k(r, t - 57344));
                                default:
                                    return (
                                        (e = t < 40960 ? 1 : t < 49152 ? 2 : t < 57344 ? 3 : 4),
                                        (s = this.prgBankReg[e]),
                                        (h = 1 === e ? 32768 : 2 === e ? 40960 : 3 === e ? 49152 : 57344),
                                        e < 4 && !(128 & s)
                                            ? ((r = 7 & s), this.prgRam[8192 * r + (t - h)])
                                            : ((r = 127 & s), this._readPrgRom8k(r, t - h))
                                    );
                            }
                        }
                        _readPrgRom32k(t, e) {
                            let s = (2 * t + Math.floor(e / 16384)) % this.nes.rom.romCount,
                                i = e % 16384;
                            return this.nes.rom.rom[s][i];
                        }
                        _readPrgRom16k(t, e) {
                            return (t %= this.nes.rom.romCount), this.nes.rom.rom[t][e];
                        }
                        _readPrgRom8k(t, e) {
                            let s = Math.floor(t / 2) % this.nes.rom.romCount,
                                i = (t % 2) * 8192 + e;
                            return s < this.nes.rom.romCount ? this.nes.rom.rom[s][i] : 0;
                        }
                        write(t, e) {
                            if (t < 20480) super.write(t, e);
                            else if (t >= 20480 && t <= 20483) this._writePulse(this.pulse1, t - 20480, e);
                            else if (t >= 20484 && t <= 20487) this._writePulse(this.pulse2, t - 20484, e);
                            else {
                                if (20496 === t)
                                    return (this.pcmReadMode = !!(1 & e)), void (this.pcmIrqEnabled = !!(128 & e));
                                if (20497 !== t) {
                                    if (20501 === t)
                                        return (
                                            (this.audioEnabled = 3 & e),
                                            (this.pulse1.enabled = !!(1 & e)),
                                            (this.pulse2.enabled = !!(2 & e)),
                                            this.pulse1.enabled || (this.pulse1.lengthCounter = 0),
                                            void (this.pulse2.enabled || (this.pulse2.lengthCounter = 0))
                                        );
                                    if (20736 === t) return (this.prgMode = 3 & e), void this._syncPrg();
                                    if (20737 === t) return (this.chrMode = 3 & e), void this._syncChr();
                                    if (20738 !== t)
                                        if (20739 !== t) {
                                            if (20740 === t)
                                                return (
                                                    (this.exramMode = 3 & e),
                                                    (this.bgTileOverride = 1 === this.exramMode),
                                                    void this._syncNametables()
                                                );
                                            if (20741 === t) {
                                                let t = e;
                                                return (
                                                    (this.ntMapping[0] = 3 & t),
                                                    (t >>= 2),
                                                    (this.ntMapping[1] = 3 & t),
                                                    (t >>= 2),
                                                    (this.ntMapping[2] = 3 & t),
                                                    (t >>= 2),
                                                    (this.ntMapping[3] = 3 & t),
                                                    void this._syncNametables()
                                                );
                                            }
                                            if (20742 === t) return (this.fillTile = e), void this._syncNametables();
                                            if (20743 === t)
                                                return (this.fillAttr = 3 & e), void this._syncNametables();
                                            if (20755 !== t) {
                                                if (t >= 20756 && t <= 20759) {
                                                    let s = t - 20755;
                                                    return (this.prgBankReg[s] = e), void this._syncPrg();
                                                }
                                                if (t >= 20768 && t <= 20775) {
                                                    let s = t - 20768;
                                                    return (
                                                        (this.chrBankA[s] = (this.chrUpperBits << 8) | e),
                                                        (this.lastChrWrite = 0),
                                                        void this._syncChr()
                                                    );
                                                }
                                                if (t >= 20776 && t <= 20779) {
                                                    let s = t - 20776;
                                                    return (
                                                        (this.chrBankB[s] = (this.chrUpperBits << 8) | e),
                                                        (this.lastChrWrite = 1),
                                                        void this._syncChr()
                                                    );
                                                }
                                                if (20784 !== t) {
                                                    if (20992 === t)
                                                        return (
                                                            (this.splitEnabled = !!(128 & e)),
                                                            (this.splitRight = !!(64 & e)),
                                                            void (this.splitTile = 31 & e)
                                                        );
                                                    if (20993 !== t)
                                                        if (20994 !== t)
                                                            if (20995 !== t) {
                                                                if (20996 === t)
                                                                    return (
                                                                        (this.irqEnabled = !!(128 & e)),
                                                                        void (
                                                                            this.irqEnabled &&
                                                                            this.irqPending &&
                                                                            this.nes.cpu.requestIrq(
                                                                                this.nes.cpu.IRQ_NORMAL
                                                                            )
                                                                        )
                                                                    );
                                                                if (20997 !== t)
                                                                    if (20998 !== t) {
                                                                        if (t >= 23552 && t <= 24575) {
                                                                            let s = t - 23552;
                                                                            return void (0 === this.exramMode ||
                                                                            1 === this.exramMode
                                                                                ? ((this.exram[s] = this.inFrame
                                                                                      ? e
                                                                                      : 0),
                                                                                  this._syncExramToVram(s))
                                                                                : 2 === this.exramMode &&
                                                                                  (this.exram[s] = e));
                                                                        }
                                                                        if (t >= 24576 && t <= 32767) {
                                                                            if (
                                                                                2 === this.prgRamProtectA &&
                                                                                1 === this.prgRamProtectB
                                                                            ) {
                                                                                let s =
                                                                                    8192 * (7 & this.prgBankReg[0]) +
                                                                                    (t - 24576);
                                                                                (this.prgRam[65535 & s] = e),
                                                                                    (this.nes.cpu.mem[t] = e),
                                                                                    this.nes.opts.onBatteryRamWrite(
                                                                                        t,
                                                                                        e
                                                                                    );
                                                                            }
                                                                        } else t >= 32768 && this._writePrg(t, e);
                                                                    } else this.multB = e;
                                                                else this.multA = e;
                                                            } else this.irqTarget = e;
                                                        else this.splitPage = 63 & e;
                                                    else this.splitScroll = e;
                                                } else this.chrUpperBits = 3 & e;
                                            } else this.prgBankReg[0] = 7 & e;
                                        } else this.prgRamProtectB = 3 & e;
                                    else this.prgRamProtectA = 3 & e;
                                } else this.pcmReadMode || 0 === e || (this.pcmValue = e);
                            }
                        }
                        _writePrg(t, e) {
                            let s, i, r, h, a;
                            switch (this.prgMode) {
                                case 0:
                                    return;
                                case 1:
                                    return void (
                                        t < 49152 &&
                                        ((i = this.prgBankReg[2]),
                                        (r = !(128 & i)),
                                        r &&
                                            this._isPrgRamWritable() &&
                                            ((h = (6 & i) >> 1), (this.prgRam[16384 * h + (t - 32768)] = e)))
                                    );
                                case 2:
                                    return void (t < 49152
                                        ? ((i = this.prgBankReg[2]),
                                          (r = !(128 & i)),
                                          r &&
                                              this._isPrgRamWritable() &&
                                              ((h = (6 & i) >> 1), (this.prgRam[16384 * h + (t - 32768)] = e)))
                                        : t < 57344 &&
                                          ((i = this.prgBankReg[3]),
                                          (r = !(128 & i)),
                                          r &&
                                              this._isPrgRamWritable() &&
                                              ((h = 7 & i), (this.prgRam[8192 * h + (t - 49152)] = e))));
                                default:
                                    if (t < 40960) (s = 1), (a = 32768);
                                    else if (t < 49152) (s = 2), (a = 40960);
                                    else {
                                        if (!(t < 57344)) return;
                                        (s = 3), (a = 49152);
                                    }
                                    return (
                                        (i = this.prgBankReg[s]),
                                        (r = !(128 & i)),
                                        void (
                                            r &&
                                            this._isPrgRamWritable() &&
                                            ((h = 7 & i), (this.prgRam[8192 * h + (t - a)] = e))
                                        )
                                    );
                            }
                        }
                        _isPrgRamWritable() {
                            return 2 === this.prgRamProtectA && 1 === this.prgRamProtectB;
                        }
                        _syncPrg() {
                            switch (this.prgMode) {
                                case 0: {
                                    let t = (124 & this.prgBankReg[4]) >> 2;
                                    this.load32kRomBank(t, 32768);
                                    break;
                                }
                                case 1: {
                                    let t = this.prgBankReg[2];
                                    if (128 & t) {
                                        let e = (126 & t) >> 1;
                                        this.loadRomBank(e % this.nes.rom.romCount, 32768);
                                    }
                                    let e = (126 & this.prgBankReg[4]) >> 1;
                                    this.loadRomBank(e % this.nes.rom.romCount, 49152);
                                    break;
                                }
                                case 2: {
                                    let t = this.prgBankReg[2];
                                    if (128 & t) {
                                        let e = (126 & t) >> 1;
                                        this.loadRomBank(e % this.nes.rom.romCount, 32768);
                                    }
                                    let e = this.prgBankReg[3];
                                    128 & e && this.load8kRomBank(127 & e, 49152);
                                    let s = this.prgBankReg[4];
                                    this.load8kRomBank(127 & s, 57344);
                                    break;
                                }
                                default:
                                    for (let t = 1; t <= 4; t++) {
                                        let e = this.prgBankReg[t],
                                            s = 24576 + 8192 * t;
                                        (4 === t || 128 & e) && this.load8kRomBank(127 & e, s);
                                    }
                            }
                        }
                        _syncChr() {
                            this.nes.ppu.triggerRendering(),
                                (this._chrBankTarget = -1),
                                0 === this.nes.ppu.f_spriteSize && (this._applyChrSetA(), (this._chrBankTarget = 0));
                        }
                        _applyChrSetA() {
                            if (0 !== this.nes.rom.vromCount)
                                switch (this.chrMode) {
                                    case 0:
                                        this.load8kVromBank(2 * (255 & this.chrBankA[7]), 0);
                                        break;
                                    case 1:
                                        this.loadVromBank(255 & this.chrBankA[3], 0),
                                            this.loadVromBank(255 & this.chrBankA[7], 4096);
                                        break;
                                    case 2:
                                        this.load2kVromBank(511 & this.chrBankA[1], 0),
                                            this.load2kVromBank(511 & this.chrBankA[3], 2048),
                                            this.load2kVromBank(511 & this.chrBankA[5], 4096),
                                            this.load2kVromBank(511 & this.chrBankA[7], 6144);
                                        break;
                                    default:
                                        for (let t = 0; t < 8; t++)
                                            this.load1kVromBank(1023 & this.chrBankA[t], 1024 * t);
                                }
                        }
                        _applyChrSetB() {
                            if (0 !== this.nes.rom.vromCount)
                                switch (this.chrMode) {
                                    case 0:
                                        this.load8kVromBank(2 * (255 & this.chrBankB[3]), 0);
                                        break;
                                    case 1:
                                        this.loadVromBank(255 & this.chrBankB[3], 0),
                                            this.loadVromBank(255 & this.chrBankB[3], 4096);
                                        break;
                                    case 2:
                                        this.load2kVromBank(511 & this.chrBankB[1], 0),
                                            this.load2kVromBank(511 & this.chrBankB[3], 2048),
                                            this.load2kVromBank(511 & this.chrBankB[1], 4096),
                                            this.load2kVromBank(511 & this.chrBankB[3], 6144);
                                        break;
                                    default:
                                        for (let t = 0; t < 4; t++)
                                            this.load1kVromBank(1023 & this.chrBankB[t], 1024 * t),
                                                this.load1kVromBank(1023 & this.chrBankB[t], 1024 * (t + 4));
                                }
                        }
                        _syncNametables() {
                            let t = this.nes.ppu,
                                e = this.fillAttr | (this.fillAttr << 2) | (this.fillAttr << 4) | (this.fillAttr << 6);
                            for (let e = 0; e < 960; e++) t.vramMem[11264 + e] = this.fillTile;
                            for (let s = 960; s < 1024; s++) t.vramMem[11264 + s] = e;
                            if (this.exramMode >= 2) for (let e = 0; e < 1024; e++) t.vramMem[10240 + e] = 0;
                            else s(this.exram, 0, t.vramMem, 10240, 1024);
                            const i = [8192, 9216, 10240, 11264];
                            for (let e = 0; e < 4; e++) {
                                let s = 8192 + 1024 * e,
                                    r = i[this.ntMapping[e]];
                                t.defineMirrorRegion(s, r, 1024);
                            }
                            t.defineMirrorRegion(12288, 8192, 3840);
                            for (let e = 0; e < 4; e++) t.ntable1[e] = this.ntMapping[e];
                            this._populateNameTable(2, 10240), this._populateNameTable(3, 11264);
                        }
                        _populateNameTable(t, e) {
                            let s = this.nes.ppu,
                                i = s.nameTable[t];
                            for (let t = 0; t < 960; t++) i.tile[t] = s.vramMem[e + t];
                            for (let t = 0; t < 64; t++) i.writeAttrib(t, s.vramMem[e + 960 + t]);
                        }
                        _syncExramToVram(t) {
                            if (this.exramMode < 2) {
                                let e = this.nes.ppu;
                                (e.vramMem[10240 + t] = this.exram[t]),
                                    t < 960
                                        ? (e.nameTable[2].tile[t] = this.exram[t])
                                        : t < 1024 && e.nameTable[2].writeAttrib(t - 960, this.exram[t]);
                            }
                        }
                        _writePulse(t, e, s) {
                            switch (e) {
                                case 0:
                                    (t.dutyCycle = (s >> 6) & 3),
                                        (t.lengthHalt = !!(32 & s)),
                                        (t.constantVolume = !!(16 & s)),
                                        (t.volume = 15 & s);
                                    break;
                                case 1:
                                    break;
                                case 2:
                                    t.timer = (1792 & t.timer) | s;
                                    break;
                                case 3:
                                    (t.timer = (255 & t.timer) | ((7 & s) << 8)),
                                        t.enabled && (t.lengthCounter = this.nes.papu.getLengthMax(s)),
                                        (t.envelopeStart = !0),
                                        (t.sequencePos = 0);
                            }
                        }
                        clockIrqCounter() {
                            if (20 === this.nes.ppu.scanline) return (this.inFrame = !0), void (this.irqCounter = 0);
                            this.irqCounter++,
                                0 !== this.irqTarget &&
                                    this.irqCounter === this.irqTarget &&
                                    ((this.irqPending = !0),
                                    this.irqEnabled && this.nes.cpu.requestIrq(this.nes.cpu.IRQ_NORMAL)),
                                3 & this.irqCounter ||
                                    (this._clockPulseLengthCounter(this.pulse1),
                                    this._clockPulseLengthCounter(this.pulse2));
                        }
                        _clockPulseLengthCounter(t) {
                            t.enabled && !t.lengthHalt && t.lengthCounter > 0 && t.lengthCounter--;
                        }
                        onBgRender() {
                            1 === this.nes.ppu.f_spriteSize &&
                                1 !== this._chrBankTarget &&
                                (this._applyChrSetB(), (this._chrBankTarget = 1), (this.nes.ppu.validTileData = !1));
                        }
                        onSpriteRender() {
                            1 === this.nes.ppu.f_spriteSize &&
                                0 !== this._chrBankTarget &&
                                (this._applyChrSetA(), (this._chrBankTarget = 0));
                        }
                        getSpritePatternTile(t) {
                            if (1 !== this.nes.ppu.f_spriteSize || 0 === this.nes.rom.vromCount)
                                return this.nes.ppu.ptTile[t];
                            let e = this.nes.rom.vromCount,
                                s = this.nes.rom.vromTile;
                            switch (this.chrMode) {
                                case 0: {
                                    let i = t >= 256 ? 1 : 0;
                                    return s[(2 * (255 & this.chrBankA[7]) + i) % e][t - 256 * i];
                                }
                                case 1: {
                                    let i;
                                    return (
                                        (i = t < 256 ? (255 & this.chrBankA[3]) % e : (255 & this.chrBankA[7]) % e),
                                        s[i][t % 256]
                                    );
                                }
                                case 2: {
                                    let i = [1, 3, 5, 7],
                                        r = t >> 7,
                                        h = 127 & t,
                                        a = 511 & this.chrBankA[i[r]];
                                    return s[Math.floor(a / 2) % e][(a % 2 << 7) + h];
                                }
                                default: {
                                    let i = t >> 6,
                                        r = 63 & t,
                                        h = 1023 & this.chrBankA[i];
                                    return s[Math.floor(h / 4) % e][(h % 4 << 6) + r];
                                }
                            }
                        }
                        getBgTileData(t, e, s, i) {
                            if (1 !== this.exramMode || 0 === this.nes.rom.vromCount) return null;
                            let r = 32 * i + s,
                                h = this.exram[r],
                                a = ((63 & h) | (this.chrUpperBits << 6)) % this.nes.rom.vromCount,
                                n = this.nes.rom.vromTile[a][e];
                            return n ? { tile: n, attrib: ((h >> 6) & 3) << 2 } : null;
                        }
                        loadROM() {
                            if (!this.nes.rom.valid) throw new Error("MMC5: Invalid ROM! Unable to load.");
                            (this.prgBankReg[4] = 255),
                                this._syncPrg(),
                                this.loadCHRROM(),
                                this.loadBatteryRam(),
                                this._syncNametables(),
                                this.nes.cpu.requestIrq(this.nes.cpu.IRQ_RESET);
                        }
                        toJSON() {
                            let t = super.toJSON();
                            return (
                                (t.prgMode = this.prgMode),
                                (t.prgBankReg = Array.from(this.prgBankReg)),
                                (t.prgRam = Array.from(this.prgRam)),
                                (t.prgRamProtectA = this.prgRamProtectA),
                                (t.prgRamProtectB = this.prgRamProtectB),
                                (t.chrMode = this.chrMode),
                                (t.chrBankA = Array.from(this.chrBankA)),
                                (t.chrBankB = Array.from(this.chrBankB)),
                                (t.chrUpperBits = this.chrUpperBits),
                                (t.lastChrWrite = this.lastChrWrite),
                                (t.ntMapping = Array.from(this.ntMapping)),
                                (t.exramMode = this.exramMode),
                                (t.exram = Array.from(this.exram)),
                                (t.fillTile = this.fillTile),
                                (t.fillAttr = this.fillAttr),
                                (t.irqTarget = this.irqTarget),
                                (t.irqEnabled = this.irqEnabled),
                                (t.irqPending = this.irqPending),
                                (t.inFrame = this.inFrame),
                                (t.irqCounter = this.irqCounter),
                                (t.multA = this.multA),
                                (t.multB = this.multB),
                                (t.splitEnabled = this.splitEnabled),
                                (t.splitRight = this.splitRight),
                                (t.splitTile = this.splitTile),
                                (t.splitScroll = this.splitScroll),
                                (t.splitPage = this.splitPage),
                                (t.pcmValue = this.pcmValue),
                                (t.pcmReadMode = this.pcmReadMode),
                                (t.pcmIrqEnabled = this.pcmIrqEnabled),
                                (t.audioEnabled = this.audioEnabled),
                                (t.pulse1 = Object.assign({}, this.pulse1)),
                                (t.pulse2 = Object.assign({}, this.pulse2)),
                                t
                            );
                        }
                        fromJSON(t) {
                            super.fromJSON(t),
                                (this.prgMode = t.prgMode),
                                (this.prgBankReg = new Uint8Array(t.prgBankReg)),
                                (this.prgRam = new Uint8Array(t.prgRam)),
                                (this.prgRamProtectA = t.prgRamProtectA),
                                (this.prgRamProtectB = t.prgRamProtectB),
                                (this.chrMode = t.chrMode),
                                (this.chrBankA = new Uint16Array(t.chrBankA)),
                                (this.chrBankB = new Uint16Array(t.chrBankB)),
                                (this.chrUpperBits = t.chrUpperBits),
                                (this.lastChrWrite = t.lastChrWrite),
                                (this.ntMapping = new Uint8Array(t.ntMapping)),
                                (this.exramMode = t.exramMode),
                                (this.exram = new Uint8Array(t.exram)),
                                (this.fillTile = t.fillTile),
                                (this.fillAttr = t.fillAttr),
                                (this.irqTarget = t.irqTarget),
                                (this.irqEnabled = t.irqEnabled),
                                (this.irqPending = t.irqPending),
                                (this.inFrame = t.inFrame),
                                (this.irqCounter = t.irqCounter),
                                (this.multA = t.multA),
                                (this.multB = t.multB),
                                (this.splitEnabled = t.splitEnabled),
                                (this.splitRight = t.splitRight),
                                (this.splitTile = t.splitTile),
                                (this.splitScroll = t.splitScroll),
                                (this.splitPage = t.splitPage),
                                (this.pcmValue = t.pcmValue),
                                (this.pcmReadMode = t.pcmReadMode),
                                (this.pcmIrqEnabled = t.pcmIrqEnabled),
                                (this.audioEnabled = t.audioEnabled),
                                t.pulse1 && (this.pulse1 = Object.assign(this._initPulse(), t.pulse1)),
                                t.pulse2 && (this.pulse2 = Object.assign(this._initPulse(), t.pulse2)),
                                this._syncPrg(),
                                this._syncChr(),
                                this._syncNametables();
                        }
                    };
                    const K = class extends W {
                        static mapperName = "AxROM";
                        constructor(t) {
                            super(t);
                        }
                        write(t, e) {
                            t < 32768
                                ? super.write(t, e)
                                : (this.load32kRomBank(7 & e, 32768),
                                  16 & e
                                      ? this.nes.ppu.setMirroring(this.nes.rom.SINGLESCREEN_MIRRORING2)
                                      : this.nes.ppu.setMirroring(this.nes.rom.SINGLESCREEN_MIRRORING));
                        }
                        loadROM() {
                            if (!this.nes.rom.valid) throw new Error("AOROM: Invalid ROM! Unable to load.");
                            this.loadPRGROM(), this.loadCHRROM(), this.nes.cpu.requestIrq(this.nes.cpu.IRQ_RESET);
                        }
                    };
                    const Q = class extends W {
                        static mapperName = "MMC2";
                        constructor(t) {
                            super(t),
                                (this.prgBank = 0),
                                (this.chrBankFD0 = 0),
                                (this.chrBankFE0 = 0),
                                (this.chrBankFD1 = 0),
                                (this.chrBankFE1 = 0),
                                (this.latch0 = 254),
                                (this.latch1 = 254);
                        }
                        write(t, e) {
                            if (t < 32768) super.write(t, e);
                            else
                                switch (61440 & t) {
                                    case 40960:
                                        (this.prgBank = 15 & e), this.load8kRomBank(this.prgBank, 32768);
                                        break;
                                    case 45056:
                                        (this.chrBankFD0 = 31 & e), this._updateChr0();
                                        break;
                                    case 49152:
                                        (this.chrBankFE0 = 31 & e), this._updateChr0();
                                        break;
                                    case 53248:
                                        (this.chrBankFD1 = 31 & e), this._updateChr1();
                                        break;
                                    case 57344:
                                        (this.chrBankFE1 = 31 & e), this._updateChr1();
                                        break;
                                    case 61440:
                                        1 & e
                                            ? this.nes.ppu.setMirroring(this.nes.rom.HORIZONTAL_MIRRORING)
                                            : this.nes.ppu.setMirroring(this.nes.rom.VERTICAL_MIRRORING);
                                }
                        }
                        _updateChr0() {
                            let t = 253 === this.latch0 ? this.chrBankFD0 : this.chrBankFE0;
                            this.loadVromBank(t, 0);
                        }
                        _updateChr1() {
                            let t = 253 === this.latch1 ? this.chrBankFD1 : this.chrBankFE1;
                            this.loadVromBank(t, 4096);
                        }
                        latchAccess(t) {
                            4056 === t
                                ? 253 !== this.latch0 && ((this.latch0 = 253), this._updateChr0())
                                : 4072 === t
                                  ? 254 !== this.latch0 && ((this.latch0 = 254), this._updateChr0())
                                  : t >= 8152 && t <= 8159
                                    ? 253 !== this.latch1 && ((this.latch1 = 253), this._updateChr1())
                                    : t >= 8168 &&
                                      t <= 8175 &&
                                      254 !== this.latch1 &&
                                      ((this.latch1 = 254), this._updateChr1());
                        }
                        loadROM() {
                            if (!this.nes.rom.valid) throw new Error("MMC2: Invalid ROM! Unable to load.");
                            this.load8kRomBank(0, 32768);
                            let t = 2 * (this.nes.rom.romCount - 1) + 1;
                            this.load8kRomBank(t - 2, 40960),
                                this.load8kRomBank(t - 1, 49152),
                                this.load8kRomBank(t, 57344),
                                this.loadCHRROM(),
                                this.loadBatteryRam(),
                                this.nes.cpu.requestIrq(this.nes.cpu.IRQ_RESET);
                        }
                        toJSON() {
                            let t = super.toJSON();
                            return (
                                (t.prgBank = this.prgBank),
                                (t.chrBankFD0 = this.chrBankFD0),
                                (t.chrBankFE0 = this.chrBankFE0),
                                (t.chrBankFD1 = this.chrBankFD1),
                                (t.chrBankFE1 = this.chrBankFE1),
                                (t.latch0 = this.latch0),
                                (t.latch1 = this.latch1),
                                t
                            );
                        }
                        fromJSON(t) {
                            super.fromJSON(t),
                                (this.prgBank = t.prgBank),
                                (this.chrBankFD0 = t.chrBankFD0),
                                (this.chrBankFE0 = t.chrBankFE0),
                                (this.chrBankFD1 = t.chrBankFD1),
                                (this.chrBankFE1 = t.chrBankFE1),
                                (this.latch0 = t.latch0),
                                (this.latch1 = t.latch1);
                        }
                    };
                    const $ = class extends W {
                        static mapperName = "Color Dreams";
                        constructor(t) {
                            super(t);
                        }
                        write(t, e) {
                            if (t < 32768) super.write(t, e);
                            else {
                                let t = (2 * (15 & e)) % this.nes.rom.romCount,
                                    s = (2 * (15 & e) + 1) % this.nes.rom.romCount;
                                if (
                                    (this.loadRomBank(t, 32768), this.loadRomBank(s, 49152), this.nes.rom.vromCount > 0)
                                ) {
                                    let t = (2 * (e >> 4)) % this.nes.rom.vromCount;
                                    this.loadVromBank(t, 0), this.loadVromBank(t + 1, 4096);
                                }
                            }
                        }
                    };
                    const tt = class extends W {
                        static mapperName = "BNROM";
                        constructor(t) {
                            super(t);
                        }
                        write(t, e) {
                            t < 32768 ? super.write(t, e) : this.load32kRomBank(e, 32768);
                        }
                    };
                    const et = class extends W {
                        static mapperName = "PCI556";
                        constructor(t) {
                            super(t);
                        }
                        write(t, e) {
                            t < 28672 || t > 32767
                                ? super.write(t, e)
                                : (this.load32kRomBank(3 & e, 32768), this.load8kVromBank(2 * ((e >> 2) & 3), 0));
                        }
                    };
                    const st = class extends W {
                        static mapperName = "GxROM";
                        constructor(t) {
                            super(t);
                        }
                        write(t, e) {
                            t < 32768
                                ? super.write(t, e)
                                : (this.load32kRomBank((e >> 4) & 3, 32768), this.load8kVromBank(2 * (3 & e), 0));
                        }
                    };
                    const it = class extends W {
                        static mapperName = "Camerica";
                        constructor(t) {
                            super(t);
                        }
                        write(t, e) {
                            t < 32768
                                ? super.write(t, e)
                                : t >= 36864 && t < 40960
                                  ? 16 & e
                                      ? this.nes.ppu.setMirroring(this.nes.rom.SINGLESCREEN_MIRRORING2)
                                      : this.nes.ppu.setMirroring(this.nes.rom.SINGLESCREEN_MIRRORING)
                                  : t >= 49152 && this.loadRomBank(15 & e, 32768);
                        }
                        loadROM() {
                            if (!this.nes.rom.valid) throw new Error("Mapper 71: Invalid ROM! Unable to load.");
                            this.loadRomBank(0, 32768),
                                this.loadRomBank(this.nes.rom.romCount - 1, 49152),
                                this.loadCHRROM(),
                                this.nes.cpu.requestIrq(this.nes.cpu.IRQ_RESET);
                        }
                    };
                    const rt = class extends W {
                        static mapperName = "NINA-03/NINA-06";
                        constructor(t) {
                            super(t);
                        }
                        write(t, e) {
                            16640 == (57600 & t) &&
                                (this.load32kRomBank((e >> 3) & 1, 32768), this.load8kVromBank(2 * (7 & e), 0)),
                                super.write(t, e);
                        }
                    };
                    const ht = class extends W {
                        static mapperName = "UN1ROM";
                        constructor(t) {
                            super(t);
                        }
                        write(t, e) {
                            t < 32768 ? super.write(t, e) : this.loadRomBank(e >> 2, 32768);
                        }
                        loadROM() {
                            if (!this.nes.rom.valid) throw new Error("UN1ROM: Invalid ROM! Unable to load.");
                            this.loadRomBank(0, 32768),
                                this.loadRomBank(this.nes.rom.romCount - 1, 49152),
                                this.loadCHRROM(),
                                this.nes.cpu.requestIrq(this.nes.cpu.IRQ_RESET);
                        }
                    };
                    const at = class extends j {
                        static mapperName = "TxSROM";
                        constructor(t) {
                            super(t), (this.chrRegs = [0, 0, 0, 0, 0, 0]);
                        }
                        write(t, e) {
                            40960 !== t && (super.write(t, e), 32768 === t && this.updateNametableMirroring());
                        }
                        executeCommand(t, e) {
                            t <= 5
                                ? ((this.chrRegs[t] = e),
                                  super.executeCommand(t, 127 & e),
                                  this.updateNametableMirroring())
                                : super.executeCommand(t, e);
                        }
                        updateNametableMirroring() {
                            let t = this.nes.ppu;
                            if (0 === this.chrAddressSelect) {
                                let e = (this.chrRegs[0] >> 7) & 1,
                                    s = (this.chrRegs[1] >> 7) & 1;
                                (t.ntable1[0] = e), (t.ntable1[1] = e), (t.ntable1[2] = s), (t.ntable1[3] = s);
                            } else
                                (t.ntable1[0] = (this.chrRegs[2] >> 7) & 1),
                                    (t.ntable1[1] = (this.chrRegs[3] >> 7) & 1),
                                    (t.ntable1[2] = (this.chrRegs[4] >> 7) & 1),
                                    (t.ntable1[3] = (this.chrRegs[5] >> 7) & 1);
                            for (let e = 0; e < 4; e++) {
                                let s = 8192 + 1024 * e,
                                    i = 8192 + 1024 * t.ntable1[e];
                                t.defineMirrorRegion(s, i, 1024);
                            }
                            t.currentMirroring = -1;
                        }
                        loadROM() {
                            super.loadROM(), this.updateNametableMirroring();
                        }
                        toJSON() {
                            let t = super.toJSON();
                            return (t.chrRegs = this.chrRegs.slice()), t;
                        }
                        fromJSON(t) {
                            super.fromJSON(t), (this.chrRegs = t.chrRegs), this.updateNametableMirroring();
                        }
                    };
                    const nt = class extends j {
                        static mapperName = "TQROM";
                        constructor(t) {
                            super(t), (this.chrRam = new Uint8Array(8192)), (this.chrRamTiles = new Array(8));
                            for (let t = 0; t < 8; t++) {
                                this.chrRamTiles[t] = new Array(64);
                                for (let e = 0; e < 64; e++) this.chrRamTiles[t][e] = new B();
                            }
                            this.chrRamSlots = [-1, -1, -1, -1, -1, -1, -1, -1];
                        }
                        executeCommand(t, e) {
                            switch (t) {
                                case j.CMD_SEL_2_1K_VROM_0000: {
                                    let t = 0 === this.chrAddressSelect ? 0 : 4096;
                                    if (64 & e) {
                                        let s = 6 & e;
                                        this.load1kChrRamBank(s, t), this.load1kChrRamBank(s + 1, t + 1024);
                                    } else {
                                        let s = 63 & e;
                                        this.saveChrRamSlot(t),
                                            this.saveChrRamSlot(t + 1024),
                                            (this.chrRamSlots[t >> 10] = -1),
                                            (this.chrRamSlots[1 + (t >> 10)] = -1),
                                            this.load1kVromBank(s, t),
                                            this.load1kVromBank(s + 1, t + 1024);
                                    }
                                    break;
                                }
                                case j.CMD_SEL_2_1K_VROM_0800: {
                                    let t = 0 === this.chrAddressSelect ? 2048 : 6144;
                                    if (64 & e) {
                                        let s = 6 & e;
                                        this.load1kChrRamBank(s, t), this.load1kChrRamBank(s + 1, t + 1024);
                                    } else {
                                        let s = 63 & e;
                                        this.saveChrRamSlot(t),
                                            this.saveChrRamSlot(t + 1024),
                                            (this.chrRamSlots[t >> 10] = -1),
                                            (this.chrRamSlots[1 + (t >> 10)] = -1),
                                            this.load1kVromBank(s, t),
                                            this.load1kVromBank(s + 1, t + 1024);
                                    }
                                    break;
                                }
                                case j.CMD_SEL_1K_VROM_1000: {
                                    let t = 0 === this.chrAddressSelect ? 4096 : 0;
                                    64 & e
                                        ? this.load1kChrRamBank(7 & e, t)
                                        : (this.saveChrRamSlot(t),
                                          (this.chrRamSlots[t >> 10] = -1),
                                          this.load1kVromBank(63 & e, t));
                                    break;
                                }
                                case j.CMD_SEL_1K_VROM_1400: {
                                    let t = 0 === this.chrAddressSelect ? 5120 : 1024;
                                    64 & e
                                        ? this.load1kChrRamBank(7 & e, t)
                                        : (this.saveChrRamSlot(t),
                                          (this.chrRamSlots[t >> 10] = -1),
                                          this.load1kVromBank(63 & e, t));
                                    break;
                                }
                                case j.CMD_SEL_1K_VROM_1800: {
                                    let t = 0 === this.chrAddressSelect ? 6144 : 2048;
                                    64 & e
                                        ? this.load1kChrRamBank(7 & e, t)
                                        : (this.saveChrRamSlot(t),
                                          (this.chrRamSlots[t >> 10] = -1),
                                          this.load1kVromBank(63 & e, t));
                                    break;
                                }
                                case j.CMD_SEL_1K_VROM_1C00: {
                                    let t = 0 === this.chrAddressSelect ? 7168 : 3072;
                                    64 & e
                                        ? this.load1kChrRamBank(7 & e, t)
                                        : (this.saveChrRamSlot(t),
                                          (this.chrRamSlots[t >> 10] = -1),
                                          this.load1kVromBank(63 & e, t));
                                    break;
                                }
                                default:
                                    super.executeCommand(t, e);
                            }
                        }
                        saveChrRamSlot(t) {
                            let e = t >> 10,
                                i = this.chrRamSlots[e];
                            -1 !== i && s(this.nes.ppu.vramMem, e << 10, this.chrRam, 1024 * i, 1024);
                        }
                        load1kChrRamBank(t, e) {
                            this.nes.ppu.triggerRendering(), (t &= 7), this.saveChrRamSlot(e);
                            let i = e >> 10;
                            this.chrRamSlots[i] = t;
                            let r = 1024 * t;
                            s(this.chrRam, r, this.nes.ppu.vramMem, e, 1024), this.rebuildChrRamTiles(t);
                            let h = e >> 4;
                            for (let e = 0; e < 64; e++) this.nes.ppu.ptTile[h + e] = this.chrRamTiles[t][e];
                        }
                        rebuildChrRamTiles(t) {
                            let e = 1024 * t;
                            for (let s = 0; s < 1024; s++) {
                                let i = s >> 4,
                                    r = s % 16;
                                r < 8
                                    ? this.chrRamTiles[t][i].setScanline(r, this.chrRam[e + s], this.chrRam[e + s + 8])
                                    : this.chrRamTiles[t][i].setScanline(
                                          r - 8,
                                          this.chrRam[e + s - 8],
                                          this.chrRam[e + s]
                                      );
                            }
                        }
                        canWriteChr(t) {
                            return !(t >= 8192) && -1 !== this.chrRamSlots[t >> 10];
                        }
                        toJSON() {
                            for (let t = 0; t < 8; t++) this.saveChrRamSlot(t << 10);
                            let t = super.toJSON();
                            return (t.chrRam = Array.from(this.chrRam)), (t.chrRamSlots = this.chrRamSlots.slice()), t;
                        }
                        fromJSON(t) {
                            super.fromJSON(t),
                                (this.chrRam = new Uint8Array(t.chrRam)),
                                (this.chrRamSlots = t.chrRamSlots);
                            for (let t = 0; t < 8; t++) this.rebuildChrRamTiles(t);
                            for (let t = 0; t < 8; t++) {
                                let e = this.chrRamSlots[t];
                                if (-1 !== e) {
                                    let s = (t << 10) >> 4;
                                    for (let t = 0; t < 64; t++) this.nes.ppu.ptTile[s + t] = this.chrRamTiles[e][t];
                                }
                            }
                        }
                    };
                    const ot = class extends W {
                        static mapperName = "Jaleco JF-11/JF-14";
                        constructor(t) {
                            super(t);
                        }
                        write(t, e) {
                            t < 24576 || t > 32767
                                ? super.write(t, e)
                                : (this.load32kRomBank((e >> 4) & 3, 32768), this.load8kVromBank(2 * (15 & e), 0));
                        }
                    };
                    const lt = class extends W {
                        static mapperName = "UNROM (Crazy Climber)";
                        constructor(t) {
                            super(t);
                        }
                        write(t, e) {
                            t < 32768 ? super.write(t, e) : this.loadRomBank(e, 49152);
                        }
                        loadROM() {
                            if (!this.nes.rom.valid) throw new Error("Mapper 180: Invalid ROM! Unable to load.");
                            this.loadRomBank(0, 32768),
                                this.loadRomBank(0, 49152),
                                this.loadCHRROM(),
                                this.nes.cpu.requestIrq(this.nes.cpu.IRQ_RESET);
                        }
                    };
                    const ct = class extends W {
                        static mapperName = "Mapper 240";
                        constructor(t) {
                            super(t);
                        }
                        write(t, e) {
                            t < 16416 || t > 24575
                                ? super.write(t, e)
                                : (this.load32kRomBank((e >> 4) & 3, 32768), this.load8kVromBank(2 * (15 & e), 0));
                        }
                    };
                    const mt = class extends W {
                            static mapperName = "BxROM (Mapper 241)";
                            constructor(t) {
                                super(t);
                            }
                            write(t, e) {
                                t < 32768 ? super.write(t, e) : this.load32kRomBank(e, 32768);
                            }
                        },
                        dt = {
                            0: W,
                            1: H,
                            2: J,
                            3: Y,
                            4: j,
                            5: Z,
                            7: K,
                            9: Q,
                            11: $,
                            34: tt,
                            38: et,
                            66: st,
                            71: it,
                            79: rt,
                            94: ht,
                            118: at,
                            119: nt,
                            140: ot,
                            180: lt,
                            240: ct,
                            241: mt,
                        };
                    class ut {
                        VERTICAL_MIRRORING = 0;
                        HORIZONTAL_MIRRORING = 1;
                        FOURSCREEN_MIRRORING = 2;
                        SINGLESCREEN_MIRRORING = 3;
                        SINGLESCREEN_MIRRORING2 = 4;
                        SINGLESCREEN_MIRRORING3 = 5;
                        SINGLESCREEN_MIRRORING4 = 6;
                        CHRROM_MIRRORING = 7;
                        constructor(t) {
                            (this.nes = t), (this.valid = !1);
                        }
                        load(t) {
                            let e, s, i;
                            t instanceof ArrayBuffer && (t = new Uint8Array(t));
                            const r = ArrayBuffer.isView(t);
                            if (r) {
                                if (t.length < 4 || 78 !== t[0] || 69 !== t[1] || 83 !== t[2] || 26 !== t[3])
                                    throw new Error("Not a valid NES ROM.");
                            } else if (!t.startsWith("NES")) throw new Error("Not a valid NES ROM.");
                            for (this.header = new Uint8Array(16), e = 0; e < 16; e++)
                                this.header[e] = r ? t[e] : 255 & t.charCodeAt(e);
                            (this.mirroring = 1 & this.header[6] ? 1 : 0),
                                (this.batteryRam = !!(2 & this.header[6])),
                                (this.trainer = !!(4 & this.header[6])),
                                (this.fourScreen = !!(8 & this.header[6])),
                                (this.isNES2 = 8 == (12 & this.header[7])),
                                this.isNES2 ? this._loadNES2Header() : this._loadINES1Header(),
                                (this.rom = new Array(this.romCount));
                            let h,
                                a,
                                n = 16 + (this.trainer ? 512 : 0);
                            for (e = 0; e < this.romCount; e++) {
                                for (this.rom[e] = new Uint8Array(16384), s = 0; s < 16384 && !(n + s >= t.length); s++)
                                    this.rom[e][s] = r ? t[n + s] : 255 & t.charCodeAt(n + s);
                                n += 16384;
                            }
                            for (this.vrom = new Array(this.vromCount), e = 0; e < this.vromCount; e++) {
                                for (this.vrom[e] = new Uint8Array(4096), s = 0; s < 4096 && !(n + s >= t.length); s++)
                                    this.vrom[e][s] = r ? t[n + s] : 255 & t.charCodeAt(n + s);
                                n += 4096;
                            }
                            for (this.vromTile = new Array(this.vromCount), e = 0; e < this.vromCount; e++)
                                for (this.vromTile[e] = new Array(256), s = 0; s < 256; s++)
                                    this.vromTile[e][s] = new B();
                            for (i = 0; i < this.vromCount; i++)
                                for (e = 0; e < 4096; e++)
                                    (h = e >> 4),
                                        (a = e % 16),
                                        a < 8
                                            ? this.vromTile[i][h].setScanline(a, this.vrom[i][e], this.vrom[i][e + 8])
                                            : this.vromTile[i][h].setScanline(
                                                  a - 8,
                                                  this.vrom[i][e - 8],
                                                  this.vrom[i][e]
                                              );
                            this.valid = !0;
                        }
                        _loadINES1Header() {
                            (this.romCount = this.header[4]),
                                (this.vromCount = 2 * this.header[5]),
                                (this.mapperType = (this.header[6] >> 4) | (240 & this.header[7]));
                            let t = !1;
                            for (let e = 8; e < 16; e++)
                                if (0 !== this.header[e]) {
                                    t = !0;
                                    break;
                                }
                            t && (this.mapperType &= 15),
                                (this.subMapper = 0),
                                (this.prgRamSize = 0),
                                (this.prgNvRamSize = 0),
                                (this.chrRamSize = 0),
                                (this.chrNvRamSize = 0),
                                (this.timingMode = 0),
                                (this.consoleType = 0);
                        }
                        _loadNES2Header() {
                            (this.mapperType =
                                (this.header[6] >> 4) | (240 & this.header[7]) | ((15 & this.header[8]) << 8)),
                                (this.subMapper = (this.header[8] >> 4) & 15);
                            const t = 15 & this.header[9];
                            if (15 === t) {
                                const t = (this.header[4] >> 2) & 63,
                                    e = 3 & this.header[4];
                                this.romCount = Math.ceil((Math.pow(2, t) * (2 * e + 1)) / 16384);
                            } else this.romCount = (t << 8) | this.header[4];
                            const e = (this.header[9] >> 4) & 15;
                            if (15 === e) {
                                const t = (this.header[5] >> 2) & 63,
                                    e = 3 & this.header[5];
                                this.vromCount = Math.ceil((Math.pow(2, t) * (2 * e + 1)) / 4096);
                            } else this.vromCount = 2 * ((e << 8) | this.header[5]);
                            (this.prgRamSize = ut._decodeRamSize(15 & this.header[10])),
                                (this.prgNvRamSize = ut._decodeRamSize((this.header[10] >> 4) & 15)),
                                (this.chrRamSize = ut._decodeRamSize(15 & this.header[11])),
                                (this.chrNvRamSize = ut._decodeRamSize((this.header[11] >> 4) & 15)),
                                (this.timingMode = 3 & this.header[12]),
                                (this.consoleType = 3 & this.header[7]);
                        }
                        static _decodeRamSize(t) {
                            return 0 === t ? 0 : 64 << t;
                        }
                        getMirroringType() {
                            return this.fourScreen
                                ? this.FOURSCREEN_MIRRORING
                                : 0 === this.mirroring
                                  ? this.HORIZONTAL_MIRRORING
                                  : this.VERTICAL_MIRRORING;
                        }
                        mapperSupported() {
                            return void 0 !== dt[this.mapperType];
                        }
                        createMapper() {
                            if (this.mapperSupported()) return new dt[this.mapperType](this.nes);
                            throw new Error(\`Unsupported mapper: \${this.mapperType}\`);
                        }
                    }
                    const pt = ut;
                    const gt = class {
                            constructor(t) {
                                (this.opts = {
                                    onFrame: function () {},
                                    onAudioSample: null,
                                    onStatusUpdate: function () {},
                                    onBatteryRamWrite: function () {},
                                    emulateSound: !0,
                                    sampleRate: 48e3,
                                    ...t,
                                }),
                                    (this.ui = {
                                        writeFrame: this.opts.onFrame,
                                        updateStatus: this.opts.onStatusUpdate,
                                    }),
                                    (this.cpu = new E(this)),
                                    (this.ppu = new v(this)),
                                    (this.papu = new L(this)),
                                    (this.gameGenie = new x()),
                                    (this.gameGenie.onChange = () => this.cpu._updateCartridgeLoader()),
                                    (this.mmap = null),
                                    (this.controllers = { 1: new A(), 2: new A() }),
                                    (this.fpsFrameCount = 0),
                                    (this.romData = null),
                                    this.ui.updateStatus("Ready to load a ROM.");
                            }
                            reset() {
                                (this.cpu = new E(this)),
                                    (this.ppu = new v(this)),
                                    (this.papu = new L(this)),
                                    null !== this.mmap && (this.mmap = this.rom.createMapper()),
                                    (this.lastFpsTime = null),
                                    (this.fpsFrameCount = 0),
                                    (this.crashed = !1);
                            }
                            frame = () => {
                                if (this.crashed)
                                    throw new Error("Game has crashed. Call reset() or loadROM() to restart.");
                                let t;
                                this.controllers[1].clock(), this.controllers[2].clock(), this.ppu.startFrame();
                                const e = this.cpu,
                                    s = this.ppu,
                                    i = this.papu;
                                try {
                                    for (;;)
                                        if (0 === e.cyclesToHalt) {
                                            if (
                                                ((t = e.emulate()),
                                                i.clockFrameCounter(t, e.apuCatchupCycles),
                                                (e.apuCatchupCycles = 0),
                                                s.frameEnded)
                                            ) {
                                                s.frameEnded = !1;
                                                break;
                                            }
                                        } else {
                                            let t = Math.min(e.cyclesToHalt, 8);
                                            for (let e = 0; e < t; e++) s.advanceDots(3);
                                            if (
                                                (i.clockFrameCounter(t),
                                                (e.cyclesToHalt -= t),
                                                (e._cpuCycleBase += t),
                                                s.frameEnded)
                                            ) {
                                                s.frameEnded = !1;
                                                break;
                                            }
                                        }
                                } catch (t) {
                                    throw ((this.crashed = !0), t);
                                }
                                this.fpsFrameCount++;
                            };
                            buttonDown = (t, e) => {
                                this.controllers[t].buttonDown(e);
                            };
                            buttonUp = (t, e) => {
                                this.controllers[t].buttonUp(e);
                            };
                            zapperMove = (t, e) => {
                                this.mmap && ((this.mmap.zapperX = t), (this.mmap.zapperY = e));
                            };
                            zapperFireDown = () => {
                                this.mmap && (this.mmap.zapperFired = !0);
                            };
                            zapperFireUp = () => {
                                this.mmap && (this.mmap.zapperFired = !1);
                            };
                            getFPS() {
                                const t = Date.now();
                                let e = null;
                                return (
                                    this.lastFpsTime && (e = this.fpsFrameCount / ((t - this.lastFpsTime) / 1e3)),
                                    (this.fpsFrameCount = 0),
                                    (this.lastFpsTime = t),
                                    e
                                );
                            }
                            reloadROM() {
                                null !== this.romData && this.loadROM(this.romData);
                            }
                            loadROM(t) {
                                (this.rom = new pt(this)),
                                    this.rom.load(t),
                                    this.reset(),
                                    (this.mmap = this.rom.createMapper()),
                                    this.mmap.loadROM(),
                                    this.ppu.setMirroring(this.rom.getMirroringType()),
                                    (this.romData = t);
                            }
                            setFramerate(t) {
                                this.papu.setFrameRate(t);
                            }
                            toJSON() {
                                return {
                                    cpu: this.cpu.toJSON(),
                                    mmap: this.mmap.toJSON(),
                                    ppu: this.ppu.toJSON(),
                                    papu: this.papu.toJSON(),
                                    controllers: { 1: this.controllers[1].toJSON(), 2: this.controllers[2].toJSON() },
                                };
                            }
                            fromJSON(t) {
                                this.reset(),
                                    this.cpu.fromJSON(t.cpu),
                                    this.mmap.fromJSON(t.mmap),
                                    this.ppu.fromJSON(t.ppu),
                                    this.papu.fromJSON(t.papu),
                                    t.controllers &&
                                        (t.controllers[1] && this.controllers[1].fromJSON(t.controllers[1]),
                                        t.controllers[2] && this.controllers[2].fromJSON(t.controllers[2]));
                            }
                        },
                        Rt = 256,
                        Ct = 240;
                    class _t {
                        constructor(t, e = {}) {
                            (this.onMouseDown = e.onMouseDown),
                                (this.onMouseUp = e.onMouseUp),
                                (this.canvas = document.createElement("canvas")),
                                (this.canvas.width = Rt),
                                (this.canvas.height = Ct),
                                (this.canvas.style.imageRendering = "pixelated"),
                                (this.canvas.style.imageRendering = "crisp-edges"),
                                t.appendChild(this.canvas),
                                (this._handleMouseDown = (t) => {
                                    if (!this.onMouseDown) return;
                                    let e = Rt / parseFloat(this.canvas.style.width),
                                        s = this.canvas.getBoundingClientRect(),
                                        i = Math.round((t.clientX - s.left) * e),
                                        r = Math.round((t.clientY - s.top) * e);
                                    this.onMouseDown(i, r);
                                }),
                                (this._handleMouseUp = () => {
                                    this.onMouseUp && this.onMouseUp();
                                }),
                                this.canvas.addEventListener("mousedown", this._handleMouseDown),
                                this.canvas.addEventListener("mouseup", this._handleMouseUp),
                                this._initCanvas();
                        }
                        _initCanvas() {
                            (this.context = this.canvas.getContext("2d")),
                                (this.imageData = this.context.getImageData(0, 0, Rt, Ct)),
                                (this.context.fillStyle = "black"),
                                this.context.fillRect(0, 0, Rt, Ct),
                                (this.buf = new ArrayBuffer(this.imageData.data.length)),
                                (this.buf8 = new Uint8ClampedArray(this.buf)),
                                (this.buf32 = new Uint32Array(this.buf));
                            for (var t = 0; t < this.buf32.length; ++t) this.buf32[t] = 4278190080;
                        }
                        setBuffer = (t) => {
                            for (var e = 0; e < Ct; ++e)
                                for (var s = 0; s < Rt; ++s) {
                                    var i = 256 * e + s;
                                    this.buf32[i] = 4278190080 | t[i];
                                }
                        };
                        writeBuffer = () => {
                            this.imageData.data.set(this.buf8), this.context.putImageData(this.imageData, 0, 0);
                        };
                        fitInParent = () => {
                            let t = this.canvas.parentNode,
                                e = t.clientWidth,
                                s = t.clientHeight,
                                i = 1.0666666666666667;
                            i < e / s
                                ? ((this.canvas.style.width = \`\${Math.round(s * i)}px\`),
                                  (this.canvas.style.height = \`\${s}px\`))
                                : ((this.canvas.style.width = \`\${e}px\`),
                                  (this.canvas.style.height = \`\${Math.round(e / i)}px\`));
                        };
                        screenshot() {
                            var t = new Image();
                            return (t.src = this.canvas.toDataURL("image/png")), t;
                        }
                        destroy() {
                            this.canvas.removeEventListener("mousedown", this._handleMouseDown),
                                this.canvas.removeEventListener("mouseup", this._handleMouseUp),
                                this.canvas.parentNode.removeChild(this.canvas);
                        }
                    }
                    class bt {
                        constructor({ onBufferUnderrun: t }) {
                            (this.onBufferUnderrun = t),
                                (this.audioCtx = null),
                                (this.node = null),
                                (this.batchL = new Float32Array(128)),
                                (this.batchR = new Float32Array(128)),
                                (this.batchPos = 0);
                        }
                        getSampleRate() {
                            return this.audioCtx ? this.audioCtx.sampleRate : 44100;
                        }
                        async start() {
                            if (!window.AudioContext) return;
                            try {
                            this.audioCtx = new window.AudioContext();
                            const t = new Blob(
                                    [
                                        '\nclass NESAudioProcessor extends AudioWorkletProcessor {\n  constructor() {\n    super();\n    // Circular buffer sized to hold ~170ms of audio at 48kHz (8192 samples).\n    this.capacity = 8192;\n    this.bufferL = new Float32Array(this.capacity);\n    this.bufferR = new Float32Array(this.capacity);\n    this.readPos = 0;\n    this.writePos = 0;\n    this.count = 0;\n\n    this.port.onmessage = (e) => {\n      if (e.data.type === "samples") {\n        const left = e.data.left;\n        const right = e.data.right;\n        const len = left.length;\n\n        // If adding these samples would overflow, drop oldest to make room\n        if (this.count + len > this.capacity) {\n          const drop = this.count + len - this.capacity;\n          this.readPos = (this.readPos + drop) % this.capacity;\n          this.count -= drop;\n        }\n\n        for (let i = 0; i < len; i++) {\n          this.bufferL[this.writePos] = left[i];\n          this.bufferR[this.writePos] = right[i];\n          this.writePos = (this.writePos + 1) % this.capacity;\n        }\n        this.count += len;\n      }\n    };\n  }\n\n  process(inputs, outputs) {\n    const output = outputs[0];\n    if (!output || output.length < 2) return true;\n\n    const outL = output[0];\n    const outR = output[1];\n    const size = outL.length;\n\n    if (this.count < size) {\n      for (let i = 0; i < this.count; i++) {\n        outL[i] = this.bufferL[this.readPos];\n        outR[i] = this.bufferR[this.readPos];\n        this.readPos = (this.readPos + 1) % this.capacity;\n      }\n      for (let i = this.count; i < size; i++) {\n        outL[i] = 0;\n        outR[i] = 0;\n      }\n      this.count = 0;\n      this.port.postMessage({ type: "underrun" });\n    } else {\n      for (let i = 0; i < size; i++) {\n        outL[i] = this.bufferL[this.readPos];\n        outR[i] = this.bufferR[this.readPos];\n        this.readPos = (this.readPos + 1) % this.capacity;\n      }\n      this.count -= size;\n    }\n\n    return true;\n  }\n}\n\nregisterProcessor("nes-audio-processor", NESAudioProcessor);\n',
                                    ],
                                    { type: "application/javascript" }
                                ),
                                e = URL.createObjectURL(t);
                            await this.audioCtx.audioWorklet.addModule(e),
                                URL.revokeObjectURL(e),
                                (this.node = new AudioWorkletNode(this.audioCtx, "nes-audio-processor", {
                                    outputChannelCount: [2],
                                })),
                                (this.node.port.onmessage = (t) => {
                                    "underrun" === t.data.type && this.onBufferUnderrun && this.onBufferUnderrun();
                                }),
                                this.node.connect(this.audioCtx.destination),
                                "suspended" === this.audioCtx.state &&
                                    ((this._resumeOnInteraction = () => {
                                        this.audioCtx && this.audioCtx.resume(), this._removeResumeListeners();
                                    }),
                                    document.addEventListener("keydown", this._resumeOnInteraction),
                                    document.addEventListener("mousedown", this._resumeOnInteraction),
                                    document.addEventListener("touchstart", this._resumeOnInteraction));
                            } catch (e) {
                                console.error('[KAGE] Audio init gagal (game tetap jalan tanpa suara):', e && e.message);
                                this.audioCtx = null;
                                this.node = null;
                            }
                        }
                        _removeResumeListeners() {
                            this._resumeOnInteraction &&
                                (document.removeEventListener("keydown", this._resumeOnInteraction),
                                document.removeEventListener("mousedown", this._resumeOnInteraction),
                                document.removeEventListener("touchstart", this._resumeOnInteraction),
                                (this._resumeOnInteraction = null));
                        }
                        stop() {
                            this._removeResumeListeners(),
                                this.node && (this.node.disconnect(this.audioCtx.destination), (this.node = null)),
                                this.audioCtx &&
                                    (this.audioCtx.close().catch((t) => console.error(t)), (this.audioCtx = null)),
                                (this.batchPos = 0);
                        }
                        writeSample = (t, e) => {
                            this.node &&
                                ((this.batchL[this.batchPos] = t),
                                (this.batchR[this.batchPos] = e),
                                this.batchPos++,
                                this.batchPos >= 128 &&
                                    (this.node.port.postMessage({
                                        type: "samples",
                                        left: this.batchL.slice(),
                                        right: this.batchR.slice(),
                                    }),
                                    (this.batchPos = 0)));
                        };
                        flush() {
                            this.batchPos > 0 &&
                                this.node &&
                                (this.node.port.postMessage({
                                    type: "samples",
                                    left: this.batchL.slice(0, this.batchPos),
                                    right: this.batchR.slice(0, this.batchPos),
                                }),
                                (this.batchPos = 0));
                        }
                    }
                    let yt = !1;
                    try {
                        yt = !!localStorage.getItem("jsnes_debug");
                    } catch {}
                    class ft {
                        constructor(t) {
                            (this.onGenerateFrame = t.onGenerateFrame),
                                (this.onWriteFrame = t.onWriteFrame),
                                (this.onAnimationFrame = this.onAnimationFrame.bind(this)),
                                (this.running = !0),
                                (this.interval = 1e3 / 60.098),
                                (this.lastFrameTime = !1);
                        }
                        start() {
                            (this.running = !0), this.requestAnimationFrame();
                        }
                        stop() {
                            (this.running = !1),
                                this._requestID && window.cancelAnimationFrame(this._requestID),
                                (this.lastFrameTime = !1);
                        }
                        requestAnimationFrame() {
                            this._requestID = window.requestAnimationFrame(this.onAnimationFrame);
                        }
                        generateFrame() {
                            this.onGenerateFrame(), (this.lastFrameTime += this.interval);
                        }
                        onAnimationFrame = (t) => {
                            this.requestAnimationFrame();
                            let e = t % this.interval,
                                s = t - e;
                            if (!this.lastFrameTime) return void (this.lastFrameTime = s);
                            let i = Math.round((s - this.lastFrameTime) / this.interval);
                            if (0 === i) return;
                            this.generateFrame(), this.onWriteFrame();
                            let r = this.interval - e;
                            for (let t = 1; t < i; t++)
                                setTimeout(
                                    () => {
                                        this.generateFrame();
                                    },
                                    (t * r) / i
                                );
                            i > 1 && yt && console.log("SKIP", i - 1, this.lastFrameTime);
                        };
                    }
                    const St = {
                        88: [1, A.BUTTON_A, "X"],
                        89: [1, A.BUTTON_B, "Y"],
                        90: [1, A.BUTTON_B, "Z"],
                        17: [1, A.BUTTON_SELECT, "Right Ctrl"],
                        13: [1, A.BUTTON_START, "Enter"],
                        38: [1, A.BUTTON_UP, "Up"],
                        40: [1, A.BUTTON_DOWN, "Down"],
                        37: [1, A.BUTTON_LEFT, "Left"],
                        39: [1, A.BUTTON_RIGHT, "Right"],
                        83: [1, A.BUTTON_TURBO_A, "S"],
                        65: [1, A.BUTTON_TURBO_B, "A"],
                        103: [2, A.BUTTON_A, "Num-7"],
                        105: [2, A.BUTTON_B, "Num-9"],
                        99: [2, A.BUTTON_SELECT, "Num-3"],
                        97: [2, A.BUTTON_START, "Num-1"],
                        104: [2, A.BUTTON_UP, "Num-8"],
                        98: [2, A.BUTTON_DOWN, "Num-2"],
                        100: [2, A.BUTTON_LEFT, "Num-4"],
                        102: [2, A.BUTTON_RIGHT, "Num-6"],
                    };
                    class Tt {
                        constructor(t) {
                            (this.onButtonDown = t.onButtonDown), (this.onButtonUp = t.onButtonUp);
                        }
                        loadKeys = () => {
                            var t;
                            try {
                                (t = localStorage.getItem("keys")) && (t = JSON.parse(t));
                            } catch (t) {
                                console.warn("Failed to get keys from localStorage.", t);
                            }
                            this.keys = t || St;
                        };
                        setKeys = (t) => {
                            try {
                                localStorage.setItem("keys", JSON.stringify(t)), (this.keys = t);
                            } catch (t) {
                                console.warn("Failed to set keys in localStorage.", t);
                            }
                        };
                        handleKeyDown = (t) => {
                            var e = this.keys[t.keyCode];
                            e && (this.onButtonDown(e[0], e[1]), t.preventDefault());
                        };
                        handleKeyUp = (t) => {
                            var e = this.keys[t.keyCode];
                            e && (this.onButtonUp(e[0], e[1]), t.preventDefault());
                        };
                        handleKeyPress = (t) => {
                            this.keys[t.keyCode] && t.preventDefault();
                        };
                    }
                    class Et {
                        constructor(t) {
                            (this.onButtonDown = t.onButtonDown),
                                (this.onButtonUp = t.onButtonUp),
                                (this.gamepadState = []),
                                (this.buttonCallback = null);
                        }
                        disableIfGamepadEnabled = (t) => {
                            var e = this;
                            return (s, i) => {
                                if (!e.gamepadConfig) return t(s, i);
                                var r = e.gamepadConfig.playerGamepadId;
                                return r && r[s - 1] ? void 0 : t(s, i);
                            };
                        };
                        _getPlayerNumberFromGamepad = (t) =>
                            this.gamepadConfig.playerGamepadId[0] === t.id
                                ? 1
                                : this.gamepadConfig.playerGamepadId[1] === t.id
                                  ? 2
                                  : 1;
                        poll = () => {
                            const t = navigator.getGamepads ? navigator.getGamepads() : navigator.webkitGetGamepads(),
                                e = [];
                            for (let s = 0; s < t.length; s++) {
                                const i = t[s],
                                    r = this.gamepadState[s];
                                if (!i) continue;
                                if (!r) {
                                    this.gamepadState[s] = i;
                                    continue;
                                }
                                const h = i.buttons,
                                    a = r.buttons;
                                if (this.buttonCallback) {
                                    for (let t = 0; t < i.axes.length; t++) {
                                        const e = i.axes[t],
                                            s = r.axes[t];
                                        -1 === e &&
                                            -1 !== s &&
                                            this.buttonCallback({ gamepadId: i.id, type: "axis", code: t, value: e }),
                                            1 === e &&
                                                1 !== s &&
                                                this.buttonCallback({
                                                    gamepadId: i.id,
                                                    type: "axis",
                                                    code: t,
                                                    value: e,
                                                });
                                    }
                                    for (let t = 0; t < h.length; t++) {
                                        const e = h[t],
                                            s = a[t];
                                        e.pressed &&
                                            !s.pressed &&
                                            this.buttonCallback({ gamepadId: i.id, type: "button", code: t });
                                    }
                                } else if (this.gamepadConfig) {
                                    let t = this._getPlayerNumberFromGamepad(i);
                                    if (
                                        e.length < 2 &&
                                        (-1 !== e.indexOf(t) && (t++, t > 2 && (t = 1)),
                                        e.push(t),
                                        this.gamepadConfig.configs[i.id])
                                    ) {
                                        const e = this.gamepadConfig.configs[i.id].buttons;
                                        for (let s = 0; s < e.length; s++) {
                                            const n = e[s];
                                            if ("button" === n.type) {
                                                const e = n.code,
                                                    s = h[e],
                                                    i = a[e];
                                                s.pressed && !i.pressed
                                                    ? this.onButtonDown(t, n.buttonId)
                                                    : !s.pressed && i.pressed && this.onButtonUp(t, n.buttonId);
                                            } else if ("axis" === n.type) {
                                                const e = n.code,
                                                    s = i.axes[e],
                                                    h = r.axes[e];
                                                s === n.value && h !== n.value && this.onButtonDown(t, n.buttonId),
                                                    s !== n.value && h === n.value && this.onButtonUp(t, n.buttonId);
                                            }
                                        }
                                    }
                                }
                                this.gamepadState[s] = {
                                    buttons: h.map((t) => ({ pressed: t.pressed })),
                                    axes: i.axes.slice(0),
                                };
                            }
                        };
                        promptButton = (t) => {
                            this.buttonCallback = t
                                ? (e) => {
                                      (this.buttonCallback = null), t(e);
                                  }
                                : t;
                        };
                        loadGamepadConfig = () => {
                            var t;
                            try {
                                (t = localStorage.getItem("gamepadConfig")) && (t = JSON.parse(t));
                            } catch (t) {
                                console.warn("Failed to get gamepadConfig from localStorage.", t);
                            }
                            this.gamepadConfig = t;
                        };
                        setGamepadConfig = (t) => {
                            try {
                                localStorage.setItem("gamepadConfig", JSON.stringify(t)), (this.gamepadConfig = t);
                            } catch (t) {
                                console.warn("Failed to set gamepadConfig in localStorage.", t);
                            }
                        };
                        startPolling = () => {
                            if (!navigator.getGamepads && !navigator.webkitGetGamepads) return { stop: () => {} };
                            let t = !1;
                            const e = () => {
                                t || (this.poll(), requestAnimationFrame(e));
                            };
                            return (
                                requestAnimationFrame(e),
                                {
                                    stop: () => {
                                        t = !0;
                                    },
                                }
                            );
                        };
                    }
                    let kt = !1;
                    try {
                        kt = !!localStorage.getItem("jsnes_debug");
                    } catch {}
                    function At(...t) {
                        kt && console.log(...t);
                    }
                    class Bt {
                        constructor(t = {}) {
                            (this._options = t),
                                (this._screen = new _t(t.container, {
                                    onMouseDown: (t, e) => {
                                        this.nes.zapperMove(t, e), this.nes.zapperFireDown();
                                    },
                                    onMouseUp: () => {
                                        this.nes.zapperFireUp();
                                    },
                                })),
                                this._screen.fitInParent(),
                                (this._speakers = new bt({
                                    onBufferUnderrun: () => {
                                        At("Buffer underrun, running extra frames to catch up"),
                                            this._frameTimer.generateFrame(),
                                            this._frameTimer.generateFrame();
                                    },
                                })),
                                (this.nes = new gt({
                                    onFrame: this._screen.setBuffer,
                                    onStatusUpdate: At,
                                    onAudioSample: this._speakers.writeSample,
                                    onBatteryRamWrite: t.onBatteryRamWrite || (() => {}),
                                    sampleRate: this._speakers.getSampleRate(),
                                })),
                                (this._frameTimer = new ft({
                                    onGenerateFrame: () => {
                                        try {
                                            this.nes.frame(), this._speakers.flush();
                                        } catch (t) {
                                            this.stop(), this._options.onError && this._options.onError(t);
                                        }
                                    },
                                    onWriteFrame: this._screen.writeBuffer,
                                })),
                                (this.gamepad = new Et({
                                    onButtonDown: this.nes.buttonDown,
                                    onButtonUp: this.nes.buttonUp,
                                })),
                                this.gamepad.loadGamepadConfig(),
                                (this._gamepadPolling = this.gamepad.startPolling()),
                                (this.keyboard = new Tt({
                                    onButtonDown: this.gamepad.disableIfGamepadEnabled(this.nes.buttonDown),
                                    onButtonUp: this.gamepad.disableIfGamepadEnabled(this.nes.buttonUp),
                                })),
                                this.keyboard.loadKeys(),
                                document.addEventListener("keydown", this.keyboard.handleKeyDown),
                                document.addEventListener("keyup", this.keyboard.handleKeyUp),
                                document.addEventListener("keypress", this.keyboard.handleKeyPress),
                                t.romData && (this.nes.loadROM(t.romData), this.start());
                        }
                        start() {
                            this._frameTimer.start(),
                                this._speakers.start(),
                                (this._fpsInterval = setInterval(() => {
                                    At(\`FPS: \${this.nes.getFPS()}\`);
                                }, 1e3));
                        }
                        stop() {
                            this._frameTimer.stop(), this._speakers.stop(), clearInterval(this._fpsInterval);
                        }
                        loadROM(t) {
                            this.stop(), this.nes.loadROM(t), this.start();
                        }
                        fitInParent() {
                            this._screen.fitInParent();
                        }
                        screenshot() {
                            return this._screen.screenshot();
                        }
                        destroy() {
                            this.stop(),
                                document.removeEventListener("keydown", this.keyboard.handleKeyDown),
                                document.removeEventListener("keyup", this.keyboard.handleKeyUp),
                                document.removeEventListener("keypress", this.keyboard.handleKeyPress),
                                this._gamepadPolling.stop(),
                                this._screen.destroy();
                        }
                        static loadROMFromURL(t, e) {
                            var s = new XMLHttpRequest();
                            return (
                                s.open("GET", t),
                                s.overrideMimeType("text/plain; charset=x-user-defined"),
                                (s.onerror = () => e(new Error(\`Error loading \${t}: \${s.statusText}\`))),
                                (s.onload = function () {
                                    200 === this.status ? e(null, this.responseText) : 0 === this.status || s.onerror();
                                }),
                                s.send(),
                                s
                            );
                        }
                    }
                    return e;
                })()
            );
            //# sourceMappingURL=jsnes.min.js.map
        </script>
        <script>
            const cv = document.getElementById("nes"),
                cx = cv.getContext("2d"),
                img = cx.createImageData(256, 240),
                buf = new ArrayBuffer(img.data.length),
                buf8 = new Uint8ClampedArray(buf),
                buf32 = new Uint32Array(buf);
            const SAMPLE_RATE = 44100;
            const BUFFER_SIZE = 2048;
            const RING_SIZE = 65536;
            const ringL = new Float32Array(RING_SIZE);
            const ringR = new Float32Array(RING_SIZE);
            let writePtr = 0,
                readPtr = 0;
            let audioCtx = null,
                scriptNode = null;
            function initAudio() {
                if (!audioCtx) {
                    try {
                        const AC = window.AudioContext || window.webkitAudioContext;
                        if (AC) {
                            audioCtx = new AC({ sampleRate: SAMPLE_RATE });
                            scriptNode = audioCtx.createScriptProcessor(BUFFER_SIZE, 0, 2);
                            scriptNode.onaudioprocess = (e) => {
                                const outL = e.outputBuffer.getChannelData(0);
                                const outR = e.outputBuffer.getChannelData(1);
                                const count = (writePtr - readPtr + RING_SIZE) % RING_SIZE;
                                if (count < BUFFER_SIZE) {
                                    for (let i = 0; i < outL.length; i++) {
                                        outL[i] = 0;
                                        outR[i] = 0;
                                    }
                                    return;
                                }
                                for (let i = 0; i < outL.length; i++) {
                                    outL[i] = ringL[readPtr];
                                    outR[i] = ringR[readPtr];
                                    readPtr = (readPtr + 1) % RING_SIZE;
                                }
                            };
                            scriptNode.connect(audioCtx.destination);
                        }
                    } catch (e) {}
                }
                if (audioCtx && audioCtx.state === "suspended") {
                    audioCtx.resume();
                }
            }
            const nes = new jsnes.NES({
                onFrame: (fb) => {
                    for (let i = 0; i < 256 * 240; i++) buf32[i] = 0xff000000 | fb[i];
                    img.data.set(buf8);
                    cx.putImageData(img, 0, 0);
                },
                onAudioSample: (l, r) => {
                    ringL[writePtr] = l;
                    ringR[writePtr] = r;
                    writePtr = (writePtr + 1) % RING_SIZE;
                },
            });
            const b64 =
                "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AiYnKCEOAAAABAAAAgICAikqKyEOAAAABAAAAgICAgICAiEOAAAABAAAAgICAgICAiEOAAAABAAAAgICAgICAiEOAAAABAAAAgICAgICAiEOAAAABAAAAgICAgICAiEOAAAABAAAAgICAgICAiEOAAAABAAAAgICAgICAiEOAAAABAAAAgICAgICAiEOAAAABAAAAgICAgICAiEOAAAABAAAAgICAgICAiEOAAAABDkAAgICAgICAiEOAAAABAUFAgICAgICAiEOAAAABAYGAgICAgICAiEOAAAABCUAAgICAgICAiEOAAAABAAAAgICAgICAiEOAAAABAAAAgICAgICAiEOAAAABAAAAgICAgICAiEsFxcXFxcXAgICAgICAiEtGBgYGBgYAgICAgICAiEuGRkZGRkZAgICAgICAiEvGhoaGhoaAgICAgICAiEOAAAABAAAAgICAgICAiEOAAAABAAAAgICAgICAiEOAAAABAAAAgICAgICAiEOAAAABDkAAgICAgICAiEOAAAABAUFAgICAgICAiEOAAAABAYGAgICAgICAiEOAAAABCUAAgICAgICAiEOAAAABAAAAgICAgICAiEOAAAABAAAAgICAgICAiEOAAAABAAAAgICAgICAiEOAAAABAAAAgICAgICAiEOAAAABAAAAgICAgICAiEOAAAABAAAAgICAgICAiEOAAAABAAAAgICAgICAiEOAAAABAAAAgICAgICAiEOAAAABAAAAgICAjAxMiEOAAAABAAAAgICAjM0NSEOAAAABAAAAgICAjY3OCEOOQAABDkAAgICAgICAiEeBQUFCwUFERUFBQUFBQUFBQUFBQUFEogGBgoGBgoGBgYGBgYGEw8lAAQlAAQlAAAAAEwAFA8AAAQAAAQAAAAAAEwAAQ8AAAQAAAQAAAAAAEwAAQ8AAAQAAAQAAAAAAEwABR4AAAQAAAQAAAAAAEwABiAAAAQAAAQAAAAAAEwAAQ8AAAQAAAQAAAAAAEwAAQ8AAAQAAAQAAAAAAEwAAQ8AAAQAAAQAAAAAAExEAQ8AAAQAAAQAAAAAAERFAQ8AAAQAAAQAAAAAREVGAQ8AAAQAAAQAAABERUZHAQ8AAAQAAAQAAE1OSEcAAQ8AAAQAAAQAAElKS0wAAQ8AAAQAAAQAAAAAAEwAAQ85AAQ5AAQ5AAAAAEwABQUFBQsFBQsFBQUFBYMFBgoGBgYGBgoGBgYGBg0GAAQlAAAAAAQlAAAAAFEBAAQAAAAAAAQAUlNUCQcBAAQAAAAAAAQAVVZXCQcBAAQAAAAAAAQAWFNUCQcBAAQAAAAAAAQAWlZXCQcBAAQAAAAAAAQAUlNUCQcBAAQAAAAAAAQAWFZXCQcBAAQAAAAAAAQAAlNUCQcBAAQAAAAAAAQAAlZXCQcBAAQAAAAAAAQAAlNUCQcBAAQAAAAAAAQAW1ZXCQcBAAQAAAAAAAQAUlNUCQcBAAQAAAAAAAQAVVZXCQcBAAQAAAAAAAQAWFNUCQcBAAQAAAAAAAQAWVZXCQcBAAQAAAAAAAQAAlNUCQcBAAQAAAAAAAQAAlZXCQcBAAQAAAAAAAQAW1NUCQcBAAQAAAAAAAQAUlZXCQcBAAQ5AAAAAAQ5AAAAAFwBBQsFBQUFBQsFBQUFBQwFBgoGBgYGBgYGBgYGBg0GAAQlAAAAAAAAAAAAAFEBAAQAAAAAAAAAAAAAAAcBAAQAAAAAAAAAAAAAAAcBAAQAAAAAAAAAAAAAAAcBFxcXFxcXFxcXFxcXF10XGBgYGBgYGBgYGBgYGF4YGRkZGRkZGRkZGRkZGV8ZGhoaGhoaGhoaGhoaGmAaAAQAAAAAAAAAAAAAAAcBAAQAAAAAAAAAAAAAAAcBAAQAAAAAAAAAAAAAAAcBAAQ5AAAAAAAAAAAAAFwBBQsFBQUFBQUFBQUFBQwFBgoGBgYGBgoGBgYGBg0GAAQlAAAAAAQlAAAAAFEBAAQAAAAAAAQAAlNUCQcBAAQAAAAAAAQAW1ZXCQcBAAQAAAAAAAQAUlNUCQcBAAQAAAAAAAQAVVZXCQcBAAQAAAAAAAQAWFNUCQcBAAQAAAAAAAQAWlZXCQcBAAQAAAAAAAQAUlNUCQcBAAQAAAAAAAQAWFZXCQcBAAQAAAAAAAQAWVNUCQcBAAQAAAAAAAQAAlZXCQcBAAQAAAAAAAQAAlNUCQcBAAQAAAAAAAQAW1ZXCQcBAAQAAAAAAAQAUlNUCQcBAAQAAAAAAAQAVVZXCQcBAAQAAAAAAAQAWFNUCQcBAAQAAAAAAAQAWVZXCQcBAAQAAAAAAAQAAlNUCQcBAAQAAAAAAAQAAlZXCQcBAAQ5AAAAAAQ5AAAAAFwBBQsFBQUFBQsFBQUFBQwFBgYGBgoGBgoGBgYGBg0GAQ8l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AFVVVVVVVVUAAAAA//8AAACqqgAzMwAAAKqqAAAAAAAAqqoAAAAAAACqqswMAAAAAAD//w8AAAAAVVVVVVVVVVVVVVVVVVVVlapVVVVVVZWqqlVVVVWVqqqqVVVVVSoiIiJVVf9fCgAAAFVVVVUKAAAAVVVVVQoAAABVVVVVCgAAAFVVVVWKiIiIVVVVVSoiIiJVVVVVCgAAAFVVVVUKAAAAVVVVVQoAAABVVf9fCgAAAFVVVVWKiIiIVVVVVWWqqqpVVVVVVWWqqlVVVVVVVWWqVVVVVVVVVVWpAAAAAMzMzKoAAAAA////qgAAAAD///+qAAAAAP///yIAAAAAAICIAAAAAFBVpaoAAAAAUFWlqgAAAABQVaWqAAAAAAAAoKqIiIiIiIioqiIiIiIiIqKqAAAAAAAAoKoAAAAAUFWlqgAAAABQVaWqAAAAAFBVpaqIAAAAAACgqqoAAAAAAKCqqgAAAAAAoKqqAAAAAACgqqYAAAAAAKCqqgAAAADMzMyqAAAAAP///6oAAAAA////qgAAAAD///+qAAAAAACAiKoAAADARKSqqgAAAPBVpaqqAAAA8FWlqqoAAAAwEaGqIgAAAAAAoKr///////+vqv///////6+q////////r6ozMzMzMzOjqszMzMzMzKyq////////r6r///////+vqv///////6+qiAAAAAAAoKqqAAAAwFWlqqoAAADwVaWqqgAAAPBVpaqqAAAAMBGhqqoAAAAAAOAiqgAAAAD///+qAAAAAP///6oAAAAA////qgAAAAAzMzOqAAAA8FWlqqoAAAAwEaGqqgAAAAAAoKqqzMzMzMysqqozMzMzM6OqqgAAAAAAoKqqAAAAwESkqqoAAADwVaWqqgAAAPBVpaqqAAAAMBGhqqoAAAAAAKCqqgAAAAAAoKqqAAAAAACgqqoAAAAAAKCqqgAAAAAAoKo2+2b7lvvW+wb8Nvzm/Fb9Fv12/Fb9pvzm/Fb9jv3//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////wID+YgAgPeIAAN//49/f38GD3+//wsLDwMHB3MzAwMHAAweDg8fBwfAwICAgAAA4Pz+/v78+PDwAAAABA4OHhwHDw8LAQAAAAAAAGBwcHA44PDwmIgAAAA8HBwODgcPHgAcAA4ABwUKOBgcDAwMHj4AGAAMAAwKFgMDDjhgAAAAAAMOOGAAAAB/vLw8HAgEDw9nZ+d3Pw8PAAAAAAAAAMAAgICAgIDAwAAAcPjwcDg8Dz8PBwNwADwAAAAAIODg4MDg4ODAAAAAHA4GDhwAAAAADgIGCAAAAODw8HA4GDh4APAAcAAYKDABAQEDBgwYEAAAAQMGDBgQAABw/H5+fz8PPw8DBwgSFAAAAAAAAACAwODgwIAAAIAPAQEBAwAAAAUBAAEBAAAA4PDgwAAAAACgcCBAAAAAABwOf/+Hf39/HD5/z/8HBwcHBxc/PwYGDzx87MVHfw8PgICAgAAAAMD4/Pz8/PDgwAMDHz9/PwADBA8ABwIAAAHA4PD48ODg4DDYKOAA4OBgAAAAAAAODg4fHz8/HgAAAEDg4ODg4PB4gOAA4ADg4GgODg4ODg4ePgAOAA4ADg4WAABAbH5+fH5+fz8TAQAABj87MnBw4MAAPwEyAHAgwAAAAAAAAODg4ODw8PDwAAAA4ODg4ODg8PgA4ADgAOCg8AcHD3//BwMPDDwwAAAYHA+QgISM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AAAAAP////////////////////8AAAAAAAAAAP//////////////////////AAD/AP///wD//wD/AP///0ElEQkFAwEAAAAAAAAAAP+CpIiQoMCAAAAAAAAAAAD/AAAAAAAAAAAA/////////wBgMBgMBgMAAN/v9/v9/v8A4uLi4uLiAADd3d3d3d3/AP///////wAALy8vLy8v/wAGDBgwYMAAAPv379+/f+Li4uLi4uL/3d3d3d3d3f///////////y8vLy8vLy//AAAAAAAAAP////////////8AwMBgYDAwAAC/v9/f7+//AAMDBgYMDAAA/f37+/f3GBgMDAYGAwP39/v7/f3+/hgYMDBgYMDA7+/f37+/f3//gICAgICAgP+Av7+/v7+//wAAAAAAAAD/AP////////8BAQEBAQEB/wH9/f39/f2AgICAgICAgL+/v7+/v7+//v7+/v7+/v7R0dHR0dHR0YKCgoKCgoKCfX19fX19fX1fX19fX19fX6KioqKioqKi//////////9vb29vb29vbwEBAQEBAQEB/f39/f39/f2IlJSIgICAgL+/v7+/v7+/ESkpEQEBAQH9/f39/f39/bymg4CAg6a0g5mAmb28mYj/AP7+/v7+/gAA0dHR0dHR/wCCgoKCgoIAAH19fX19ff8AX19fX19fAACioqKioqL/AP///////wAAb29vb29v/v7+/v7+/v/R0dHR0dHR/4KCgoKCgoL/fX19fX19ff9fX19fX19f/6KioqKioqL///////////9vb29vb29v/zxmQwAAw2Y0w5mAmT08mQg9ZUEBAcFlNcGZgZk9PZkJgIC8poOAgP+Zk4OZvL+A/wAAPGZDAAD/mdPDmbz/AP8BAT1lQQEB/5nRwZm9/QH/Ax977XU3PhgAAQ8/HxwAAMD43reu7HwYAIDw/Pg4AAD///////8A//////////8AAABAgIBA4OAAAABgYECAn///////////7u7d3bm5dnYnF5ePz8fn54SERESkpNTU5Ojp8fPj5+eBgYKChYWLi///////////d3e7u52dbm7//////////+/v39+fn29v9/f7+/39/v5sbLS02trt7QJEBCKHV0cvQCMjEhQMDARAgoBF4eri9AJkZEiIkJCA7+/f37+/f3+Wlq2t29u3t///////////9/f7+/n59vZ/fz8/Hx8PD3d3OzsdHQ4O///////////39+vr3d2+vv//////////b2/X17u7fX3+/vz8+Pjw8O7u3Ny4uHBwBwcDAwEBAAAHBwMDAQEAAP//////////f3+/v9/f7+8AAAIEBAIHBwAAAAMDAgT84ODAwICAAADg4MDAgIAAAAAAAAAAAACAAAAAAACAgEAAAAAAAAAAAQAAAAAAAQEC/+Tk5OTk5P+AhISEhISEgP8nJycnJyf/BCQkJCQkJATg4ODg4ODg4ICAgICAgICABwcHBwcHBwcEBAQEBAQEBAD//////////wD///////+/v7+/v7+A/39/f39/f38A/wH9/f39/f0A/v7+/v7+/v8A////////AP//////////gL+/v7+/vwB/f39/f39/+fn5+fn5+fn29tbW1tbW1v39/f39/QH//v7+/v7+/gD5+fn5+fn5+dbW1tbW1tbW///7+/n5+fnX19fX19fW1v///f35+fn57u7e3r6+dnb///////////f3+/vd3d7e/wAAAAAAAAD//wAAAAAAAP/////////+AAAAAAAAAQP+/vHmyJEiRAMPHz548eLEiJEiRIkTp0+IkSJEiROnT548ePDgwIAAnz9///////+ePnry4uLi4p89ff393d3dnz9///////+fP3//7++vL3k8Hg8HAwEA+fz+//////8RiUQikcrk8hGJRCKRyuTyf3+PZxOJRCLA8Ph8Ho9HI/////////9/AAAAAAAAgMD5/P7v5+Pj4vn83t/f393d+fz+//////95PD4vLy8vL/k8Hv8H////efz+D/8D//+fPHj/4P///54/f/D/wP//gcN+AP8A/////////wD///8AAAD/AP////////8A//8A/wAA/////wD/AAD//////////Pz8/PwBAwMAAAAAAP//////////AICAgICAgIAAAPz8/Pz8/AAA/ICAgICAgID//Pz8/PyAgP+AgICAgPyA/Pz8/Pz8gID8gICAgID///////jADwAAAAAABz/w///88AAZc+8AAAMP/+aMEN8HAQCApnP9IPj+/39ZjAL///9/HwPA/wAAAIDg/D8A///////+eMcAAAAAAAGHOP///////wf/AAAAAAAA+AD/8/n4/Pz8/gAOBwcDAwMB7ycWlKioq6QY/P3///////7+/v7+/ubCAQEBAQEDGz+ppqigg4cfn//////8+PDwyeTq9PL4mIg/Hx8PDwdndyMHTw8rhy9n/Pz48PT8+PjOxubi8vM5HT8/Pz9/f///Q09PS0leHx/+/Pj8/v/58P///38/xwM/AAAAgMD4/PjDA3////////z8gAAAAAAA//////9/D4cAAAAAAID4/JzO4/D//v//fz8fDw8HAwGfj2ZniwQD8PD5//v9////hw8f//8H/x/8/Pj4UPjw4P////7848D8AAAAAQMfPx/35GgpFQXFJRg/v////////8+fHz8/P38AcODgwMDAgMPA/v//////Pz8BAAAAAACVZRXF4fn42f///z8fDw8vf39/f39/Z0OAgICAgMDY/MTg8vDU4fSmPz8fDy8/H1+TJ1cvTx8ZEfz4+PDw4ObuwvLy0pJ6+Ph/Px8/f/+fD3NjZ0dPz5y4/Pz8/P7+//////////7w4QAAAAAAAR8/4fD4///g//g/Px8fCh8PB/nxZubRIMAPD5//37////85c8cP/3////78+PDw4MCA///////////+/v39+/v39+LkxOKH10cv4OPj0pSMDARHh4NH4evi9AdnZ0uJkZCA///nw4GBgYEAGDx+59vb5wjw74MCgMDa9w8QfP3///8AAAAAAAAGBwAAAAAfP3k4AAOHgOfseHEAAHh/GBOHjvjw2B4XAwYCAAwn4ej8+f0AAAAAAAAAAAAAAMDg8ODAAAAAAAAAAwMAAAAAAAAEPAQfHzwAvv9wGwAAAz9BAI//P/ATA0+6/ADAD+7+vE0zAAAA+PtPAQTA+PwGBLD++gAAAAAAAAAAAAAAAQEDBx98BwMn/3/14IP4/dkHjz//4Pj+v3+P7mB/98HHmfzx/wYACPz4mDgf////8wdnx+AAAAAAAAAA8PD+//Dg+PwMAKDjj/jw6P//XxxwH////wEByf99OBz8//8///7/4wPgoODw/38/f///nw8AgMCAGt+DB4G7/j7lIHz4fkQBwQjw5oMCAAAA9w8ZfP3///94ACAfBuNjHob/3+D4HJzgPw+fxfjw8ODw8OD6hQgAAOLwvx8KEDYAHQ9A4PXnAADRgAAAAAAAAC5///fgwAAA/BQAAAAAAAAB4KAAAAAAAAoPEgAAAAAA9fBsPBAAAACM+PAAAAAAAHAAAAAAAAAAAAAAACF3Px8DDx8/HghA4L+fDR8xceCATGPy4M6OH3/4/P/5344MPwcDIDY4efvEAQEHAeP/TQEABhh+HAAyfoPn+8Cf////fBgEP3/wAAA4fMDg8++e/MeDPx//F2EDP278Hg//+XHClwfj86uWnw7/wwnN+fP/8QA89jKGjMABAwMBAwAAAD4cHAYAAAAA//Hg+P4TP/4HDx8HAezAAf//fh8Pn7//8Pj///9vQwCPfwbA/////3CA+f////8/AAMeCQcAAAAAAAEGAAAAAGfDwoAMAAAAmDw9f/PPAwAAwqq+633tYwAAQeEUi1L+isrO+tNJeW0CBxMHbLaOtgoK7kJr+dmdABURvZZWtmYAA4eLxs1OmgAAAQSdu7V9dh5d9/NqJI6r47df7r/f/yubjjKlq03c/v/5zXvf//+/3qZNu/H/90w52bv3/////OpJGcun//uz/bfv/////2JO197/7UkA3/O+feQ/vv/et723/9tqAqnaY8ypptX/n7a7mt+1BSD1ydZncnr//77X3W/6f4IAZWlu2i+Y/f////+/H4fB8AAA3v///////////8/rOzMAAFv///////////z4+J4HAILv///////////+cHHh5QAC5///////86Dw89+O7P///////////wOBD//5MR/d//////////+Dx/7MX//7////////////MTNn/dAD9////////////xrfgwfB+///5SB8+H5Mze0I8O+DAgiNr/cPEHz9////5+fP379///////37+/ekAM/jeX0/v5/f//////t352LA8PD+//zoz///////77e39/M1HAwl/v7////39/vZlcPB4HCw+X8////////+9uKDx8P5fDwfH//////78/fl8vj4+Pnx8/P//////////4SBwcOHn5/P//////////+IiIiAgIDAwP//////////aGBgfG5v7+f//////////xQQAAABAYOD6+/////////LqxsDG5mZizdX5//3////933+eX569vr//////////zxZ2/reyqjA//////////+CqarqyciIiP//////////ZmRkYmJoaGj//////////8hhaEgAIAAAt97X9/////9BVZAJkIWjU7+rb/dve1+vfv97c//1e33//////////6oyloOrv3qa//////////+sipqS0pKSkP//////////BC0pIWBqY2L//////////0QhiSEIEoKAu952/vftff+pMEHhpYG1YFfPvx9bf0uf/vZ/////+3f//////////7VtRdBSevNi//////////8DQ2LoSkgMKP//////////EREZVURERYT////7//++/4QAYCEFpOiU+/+/3vrbl+sTgxEVQ6lhLe9/7+u/V5/T+P76//z39fr//////////1baetDilObU//////////9QELJoqKCgYf//////////EjMjKaEEAAL//v/3/////UkBKQGBgBAA///3////7/+DgyODAwODI///33///3/f9fX19fv7/fj///////////H11ZVVtGRM///////////Ly8nJTU0cFP//////////ysiKiRoqKir//////////+/uakwFQEhJ//////////8rKy+rCwMLS///////////AAAAAIAAgNAAAAAAAOBwKBjfgQeBu///5yB++H7ExdUIcO+DQmDg8fcPEHz9////GN+DB4G7///nIHz4/sTBy+Li4uLi4uLi3d3d3d3d3d3//////////y8vLy8vLy8v4iIC4gLi4uJd3f0d/R3d3f/8+P/4////Li8vKC8oLy8GA3//j39/fwYPf7//CwsPAwcHczMDAwcADB4ODx8HB8DAgICAAADg/P7+/vz48OAAAAAEDg4eHAcPDwsBAAAAAAAAMHB4eDjg8PDIiAAAADwcHA4OBw8eABwADgAHBQo4GBwMDAwePgAYAAwADAoWAwMOOGAAAAAAAw44YAAAAH+8vDwcCAQPD2dn53c/Dw8AAAAAAAAAwACAgICAgMDAAABw+PBwODwPPw8HA3AAPAAAAAAg4ODgwODg4MAAAAAcDgYOHAAAAAAOAgYIAAAA4PDwcDgYOHgA8ABwABgoMAEBAQMGDBgQAAABAwYMGBAAAHD8fn5/Pw8/DwMHCBIUAAAAAAAAAIDA4ODAgAAAgA8BAQEDAAAABQEAAQEAAADg8ODAAAAAAKBwIEAAAAAAHA5//4d/f38cPn/P/wcHBwcHFz8/BgYPPHzsxUd/Dw+AgICAAAAAwPj8/Pz88ODAAwMfP38/AAMEDwAHAgAAAcDg8Pjw4ODgMNgo4ADg4GAAAAAAAA4ODh8fPz8eAAAAQODg4ODg8HiA4ADgAODgaA4ODg4ODh4+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AAgIDAQEAgIfDw8HAQIAAAEACQMDBQAA/v7+/v78aBCAgICAgkBQLAZ3+/9/f388Bn//vz8bGw9gQICAPHz8+ABg4MD8/Pz4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA/////////////////////wAAAAAAAAAA/////////////////////wEBAQEBAX8Af39/f39/fwAQEBAQEBD3APf39/f39/cAHD9/f+/tqShjQAAAEBJWABM3/9///f//bEgAAAAAAAAFj+/9/////3pwEAAAAAAAjd/9/9////9yIAAAAAAAAMPn/9/9////PBgAAAAAAAD/////cAQAUP//cyCP+/+v////nwdTgAD/nw9j+ax///////jggi4E//3wxx990fv////nAAwcAP/nQhj/8+P/MB0GEEDg+f/P4vnvvx8GAIgBAEgYvv7/d/7/t+dBAQCAkOggBAxf/39vF9/786AAYOxwAQjc//+fE4/+9yMAAAAAAP8A////////AP8AAAD///////////8A////////OBAAAAAAAADH7////////2DAgIICBj4Agx09PHx4gMEABz0AAAAQEP/4AML39+fnAAACAgYEHAjbvHx8eLnB4xAgwEIDDAAA58sdHLzA8/ceP3///+0jAf/////1ofH3AAACwvP////bvHz8/f///xAgxHa/7/3/58sZOr/v//8AAAAGzvvv/+Pdvbz+////AAc9Dh9/7///+ADO/////wDdAN0AAN3d/////wAA////gICA/wgICP+AgID/CAgI////9wAAAAD//////xAQEJn/mQAAAAAA//+ZAAAAAAD/AP//AN0A3f//////////gICAgICAgICenp6enp6engsLCwsLCwsLi4uLi4uLi4tew4GBgAAAAAAAABAQfXw4AACAgIDAQGAAAAAAAAAAADAwIAAAAAAAIYGBgYGFhd0gAAAAAAAAAECgsLjY4Pj8YPz9/f9/f3CdHX39/9+PjwAAAAAHGCQu/Pz+/vjn29EgICAwMDA8PN/f3+/v7/PzRk5CQERMLCy5sb2+uLDQ0jAwMDAwMDAw8PDw8LCwsLASDQAAwiAChOzy//893/x6HCZjY2MyHAAcJmNjYzIcAAwcDAwMDD8ADBwMDAwMPwA+YwcePHB/AD5jBx48cH8APwYMHgNjPgA/Bgwe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+PDw4PDw4PqFCAAA4vC/HwoQNgAdD0Dg9ecAANGAAAAAAAAALn//9+DAAAD8FAAAAAAAAAHgoAAAAAAACg8SAAAAAAD18Gw8EAAAAIz48AAAAAAAcAAAAAAAAAAAAAAAIXc/HwMPHz8eCEDgv58NHzFx4IBMY/Lgzo4ff/j8//nfjgw/BwMgNjh5+8QBAQcB4/9NAQAGGH4cADJ+g+f7wJ////98GAQ/f/AAADh8wODz7578x4M/H/8XYQM/bvweD//5ccKXB+Pzq5afDv/DCc358//xADz2MoaMwAEDAwEDAAAAPhwcBgAAAAD/8eD4/hM//gcPHwcB7MAB//9+Hw+fv//w+P///29DAI9/BsD/////cID5/////z8AAx4JBwAAAAAAAQYAAAAAZ8PCgAwAAACYPD1/888DAADCqr7rfe1jAABB4RSLUv6Kys7600l5bQIHEwdsto62CgruQmv52Z0AFRG9lla2ZgADh4vGzU6aAAABBJ27tX12Hl3382okjqvjt1/uv9//K5uOMqWrTdz+//nNe9///7/epk278f/3TDnZu/f////86kkZy6f/+7P9t+//////Yk7X3v/tSQDf87595D++/963vbf/22oCqdpjzKmm1f+ftrua37UFIPXJ1mdyev//vtfdb/p/ggBlaW7aL5j9/////78fh8HwAADe////////////z+s7MwAAW////////////Pj4ngcAgu////////////5wceHlAALn///////zoPDz347s////////////A4EP//kxH93//////////4PH/sxf//v///////////8xM2f90AP3////////////Gt+DB8H7///lIHz4fkzN7Qjw74MCCI2v9w8QfP3////n58/fv3///////fv796QAz+N5fT+/n9//////+3fnYsDw8P7//OjP///////vt7f38zUcDCX+/v////f3+9mVw8HgcLD5fz////////724oPHw/l8PB8f//////vz9+Xy+Pj4+fHz8///////////hIHBw4efn8///////////4iIiICAgMDA//////////9oYGB8bm/v5///////////FBAAAAEBg4Pr7////////8urGwMbmZmLN1fn//f////3ff55fnr2+v//////////PFnb+t7KqMD//////////4KpqurJyIiI//////////9mZGRiYmhoaP//////////yGFoSAAgAAC33tf3/////0FVkAmQhaNTv6tv9297X69+/3tz//V7ff//////////qjKWg6u/epr//////////6yKmpLSkpKQ//////////8ELSkhYGpjYv//////////RCGJIQgSgoC73nb+9+19/6kwQeGlgbVgV8+/H1t/S5/+9n/////7d///////////tW1F0FJ682L//////////wNDYuhKSAwo//////////8RERlVRERFhP////v//77/hABgIQWk6JT7/7/e+tuX6xODERVDqWEt73/v679Xn9P4/vr//Pf1+v//////////Vtp60OKU5tT//////////1AQsmiooKBh//////////8SMyMpoQQAAv/+//f////9SQEpAYGAEAD///f////v/4ODI4MDA4Mj///ff///f9/19fX1+/v9+P//////////8fXVlVW0ZEz//////////8vLyclNTRwU///////////KyIqJGioqKv//////////7+5qTAVASEn//////////ysrL6sLAwtL//////////8AAAAAgACA0AAAAAAA4HAoGN+BB4G7///nIH74fsTF1Qhw74NCYODx9w8QfP3///8Y34MHgbv//+cgfPj+xMHLAAMDBwcPPz8fHBwYGHFDwwAAAAQAAQQQAwMHCw8eGw///////////////////////////////////////////w==";
            const bin = atob(b64);
            nes.loadROM(bin);
            let lastTime = 0;
            const FRAME_DURATION = 1000 / 60;
            function loop(now) {
                if (!lastTime) lastTime = now;
                const elapsed = now - lastTime;
                if (elapsed >= FRAME_DURATION) {
                    try {
                        nes.frame();
                    } catch (e) {
                        console.error('[KAGE] Frame crash:', e && e.message);
                        const statusEl = document.getElementById('status');
                        if (statusEl) statusEl.textContent = 'Game error: ' + (e && e.message || 'unknown');
                        return; // stop the loop cleanly instead of an unhandled throw
                    }
                    lastTime = now - (elapsed % FRAME_DURATION);
                }
                requestAnimationFrame(loop);
            }
            requestAnimationFrame(loop);
            const K = {
                u: jsnes.Controller.BUTTON_UP,
                d: jsnes.Controller.BUTTON_DOWN,
                l: jsnes.Controller.BUTTON_LEFT,
                r: jsnes.Controller.BUTTON_RIGHT,
                "btn-a": jsnes.Controller.BUTTON_A,
                "btn-b": jsnes.Controller.BUTTON_B,
                st: jsnes.Controller.BUTTON_START,
                sel: jsnes.Controller.BUTTON_SELECT,
            };
            Object.keys(K).forEach((id) => {
                const el = document.getElementById(id);
                if (!el) return;
                const press = (e) => {
                    if (e.cancelable) e.preventDefault();
                    initAudio();
                    el.classList.add("touching");
                    if (navigator.vibrate) navigator.vibrate(12);
                    nes.buttonDown(1, K[id]);
                };
                const release = (e) => {
                    if (e.cancelable) e.preventDefault();
                    el.classList.remove("touching");
                    nes.buttonUp(1, K[id]);
                };
                el.addEventListener("pointerdown", press, { passive: false });
                el.addEventListener("pointerup", release, { passive: false });
                el.addEventListener("pointercancel", release, { passive: false });
                el.addEventListener("pointerleave", release, { passive: false });
                el.addEventListener("touchstart", press, { passive: false });
                el.addEventListener("touchend", release, { passive: false });
                el.addEventListener("touchcancel", release, { passive: false });
            });
            document.addEventListener("pointerdown", initAudio, { once: true });
            document.addEventListener("touchstart", initAudio, { once: true });
        </script>
    </body>
`;

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
    console.error("[KAGE GAGAL]", err?.message || err);
    return m.reply("Gagal mengirim game. Kemungkinan fitur rich-message ini belum/tidak didukung di versi WhatsApp app kamu.");
  }
};

handler.command = ["kage"];
handler.help = ["kage"];
handler.tags = ["game"];

module.exports = handler;
