import Phaser from 'phaser';
import { audio } from '../audio/input.js';
import { createPitchReader } from '../audio/pitch.js';
import { blip } from '../audio/sfx.js';
import { validateTab, findHit, grade, WINDOW } from '../data/tabs.js';
import { load, save } from '../store.js';
import { C, FUN, onColor, text, card, pop, confetti, background, choiceScreen, resultCard, shadowTitle } from '../theme.js';

// Every JSON dropped in src/data/tabs/ shows up in the list, sorted by file name.
const files = import.meta.glob('../data/tabs/*.json', { eager: true, import: 'default' });
const TABS = Object.keys(files).sort().map((path) => ({ file: path.split('/').pop(), tab: files[path], errors: validateTab(files[path]) }));

const HIT_X = 180;
const PX_PER_BEAT = 140;
const COUNT_IN = 4;
const lineY = (string) => 150 + (string - 1) * 46; // string 1 (high e) on top, like a written tab
const STRING_COLOR = (string) => FUN[(string - 1) % FUN.length];
const FEEDBACK = { perfect: ['Parfait !', '#2fae4a'], good: ['Bien', '#3da5ff'], miss: ['Raté', '#ff5a4e'] };

// A tab scrolls to the hit line; each note is judged on pitch + timing (latency compensated).
export class TabHeroScene extends Phaser.Scene {
  constructor() { super('tabhero'); }

  create() {
    this.latency = load('tabLatencyMs', 50); // guitar -> detection delay, measured at the end of a run
    this.tempo = load('tabTempo', 100); // % of the written bpm
    this.metronome = load('tabMetronome', true);
    this.input.keyboard.addCapture('UP,DOWN,LEFT,RIGHT,SPACE');
    this.input.keyboard.on('keydown', (e) => this.onKey(e.key));
    this.showSelect();
  }

  showSelect() {
    this.mode = 'select';
    this.tweens.killAll();
    this.children.removeAll(true);
    choiceScreen(this, {
      title: 'Tab Hero',
      subtitle: 'Joue chaque note quand elle passe sur la bande jaune',
      items: TABS.map(({ file, tab, errors }, i) => (errors.length
        ? { label: file, sub: `fichier invalide : ${errors[0]}`, color: C.red, onClick: () => {} }
        : { label: tab.title, sub: `${tab.bpm} bpm · ${tab.notes.length} notes`, onClick: () => this.start(i) })),
      onBack: () => this.scene.start('menu'),
    });
    card(this, 110, 470, 740, 46, C.white, 23);
    this.settings = text(this, 480, 493, '', 17, C.ink, 600).setOrigin(0.5);
    this.refreshSettings();
  }

  refreshSettings() {
    this.settings.setText(`Tempo ${this.tempo} % (↑↓)   ·   Latence ${this.latency} ms (←→)   ·   Métronome ${this.metronome ? 'oui' : 'non'} (M)`);
    save('tabLatencyMs', this.latency);
    save('tabTempo', this.tempo);
    save('tabMetronome', this.metronome);
  }

  onKey(key) {
    if (key.toLowerCase() === 'q') return this.mode === 'select' ? this.scene.start('menu') : this.showSelect();
    if (this.mode === 'result') {
      if (key.toLowerCase() === 'c' && this.suggested != null) this.applyLatency();
      if (key === ' ') this.showSelect();
      return;
    }
    if (this.mode !== 'select') return;
    const i = Number(key) - 1;
    if (TABS[i] && !TABS[i].errors.length) return this.start(i);
    if (key === 'ArrowUp') this.tempo = Math.min(150, this.tempo + 5);
    else if (key === 'ArrowDown') this.tempo = Math.max(40, this.tempo - 5);
    else if (key === 'ArrowRight') this.latency = Math.min(300, this.latency + 10);
    else if (key === 'ArrowLeft') this.latency = Math.max(0, this.latency - 10);
    else if (key.toLowerCase() === 'm') this.metronome = !this.metronome;
    else return;
    this.refreshSettings();
    pop(this, this.settings, 0.9);
  }

  applyLatency() {
    this.latency = this.suggested;
    this.showSelect();
  }

  start(i) {
    if (!audio.analyser) return this.scene.start('menu');
    this.mode = 'play';
    this.tweens.killAll();
    this.children.removeAll(true);
    const { tab } = TABS[i];
    this.tab = tab;
    this.spb = 60 / ((tab.bpm * this.tempo) / 100);
    this.notes = tab.notes.map((n, idx) => ({ ...n, idx })); // fresh copy: judging writes n.result
    this.start0 = audio.ctx.currentTime + 0.2 + COUNT_IN * this.spb; // AudioContext time of beat 0
    this.nextClick = -COUNT_IN;
    this.reader = createPitchReader(audio.analyser, audio.ctx.sampleRate);
    this.lastMidi = this.lastCount = null;
    Object.assign(this, { combo: 0, maxCombo: 0, counts: { perfect: 0, good: 0, miss: 0 }, diffs: [] });

    const w = this.scale.width;
    card(this, 20, 112, w - 40, 316);
    this.add.rectangle(HIT_X, lineY(3.5), 56, 290, C.yellow, 0.35);
    ['e', 'B', 'G', 'D', 'A', 'E'].forEach((name, s) => {
      const color = STRING_COLOR(s + 1);
      this.add.rectangle(w / 2 + 30, lineY(s + 1), w - 100, 2 + s * 0.8, color, 0.75);
      this.add.circle(44, lineY(s + 1), 14, color);
      text(this, 44, lineY(s + 1), name, 16, onColor(color), 700).setOrigin(0.5);
    });
    this.add.rectangle(HIT_X, lineY(3.5), 4, 290, C.ink, 0.6);
    this.noteObjs = this.notes.map((n) => {
      const color = STRING_COLOR(n.string);
      return [
        this.add.circle(0, lineY(n.string), 17, color).setStrokeStyle(3, C.white),
        text(this, 0, lineY(n.string), String(n.fret), 16, onColor(color), 700).setOrigin(0.5),
      ];
    });
    text(this, 24, 22, `${tab.title}  ·  ${Math.round((tab.bpm * this.tempo) / 100)} bpm`, 20, C.ink, 600).setAlpha(0.7);
    this.feedback = text(this, HIT_X, 72, '', 30, C.ink, 700).setOrigin(0.5);
    this.comboText = shadowTitle(text(this, w - 24, 16, '', 32, C.ink, 700).setOrigin(1, 0));
    this.countText = shadowTitle(text(this, w / 2 + 60, 270, '', 110, C.ink, 700).setOrigin(0.5), 4);
    this.heardText = text(this, 24, 470, '', 18, C.ink, 600).setAlpha(0.7);
  }

  update() {
    if (this.mode !== 'play') return;
    if (!audio.analyser) return this.scene.start('menu');
    const now = audio.ctx.currentTime;
    const songT = now - this.start0; // seconds since beat 0, negative during the count-in
    const lastBeat = this.notes.at(-1).beat;

    // Clicks are scheduled ~100 ms ahead on the audio clock, so they don't jitter with the frame rate.
    while (this.nextClick <= lastBeat + 1 && this.start0 + this.nextClick * this.spb < now + 0.1) {
      if (this.nextClick < 0 || this.metronome) blip(this.nextClick % 4 === 0 ? 1760 : 1320, 30, 'square', this.start0 + this.nextClick * this.spb);
      this.nextClick++;
    }
    this.updateCount(songT);

    const t = songT - this.latency / 1000; // when the sound detected now was actually played
    const p = this.reader();
    const midi = p?.midi ?? null;
    this.heardText.setText(`tu joues : ${p?.name ?? '–'}`);
    if (midi !== null && midi !== this.lastMidi) { // only a new pitch: a held note can't validate the next notes
      const hit = findHit(this.notes, midi, t, this.spb);
      if (hit) this.judge(hit.note, grade(hit.diff), hit.diff);
    }
    this.lastMidi = midi;
    for (const n of this.notes) {
      if (n.result) continue;
      if (t - n.beat * this.spb > WINDOW.good) this.judge(n, 'miss');
      else break;
    }

    const beat = songT / this.spb; // display follows real time: the note crosses the line when it must be played
    this.notes.forEach((n) => {
      const x = HIT_X + (n.beat - beat) * PX_PER_BEAT;
      const visible = x > 30 && x < this.scale.width - 10;
      for (const o of this.noteObjs[n.idx]) o.setVisible(visible).setX(x);
    });
    if (this.notes.every((n) => n.result) && songT > (lastBeat + 1) * this.spb) this.showResult();
  }

  // Big 4-3-2-1-Go during the count-in.
  updateCount(songT) {
    const n = songT < 0 ? Math.ceil(-songT / this.spb) : songT < this.spb ? 0 : null;
    if (n === this.lastCount) return;
    this.lastCount = n;
    if (n === null) return this.countText.setText('');
    pop(this, this.countText.setText(n === 0 ? 'Go !' : String(n)).setColor(n === 0 ? '#2fae4a' : '#2a2a40'), 1.6);
  }

  judge(n, result, diff) {
    n.result = result;
    this.counts[result]++;
    if (result === 'miss') this.combo = 0;
    else { this.combo++; this.diffs.push(diff); }
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    const [circle, label] = this.noteObjs[n.idx];
    if (result === 'miss') {
      circle.setFillStyle(C.ink, 0.25);
      label.setAlpha(0.4);
    } else {
      // Hit notes burst away from the line.
      this.tweens.add({ targets: [circle, label], scale: 1.8, alpha: 0, duration: 260, ease: 'Quad.easeOut' });
      if (result === 'perfect') confetti(this, HIT_X, lineY(n.string), 8);
    }
    const [msg, color] = FEEDBACK[result];
    pop(this, this.feedback.setText(msg).setColor(color), 0.6);
    this.comboText.setText(this.combo > 1 ? `combo ×${this.combo}` : '');
    if (this.combo > 1) pop(this, this.comboText, 1.25);
  }

  showResult() {
    this.mode = 'result';
    this.tweens.killAll();
    this.children.removeAll(true);
    background(this);
    const { perfect, good, miss } = this.counts;
    const accuracy = Math.round((100 * (perfect + good / 2)) / this.notes.length);
    const meanMs = this.diffs.length ? Math.round((1000 * this.diffs.reduce((a, b) => a + b, 0)) / this.diffs.length) : 0;
    // Mean offset of the hits = latency error (if you played in time). Needs a few hits to mean anything.
    this.suggested = this.diffs.length >= 5 ? Math.max(0, Math.round((this.latency + meanMs) / 5) * 5) : null;
    const canCalibrate = this.suggested != null && this.suggested !== this.latency;
    resultCard(this, {
      title: this.tab.title,
      big: `${accuracy} %`,
      color: accuracy >= 90 ? C.green : C.ink,
      lines: [
        `Parfait ${perfect} · Bien ${good} · Raté ${miss} · combo max ${this.maxCombo}`,
        this.diffs.length ? `décalage moyen ${meanMs > 0 ? '+' : ''}${meanMs} ms (${meanMs > 0 ? 'en retard' : 'en avance'})` : '',
        canCalibrate ? `latence actuelle ${this.latency} ms` : '',
      ].filter(Boolean),
      party: accuracy >= 90,
      actions: [
        ...(canCalibrate ? [{ label: `Latence → ${this.suggested} ms`, color: C.yellow, onClick: () => this.applyLatency() }] : []),
        { label: 'Liste', color: C.blue, onClick: () => this.showSelect() },
      ],
      hint: canCalibrate
        ? 'C : régler la latence (seulement si tu as joué en place, avec le métronome) · Espace / Q : liste'
        : 'Espace ou Q : retour à la liste',
    });
  }
}
