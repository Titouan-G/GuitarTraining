// Tab format: { title, bpm, notes: [{ beat, string, fret }] }, string 1 = high e ... 6 = low E, beat from 0.
export const OPEN = [64, 59, 55, 50, 45, 40]; // standard tuning, MIDI of open strings 1..6
export const WINDOW = { perfect: 0.06, good: 0.12 }; // seconds either side of the note

export const noteMidi = (n) => OPEN[n.string - 1] + n.fret;

// Hand-written JSON: list what is wrong instead of crashing the game.
export function validateTab(tab) {
  const errors = [];
  if (!tab?.title) errors.push('title manquant');
  if (!(tab?.bpm >= 30 && tab?.bpm <= 300)) errors.push('bpm entre 30 et 300');
  if (!Array.isArray(tab?.notes) || !tab.notes.length) return [...errors, 'notes vide'];
  tab.notes.forEach((n, i) => {
    if (![1, 2, 3, 4, 5, 6].includes(n.string)) errors.push(`note ${i} : corde 1 à 6`);
    if (!Number.isInteger(n.fret) || n.fret < 0 || n.fret > 24) errors.push(`note ${i} : case 0 à 24`);
    // shortcut: one note at a time (pitch detection is monophonic), no chords inside a tab.
    if (!(n.beat >= 0) || (i > 0 && n.beat <= tab.notes[i - 1].beat)) errors.push(`note ${i} : temps croissant, une note à la fois`);
  });
  return errors;
}

// Earliest not-yet-judged note with this pitch inside the good window around time t (seconds). notes sorted by beat.
export function findHit(notes, midi, t, secPerBeat) {
  for (const n of notes) {
    if (n.result) continue;
    const diff = t - n.beat * secPerBeat;
    if (diff < -WINDOW.good) return null; // every later note is even further away
    if (diff <= WINDOW.good && noteMidi(n) === midi) return { note: n, diff };
  }
  return null;
}

export const grade = (diff) => (Math.abs(diff) <= WINDOW.perfect ? 'perfect' : 'good');
