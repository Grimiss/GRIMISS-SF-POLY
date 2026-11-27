import { mkdir, writeFile } from "node:fs/promises";
import { SynthEngine } from "../src/audio/engine.js";
import { factory } from "../src/presets.js";
await mkdir("work/diagnostics", { recursive: true });
const sr = 48000,
  results = { sampleRate: sr, models: {}, performance: {} };
function wav(left, right) {
  const N = left.length,
    b = Buffer.alloc(44 + N * 4);
  b.write("RIFF");
  b.writeUInt32LE(b.length - 8, 4);
  b.write("WAVEfmt ", 8);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(2, 22);
  b.writeUInt32LE(sr, 24);
  b.writeUInt32LE(sr * 4, 28);
  b.writeUInt16LE(4, 32);
  b.writeUInt16LE(16, 34);
  b.write("data", 36);
  b.writeUInt32LE(N * 4, 40);
  for (let i = 0; i < N; i++) {
    b.writeInt16LE(
      Math.round(Math.max(-1, Math.min(1, left[i])) * 32767),
      44 + i * 4,
    );
    b.writeInt16LE(
      Math.round(Math.max(-1, Math.min(1, right[i])) * 32767),
      46 + i * 4,
    );
  }
  return b;
}
function metrics(a) {
  let sum = 0,
    peak = 0,
    dc = 0,
    jump = 0;
  for (let i = 0; i < a.length; i++) {
    if (!Number.isFinite(a[i])) throw Error("Nonfinite diagnostic sample");
    sum += a[i] ** 2;
    peak = Math.max(peak, Math.abs(a[i]));
    dc += a[i];
    if (i) jump = Math.max(jump, Math.abs(a[i] - a[i - 1]));
  }
  return {
    rms: Math.sqrt(sum / a.length),
    peak,
    dc: dc / a.length,
    maxAdjacentJump: jump,
  };
}
for (const [name, index] of [
  ["prophet", 0],
  ["oberheim", 4],
  ["juno", 8],
]) {
  const e = new SynthEngine(sr);
  e.handle({ type: "patch", patch: factory[index] });
  for (const [i, n] of [48, 55, 60, 64, 67].entries())
    e.schedule({ type: "on", id: "" + i, note: n, at: 0.05 + i * 0.02 });
  for (let i = 0; i < 5; i++) e.schedule({ type: "off", id: "" + i, at: 2 });
  const l = new Float32Array(sr * 4),
    r = new Float32Array(l.length);
  e.render(l, r);
  results.models[name] = metrics(l);
  await writeFile("work/diagnostics/" + name + ".wav", wav(l, r));
}
const sweep = new SynthEngine(sr);
for (let i = 0; i < 4; i++) sweep.noteOn("sweep" + i, 48 + i * 7);
for (let i = 0; i <= 80; i++)
  sweep.schedule({ type: "param", k: "character", v: i / 80, at: i * 0.075 });
const l = new Float32Array(sr * 7),
  r = new Float32Array(l.length);
sweep.render(l, r);
results.characterSweep = metrics(l);
await writeFile("work/diagnostics/character-sweep.wav", wav(l, r));
for (const character of [0, 0.25, 0.5, 0.75, 1]) {
  const e = new SynthEngine(sr);
  e.p.character = e.target.character = character;
  for (let i = 0; i < 12; i++) e.noteOn("bench" + i, 48 + i);
  const l = new Float32Array(sr),
    r = new Float32Array(sr);
  e.render(l, r);
  const t = performance.now();
  e.render(l, r);
  const ms = performance.now() - t;
  results.performance[character] = {
    voices: 12,
    renderedSeconds: 1,
    cpuMilliseconds: Math.round(ms),
    realtimeRatio: +(ms / 1000).toFixed(3),
  };
}
const sustain = new SynthEngine(24000);
for (let i = 0; i < 12; i++) sustain.noteOn("long" + i, 36 + i * 5);
let peak = 0;
const sl = new Float32Array(24000),
  srOut = new Float32Array(24000);
for (let sec = 0; sec < 30; sec++) {
  sustain.param("character", (sec % 10) / 9, false);
  sustain.param("resonance", sec % 2 ? 0.94 : 0.1, false);
  sustain.render(sl, srOut);
  peak = Math.max(peak, metrics(sl).peak);
}
results.sustainStress = {
  durationSeconds: 30,
  voices: 12,
  sampleRate: 24000,
  peak,
  finite: true,
};
await writeFile(
  "work/diagnostics/metrics.json",
  JSON.stringify(results, null, 2) + "\n",
);
console.log(JSON.stringify(results, null, 2));
