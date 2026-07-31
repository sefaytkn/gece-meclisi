export type GameSound =
  | "SUNSET"
  | "NIGHT_START"
  | "DAY_START"
  | "CLOCK_BELL"
  | "TIME_WARNING"
  | "NIGHT_CREATURE"
  | "VOTING_START"
  | "VOTING_END"
  | "VAMPIRE_ATTACK"
  | "VOTE_EXECUTION"
  | "PLAYER_ELIMINATED"
  | "VAMPIRE_VICTORY"
  | "VILLAGE_VICTORY";

let sharedContext: AudioContext | null = null;
let soundEnabled = true;
let soundVolume = 0.18;
let activeSources = new Set<AudioScheduledSourceNode>();
let activeOutput: GainNode | null = null;
let ambientSource: AudioBufferSourceNode | null = null;
let ambientLfo: OscillatorNode | null = null;
let ambientOutput: GainNode | null = null;

function getAudioContext() {
  const AudioContextClass = window.AudioContext;
  if (!AudioContextClass) return null;
  sharedContext ??= new AudioContextClass();
  return sharedContext;
}

function stopActiveSound() {
  activeSources.forEach((source) => {
    try {
      source.stop();
    } catch {
      // The source may already have naturally ended.
    }
    source.disconnect();
  });
  activeSources.clear();
  activeOutput?.disconnect();
  activeOutput = null;
}

export function stopGameAmbience() {
  try {
    ambientSource?.stop();
  } catch {
    // The ambience may already have stopped naturally.
  }
  try {
    ambientLfo?.stop();
  } catch {
    // The modulation oscillator may already have stopped.
  }
  ambientSource?.disconnect();
  ambientLfo?.disconnect();
  ambientOutput?.disconnect();
  ambientSource = null;
  ambientLfo = null;
  ambientOutput = null;
}

function track(source: AudioScheduledSourceNode) {
  activeSources.add(source);
  source.addEventListener("ended", () => activeSources.delete(source), { once: true });
}

function createOutput(context: AudioContext, duration: number, level = 0.72) {
  stopActiveSound();
  const output = context.createGain();
  const compressor = context.createDynamicsCompressor();
  const now = context.currentTime;
  const targetVolume = Math.max(0.0001, soundVolume * level);
  compressor.threshold.setValueAtTime(-24, now);
  compressor.knee.setValueAtTime(18, now);
  compressor.ratio.setValueAtTime(5, now);
  compressor.attack.setValueAtTime(0.004, now);
  compressor.release.setValueAtTime(0.24, now);
  output.gain.setValueAtTime(targetVolume, now);
  output.gain.setValueAtTime(targetVolume, now + Math.max(0, duration - 0.18));
  output.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  output.connect(compressor).connect(context.destination);
  activeOutput = output;
  window.setTimeout(() => {
    if (activeOutput === output) {
      output.disconnect();
      activeOutput = null;
    }
  }, (duration + 0.2) * 1000);
  return { output, now };
}

function addTone(
  context: AudioContext,
  output: AudioNode,
  options: {
    frequency: number;
    frequencyEnd?: number;
    gain?: number;
    start?: number;
    duration: number;
    type?: OscillatorType;
    attack?: number;
  }
) {
  const start = context.currentTime + (options.start ?? 0);
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = options.type ?? "sine";
  oscillator.frequency.setValueAtTime(options.frequency, start);
  if (options.frequencyEnd) {
    oscillator.frequency.exponentialRampToValueAtTime(options.frequencyEnd, start + options.duration);
  }
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(options.gain ?? 0.35, start + (options.attack ?? 0.035));
  gain.gain.exponentialRampToValueAtTime(0.0001, start + options.duration);
  oscillator.connect(gain).connect(output);
  track(oscillator);
  oscillator.start(start);
  oscillator.stop(start + options.duration);
}

function addNoise(
  context: AudioContext,
  output: AudioNode,
  options: {
    start?: number;
    duration: number;
    gain?: number;
    frequency?: number;
    filterType?: BiquadFilterType;
    q?: number;
    attack?: number;
  }
) {
  const start = context.currentTime + (options.start ?? 0);
  const frameCount = Math.floor(context.sampleRate * options.duration);
  const buffer = context.createBuffer(1, frameCount, context.sampleRate);
  const channel = buffer.getChannelData(0);
  for (let index = 0; index < channel.length; index += 1) {
    channel[index] = (Math.random() * 2 - 1) * (1 - index / channel.length);
  }
  const source = context.createBufferSource();
  const filter = context.createBiquadFilter();
  const gain = context.createGain();
  source.buffer = buffer;
  filter.type = options.filterType ?? "bandpass";
  filter.frequency.value = options.frequency ?? 720;
  filter.Q.value = options.q ?? 0.8;
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(options.gain ?? 0.25, start + (options.attack ?? 0.008));
  gain.gain.exponentialRampToValueAtTime(0.0001, start + options.duration);
  source.connect(filter).connect(gain).connect(output);
  track(source);
  source.start(start);
}

export function configureGameAudio(enabled: boolean, volume: number) {
  soundEnabled = enabled;
  soundVolume = Math.min(1, Math.max(0, volume));
  if (!enabled || soundVolume === 0) {
    stopActiveSound();
    stopGameAmbience();
    return;
  }
  if (ambientOutput && sharedContext) {
    ambientOutput.gain.setTargetAtTime(soundVolume * 0.065, sharedContext.currentTime, 0.08);
  }
}

export function unlockGameAudio() {
  const context = getAudioContext();
  if (context?.state === "suspended") void context.resume();
}

export function startNightWind() {
  if (!soundEnabled || soundVolume === 0 || ambientSource) return;
  const context = getAudioContext();
  if (!context) return;
  if (context.state === "suspended") void context.resume();

  const duration = 5;
  const frameCount = Math.floor(context.sampleRate * duration);
  const buffer = context.createBuffer(1, frameCount, context.sampleRate);
  const channel = buffer.getChannelData(0);
  let brown = 0;
  for (let index = 0; index < channel.length; index += 1) {
    brown = (brown + 0.018 * (Math.random() * 2 - 1)) / 1.018;
    channel[index] = Math.max(-1, Math.min(1, brown * 3.2));
  }

  const source = context.createBufferSource();
  const lowpass = context.createBiquadFilter();
  const highpass = context.createBiquadFilter();
  const output = context.createGain();
  const lfo = context.createOscillator();
  const lfoDepth = context.createGain();

  source.buffer = buffer;
  source.loop = true;
  lowpass.type = "lowpass";
  lowpass.frequency.value = 720;
  lowpass.Q.value = 0.45;
  highpass.type = "highpass";
  highpass.frequency.value = 80;
  output.gain.setValueAtTime(0.0001, context.currentTime);
  output.gain.exponentialRampToValueAtTime(Math.max(0.0001, soundVolume * 0.065), context.currentTime + 1.8);
  lfo.type = "sine";
  lfo.frequency.value = 0.09;
  lfoDepth.gain.value = soundVolume * 0.018;
  lfo.connect(lfoDepth).connect(output.gain);
  source.connect(lowpass).connect(highpass).connect(output).connect(context.destination);

  ambientSource = source;
  ambientLfo = lfo;
  ambientOutput = output;
  source.start();
  lfo.start();
}

export function playGameSound(sound: GameSound) {
  if (!soundEnabled || soundVolume === 0) return;
  const context = getAudioContext();
  if (!context) return;
  if (context.state === "suspended") void context.resume();

  if (sound === "SUNSET") {
    const { output } = createOutput(context, 2.8, 0.46);
    addTone(context, output, { frequency: 220, frequencyEnd: 110, duration: 2.5, gain: 0.2, type: "sine", attack: 0.28 });
    addTone(context, output, { frequency: 330, frequencyEnd: 147, duration: 2.1, start: 0.18, gain: 0.08, type: "sine", attack: 0.32 });
    addNoise(context, output, { duration: 2.6, gain: 0.035, frequency: 520, filterType: "lowpass", attack: 0.35 });
    return;
  }

  if (sound === "NIGHT_START") {
    const { output } = createOutput(context, 1.55, 0.58);
    addTone(context, output, { frequency: 98, frequencyEnd: 49, duration: 1.45, gain: 0.38, type: "sine", attack: 0.12 });
    addTone(context, output, { frequency: 196, frequencyEnd: 110, duration: 1.2, gain: 0.1, type: "sine", attack: 0.16 });
    addNoise(context, output, { duration: 1.3, gain: 0.045, frequency: 320, filterType: "lowpass", attack: 0.18 });
    return;
  }

  if (sound === "DAY_START") {
    const { output } = createOutput(context, 1.4, 0.5);
    [262, 330, 392, 523].forEach((frequency, index) => {
      addTone(context, output, { frequency, duration: 0.72, start: index * 0.17, gain: 0.16, type: "sine", attack: 0.045 });
    });
    return;
  }

  if (sound === "CLOCK_BELL") {
    const { output } = createOutput(context, 1.45, 0.52);
    addTone(context, output, { frequency: 523, frequencyEnd: 505, duration: 1.3, gain: 0.32, type: "sine" });
    addTone(context, output, { frequency: 1046, frequencyEnd: 1010, duration: 0.95, gain: 0.12, type: "sine" });
    addTone(context, output, { frequency: 1568, duration: 0.5, gain: 0.035, type: "sine" });
    return;
  }

  if (sound === "TIME_WARNING") {
    const { output } = createOutput(context, 2.25, 0.56);
    [0, 0.62, 1.24].forEach((start, index) => {
      addTone(context, output, {
        frequency: 622 - index * 30,
        frequencyEnd: 570 - index * 26,
        duration: 0.82,
        start,
        gain: 0.28,
        type: "sine"
      });
      addTone(context, output, {
        frequency: 1244 - index * 60,
        frequencyEnd: 1140 - index * 52,
        duration: 0.55,
        start,
        gain: 0.07,
        type: "sine"
      });
    });
    return;
  }

  if (sound === "NIGHT_CREATURE") {
    const { output } = createOutput(context, 1.65, 0.38);
    if (Math.random() > 0.5) {
      addTone(context, output, { frequency: 390, frequencyEnd: 230, duration: 0.38, start: 0.05, gain: 0.2, type: "sine", attack: 0.08 });
      addTone(context, output, { frequency: 355, frequencyEnd: 215, duration: 0.4, start: 0.62, gain: 0.17, type: "sine", attack: 0.08 });
    } else {
      addTone(context, output, { frequency: 165, frequencyEnd: 315, duration: 0.72, start: 0.05, gain: 0.18, type: "sine", attack: 0.12 });
      addTone(context, output, { frequency: 315, frequencyEnd: 135, duration: 0.72, start: 0.78, gain: 0.16, type: "sine", attack: 0.1 });
    }
    return;
  }

  if (sound === "VOTING_START") {
    const { output } = createOutput(context, 1.15, 0.52);
    [0, 0.28, 0.56].forEach((start, index) => {
      addTone(context, output, { frequency: 165 - index * 14, frequencyEnd: 92, duration: 0.45, start, gain: 0.24, type: "sine", attack: 0.05 });
    });
    return;
  }

  if (sound === "VOTING_END") {
    const { output } = createOutput(context, 1.05, 0.5);
    addNoise(context, output, { duration: 0.12, gain: 0.18, frequency: 760, q: 1.4 });
    addTone(context, output, { frequency: 146, frequencyEnd: 68, duration: 0.82, gain: 0.3, type: "sine", attack: 0.04 });
    return;
  }

  if (sound === "PLAYER_ELIMINATED") {
    const { output } = createOutput(context, 0.85, 0.62);
    addNoise(context, output, { duration: 0.12, gain: 0.22, frequency: 410, filterType: "lowpass" });
    addTone(context, output, { frequency: 92, frequencyEnd: 42, duration: 0.58, gain: 0.42, type: "sine", attack: 0.02 });
    return;
  }

  if (sound === "VAMPIRE_ATTACK") {
    const { output } = createOutput(context, 1.05, 0.64);
    addNoise(context, output, { duration: 0.22, gain: 0.3, frequency: 2500, q: 0.55, attack: 0.015 });
    addNoise(context, output, { start: 0.13, duration: 0.16, gain: 0.3, frequency: 280, filterType: "lowpass" });
    addTone(context, output, { frequency: 82, frequencyEnd: 38, duration: 0.68, start: 0.12, gain: 0.46, type: "sine", attack: 0.015 });
    addNoise(context, output, { start: 0.42, duration: 0.08, gain: 0.11, frequency: 1200, q: 1.8 });
    return;
  }

  if (sound === "VOTE_EXECUTION") {
    const { output } = createOutput(context, 1.05, 0.62);
    [
      { start: 0.04, frequency: 1500, gain: 0.24 },
      { start: 0.12, frequency: 920, gain: 0.28 },
      { start: 0.2, frequency: 540, gain: 0.3 }
    ].forEach(({ start, frequency, gain }) => {
      addNoise(context, output, { start, duration: 0.045, gain, frequency, q: 2.2, attack: 0.002 });
    });
    addTone(context, output, { frequency: 112, frequencyEnd: 68, duration: 0.34, start: 0.03, gain: 0.14, type: "triangle", attack: 0.08 });
    addNoise(context, output, { start: 0.22, duration: 0.16, gain: 0.24, frequency: 210, filterType: "lowpass" });
    addTone(context, output, { frequency: 76, frequencyEnd: 36, duration: 0.62, start: 0.2, gain: 0.48, type: "sine", attack: 0.015 });
    return;
  }

  if (sound === "VAMPIRE_VICTORY") {
    const { output } = createOutput(context, 2, 0.52);
    [196, 165, 131, 98].forEach((frequency, index) => {
      addTone(context, output, { frequency, frequencyEnd: frequency * 0.72, duration: 0.9, start: index * 0.31, gain: 0.2, type: "sine", attack: 0.08 });
    });
    addNoise(context, output, { duration: 1.8, gain: 0.035, frequency: 220, filterType: "lowpass", attack: 0.2 });
    return;
  }

  const { output } = createOutput(context, 2, 0.48);
  [262, 330, 392, 523, 659].forEach((frequency, index) => {
    addTone(context, output, { frequency, duration: 0.82, start: index * 0.24, gain: 0.17, type: "sine", attack: 0.045 });
  });
}
