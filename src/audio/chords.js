import { NAMES } from './pitch.js';

// Intervals from the root, in semitones.
const QUALITIES = {
  '': [0, 4, 7], m: [0, 3, 7], 7: [0, 4, 7, 10], maj7: [0, 4, 7, 11], m7: [0, 3, 7, 10],
  sus2: [0, 2, 7], sus4: [0, 5, 7], dim: [0, 3, 6], 5: [0, 7], add9: [0, 2, 4, 7],
};
// A guitar note also rings its harmonics (octave, fifth, third...): templates include them so they don't fool the match.
const HARMONICS = [1, 2, 3, 4, 5, 6].map((h) => [Math.round(12 * Math.log2(h)) % 12, 0.6 ** (h - 1)]);

function template(pcs) {
  const t = new Array(12).fill(0);
  for (const pc of pcs) for (const [off, w] of HARMONICS) t[(pc + off) % 12] += w;
  return t;
}

// Chords with the same notes (Csus2 = Gsus4) are merged: the ear can't tell them apart either.
const byKey = new Map();
NAMES.forEach((root, r) => Object.entries(QUALITIES).forEach(([q, ivs]) => {
  const pcs = ivs.map((i) => (r + i) % 12).sort((a, b) => a - b);
  const key = pcs.join(',');
  if (!byKey.has(key)) byKey.set(key, { key, pcs, names: [], template: template(pcs) });
  byKey.get(key).names.push(root + q);
}));
export const CHORDS = [...byKey.values()];
export const chordByName = (name) => CHORDS.find((c) => c.names.includes(name));

// db: AnalyserNode.getFloatFrequencyData output. Only spectral peaks count, so a low note's wide FFT lobe doesn't leak into neighbour notes.
// maxHz 800: chord fundamentals sit below it, and high harmonics (7th, 9th...) land on notes outside the chord. Measured: score 0.91 -> 0.97.
export function chromaFromSpectrum(db, sampleRate, { minHz = 75, maxHz = 800, gateDb = -65, rangeDb = 30 } = {}) {
  const binHz = sampleRate / (2 * db.length);
  const lo = Math.max(1, Math.ceil(minHz / binHz));
  const hi = Math.min(db.length - 2, Math.floor(maxHz / binHz));
  let max = -Infinity;
  for (let i = lo; i <= hi; i++) if (db[i] > max) max = db[i];
  if (max < gateDb) return null; // silence
  const chroma = new Array(12).fill(0);
  for (let i = lo; i <= hi; i++) {
    const [a, b, c] = [db[i - 1], db[i], db[i + 1]];
    if (b < max - rangeDb || b <= a || b < c) continue;
    const shift = 0.5 * (a - c) / (a - 2 * b + c || 1); // parabolic interpolation: true peak between bins
    const midi = Math.round(69 + 12 * Math.log2(((i + shift) * binHz) / 440));
    chroma[((midi % 12) + 12) % 12] += 10 ** (b / 20);
  }
  return chroma.map(Math.sqrt); // sqrt: power 1 reads E as E5 (third drowned by doubled roots/fifths), power 0.33 reads triads as 7ths
}

function cosine(a, b) {
  let d = 0, na = 0, nb = 0;
  for (let i = 0; i < 12; i++) { d += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return d / (Math.sqrt(na * nb) || 1);
}

export function detectChord(chroma, minScore = 0.8) {
  if (!chroma) return null;
  let best = null, score = -1;
  for (const c of CHORDS) {
    const s = cosine(chroma, c.template);
    if (s > score) { score = s; best = c; }
  }
  return score >= minScore ? { ...best, name: best.names.join(' / '), score } : null;
}

// Smooths chroma over frames and only switches chord once a new one has won for holdMs: stops the display from flickering.
export class ChordTracker {
  constructor({ alpha = 0.3, holdMs = 150 } = {}) {
    Object.assign(this, { alpha, holdMs, chroma: null, stable: null, candidate: null, since: 0 });
  }

  push(chroma, now) {
    if (!chroma) return this.reset();
    const len = Math.hypot(...chroma) || 1; // per-frame normalisation: a decaying chord weighs as much as the attack
    const n = chroma.map((v) => v / len);
    this.chroma = this.chroma ? this.chroma.map((v, i) => v + this.alpha * (n[i] - v)) : n;
    const c = detectChord(this.chroma);
    if (c?.key !== this.candidate?.key) { this.candidate = c; this.since = now; }
    if (c?.key === this.stable?.key) this.stable = c; // refresh score
    else if (now - this.since >= this.holdMs) this.stable = c;
    return this.stable;
  }

  reset() {
    this.chroma = this.stable = this.candidate = null;
    return null;
  }

  // Game check: we know the expected chord, so only ask "is it (nearly) the best match?" instead of guessing among all.
  isPlaying(name, { margin = 0.02, minScore = 0.8 } = {}) {
    const target = chordByName(name);
    const best = detectChord(this.chroma, 0);
    if (!target || !best) return false;
    const s = cosine(this.chroma, target.template);
    return s >= minScore && s >= best.score - margin;
  }
}
