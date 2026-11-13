import { chordByName } from '../audio/chords.js';

// Chord Runner pools. Sharps only (detector names), no two names for the same notes.
// New levels go at the end: records are saved by level index.
export const LEVELS = [
  { name: 'Accords ouverts', chords: ['E', 'A', 'D', 'G', 'C', 'Am', 'Em', 'Dm'] },
  { name: 'Barrés', chords: ['F', 'B', 'Bm', 'F#m', 'C#m', 'G#m', 'A#', 'F#'] },
  { name: '7, maj7, m7', chords: ['E7', 'A7', 'D7', 'G7', 'B7', 'C7', 'Am7', 'Em7', 'Dm7', 'Bm7', 'Cmaj7', 'Fmaj7', 'Gmaj7', 'Amaj7'] },
  { name: 'sus, add9, dim', chords: ['Dsus4', 'Asus4', 'Esus4', 'Csus2', 'Cadd9', 'Gadd9', 'Bdim', 'F#dim'] },
  { name: 'Power chords', chords: ['E5', 'F5', 'F#5', 'G5', 'G#5', 'A5', 'A#5', 'B5', 'C5', 'C#5', 'D5', 'D#5'] },
];

// Keys as pitch-class sets: 12 major scales + 12 harmonic minor (so V7 -> i, like E7 -> Am, counts as "in key").
const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const HARMONIC_MINOR = [0, 2, 3, 5, 7, 8, 11];
const SCALES = [MAJOR, HARMONIC_MINOR].flatMap((steps) => Array.from({ length: 12 }, (_, root) => new Set(steps.map((s) => (root + s) % 12))));
const inScale = (name, scale) => chordByName(name).pcs.every((pc) => scale.has(pc));

// Chords of the pool grouped by key, keeping only keys with at least 3 of them (enough to vary).
export const keysOf = (pool) => SCALES.map((s) => pool.filter((c) => inScale(c, s))).filter((chords) => chords.length >= 3);

// Endless sequence that sounds good: PER_KEY chords from one key, then a pivot chord (shared by two keys) leads to the next key.
export function createProgression(pool, rand = Math.random, perKey = 6) {
  const keys = keysOf(pool);
  const any = (arr) => arr[Math.floor(rand() * arr.length)];
  let key = any(keys);
  let count = 0;
  let prev = null;
  return () => {
    if (count >= perKey) {
      const pivots = keys.filter((k) => k !== key && k.includes(prev));
      if (pivots.length) key = any(pivots);
      count = 0;
    }
    let chord;
    do chord = any(key); while (chord === prev); // every key has 3+ chords, so this ends
    count++;
    prev = chord;
    return chord;
  };
}
