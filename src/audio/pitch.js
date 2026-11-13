import { PitchDetector } from 'pitchy';

export const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const SOLFEGE = ['Do', 'Do#', 'Ré', 'Ré#', 'Mi', 'Fa', 'Fa#', 'Sol', 'Sol#', 'La', 'La#', 'Si'];

export const freqToMidi = (f) => 69 + 12 * Math.log2(f / 440);
export const noteName = (midi) => NAMES[midi % 12] + (Math.floor(midi / 12) - 1);
export const solfege = (midi) => SOLFEGE[midi % 12];

// Returns a function reading the current note from the analyser, or null when silent / unclear.
export function createPitchReader(analyser, sampleRate) {
  const buf = new Float32Array(analyser.fftSize);
  const detector = PitchDetector.forFloat32Array(buf.length);
  detector.minVolumeDecibels = -50;
  return () => {
    analyser.getFloatTimeDomainData(buf);
    const [freq, clarity] = detector.findPitch(buf, sampleRate);
    // Guitar range E2 (82 Hz) .. ~E6, 24 frets on high E.
    if (clarity < 0.9 || freq < 70 || freq > 1400) return null;
    const exact = freqToMidi(freq);
    const midi = Math.round(exact);
    return { freq, clarity, midi, name: noteName(midi), solfege: solfege(midi), cents: Math.round((exact - midi) * 100) };
  };
}
