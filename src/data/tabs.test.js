import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { validateTab, findHit, noteMidi, grade } from './tabs.js';

const dir = new URL('./tabs/', import.meta.url);
for (const file of readdirSync(dir).filter((f) => f.endsWith('.json'))) {
  test(`tab ${file} is valid`, () => {
    const tab = JSON.parse(readFileSync(new URL(file, dir), 'utf8'));
    assert.deepEqual(validateTab(tab), []);
    tab.notes.forEach((n, i) => assert.ok(i === 0 || noteMidi(n) !== noteMidi(tab.notes[i - 1]), `note ${i} repeats the previous pitch`));
  });
}

test('validateTab reports hand-written mistakes', () => {
  const errors = validateTab({ title: 'x', bpm: 100, notes: [{ beat: 0, string: 7, fret: 3 }, { beat: 0, string: 1, fret: 30 }] });
  assert.equal(errors.length, 3);
  assert.deepEqual(validateTab({}), ['title manquant', 'bpm entre 30 et 300', 'notes vide']);
});

test('noteMidi uses standard tuning', () => {
  assert.equal(noteMidi({ string: 6, fret: 5 }), 45); // A2
  assert.equal(noteMidi({ string: 1, fret: 0 }), 64); // E4
});

test('findHit matches pitch and timing, in order', () => {
  const spb = 0.5;
  const notes = [{ beat: 0, string: 6, fret: 5 }, { beat: 1, string: 6, fret: 8 }, { beat: 2, string: 6, fret: 5 }];
  assert.equal(findHit(notes, 45, 0.05, spb).note, notes[0]);
  assert.equal(findHit(notes, 46, 0.05, spb), null, 'wrong pitch');
  assert.equal(findHit(notes, 48, 0.2, spb), null, 'too early for note 2');
  assert.equal(findHit(notes, 48, 0.6, spb).note, notes[1]);
  notes[0].result = 'perfect';
  assert.equal(findHit(notes, 45, 1.02, spb).note, notes[2], 'judged note is skipped');
  assert.equal(grade(0.05), 'perfect');
  assert.equal(grade(-0.1), 'good');
});
