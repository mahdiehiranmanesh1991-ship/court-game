// «اعتراض دارم!» — every sound and every note of music is synthesised live with WebAudio.
// iOS Safari only lets audio start after a user gesture, so unlock() runs on the first tap.
let ctx = null, master = null, sfxBus = null, musicBus = null;
const st = { music: true, sfx: true, track: null, timer: null, step: 0, nextT: 0 };

function ensure() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
  ctx = new AC(); master = ctx.createGain(); master.gain.value = 0.8; master.connect(ctx.destination);
  sfxBus = ctx.createGain(); sfxBus.gain.value = 0.9; sfxBus.connect(master);
  musicBus = ctx.createGain(); musicBus.gain.value = 0.22; musicBus.connect(master);
  return ctx;
}
export function unlock() {
  const c = ensure(); if (!c) return;
  const go = () => { if (st.track && !st.timer && st.music) startLoop(); };
  if (c.state === 'suspended') c.resume().then(go, () => {});
  const b = c.createBuffer(1, 1, 22050); const s = c.createBufferSource(); s.buffer = b; s.connect(c.destination); s.start(0);
  go();
}
export function setEnabled({ music, sfx }) {
  if (sfx !== undefined) st.sfx = !!sfx;
  if (music !== undefined) { st.music = !!music; if (!st.music) stopLoop(); else if (st.track) startLoop(); }
}

function tone(freq, t, dur, { type = 'square', vol = 0.2, bus, slide, attack = 0.005 } = {}) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t); if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(bus || sfxBus); o.start(t); o.stop(t + dur + 0.02);
}
function noise(t, dur, { vol = 0.3, freq = 1200, q = 0.8, bus } = {}) {
  const len = Math.max(1, Math.floor(ctx.sampleRate * dur)); const buf = ctx.createBuffer(1, len, ctx.sampleRate); const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const s = ctx.createBufferSource(); s.buffer = buf; const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
  const g = ctx.createGain(); g.gain.value = vol; s.connect(f); f.connect(g); g.connect(bus || sfxBus); s.start(t);
}

const SFX = {
  blip: (t, p = 1) => tone(520 * p, t, 0.035, { vol: 0.06 }),
  select: (t) => { tone(660, t, 0.06, { vol: 0.12 }); tone(990, t + 0.05, 0.08, { vol: 0.1 }); },
  back: (t) => tone(440, t, 0.08, { vol: 0.1, slide: 300 }),
  objection: (t) => { noise(t, 0.25, { vol: 0.5, freq: 900 }); [0, 0.07, 0.14].forEach((d, i) => tone([392, 523, 784][i], t + d, 0.35, { type: 'sawtooth', vol: 0.18 })); tone(1568, t + 0.2, 0.5, { type: 'triangle', vol: 0.12 }); },
  hold: (t) => { noise(t, 0.15, { vol: 0.4, freq: 1500 }); tone(880, t, 0.12, { type: 'sawtooth', vol: 0.15 }); tone(660, t + 0.1, 0.25, { type: 'sawtooth', vol: 0.15 }); },
  gavel: (t) => { noise(t, 0.12, { vol: 0.9, freq: 300, q: 2 }); tone(140, t, 0.18, { type: 'sine', vol: 0.5, slide: 60 }); noise(t + 0.25, 0.1, { vol: 0.6, freq: 300, q: 2 }); tone(130, t + 0.25, 0.16, { type: 'sine', vol: 0.4, slide: 60 }); },
  damage: (t) => { tone(200, t, 0.4, { type: 'sawtooth', vol: 0.25, slide: 60 }); noise(t, 0.3, { vol: 0.3, freq: 400 }); },
  evidence: (t) => [784, 988, 1175, 1568].forEach((f, i) => tone(f, t + i * 0.07, 0.18, { type: 'triangle', vol: 0.14 })),
  success: (t) => [523, 659, 784, 1047].forEach((f, i) => tone(f, t + i * 0.1, 0.3, { type: 'square', vol: 0.1 })),
  shock: (t) => { tone(1200, t, 0.3, { type: 'sawtooth', vol: 0.12, slide: 200 }); },
  fail: (t) => [392, 370, 349, 262].forEach((f, i) => tone(f, t + i * 0.22, 0.3, { type: 'triangle', vol: 0.15 })),
};
export function sfx(name, arg) {
  if (!st.sfx || !ensure() || ctx.state !== 'running') return;
  const f = SFX[name]; if (f) f(ctx.currentTime + 0.01, arg);
}

// ---------- music: tiny step sequencer. Notes are semitones from A3 (220 Hz); null = rest ----------
const N = (s) => 220 * Math.pow(2, s / 12);
// Melodies lean on a Shur-like flavour (flat 2nd) to give a Persian colour with plain 12-TET.
const TRACKS = {
  investigation: { bpm: 92, lead: [12, null, 13, 15, 13, null, 12, 10, 12, null, null, 8, 10, null, 12, null, 15, null, 13, 12, 10, null, 8, 10, 12, null, 13, null, 12, null, null, null], bass: [0, null, 0, null, -4, null, -4, null, -2, null, -2, null, -5, null, -5, null], leadType: 'triangle', leadVol: 0.5 },
  court: { bpm: 104, lead: [0, 3, 7, 3, 1, 3, 7, 10, 8, 7, 5, 3, 1, null, 0, null], bass: [-12, -12, -12, -12, -11, -11, -11, -11, -9, -9, -9, -9, -11, -11, -12, -12], leadType: 'square', leadVol: 0.35 },
  cross: { bpm: 140, lead: [12, 12, 15, 12, 13, 12, 10, 8, 12, 12, 15, 17, 15, 13, 12, null, 7, 8, 10, 12, 13, 12, 10, 8, 7, null, 8, null, 10, null, 12, null], bass: [0, 0, 12, 0, 1, 1, 13, 1, -2, -2, 10, -2, -5, -5, 7, -5], leadType: 'sawtooth', leadVol: 0.28 },
  victory: { bpm: 126, lead: [12, 16, 19, 24, null, 19, 21, 24, 26, null, 24, null, 21, 19, 21, 24, 28, null, 26, 24, 26, null, 24, null, null, null, null, null, null, null, null, null], bass: [0, 7, 12, 7, 5, 9, 12, 9, 7, 11, 14, 11, 0, 7, 12, 7], leadType: 'square', leadVol: 0.35 },
  tension: { bpm: 70, lead: [null, null, 13, null, null, 12, null, null, null, null, 13, null, 15, null, 13, 12], bass: [0, null, null, null, 1, null, null, null, 0, null, null, null, -1, null, null, null], leadType: 'triangle', leadVol: 0.45 },
};
export const TRACK_NAMES = Object.keys(TRACKS);
function schedule() {
  const tr = TRACKS[st.track]; if (!tr) return;
  const stepDur = 60 / tr.bpm / 2; const ahead = ctx.currentTime + 0.25;
  while (st.nextT < ahead) {
    const i = st.step, t = st.nextT;
    const ln = tr.lead[i % tr.lead.length]; if (ln !== null && ln !== undefined) tone(N(ln), t, stepDur * 0.9, { type: tr.leadType, vol: tr.leadVol * 0.3, bus: musicBus, attack: 0.01 });
    if (i % 2 === 0) { const b = tr.bass[(i / 2) % tr.bass.length]; if (b !== null && b !== undefined) tone(N(b - 12), t, stepDur * 1.8, { type: 'triangle', vol: 0.35, bus: musicBus, attack: 0.01 }); }
    if (st.track === 'cross' || st.track === 'court') { if (i % 4 === 0) noise(t, 0.05, { vol: 0.12, freq: 120, q: 1, bus: musicBus }); if (i % 4 === 2) noise(t, 0.04, { vol: 0.06, freq: 6000, q: 1, bus: musicBus }); }
    st.step++; st.nextT += stepDur;
  }
}
function startLoop() {
  if (!ensure() || st.timer || ctx.state !== 'running') return;
  st.step = 0; st.nextT = ctx.currentTime + 0.05; st.timer = setInterval(schedule, 60); schedule();
}
function stopLoop() { if (st.timer) clearInterval(st.timer); st.timer = null; }
export function music(name) {
  if (name === st.track && st.timer) return;
  stopLoop(); st.track = name && TRACKS[name] ? name : null;
  if (st.track && st.music) startLoop();
}
export const currentTrack = () => st.track;
