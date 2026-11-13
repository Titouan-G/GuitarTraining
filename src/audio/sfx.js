import { audio } from './input.js';

// Short game beep through the default output (the guitar sound itself stays in Blobnarok).
// at: AudioContext time, to schedule ahead (metronome) instead of "now".
export function blip(freq, ms = 90, type = 'square', at = audio.ctx?.currentTime) {
  const ctx = audio.ctx;
  if (!ctx) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  const end = at + ms / 1000;
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(0.08, at);
  g.gain.exponentialRampToValueAtTime(0.001, end);
  o.connect(g).connect(ctx.destination);
  o.start(at);
  o.stop(end);
}
