import Phaser from 'phaser';
import { audio, readChroma } from '../audio/input.js';
import { createPitchReader, NAMES } from '../audio/pitch.js';
import { ChordTracker } from '../audio/chords.js';
import { C, FUN, text, card, button, pop, wobble, background, shadowTitle } from '../theme.js';

const TUNER_X = 330; // centre of the tuner half of the card
const GAUGE_Y = 272;
const BARS_X = 612; // first chroma bar
const BARS_BASE = 318;
const BARS_H = 150;

// Menu + tuner: shows the detected note and chord so the input can be checked before playing.
export class MenuScene extends Phaser.Scene {
  constructor() { super('menu'); }

  create() {
    const { width: w } = this.scale;
    background(this);
    shadowTitle(text(this, w / 2, 50, 'GuitarTraining', 54, C.ink, 700).setOrigin(0.5));

    card(this, 100, 96, 760, 270);
    text(this, TUNER_X, 118, 'ACCORDEUR', 15, C.ink, 600).setOrigin(0.5).setAlpha(0.45);
    this.note = text(this, TUNER_X, 168, '–', 64, C.ink, 700).setOrigin(0.5);
    this.noteName = text(this, TUNER_X, 210, '', 20, C.ink, 500).setOrigin(0.5).setAlpha(0.6);
    this.detail = text(this, TUNER_X, 238, 'Active l\'audio en haut, puis joue une note', 15, C.ink, 400).setOrigin(0.5).setAlpha(0.6);
    this.add.rectangle(TUNER_X, GAUGE_Y, 300, 14, C.ink, 0.08);
    this.add.rectangle(TUNER_X, GAUGE_Y, 30, 14, C.green, 0.45); // ±5 cents = in tune
    this.needle = this.add.rectangle(TUNER_X, GAUGE_Y, 8, 34, C.ink);
    this.chord = text(this, TUNER_X, 322, 'Accord : –', 26, C.ink, 600).setOrigin(0.5);

    // Diagnostic: what the chord detector hears, one bar per note name (full colour = notes of the detected chord).
    text(this, BARS_X + 99, 118, 'NOTES ENTENDUES', 15, C.ink, 600).setOrigin(0.5).setAlpha(0.45);
    this.bars = NAMES.map((n, i) => {
      text(this, BARS_X + i * 18, BARS_BASE + 6, n.replace('#', '♯'), 12, C.ink, 500).setOrigin(0.5, 0).setAlpha(0.55);
      return this.add.rectangle(BARS_X + i * 18, BARS_BASE, 14, 0, FUN[i % FUN.length]).setOrigin(0.5, 1);
    });
    this.tracker = new ChordTracker();
    this.readerFor = null; // scene object is reused when coming back from a game: force a fresh reader
    this.lastMidi = this.lastChord = null;

    this.hint = text(this, w / 2, 512, 'Choisis un jeu : clic ou touches 1, 2, 3', 16, C.ink, 500).setOrigin(0.5).setAlpha(0.6);
    [['ONE', 'Chord Runner', 'runner', C.red], ['TWO', 'Tab Hero', 'tabhero', C.blue], ['THREE', 'Intervalles', 'intervals', C.yellow]].forEach(([key, label, scene, color], i) => {
      const b = button(this, w / 2 + (i - 1) * 310, 438, label, color, () => this.play(scene, b), { w: 280, h: 76, badge: String(i + 1) });
      this.input.keyboard.on(`keydown-${key}`, () => this.play(scene, b));
    });
  }

  play(key, btn) {
    if (audio.analyser) return this.scene.start(key);
    this.hint.setText('Active d\'abord l\'audio en haut de la page').setColor('#ff5a4e').setAlpha(1);
    wobble(this, btn);
  }

  updateChord(time) {
    const c = this.tracker.push(readChroma(), time);
    const chroma = this.tracker.chroma ?? new Array(12).fill(0);
    const max = Math.max(...chroma) || 1;
    this.bars.forEach((b, i) => {
      b.setSize(14, (chroma[i] / max) * BARS_H); // setSize, not .height: keeps the bottom origin
      b.setAlpha(!c || c.pcs.includes(i) ? 1 : 0.3);
    });
    if (!c) { this.chord.setAlpha(0.35); return; } // keep the last chord, dimmed
    this.chord.setText(`Accord : ${c.name}`).setAlpha(1);
    if (c.name !== this.lastChord) pop(this, this.chord, 0.8);
    this.lastChord = c.name;
  }

  update(time) {
    if (!audio.analyser) return;
    // New analyser after "Relancer" or a device change: the old reader would read a closed context.
    if (this.readerFor !== audio.analyser) { this.reader = createPitchReader(audio.analyser, audio.ctx.sampleRate); this.readerFor = audio.analyser; }
    this.updateChord(time);
    const p = this.reader();
    if (!p) return; // keep the last note on screen
    const off = Math.abs(p.cents);
    const color = off <= 5 ? C.green : off <= 15 ? C.yellow : C.red;
    this.note.setText(p.solfege).setColor(off <= 5 ? '#2fae4a' : '#2a2a40');
    this.noteName.setText(p.name);
    this.detail.setText(`${p.freq.toFixed(1)} Hz · ${p.cents > 0 ? '+' : ''}${p.cents} cents · clarté ${p.clarity.toFixed(2)}`);
    this.needle.x = TUNER_X + Phaser.Math.Clamp(p.cents * 3, -150, 150);
    this.needle.fillColor = color;
    if (p.midi !== this.lastMidi) pop(this, this.note, 0.7);
    this.lastMidi = p.midi;
  }
}
