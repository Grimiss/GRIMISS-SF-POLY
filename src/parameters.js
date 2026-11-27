export const specs = {
  lfoRate: [0.001, 20, 0.28, "log"],
  lfoDelay: [0, 20, 0],
  lfoWave: [0, 2, 0],
  lfoPitch: [0, 2, 0],
  lfoPWM: [0, 0.45, 0.06],
  lfoFilter: [0, 4, 0],
  // Legacy semitone tuning remains for backward-compatible user patches.
  // New faceplate has separate 5-detent octave and ±100-cent fine controls.
  osc1Tune: [-24, 24, 0],
  osc2Tune: [-12, 12, 0],
  osc1Octave: [-2, 2, 0],
  osc2Octave: [-2, 2, 0],
  osc1Fine: [-1, 1, 0],
  osc2Fine: [-1, 1, 0],
  subOct: [1, 2, 1],
  pw: [0.05, 0.95, 0.5],
  wave1: [0, 5, 0],
  wave2: [0, 5, 0],
  sync: [0, 1, 0],
  polyMod: [0, 2, 0],
  mix1: [0, 1, 0.65],
  mix2: [0, 1, 0.45],
  mixSub: [0, 1, 0.15],
  mixNoise: [0, 0.5, 0],
  hpf: [10, 3000, 10, "log"],
  bassBoost: [0, 1, 0],
  cutoff: [20, 18000, 3200, "log"],
  resonance: [0, 0.94, 0.15],
  filterModel: [0, 7, 0], // 0 native, 1 Roland, 2 SSM, 3 Curtis
  envAmount: [-6, 8, 2],
  filterA: [0.002, 60, 0.04, "log"],
  filterD: [0.005, 60, 0.5, "log"],
  filterS: [0, 1, 0.45],
  filterR: [0.005, 90, 0.7, "log"],
  ampA: [0.002, 60, 0.02, "log"],
  ampD: [0.005, 60, 0.6, "log"],
  ampS: [0, 1, 0.75],
  ampR: [0.005, 90, 0.6, "log"],
  tune: [-1, 1, 0],
  width: [0, 1, 0.7],
  volume: [0, 1, 0.65],
  character: [0, 1, 0.5], // legacy preset compatibility
  levelJuno: [0, 1, 1],
  levelP6: [0, 1, 1],
  levelP5: [0, 1, 1],
  enableJuno: [0, 1, 1],
  enableP6: [0, 1, 0],
  enableP5: [0, 1, 0],
  characterToggle: [0, 1, 0],
  analog: [0, 1, 0.3],
  analogDetune: [0, 1, 0.2],
  voiceMode: [0, 2, 2],
  bend: [-2, 2, 0],
  mod: [0, 1, 0],
  delayOn: [0, 1, 1],
  reverbOn: [0, 1, 1],
  delayTime: [0.025, 2, 0.375, "log"],
  delayFeedback: [0, 0.88, 0.3],
  delayMix: [0, 1, 0.5],
  reverbSize: [0, 1, 0.6],
  reverbDamp: [0, 1, 0.55],
  reverbMix: [0, 1, 0.5],
  chorusMode: [0, 3, 1],
  chorusOn: [0, 1, 1],
  chorusMix: [0, 1, 0.5],
  autoSpeed: [0.1, 4, 1, "log"],
  arpRate: [0.05, 20, 5],
  ...Object.fromEntries(
    Array.from({ length: 16 }, (_, i) => ["seqStep" + i, [-12, 12, 0]]),
  ),
};
export const defaults = Object.fromEntries(
  Object.entries(specs).map(([k, v]) => [k, v[2]]),
);
export function clampParam(k, v) {
  const s = Object.hasOwn(specs, k) ? specs[k] : null;
  return s && Number.isFinite(v)
    ? Math.max(s[0], Math.min(s[1], v))
    : undefined;
}
export function fromUnit(k, u) {
  if (k === "autoSpeed") {
    const a = [0.1, 0.5, 1, 2, 4],
      x = Math.max(0, Math.min(4, u * 4)),
      i = Math.min(3, Math.floor(x));
    return a[i] * (a[i + 1] / a[i]) ** (x - i);
  }
  const [a, b, , mode] = specs[k];
  return mode === "log" ? a * (b / a) ** u : a + (b - a) * u;
}
export function toUnit(k, v) {
  if (k === "autoSpeed") {
    const a = [0.1, 0.5, 1, 2, 4];
    v = Math.max(0.1, Math.min(4, v));
    let i = 0;
    while (i < 3 && v > a[i + 1]) i++;
    return (i + Math.log(v / a[i]) / Math.log(a[i + 1] / a[i])) / 4;
  }
  const [a, b, , mode] = specs[k];
  return Math.max(
    0,
    Math.min(
      1,
      mode === "log" ? Math.log(v / a) / Math.log(b / a) : (v - a) / (b - a),
    ),
  );
}
export const initialMusic = () => ({
  arp: { on: false, mode: "up", hold: false, range: 1, rate: 5, clock: "internal" },
  seq: {
    root: 48,
    length: 16,
    direction: "forward",
    rate: 4,
    steps: Array(16).fill(0),
  },
  automation: { events: [], duration: 0, loop: false, overdub: false },
});
