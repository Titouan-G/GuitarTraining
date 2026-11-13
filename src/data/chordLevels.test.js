import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS, keysOf, createProgression } from './chordLevels.js';

// Seeded random so a failure can be replayed.
const seeded = (seed) => () => ((seed = (seed * 1664525 + 1013904223) % 2 ** 32) / 2 ** 32);

for (const level of LEVELS) {
  test(`${level.name}: every chord can come up, and chords follow each other in key`, () => {
    const keys = keysOf(level.chords);
    for (const c of level.chords) assert.ok(keys.some((k) => k.includes(c)), `${c} belongs to no key of this level`);
    const next = createProgression(level.chords, seeded(42));
    const seen = new Set();
    let prev = next();
    for (let i = 0; i < 3000; i++) {
      const c = next();
      assert.notEqual(c, prev, 'same chord twice in a row');
      assert.ok(keys.some((k) => k.includes(prev) && k.includes(c)), `${prev} -> ${c} share no key`);
      seen.add(c);
      prev = c;
    }
    assert.deepEqual([...seen].sort(), [...level.chords].sort(), 'some chords never come up');
  });
}

test('power chords level has all 12 roots', () => {
  assert.equal(LEVELS.at(-1).chords.length, 12);
});
