let sharedContext: AudioContext | null = null;

function getAudioContext() {
  const AudioContextClass = window.AudioContext;
  if (!AudioContextClass) return null;
  sharedContext ??= new AudioContextClass();
  return sharedContext;
}

export function unlockGameAudio() {
  const context = getAudioContext();
  if (context?.state === "suspended") void context.resume();
}

export function playDeathSound() {
  const context = getAudioContext();
  if (!context) return;
  if (context.state === "suspended") void context.resume();
  const now = context.currentTime;
  const master = context.createGain();
  master.gain.setValueAtTime(0.0001, now);
  master.gain.exponentialRampToValueAtTime(0.24, now + 0.015);
  master.gain.exponentialRampToValueAtTime(0.0001, now + 0.85);
  master.connect(context.destination);

  const impact = context.createOscillator();
  const impactGain = context.createGain();
  impact.type = "sawtooth";
  impact.frequency.setValueAtTime(135, now);
  impact.frequency.exponentialRampToValueAtTime(42, now + 0.48);
  impactGain.gain.setValueAtTime(0.6, now);
  impactGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.52);
  impact.connect(impactGain).connect(master);
  impact.start(now);
  impact.stop(now + 0.55);

  const sampleRate = context.sampleRate;
  const noiseBuffer = context.createBuffer(1, Math.floor(sampleRate * 0.22), sampleRate);
  const channel = noiseBuffer.getChannelData(0);
  for (let index = 0; index < channel.length; index += 1) {
    channel[index] = (Math.random() * 2 - 1) * (1 - index / channel.length);
  }

  const noise = context.createBufferSource();
  const noiseFilter = context.createBiquadFilter();
  const noiseGain = context.createGain();
  noise.buffer = noiseBuffer;
  noiseFilter.type = "bandpass";
  noiseFilter.frequency.value = 860;
  noiseFilter.Q.value = 0.7;
  noiseGain.gain.setValueAtTime(0.8, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
  noise.connect(noiseFilter).connect(noiseGain).connect(master);
  noise.start(now);

}
