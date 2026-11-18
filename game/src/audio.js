// Synthesized sound only: every effect is built with WebAudio oscillators
// and noise, so the game needs no audio files and no network at runtime.
export function createAudio() {
  return {
    context: null,
    muted: false,
    engineOsc: null,
    engineGain: null,
    sirenOsc: null,
    sirenGain: null,
    sirenPhase: 0,
    masterGain: null,
  };
}

export function ensureAudioContext(audio) {
  if (audio.context) {
    if (audio.context.state === 'suspended') audio.context.resume();
    return audio.context;
  }
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    audio.context = new Ctx();
    audio.masterGain = audio.context.createGain();
    audio.masterGain.gain.value = audio.muted ? 0 : 0.5;
    audio.masterGain.connect(audio.context.destination);
  } catch (err) {
    audio.context = null;
  }
  return audio.context;
}

export function setMuted(audio, muted) {
  audio.muted = muted;
  if (audio.masterGain && audio.context) {
    audio.masterGain.gain.value = muted ? 0 : 0.5;
  }
}

function playNoiseBurst(audio, duration, filterFreq, volume) {
  const ctx = ensureAudioContext(audio);
  if (!ctx || audio.muted) return;
  const length = Math.max(1, Math.floor(ctx.sampleRate * duration));
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / length);
  }
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = filterFreq;
  const gain = ctx.createGain();
  gain.gain.value = volume;
  source.connect(filter);
  filter.connect(gain);
  gain.connect(audio.masterGain);
  source.start();
}

function playTone(audio, freqStart, freqEnd, duration, type, volume) {
  const ctx = ensureAudioContext(audio);
  if (!ctx || audio.muted) return;
  const osc = ctx.createOscillator();
  osc.type = type || 'sine';
  osc.frequency.setValueAtTime(freqStart, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), ctx.currentTime + duration);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(volume, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
  osc.connect(gain);
  gain.connect(audio.masterGain);
  osc.start();
  osc.stop(ctx.currentTime + duration);
}

export function playGunshot(audio) {
  playNoiseBurst(audio, 0.18, 1800, 0.7);
  playTone(audio, 220, 55, 0.12, 'square', 0.25);
}

export function playPunch(audio) {
  playNoiseBurst(audio, 0.1, 700, 0.5);
}

export function playPickupBlip(audio) {
  playTone(audio, 660, 990, 0.12, 'sine', 0.3);
  playTone(audio, 990, 1320, 0.14, 'sine', 0.25);
}

export function playCashRegister(audio) {
  playTone(audio, 880, 880, 0.09, 'triangle', 0.3);
  playTone(audio, 1174, 1174, 0.09, 'triangle', 0.3);
  playTone(audio, 1568, 1568, 0.18, 'triangle', 0.3);
}

export function playCrash(audio) {
  playNoiseBurst(audio, 0.35, 500, 0.6);
  playTone(audio, 120, 40, 0.3, 'sawtooth', 0.3);
}

export function playMissionComplete(audio) {
  [523, 659, 784, 1046].forEach((freq, i) => {
    setTimeout(() => playTone(audio, freq, freq, 0.22, 'triangle', 0.3), i * 110);
  });
}

export function updateEngineSound(audio, speed, driving) {
  const ctx = ensureAudioContext(audio);
  if (!ctx) return;
  if (!audio.engineOsc) {
    audio.engineOsc = ctx.createOscillator();
    audio.engineOsc.type = 'sawtooth';
    audio.engineGain = ctx.createGain();
    audio.engineGain.gain.value = 0;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 900;
    audio.engineOsc.connect(filter);
    filter.connect(audio.engineGain);
    audio.engineGain.connect(audio.masterGain);
    audio.engineOsc.start();
  }
  const target = driving ? 0.03 + Math.min(0.09, Math.abs(speed) * 0.0022) : 0;
  audio.engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.1);
  audio.engineOsc.frequency.setTargetAtTime(55 + Math.abs(speed) * 3.2, ctx.currentTime, 0.08);
}

export function updateSirenSound(audio, wanted, dt) {
  const ctx = ensureAudioContext(audio);
  if (!ctx) return;
  if (wanted <= 0) {
    if (audio.sirenGain) audio.sirenGain.gain.setTargetAtTime(0, ctx.currentTime, 0.2);
    return;
  }
  if (!audio.sirenOsc) {
    audio.sirenOsc = ctx.createOscillator();
    audio.sirenOsc.type = 'sine';
    audio.sirenGain = ctx.createGain();
    audio.sirenGain.gain.value = 0;
    audio.sirenOsc.connect(audio.sirenGain);
    audio.sirenGain.connect(audio.masterGain);
    audio.sirenOsc.start();
  }
  audio.sirenPhase += dt * 2.2;
  const high = Math.sin(audio.sirenPhase * Math.PI) > 0;
  const freq = high ? 920 : 620;
  audio.sirenOsc.frequency.setTargetAtTime(freq, ctx.currentTime, 0.05);
  audio.sirenGain.gain.setTargetAtTime(0.045, ctx.currentTime, 0.2);
}
