import { chromaFromSpectrum } from './chords.js';
import { load, save } from '../store.js';

// Shared audio state: one AudioContext + analyser on the guitar channel, used by every scene.
export const audio = { ctx: null, analyser: null, chordAnalyser: null, stream: null };


export async function listInputs() {
  // Labels stay empty until the page has mic permission once.
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices.filter((d) => d.kind === 'audioinput');
}

export async function openInput(deviceId, channel) {
  closeInput();
  audio.stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      deviceId: deviceId ? { exact: deviceId } : undefined,
      // Raw DI signal: browser voice processing would wreck pitch detection.
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
      channelCount: { ideal: 2 },
    },
  });
  audio.ctx = new AudioContext({ latencyHint: 'interactive' });
  const source = audio.ctx.createMediaStreamSource(audio.stream);
  const splitter = audio.ctx.createChannelSplitter(2);
  audio.analyser = audio.ctx.createAnalyser();
  audio.analyser.fftSize = 2048;
  // Chords need finer frequency bins than single notes (5.9 Hz at 48 kHz), at the cost of a longer window.
  audio.chordAnalyser = audio.ctx.createAnalyser();
  audio.chordAnalyser.fftSize = 8192;
  audio.chordAnalyser.smoothingTimeConstant = 0.5;
  source.connect(splitter);
  // Not connected to destination: Blobnarok plays the sound.
  splitter.connect(audio.analyser, Number(channel));
  splitter.connect(audio.chordAnalyser, Number(channel));
  save('deviceId', deviceId ?? '');
  save('channel', String(channel));
}

export function closeInput() {
  audio.stream?.getTracks().forEach((t) => t.stop());
  audio.ctx?.close();
  audio.ctx = audio.analyser = audio.chordAnalyser = audio.stream = null;
}

// Values saved before store.js were raw strings: JSON.parse fails, load falls back and the input is picked again once.
export const savedInput = () => ({ deviceId: load('deviceId', null), channel: load('channel', '0') });

let spectrum = null;
// Current chroma of the guitar channel (or null when silent / audio off), for any scene doing chord detection.
export function readChroma() {
  if (!audio.chordAnalyser) return null;
  if (spectrum?.length !== audio.chordAnalyser.frequencyBinCount) spectrum = new Float32Array(audio.chordAnalyser.frequencyBinCount);
  audio.chordAnalyser.getFloatFrequencyData(spectrum);
  return chromaFromSpectrum(spectrum, audio.ctx.sampleRate);
}
