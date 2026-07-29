export type GameSound =
  | "NIGHT_START"
  | "DAY_START"
  | "CLOCK_BELL"
  | "TIME_WARNING"
  | "NIGHT_CREATURE"
  | "VOTING_START"
  | "VOTING_END"
  | "PLAYER_ELIMINATED"
  | "VAMPIRE_VICTORY"
  | "VILLAGE_VICTORY";

let sharedContext: AudioContext | null = null;
let soundEnabled = true;
let soundVolume = 0.18;
let activeSources = new Set<AudioScheduledSourceNode>();
let activeOutput: GainNode | null = null;

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

function track(source: AudioScheduledSourceNode) {
  activeSources.add(source);
  source.addEventListener("ended", () => activeSources.delete(source), { once: true });
}

function createOutput(context: AudioContext, duration: number) {
  stopActiveSound();
  const output = context.createGain();
  const now = context.currentTime;
  output.gain.setValueAtTime(Math.max(0.0001, soundVolume), now);
  output.gain.setValueAtTime(Math.max(0.0001, soundVolume), now + Math.max(0, duration - 0.16));
  output.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  output.connect(context.destination);
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
  gain.gain.exponentialRampToValueAtTime(options.gain ?? 0.35, start + 0.025);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + options.duration);
  oscillator.connect(gain).connect(output);
  track(oscillator);
  oscillator.start(start);
  oscillator.stop(start + options.duration);
}

function addNoise(
  context: AudioContext,
  output: AudioNode,
  options: { start?: number; duration: number; gain?: number; frequency?: number }
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
  filter.type = "bandpass";
  filter.frequency.value = options.frequency ?? 720;
  filter.Q.value = 0.8;
  gain.gain.setValueAtTime(options.gain ?? 0.25, start);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + options.duration);
  source.connect(filter).connect(gain).connect(output);
  track(source);
  source.start(start);
}

export function configureGameAudio(enabled: boolean, volume: number) {
  soundEnabled = enabled;
  soundVolume = Math.min(1, Math.max(0, volume));
  if (!enabled || soundVolume === 0) stopActiveSound();
}

export function unlockGameAudio() {
  const context = getAudioContext();
  if (context?.state === "suspended") void context.resume();
}

export function playGameSound(sound: GameSound) {
  if (!soundEnabled || soundVolume === 0) return;
  const context = getAudioContext();
  if (!context) return;
  if (context.state === "suspended") void context.resume();

  if (sound === "NIGHT_START") {
    const { output } = createOutput(context, 1.45);
    addTone(context, output, { frequency: 116, frequencyEnd: 58, duration: 1.35, gain: 0.42, type: "sine" });
    addTone(context, output, { frequency: 232, frequencyEnd: 126, duration: 1.05, gain: 0.15, type: "triangle" });
    addNoise(context, output, { duration: 1.2, gain: 0.1, frequency: 460 });
    return;
  }

  if (sound === "DAY_START") {
    const { output } = createOutput(context, 1.4);
    [262, 330, 392, 523].forEach((frequency, index) => {
      addTone(context, output, { frequency, duration: 0.65, start: index * 0.17, gain: 0.22, type: "sine" });
    });
    return;
  }

  if (sound === "CLOCK_BELL") {
    const { output } = createOutput(context, 1.35);
    addTone(context, output, { frequency: 698, frequencyEnd: 670, duration: 1.2, gain: 0.42, type: "sine" });
    addTone(context, output, { frequency: 1396, frequencyEnd: 1320, duration: 0.9, gain: 0.2, type: "sine" });
    addTone(context, output, { frequency: 2093, duration: 0.55, gain: 0.08, type: "sine" });
    return;
  }

  if (sound === "TIME_WARNING") {
    const { output } = createOutput(context, 2.25);
    [0, 0.62, 1.24].forEach((start, index) => {
      addTone(context, output, {
        frequency: 784 - index * 44,
        frequencyEnd: 720 - index * 40,
        duration: 0.82,
        start,
        gain: 0.38,
        type: "sine"
      });
      addTone(context, output, {
        frequency: 1568 - index * 88,
        frequencyEnd: 1440 - index * 80,
        duration: 0.55,
        start,
        gain: 0.14,
        type: "sine"
      });
    });
    return;
  }

  if (sound === "NIGHT_CREATURE") {
    const { output } = createOutput(context, 1.65);
    if (Math.random() > 0.5) {
      addTone(context, output, { frequency: 420, frequencyEnd: 245, duration: 0.34, start: 0.05, gain: 0.3, type: "sine" });
      addTone(context, output, { frequency: 390, frequencyEnd: 225, duration: 0.38, start: 0.58, gain: 0.26, type: "sine" });
    } else {
      addTone(context, output, { frequency: 185, frequencyEnd: 395, duration: 0.75, start: 0.05, gain: 0.27, type: "sine" });
      addTone(context, output, { frequency: 395, frequencyEnd: 145, duration: 0.75, start: 0.78, gain: 0.25, type: "sine" });
    }
    return;
  }

  if (sound === "VOTING_START") {
    const { output } = createOutput(context, 1.15);
    [0, 0.28, 0.56].forEach((start, index) => {
      addTone(context, output, { frequency: 174 - index * 16, frequencyEnd: 96, duration: 0.42, start, gain: 0.34, type: "triangle" });
    });
    return;
  }

  if (sound === "VOTING_END") {
    const { output } = createOutput(context, 0.95);
    addNoise(context, output, { duration: 0.16, gain: 0.62, frequency: 980 });
    addTone(context, output, { frequency: 164, frequencyEnd: 72, duration: 0.75, gain: 0.35, type: "sawtooth" });
    return;
  }

  if (sound === "PLAYER_ELIMINATED") {
    const { output } = createOutput(context, 0.95);
    addTone(context, output, { frequency: 135, frequencyEnd: 42, duration: 0.55, gain: 0.58, type: "sawtooth" });
    addNoise(context, output, { duration: 0.23, gain: 0.72, frequency: 860 });
    return;
  }

  if (sound === "VAMPIRE_VICTORY") {
    const { output } = createOutput(context, 2);
    [196, 165, 131, 98].forEach((frequency, index) => {
      addTone(context, output, { frequency, frequencyEnd: frequency * 0.72, duration: 0.85, start: index * 0.31, gain: 0.28, type: "sawtooth" });
    });
    addNoise(context, output, { duration: 1.8, gain: 0.08, frequency: 260 });
    return;
  }

  const { output } = createOutput(context, 2);
  [262, 330, 392, 523, 659].forEach((frequency, index) => {
    addTone(context, output, { frequency, duration: 0.8, start: index * 0.24, gain: 0.24, type: "sine" });
  });
}
