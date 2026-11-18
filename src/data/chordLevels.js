// Chord Runner pools. Sharps only (detector names), no two names for the same notes.
// New levels go at the end: records are saved by level index.
export const LEVELS = [
  { name: 'Accords ouverts', chords: ['E', 'A', 'D', 'G', 'C', 'Am', 'Em', 'Dm'] },
  { name: 'Barrés', chords: ['F', 'B', 'Bm', 'F#m', 'C#m', 'G#m', 'A#', 'F#'] },
  { name: '7, maj7, m7', chords: ['E7', 'A7', 'D7', 'G7', 'B7', 'C7', 'Am7', 'Em7', 'Dm7', 'Bm7', 'Cmaj7', 'Fmaj7', 'Gmaj7', 'Amaj7'] },
  { name: 'sus, add9, dim', chords: ['Dsus4', 'Asus4', 'Esus4', 'Csus2', 'Cadd9', 'Gadd9', 'Bdim', 'F#dim'] },
  { name: 'Power chords', chords: ['E5', 'F5', 'F#5', 'G5', 'G#5', 'A5', 'A#5', 'B5', 'C5', 'C#5', 'D5', 'D#5'] },
];

// Shuffle bag: every chord of the level comes up once, in random order, before the bag is reshuffled.
// Max variety, no short loops; chords don't follow a key (Titouan preferred variety over harmony).
export function createProgression(pool, rand = Math.random) {
  let bag = [];
  let prev = null;
  return () => {
    if (!bag.length) {
      bag = [...pool];
      for (let i = bag.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [bag[i], bag[j]] = [bag[j], bag[i]];
      }
      const last = bag.length - 1; // pop() takes from the end
      if (bag[last] === prev) [bag[0], bag[last]] = [bag[last], bag[0]]; // never the same chord twice in a row across bags
    }
    prev = bag.pop();
    return prev;
  };
}
