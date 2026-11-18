import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS, createProgression } from './chordLevels.js';

// Seeded random so a failure can be replayed.
const seeded = (seed) => () => ((seed = (seed * 1664525 + 1013904223) % 2 ** 32) / 2 ** 32);

for (const level of LEVELS) {
  test(`${level.name}: each round plays every chord once, never twice in a row`, () => {
    const next = createProgression(level.chords, seeded(42));
    const n = level.chords.length;
    let prev = null;
    for (let round = 0; round < 200; round++) {
      const played = Array.from({ length: n }, () => next());
      assert.deepEqual([...played].sort(), [...level.chords].sort(), `round ${round} is not a full shuffle`);
      for (const c of played) {
        assert.notEqual(c, prev, 'same chord twice in a row');
        prev = c;
      }
    }
  });
}

test('rounds are not all in the same order', () => {
  const next = createProgression(LEVELS[0].chords, seeded(7));
  const n = LEVELS[0].chords.length;
  const orders = new Set(Array.from({ length: 20 }, () => Array.from({ length: n }, () => next()).join()));
  assert.ok(orders.size > 15);
});

test('power chords level has all 12 roots', () => {
  assert.equal(LEVELS.at(-1).chords.length, 12);
});
