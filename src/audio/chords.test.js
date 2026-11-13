import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chromaFromSpectrum, detectChord, chordByName, ChordTracker } from './chords.js';
import { LEVELS } from '../data/chordLevels.js';

const RATE = 48000, FFT = 8192;

// Fake AnalyserNode output: guitar-like tones (8 decaying harmonics, slight detune), Blackman window, DFT in dB.
function spectrum(midis) {
  const x = new Float32Array(FFT);
  for (const m of midis) {
    const f = 440 * 2 ** ((m - 69) / 12) * (1 + (Math.random() - 0.5) * 0.004);
    for (let h = 1; h <= 8; h++) for (let n = 0; n < FFT; n++) x[n] += (0.1 * 0.7 ** (h - 1)) * Math.sin((2 * Math.PI * f * h * n) / RATE);
  }
  for (let n = 0; n < FFT; n++) x[n] *= 0.42 - 0.5 * Math.cos((2 * Math.PI * n) / FFT) + 0.08 * Math.cos((4 * Math.PI * n) / FFT);
  const db = new Float32Array(FFT / 2).fill(-120);
  for (let k = 10; k < 360; k++) { // ~60..2100 Hz, enough for chromaFromSpectrum
    let re = 0, im = 0;
    for (let n = 0; n < FFT; n++) { const a = (2 * Math.PI * k * n) / FFT; re += x[n] * Math.cos(a); im -= x[n] * Math.sin(a); }
    db[k] = 20 * Math.log10(Math.hypot(re, im) / FFT + 1e-12);
  }
  return db;
}

// Real voicings (MIDI notes, low string first).
const VOICINGS = {
  E: [40, 47, 52, 56, 59, 64],          // open E
  Am: [45, 52, 57, 60, 64],             // open Am
  G7: [43, 47, 50, 55, 59, 65],         // open G7
  Cmaj7: [48, 52, 55, 59, 64],          // x32000
  Bm7: [47, 54, 57, 62, 66],            // x24232 barre
  'F#m': [42, 49, 54, 57, 61, 66],      // 244222 barre
  Dsus4: [50, 57, 62, 67],              // xx0233
  A5: [45, 52, 57],                     // power chord
  'A#add9': [46, 53, 58, 60, 62],      // x1331(0)-style Bb add9 voicing (Bb F Bb C D)
  Bdim: [47, 53, 59, 62],               // x2343x
};

for (const [name, midis] of Object.entries(VOICINGS)) {
  test(`detects ${name}`, () => {
    const got = detectChord(chromaFromSpectrum(spectrum(midis), RATE));
    assert.ok(got, 'nothing detected');
    assert.equal(got.key, chordByName(name).key, `got ${got.name} (${got.score.toFixed(2)})`);
  });
}

test('silence gives nothing', () => {
  assert.equal(detectChord(chromaFromSpectrum(new Float32Array(FFT / 2).fill(-110), RATE)), null);
});

test('same notes are merged', () => {
  assert.equal(chordByName('Csus2'), chordByName('Gsus4'));
});

test('tracker ignores short glitches and follows a real change', () => {
  const E = chromaFromSpectrum(spectrum(VOICINGS.E), RATE);
  const Am = chromaFromSpectrum(spectrum(VOICINGS.Am), RATE);
  const t = new ChordTracker();
  let now = 0;
  const frames = (chroma, n) => { let r; for (let i = 0; i < n; i++) r = t.push(chroma, (now += 16)); return r; };
  assert.equal(frames(E, 15)?.key, chordByName('E').key);
  for (let i = 0; i < 5; i++) { assert.equal(frames(Am, 1)?.key, chordByName('E').key, 'glitch switched the chord'); frames(E, 3); }
  assert.equal(frames(Am, 30)?.key, chordByName('Am').key);
  assert.equal(t.push(null, now), null, 'silence resets');
});

test('isPlaying checks only the expected chord', () => {
  const t = new ChordTracker();
  t.push(chromaFromSpectrum(spectrum(VOICINGS.Cmaj7), RATE), 0);
  assert.ok(t.isPlaying('Cmaj7'));
  assert.ok(!t.isPlaying('Am'));
  assert.ok(!t.isPlaying('G7'));
  assert.ok(!new ChordTracker().isPlaying('C'), 'nothing played yet');
});

test('every Chord Runner chord exists and no level repeats the same notes', () => {
  const all = LEVELS.flatMap((l) => l.chords);
  for (const name of all) assert.ok(chordByName(name), `unknown chord ${name}`);
  assert.equal(new Set(all.map((n) => chordByName(n).key)).size, all.length, 'two names for the same notes');
});
