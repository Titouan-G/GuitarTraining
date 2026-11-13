import Phaser from 'phaser';

// "Plein soleil" palette: cream background, frank colours, dark ink text.
export const C = {
  bg: 0xfff4e0,
  red: 0xff5a4e,
  blue: 0x3da5ff,
  yellow: 0xffc93c,
  green: 0x4cd964,
  ink: 0x2a2a40,
  white: 0xffffff,
};
export const FUN = [C.red, C.blue, C.yellow, C.green];
export const css = (n) => `#${n.toString(16).padStart(6, '0')}`;
const FONT = 'Fredoka, "Arial Rounded MT Bold", sans-serif';
// Text on yellow stays ink, white elsewhere: white on yellow is unreadable.
export const onColor = (color) => (color === C.yellow ? C.ink : C.white);

export function text(scene, x, y, str, size = 20, color = C.ink, weight = 600) {
  return scene.add.text(x, y, str, {
    fontFamily: FONT,
    fontSize: `${size}px`,
    fontStyle: String(weight),
    color: css(color),
    resolution: window.devicePixelRatio || 1, // crisp text on Retina screens
  });
}

// Soft 3 px drop shadow under a rounded rect: faint growing layers fake a blur (Graphics has none).
export function softShadow(g, x, y, w, h, radius) {
  for (const grow of [3, 2, 1]) {
    g.fillStyle(C.ink, 0.025).fillRoundedRect(x - grow, y + 3 - grow, w + 2 * grow, h + 2 * grow, Math.min(radius + grow, h / 2 + grow));
  }
  return g;
}

// Title-style text: a soft yellow glow under the letters.
export const shadowTitle = (t, y = 3) => t.setShadow(0, y, '#ffc93c', 2, false, true);

// Rounded card with a soft shadow, drawn at (x, y) = top-left.
export function card(scene, x, y, w, h, color = C.white, radius = 24) {
  const g = softShadow(scene.add.graphics(), x, y, w, h, radius);
  g.fillStyle(color, 1).fillRoundedRect(x, y, w, h, radius);
  return g;
}

// Pill button centred on (x, y): grows on hover, squashes on click, then runs onClick.
export function button(scene, x, y, label, color, onClick, { w = 260, h = 70, size = 26, badge = null } = {}) {
  const g = softShadow(scene.add.graphics(), -w / 2, -h / 2, w, h, h / 2);
  g.fillStyle(color, 1).fillRoundedRect(-w / 2, -h / 2, w, h, h / 2);
  const parts = [g, text(scene, badge ? h / 4 : 0, 0, label, size, onColor(color), 700).setOrigin(0.5)];
  if (badge) {
    const bx = -w / 2 + h / 2;
    parts.push(scene.add.circle(bx, 0, h / 2 - 10, C.white), text(scene, bx, 0, badge, size, color === C.yellow ? C.ink : color, 700).setOrigin(0.5));
  }
  const b = scene.add.container(x, y, parts).setSize(w, h).setInteractive({ useHandCursor: true });
  const to = (scale, duration = 160) => scene.tweens.add({ targets: b, scale, duration, ease: 'Back.easeOut' });
  b.on('pointerover', () => to(1.06));
  b.on('pointerout', () => to(1));
  b.on('pointerdown', () => { b.setScale(0.92); to(1, 260); onClick(); });
  return b;
}

// Bouncy entrance: the object pops from small to its normal size.
export function pop(scene, target, from = 0.5) {
  scene.tweens.killTweensOf(target);
  target.setScale(from);
  scene.tweens.add({ targets: target, scale: 1, duration: 420, ease: 'Back.easeOut' });
  return target;
}

// Short left-right wobble, for "no" feedback.
export function wobble(scene, target) {
  scene.tweens.add({ targets: target, angle: { from: -6, to: 6 }, duration: 60, yoyo: true, repeat: 3, onComplete: () => target.setAngle(0) });
}

// Burst of colourful confetti from (x, y).
export function confetti(scene, x, y, count = 40) {
  if (!scene.textures.exists('confetti')) {
    scene.make.graphics({ add: false }).fillStyle(C.white).fillRect(0, 0, 10, 6).generateTexture('confetti', 10, 6).destroy();
  }
  const e = scene.add.particles(0, 0, 'confetti', {
    speed: { min: 250, max: 550 },
    angle: { min: 200, max: 340 },
    gravityY: 700,
    lifespan: 1700,
    rotate: { start: 0, end: 720 },
    tint: FUN,
    emitting: false,
  }).setDepth(100);
  e.explode(count, x, y);
  scene.time.delayedCall(1900, () => e.destroy());
}

// Two music staves gently waving behind everything, with a few notes (some beamed in pairs) on them.
const STAVES = [44, 468]; // y of each top line
const GAP = 11; // between staff lines
// [staff, x, height in half-gaps from the top line (0..8), beamed to the next note]
const BG_NOTES = [
  [0, 60, 5], [0, 175, 3, true], [0, 230, 1], [0, 760, 6], [0, 835, 2, true], [0, 890, 4], // none behind the centred titles
  [1, 45, 4], [1, 140, 2], [1, 270, 6, true], [1, 325, 4], [1, 470, 1], [1, 610, 5], [1, 720, 3, true], [1, 775, 0], [1, 910, 6],
];
const wave = (x, t, staff) => Math.sin(x / 140 + t * 0.7 + staff * 2) * 7;

export function background(scene) {
  const { width: w } = scene.scale;
  const g = scene.add.graphics().setDepth(-10);
  const draw = (time) => {
    const t = time / 1000;
    g.clear();
    STAVES.forEach((y0, staff) => {
      g.lineStyle(2, C.ink, 0.07);
      for (let l = 0; l < 5; l++) {
        g.beginPath().moveTo(-10, y0 + l * GAP + wave(-10, t, staff));
        for (let x = 10; x <= w + 10; x += 20) g.lineTo(x, y0 + l * GAP + wave(x, t, staff));
        g.strokePath();
      }
    });
    const stemTop = ([staff, x, pos]) => [x + 6.5, STAVES[staff] + (pos * GAP) / 2 + wave(x, t, staff) - 34];
    BG_NOTES.forEach((n, i) => {
      const [staff, x, pos, beamed] = n;
      const color = FUN[i % FUN.length];
      const y = STAVES[staff] + (pos * GAP) / 2 + wave(x, t, staff);
      const [sx, sy] = stemTop(n);
      g.fillStyle(color, 0.4).fillEllipse(x, y, 15, 11);
      g.lineStyle(2, color, 0.4).lineBetween(sx, y, sx, sy);
      if (beamed) g.lineStyle(5, color, 0.4).lineBetween(sx, sy, ...stemTop(BG_NOTES[i + 1]));
    });
  };
  draw(0);
  scene.events.on('update', draw);
  g.once('destroy', () => scene.events.off('update', draw)); // screens are rebuilt often: don't leak the listener
}

// Level / exercise list shared by the games: title, one pill per item (badge = its key), a line under each, back button.
// shortcut: fits 5 items (+ their sub-line) in 540 px, more need a scrolling list.
export function choiceScreen(scene, { title, subtitle = '', items, onBack }) {
  const { width: w } = scene.scale;
  background(scene);
  shadowTitle(text(scene, w / 2, 46, title, 44, C.ink, 700).setOrigin(0.5));
  if (subtitle) text(scene, w / 2, 88, subtitle, 16, C.ink, 500).setOrigin(0.5).setAlpha(0.6);
  button(scene, 92, 46, 'Menu', C.ink, onBack, { w: 140, h: 46, size: 18, badge: 'Q' });
  const step = Math.min(86, 340 / Math.max(1, items.length - 1));
  items.forEach((it, i) => {
    const y = 136 + i * step;
    button(scene, 400, y, it.label, it.color ?? FUN[i % FUN.length], it.onClick, { w: 540, h: 58, size: 22, badge: String(i + 1) });
    if (it.right) text(scene, 700, y, it.right, 18, C.ink, 600).setOrigin(0, 0.5).setAlpha(0.75);
    if (it.sub) text(scene, 400, y + 38, it.sub, 14, C.ink, 500).setOrigin(0.5).setAlpha(0.55);
  });
}

// End-of-run card: small title, big result, detail lines, action buttons; confetti when it's worth celebrating.
export function resultCard(scene, { title, big, color = C.ink, lines = [], party = false, actions = [], hint = '' }) {
  const { width: w } = scene.scale;
  card(scene, w / 2 - 310, 60, 620, 410);
  text(scene, w / 2, 100, title, 24, C.ink, 600).setOrigin(0.5).setAlpha(0.7);
  pop(scene, text(scene, w / 2, 168, big, 64, color, 700).setOrigin(0.5));
  lines.forEach((l, i) => text(scene, w / 2, 236 + i * 32, l, 20, C.ink, 500).setOrigin(0.5));
  actions.forEach((a, i) => button(scene, w / 2 + (i - (actions.length - 1) / 2) * 250, 398, a.label, a.color, a.onClick, { w: 230, h: 58, size: 20 }));
  if (hint) text(scene, w / 2, 448, hint, 14, C.ink, 500).setOrigin(0.5).setAlpha(0.55);
  if (party) {
    confetti(scene, w / 2, 170, 70);
    scene.time.delayedCall(250, () => confetti(scene, w / 2 - 220, 220, 40));
    scene.time.delayedCall(450, () => confetti(scene, w / 2 + 220, 220, 40));
  }
}
