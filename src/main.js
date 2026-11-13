import Phaser from 'phaser';
import { audio, listInputs, openInput, savedInput } from './audio/input.js';
import { MenuScene } from './scenes/MenuScene.js';
import { ChordRunnerScene } from './scenes/ChordRunnerScene.js';
import { TabHeroScene } from './scenes/TabHeroScene.js';
import { IntervalsScene } from './scenes/IntervalsScene.js';
import { css, C } from './theme.js';
import '@fontsource/fredoka/400.css';
import '@fontsource/fredoka/600.css';
import '@fontsource/fredoka/700.css';

// Canvas text is drawn once: start Phaser only when Fredoka is ready, or titles stay in the fallback font.
Promise.all([400, 600, 700].map((w) => document.fonts.load(`${w} 20px Fredoka`))).catch(() => {}).finally(() => {
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    width: 960,
    height: 540,
    backgroundColor: css(C.bg),
    scene: [MenuScene, ChordRunnerScene, TabHeroScene, IntervalsScene],
  });
  if (import.meta.env.DEV) window.game = game; // console debugging only
});

const $ = (id) => document.getElementById(id);
const saved = savedInput();
$('channel').value = saved.channel;

async function fillDevices() {
  const inputs = await listInputs();
  $('device').innerHTML = inputs.map((d) => `<option value="${d.deviceId}">${d.label || 'Entrée ' + d.deviceId.slice(0, 6)}</option>`).join('');
  if (inputs.some((d) => d.deviceId === saved.deviceId)) $('device').value = saved.deviceId;
}

const ERRORS = {
  NotFoundError: 'aucune entrée visible. Réglages Système > Confidentialité et sécurité > Microphone : coche ton navigateur, puis relance-le.',
  NotAllowedError: 'micro refusé. Autorise-le dans le navigateur (icône à gauche de l\'adresse) et dans Réglages Système > Microphone.',
  NotReadableError: 'entrée occupée ou bloquée par une autre appli.',
};

async function start() {
  try {
    try {
      await openInput($('device').value || undefined, $('channel').value);
    } catch (e) {
      if (e.name !== 'NotFoundError' && e.name !== 'OverconstrainedError') throw e;
      await openInput(undefined, $('channel').value); // id unknown before permission (Firefox): open default, user picks after
    }
    const track = audio.stream.getAudioTracks()[0];
    saved.deviceId = track.getSettings().deviceId;
    await fillDevices(); // labels appear once permission is granted
    $('status').textContent = `Audio actif : ${track.label} (${track.getSettings().channelCount ?? '?'} canal/canaux)`;
    $('start').textContent = 'Relancer';
  } catch (e) {
    $('status').textContent = `Erreur audio (${e.name}) : ${ERRORS[e.name] ?? e.message}`;
  }
}

$('start').onclick = start; // AudioContext needs a user click
$('device').onchange = () => audio.stream && start();
$('channel').onchange = $('device').onchange;
fillDevices();
