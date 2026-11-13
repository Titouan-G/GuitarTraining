import Phaser from 'phaser';
import { audio } from '../audio/input.js';
import { createPitchReader, noteName } from '../audio/pitch.js';
import { blip } from '../audio/sfx.js';
import { INTERVALS, INTERVAL_LEVELS, label, pc, question } from '../data/intervals.js';
import { load, save } from '../store.js';
import { C, text, card, pop, wobble, confetti, background, choiceScreen, resultCard } from '../theme.js';

const QUESTIONS = 10;
const STABLE_MS = 120; // a note counts once held this long: pick noise and slides don't count as wrong notes
const PENALTY_S = 3; // seconds added per wrong note in the score
const LOW = 40; // E2, lowest guitar note
const HIGH = 88; // E6, 24th fret of the high e
const STEP_BG = { todo: 0xf3ead8, done: C.green, wrong: C.red, warn: C.yellow };

// "Tierce mineure ↑ de Sol": play a Sol anywhere, then the note at that interval from THAT Sol.
export class IntervalsScene extends Phaser.Scene {
  constructor() { super('intervals'); }

  create() {
    this.input.keyboard.addCapture('SPACE');
    this.input.keyboard.on('keydown', (e) => this.onKey(e.key));
    this.showSelect();
  }

  showSelect() {
    this.mode = 'select';
    this.tweens.killAll();
    this.time.removeAllEvents();
    this.children.removeAll(true);
    choiceScreen(this, {
      title: 'Intervalles',
      subtitle: `Joue la note de départ, puis l'intervalle à partir de cette note · ${QUESTIONS} questions, +${PENALTY_S} s par fausse note`,
      items: INTERVAL_LEVELS.map((L, i) => {
        const best = load(`intervalsBest${i}`, null);
        return { label: L.name, sub: L.intervals.join('  ') + (L.down ? '   ·   montants et descendants' : ''), right: best ? `record ${best.toFixed(1)} s` : '', onClick: () => this.start(i) };
      }),
      onBack: () => this.scene.start('menu'),
    });
  }

  onKey(key) {
    if (key.toLowerCase() === 'q') return this.mode === 'select' ? this.scene.start('menu') : this.showSelect();
    if (this.mode === 'result' && key === ' ') return this.showSelect();
    const i = Number(key) - 1;
    if (this.mode === 'select' && INTERVAL_LEVELS[i]) this.start(i);
  }

  start(level) {
    if (!audio.analyser) return this.scene.start('menu');
    this.mode = 'play';
    this.tweens.killAll();
    this.time.removeAllEvents();
    this.children.removeAll(true);
    Object.assign(this, { level, count: 0, errors: 0, q: null, t0: audio.ctx.currentTime });
    this.reader = createPitchReader(audio.analyser, audio.ctx.sampleRate);
    // A note still ringing when the series starts (last answer, Rejouer) must not count as a wrong note.
    const ringing = this.reader()?.midi ?? null;
    Object.assign(this, { cand: ringing, candSince: 0, stable: ringing });

    const w = this.scale.width;
    background(this);
    this.dots = Array.from({ length: QUESTIONS }, (_, i) => this.add.circle(w / 2 + (i - (QUESTIONS - 1) / 2) * 28, 36, 9, C.ink, 0.12));
    text(this, 24, 22, `Niveau ${level + 1}`, 18, C.ink, 600).setAlpha(0.7);
    this.clock = text(this, w - 24, 16, '', 28, C.ink, 700).setOrigin(1, 0);
    this.errorText = text(this, w - 24, 52, '', 17, C.red, 600).setOrigin(1, 0);
    card(this, 160, 72, 640, 370);
    this.title = text(this, w / 2, 130, '', 44, C.ink, 700).setOrigin(0.5);
    this.from = text(this, w / 2, 182, '', 28, C.ink, 600).setOrigin(0.5).setAlpha(0.7);
    this.steps = [250, 308].map((y) => ({ g: this.add.graphics(), t: text(this, w / 2, y, '', 22, C.ink, 600).setOrigin(0.5) }));
    this.answer = text(this, w / 2, 385, '', 52, C.ink, 700).setOrigin(0.5).setColor('#2fae4a');
    this.heard = text(this, 24, 504, '', 18, C.ink, 600).setAlpha(0.7);
    this.next();
  }

  // Coloured pill behind a step line: todo / done / wrong / warn, or hidden when str is empty.
  setStep(i, str, state = 'todo') {
    const { g, t } = this.steps[i];
    t.setText(str).setColor(state === 'done' || state === 'wrong' ? '#ffffff' : '#2a2a40');
    g.clear();
    if (!str) return t;
    const pw = t.width + 44;
    g.fillStyle(STEP_BG[state], 1).fillRoundedRect(t.x - pw / 2, t.y - 22, pw, 44, 22);
    return t;
  }

  next() {
    if (this.count === QUESTIONS) return this.showResult();
    this.dots.forEach((d, i) => (i < this.count ? d.setFillStyle(C.green, 1) : i === this.count ? d.setFillStyle(C.yellow, 1) : d.setFillStyle(C.ink, 0.12)));
    if (this.dots[this.count]) pop(this, this.dots[this.count], 0.3);
    this.count++;
    this.q = question(this.level, this.q);
    this.root = null; // MIDI of the start note actually played
    const iv = INTERVALS[this.q.interval];
    pop(this, this.title.setText(`${iv.name} ${this.q.dir > 0 ? '↑' : '↓'}`), 0.7);
    this.from.setText(`${this.q.dir > 0 ? 'au-dessus' : 'en dessous'} de ${label(this.q.start)}`);
    this.setStep(0, `1. joue un ${label(this.q.start)}`);
    this.setStep(1, '');
    this.answer.setText('');
  }

  // Returns a note the moment it has been held STABLE_MS (once per note), else null.
  readStable(time) {
    const p = this.reader();
    this.heard.setText(`tu joues : ${p ? `${p.solfege} (${p.name})` : '–'}`);
    const midi = p?.midi ?? null;
    if (midi !== this.cand) { this.cand = midi; this.candSince = time; }
    if (time - this.candSince < STABLE_MS || this.cand === this.stable) return null;
    this.stable = this.cand; // silence also becomes "stable", so the same note can be played again after it
    return this.stable;
  }

  update(time) {
    if (this.mode !== 'play') return;
    if (!audio.analyser) return this.scene.start('menu');
    this.clock.setText(`${(audio.ctx.currentTime - this.t0).toFixed(1)} s`);
    this.errorText.setText(this.errors ? `✗ ${this.errors} fausse${this.errors > 1 ? 's' : ''} note${this.errors > 1 ? 's' : ''}` : '');
    const midi = this.readStable(time);
    if (midi === null || this.answer.text) return; // nothing new, or showing the answer before the next question

    const semis = this.q.dir * INTERVALS[this.q.interval].semis;
    if (this.root === null) {
      if (midi % 12 !== pc(this.q.start)) return this.wrong(0, `${noteName(midi)} n'est pas un ${label(this.q.start)}`);
      const t = midi + semis;
      if (t < LOW || t > HIGH) return wobble(this, this.setStep(0, `trop ${t < LOW ? 'grave' : 'aigu'} : joue un ${label(this.q.start)} ${t < LOW ? 'plus haut' : 'plus bas'}`, 'warn'));
      this.root = midi;
      pop(this, this.setStep(0, `1. ${label(this.q.start)} ✓  (${noteName(midi)})`, 'done'), 0.8);
      pop(this, this.setStep(1, `2. joue la note ${this.q.dir > 0 ? 'au-dessus' : 'en dessous'}`), 0.8);
      blip(660, 60);
    } else if (midi === this.root + semis) {
      pop(this, this.setStep(1, `2. ✓  (${noteName(midi)})`, 'done'), 0.8);
      pop(this, this.answer.setText(`= ${label(this.q.answer)}`), 0.4);
      confetti(this, this.scale.width / 2, 380, 18);
      blip(990, 120, 'triangle');
      this.time.delayedCall(900, () => this.mode === 'play' && this.next());
    } else if (midi % 12 !== this.root % 12) { // the start note still ringing is not a mistake
      this.wrong(1, midi % 12 === (this.root + semis) % 12 ? 'bonne note, mauvaise octave' : `${noteName(midi)} : non`);
    }
  }

  wrong(step, msg) {
    this.errors++;
    wobble(this, this.setStep(step, msg, 'wrong'));
    this.cameras.main.shake(120, 0.004);
    blip(150, 150, 'sawtooth');
  }

  showResult() {
    this.mode = 'result';
    const time = audio.ctx.currentTime - this.t0;
    const score = time + this.errors * PENALTY_S;
    const key = `intervalsBest${this.level}`;
    const best = load(key, null);
    const record = best === null || score < best;
    if (record) save(key, score);
    this.tweens.killAll();
    this.children.removeAll(true);
    background(this);
    resultCard(this, {
      title: `Intervalles · niveau ${this.level + 1}`,
      big: `${score.toFixed(1)} s`,
      color: record ? C.green : C.ink,
      lines: [`temps ${time.toFixed(1)} s + ${this.errors} fausse(s) note(s) × ${PENALTY_S} s`, record ? 'Nouveau record !' : `record ${best.toFixed(1)} s`],
      party: record,
      actions: [{ label: 'Rejouer', color: C.green, onClick: () => this.start(this.level) }, { label: 'Niveaux', color: C.blue, onClick: () => this.showSelect() }],
      hint: 'Espace ou Q : retour aux niveaux',
    });
  }
}
