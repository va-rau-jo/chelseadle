// Little bell chimes for correct answers, synthesised with Web Audio (no sound files).
//
//   chime('small')    two quick notes   (a crossword word, a common Krillion answer)
//   chime('correct')  a rising C-E-G     (a cryptic clue, a photo, a mid-tier Krillion answer)
//   chime('big')      C-E-G-C + sparkle  (finishing a whole puzzle, a rare Krillion answer)
//
// Browsers only allow audio after the first tap or key press, so the audio context is
// created (and "unlocked") on her first interaction with the page.

let ctx = null;
let out = null;

function audio() {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try {
      ctx = new AC();
    } catch {
      return null;
    }
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 6;
    out = ctx.createGain();
    out.gain.value = 0.9;
    out.connect(comp).connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

if (typeof window !== 'undefined') {
  const unlock = () => {
    const c = audio();
    if (!c) return;
    // iOS needs a sound started inside a tap before it will play any later.
    try {
      const src = c.createBufferSource();
      src.buffer = c.createBuffer(1, 1, 22050);
      src.connect(c.destination);
      src.start(0);
    } catch {}
    if (c.state === 'running') {
      for (const ev of EVENTS) window.removeEventListener(ev, unlock, true);
    }
  };
  const EVENTS = ['pointerdown', 'touchend', 'keydown'];
  for (const ev of EVENTS) window.addEventListener(ev, unlock, { capture: true, passive: true });
}

// A soft bell: a sine fundamental plus two quieter overtones that fade faster.
function bell(c, freq, at, { gain = 0.16, decay = 1.4 } = {}) {
  const partials = [
    [1, 1, decay],
    [2, 0.28, decay * 0.55],
    [3.01, 0.1, decay * 0.35],
  ];
  for (const [mult, level, d] of partials) {
    const f = freq * mult;
    if (f > 16000) continue;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = 'sine';
    osc.frequency.value = f;
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(gain * level, at + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, at + d);
    osc.connect(g).connect(out);
    osc.start(at);
    osc.stop(at + d + 0.05);
  }
}

const C6 = 1046.5;
const E6 = 1318.5;
const G6 = 1568;
const C7 = 2093;
const E7 = 2637;
const G7 = 3136;

const PATTERNS = {
  small: [
    [G6, 0, { gain: 0.12, decay: 0.9 }],
    [C7, 0.07, { gain: 0.12, decay: 1.1 }],
  ],
  correct: [
    [C6, 0, { decay: 1.0 }],
    [E6, 0.075, { decay: 1.0 }],
    [G6, 0.15, { decay: 1.6 }],
  ],
  big: [
    [C6, 0, { decay: 1.0 }],
    [E6, 0.07, { decay: 1.0 }],
    [G6, 0.14, { decay: 1.2 }],
    [C7, 0.21, { gain: 0.17, decay: 2.0 }],
    [E7, 0.34, { gain: 0.05, decay: 1.2 }],
    [G7, 0.41, { gain: 0.045, decay: 1.2 }],
    [C7 * 2, 0.48, { gain: 0.03, decay: 1.0 }],
  ],
};

export function chime(kind = 'correct') {
  try {
    const c = audio();
    if (!c || c.state !== 'running') return;
    const t = c.currentTime + 0.02;
    for (const [f, dt, opts] of PATTERNS[kind] ?? PATTERNS.correct) bell(c, f, t + dt, opts);
  } catch {}
}
