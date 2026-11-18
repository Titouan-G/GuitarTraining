import Phaser from 'phaser';
import { audio, readChroma } from '../audio/input.js';
import { ChordTracker } from '../audio/chords.js';
import { blip } from '../audio/sfx.js';
import { LEVELS, createProgression } from '../data/chordLevels.js';
import { load, save } from '../store.js';
import { C, text, card, pop, confetti, choiceScreen, resultCard, softShadow } from '../theme.js';

const GROUND = 430;
const PLAYER_X = 170;
const ARM_MS = 100; // expected chord must hold this long: a strum transient alone doesn't count
const JUMP_H = 120;
const HIT_DIST = 50; // blob radius + half block: they touch
const SAND = 0xffe2a8;

// Play the chord shown on the incoming obstacle: once it is heard, the blob jumps over it by itself.
export class ChordRunnerScene extends Phaser.Scene {
  constructor() { super('runner'); }

  create() {
    this.input.keyboard.addCapture('SPACE');
    this.input.keyboard.on('keydown', (e) => this.onKey(e.key));
    this.tracker = new ChordTracker();
    this.showSelect();
  }

  // Only the chosen level's chords fall; speed still rises during the run.
  showSelect() {
    this.mode = 'select';
    this.tweens.killAll();
    this.time.removeAllEvents();
    this.children.removeAll(true);
    choiceScreen(this, {
      title: 'Chord Runner',
      subtitle: 'Joue l\'accord affiché avant que l\'obstacle arrive : le blob saute tout seul',
      items: LEVELS.map((l, i) => ({ label: l.name, sub: l.chords.join('   '), right: `record ${load(`runnerBest${i}`, 0)}`, onClick: () => this.start(i) })),
      onBack: () => this.scene.start('menu'),
    });
  }

  onKey(key) {
    if (key.toLowerCase() === 'q') return this.mode === 'select' ? this.scene.start('menu') : this.showSelect();
    if (this.mode === 'select' && LEVELS[Number(key) - 1]) this.start(Number(key) - 1);
    else if (this.mode === 'play' && key === ' ' && this.over) this.start(this.level);
  }

  start(level) {
    if (!audio.analyser) return this.scene.start('menu');
    this.mode = 'play';
    this.level = level;
    this.tweens.killAll();
    this.time.removeAllEvents();
    this.children.removeAll(true);
    this.drawDecor();
    this.makeBlob();
    this.makeObstacle();

    const { width: w } = this.scale;
    card(this, w / 2 - 150, 18, 300, 112);
    this.target = text(this, w / 2, 64, '', 60, C.ink, 700).setOrigin(0.5);
    this.nextText = text(this, w / 2, 110, '', 17, C.ink, 500).setOrigin(0.5).setAlpha(0.55);
    text(this, 24, 22, `Niveau ${level + 1} · ${LEVELS[level].name}`, 18, C.ink, 600).setAlpha(0.7);
    this.scoreText = text(this, w - 24, 16, '', 30, C.ink, 700).setOrigin(1, 0);
    this.bestText = text(this, w - 24, 54, '', 16, C.ink, 500).setOrigin(1, 0).setAlpha(0.6);
    this.heard = text(this, 24, 504, '', 18, C.ink, 600).setAlpha(0.7);

    this.best = load(`runnerBest${level}`, 0);
    Object.assign(this, { score: 0, speed: 220, over: false, jumping: false, queue: [] });
    this.nextChord = createProgression(LEVELS[level].chords);
    this.spawn();
  }

  drawDecor() {
    const { width: w, height: h } = this.scale;
    this.add.circle(w - 150, 185, 84, C.yellow, 0.25);
    this.add.circle(w - 150, 185, 58, C.yellow, 0.9);
    // Parallax layers: [objects, speed factor, wrap span]
    const hills = (r, y, alpha, gap) => Array.from({ length: Math.ceil(w / gap) + 2 }, (_, i) => this.add.circle(i * gap, y, r, C.green, alpha));
    const clouds = [0, 1, 2].map((i) => this.add.container(150 + i * 330, 70 + (i % 2) * 50, [
      this.add.ellipse(0, 0, 90, 34, C.white), this.add.ellipse(-26, -12, 46, 36, C.white), this.add.ellipse(20, -16, 54, 40, C.white),
    ]).setAlpha(0.9));
    this.add.rectangle(w / 2, (GROUND + h) / 2, w, h - GROUND, SAND);
    this.add.rectangle(w / 2, GROUND + 5, w, 10, C.green);
    const stripes = Array.from({ length: Math.ceil(w / 90) + 1 }, (_, i) => this.add.rectangle(i * 90, GROUND + 44, 42, 10, C.yellow));
    this.layers = [[clouds, 0.05, 990], [hills(170, GROUND + 110, 0.22, 300), 0.15, null], [hills(110, GROUND + 60, 0.4, 240), 0.3, null], [stripes, 1, null]];
    for (const l of this.layers) l[2] ??= l[0].length * (l[0][1].x - l[0][0].x);
    // Hills sit behind the ground, which was drawn after them.
    this.layers[1][0].concat(this.layers[2][0]).forEach((o) => o.setDepth(-1));
  }

  makeBlob() {
    const body = this.add.ellipse(0, -27, 62, 54, C.blue);
    const shine = this.add.ellipse(-12, -40, 16, 10, C.white, 0.45);
    const cheeks = [-21, 21].map((dx) => this.add.circle(dx, -20, 5, C.red, 0.45));
    this.eyes = [-11, 11].map((dx) => this.add.container(dx, -34, [this.add.ellipse(0, 0, 16, 19, C.white), this.add.circle(2, 2, 4.5, C.ink)]));
    this.blobInner = this.add.container(0, 0, [body, shine, ...cheeks, ...this.eyes]);
    this.blob = this.add.container(PLAYER_X, GROUND, [this.blobInner]); // origin at the feet: squash keeps them on the ground
    this.tweens.add({ targets: this.blobInner, y: -4, duration: 140, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }); // running bob
    this.time.addEvent({ delay: 2600, loop: true, callback: () => !this.over && this.tweens.add({ targets: this.eyes, scaleY: 0.1, duration: 70, yoyo: true }) });
  }

  makeObstacle() {
    this.block = this.add.graphics();
    this.bubble = this.add.graphics();
    this.obstacleLabel = text(this, 0, -92, '', 22, C.ink, 700).setOrigin(0.5);
    this.obstacle = this.add.container(0, GROUND, [this.block, this.bubble, this.obstacleLabel]);
  }

  drawBlock(color) {
    softShadow(this.block.clear(), -22, -60, 44, 60, 12)
      .fillStyle(color, 1).fillRoundedRect(-22, -60, 44, 60, 12)
      .fillStyle(C.white, 0.3).fillRoundedRect(-14, -52, 8, 34, 4);
  }

  spawn() {
    // Two in the queue so the next chord can be shown in advance.
    while (this.queue.length < 2) this.queue.push(this.nextChord());
    this.chordName = this.queue[0];
    this.armed = false;
    this.armSince = null;
    this.obstacle.x = this.scale.width + 60;
    this.drawBlock(C.red);
    this.obstacleLabel.setText(this.chordName);
    const bw = this.obstacleLabel.width + 28;
    softShadow(this.bubble.clear(), -bw / 2, -110, bw, 34, 17).fillStyle(C.white, 1).fillRoundedRect(-bw / 2, -110, bw, 34, 17);
    pop(this, this.target.setText(this.chordName).setColor('#2a2a40'));
    this.nextText.setText(`ensuite : ${this.queue[1]}`);
  }

  update(time, delta) {
    if (this.mode !== 'play') return;
    if (!audio.analyser) { this.scene.start('menu'); return; }
    const heard = this.tracker.push(readChroma(), time);
    this.heard.setText(`tu joues : ${heard?.name ?? '–'}`);
    this.scoreText.setText(`score ${this.score}`);
    this.bestText.setText(`record ${this.best}`);
    if (this.over) return;

    const step = (this.speed * delta) / 1000;
    for (const [objs, factor, span] of this.layers) {
      for (const o of objs) { o.x -= step * factor; if (o.x < -200) o.x += span; }
    }
    this.obstacle.x -= step;

    if (!this.armed) {
      const ok = this.tracker.isPlaying(this.chordName);
      this.armSince = ok ? (this.armSince ?? time) : null;
      if (ok && time - this.armSince >= ARM_MS) {
        this.armed = true;
        this.drawBlock(C.green);
        pop(this, this.target.setColor('#2fae4a'), 1.3);
        blip(880);
      }
    }

    const dist = this.obstacle.x - PLAYER_X;
    if (this.armed && !this.jumping && dist <= this.speed * 0.32 + 10) this.jump();
    if (!this.armed && dist <= HIT_DIST) this.crash();
    if (dist < -70) this.clear();
  }

  jump() {
    this.jumping = true;
    // Stretch on take-off, squash on landing; the jump itself lasts 0.62 s whatever the speed.
    this.blob.setScale(0.85, 1.2);
    this.tweens.add({ targets: this.blob, scaleX: 1, scaleY: 1, duration: 220 });
    this.tweens.add({
      targets: this.blob, y: GROUND - JUMP_H, duration: 310, ease: 'Quad.easeOut', yoyo: true,
      onComplete: () => {
        this.jumping = false;
        this.blob.setScale(1.25, 0.78);
        this.tweens.add({ targets: this.blob, scaleX: 1, scaleY: 1, duration: 260, ease: 'Back.easeOut' });
      },
    });
  }

  clear() {
    this.score++;
    this.speed = Math.min(600, this.speed * 1.04);
    confetti(this, PLAYER_X + 30, GROUND - 70, 14);
    pop(this, this.scoreText, 1.4);
    this.queue.shift();
    this.spawn();
  }

  crash() {
    this.over = true;
    this.tweens.killTweensOf([this.blob, this.blobInner]);
    this.blob.setScale(1.35, 0.6).setAngle(-8);
    this.eyes.forEach((e) => e.setScale(1, 0.15));
    this.cameras.main.shake(250, 0.01);
    this.cameras.main.flash(200, 255, 90, 78);
    blip(110, 400, 'sawtooth');
    const record = this.score > this.best;
    if (record) { this.best = this.score; save(`runnerBest${this.level}`, this.best); }
    this.drawBlock(C.red);
    this.target.setColor('#ff5a4e');
    this.time.delayedCall(450, () => this.over && this.mode === 'play' && resultCard(this, {
      title: `Raté : ${this.chordName}`,
      big: `${this.score}`,
      color: record ? C.green : C.ink,
      lines: [record && this.score > 0 ? 'Nouveau record !' : `record ${this.best}`, `niveau ${this.level + 1} · ${LEVELS[this.level].name}`],
      party: record && this.score > 0,
      actions: [{ label: 'Rejouer', color: C.green, onClick: () => this.start(this.level) }, { label: 'Niveaux', color: C.blue, onClick: () => this.showSelect() }],
      hint: 'Espace : rejouer · Q : niveaux',
    }));
  }
}
