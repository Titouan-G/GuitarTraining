// Notes are { letter: 0..6 (Do..Si), acc: -2..2 } so answers get their real name (Sol + 3ce mineure = Si♭, not La♯).
const LETTER_PC = [0, 2, 4, 5, 7, 9, 11];
const FR = ['Do', 'Ré', 'Mi', 'Fa', 'Sol', 'La', 'Si'];
const ACC = { '-2': '♭♭', '-1': '♭', 0: '', 1: '♯', 2: '♯♯' };

export const pc = (n) => (LETTER_PC[n.letter] + n.acc + 12) % 12;
export const label = (n) => FR[n.letter] + ACC[n.acc];

// steps = how many letters away (a third is 2 letters above), semis = size in semitones.
export const INTERVALS = {
  '2m': { name: 'Seconde mineure', semis: 1, steps: 1 },
  '2M': { name: 'Seconde majeure', semis: 2, steps: 1 },
  '3m': { name: 'Tierce mineure', semis: 3, steps: 2 },
  '3M': { name: 'Tierce majeure', semis: 4, steps: 2 },
  '4J': { name: 'Quarte juste', semis: 5, steps: 3 },
  '4+': { name: 'Quarte augmentée (triton)', semis: 6, steps: 3 },
  '5J': { name: 'Quinte juste', semis: 7, steps: 4 },
  '6m': { name: 'Sixte mineure', semis: 8, steps: 5 },
  '6M': { name: 'Sixte majeure', semis: 9, steps: 5 },
  '7m': { name: 'Septième mineure', semis: 10, steps: 6 },
  '7M': { name: 'Septième majeure', semis: 11, steps: 6 },
  '8': { name: 'Octave', semis: 12, steps: 7 },
};

const NATURALS = [0, 1, 2, 3, 4, 5, 6].map((letter) => ({ letter, acc: 0 }));
const ALTERED = [[3, 1], [6, -1], [2, -1], [0, 1], [5, -1]].map(([letter, acc]) => ({ letter, acc })); // Fa♯ Si♭ Mi♭ Do♯ La♭

export const INTERVAL_LEVELS = [
  { name: 'Tierces, quinte, octave', intervals: ['3m', '3M', '5J', '8'], starts: NATURALS, down: false },
  { name: '+ secondes et quarte', intervals: ['2m', '2M', '3m', '3M', '4J', '5J', '8'], starts: NATURALS, down: false },
  { name: '+ sixtes, septièmes, notes altérées', intervals: ['2m', '2M', '3m', '3M', '4J', '5J', '6m', '6M', '7m', '7M', '8'], starts: [...NATURALS, ...ALTERED], down: false },
  // sorted by size: Object.keys would put '8' first (integer-like keys come first in JS)
  { name: '+ triton, descendants', intervals: Object.keys(INTERVALS).sort((a, b) => INTERVALS[a].semis - INTERVALS[b].semis), starts: [...NATURALS, ...ALTERED], down: true },
];

// Correctly spelled note at `interval` above (dir 1) or below (dir -1) `start`.
export function spell(start, interval, dir = 1) {
  const { semis, steps } = INTERVALS[interval];
  const letter = (start.letter + dir * steps + 70) % 7;
  const target = (pc(start) + dir * semis + 120) % 12;
  const acc = ((target - LETTER_PC[letter] + 18) % 12) - 6;
  return { letter, acc };
}

const key = (q) => `${q.start.letter}${q.start.acc}${q.interval}${q.dir}`;

// Random question for a level, never the same as the previous one.
export function question(level, prev = null, rand = Math.random) {
  const L = INTERVAL_LEVELS[level];
  const any = (arr) => arr[Math.floor(rand() * arr.length)];
  let q;
  do {
    const start = any(L.starts);
    const interval = any(L.intervals);
    const dir = L.down && rand() < 0.5 ? -1 : 1;
    q = { start, interval, dir, answer: spell(start, interval, dir) };
  } while (prev && key(q) === key(prev));
  return q;
}
