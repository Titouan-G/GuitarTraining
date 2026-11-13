import { test } from 'node:test';
import assert from 'node:assert/strict';
import { INTERVALS, INTERVAL_LEVELS, spell, label, pc, question } from './intervals.js';

const n = (letter, acc = 0) => ({ letter, acc });

test('answers are spelled like in a theory book', () => {
  assert.equal(label(spell(n(4), '3m')), 'Si♭'); // Sol + 3ce m
  assert.equal(label(spell(n(2), '3M')), 'Sol♯'); // Mi + 3ce M
  assert.equal(label(spell(n(3), '4J')), 'Si♭'); // Fa + 4te
  assert.equal(label(spell(n(6), '5J')), 'Fa♯'); // Si + 5te
  assert.equal(label(spell(n(0), '8')), 'Do');
  assert.equal(label(spell(n(1), '3M', -1)), 'Si♭'); // Ré ↓ 3ce M
  assert.equal(label(spell(n(3, 1), '7M')), 'Mi♯'); // Fa♯ + 7e M
  assert.equal(label(spell(n(3), '4+')), 'Si'); // Fa + triton
});

test('every question of every level has a right-sized, sensible answer', () => {
  for (const L of INTERVAL_LEVELS) {
    for (const start of L.starts) for (const iv of L.intervals) for (const dir of L.down ? [1, -1] : [1]) {
      const a = spell(start, iv, dir);
      const { semis, steps } = INTERVALS[iv];
      assert.equal(pc(a), (pc(start) + dir * semis + 120) % 12, `${label(start)} ${iv} ${dir}: wrong pitch`);
      assert.equal(a.letter, (start.letter + dir * steps + 70) % 7, `${label(start)} ${iv} ${dir}: wrong letter`);
      assert.ok(Math.abs(a.acc) <= 2, `${label(start)} ${iv} ${dir}: triple accidental`);
    }
  }
});

test('questions follow the level and never repeat back to back', () => {
  let prev = null;
  for (let i = 0; i < 300; i++) {
    const q = question(0, prev);
    assert.equal(q.dir, 1);
    assert.equal(q.start.acc, 0);
    assert.ok(INTERVAL_LEVELS[0].intervals.includes(q.interval));
    if (prev) assert.notDeepEqual([q.start, q.interval, q.dir], [prev.start, prev.interval, prev.dir]);
    prev = q;
  }
  assert.ok(Array.from({ length: 300 }, () => question(3).dir).includes(-1), 'level 4 asks descending intervals');
});
