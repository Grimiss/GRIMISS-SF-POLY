import test from "node:test";
import assert from "node:assert/strict";
import {
  Oscillator,
  Envelope,
  CEMFilter,
  OBFilter,
  JunoFilter,
  Effects,
} from "../src/audio/dsp.js";
import { SynthEngine } from "../src/audio/engine.js";
import { defaults } from "../src/parameters.js";
const SR = 24000;
function render(e, seconds) {
  const l = new Float32Array(Math.round(e.sr * seconds)),
    r = new Float32Array(l.length);
  e.render(l, r);
  return l;
}
function rms(a) {
  return Math.sqrt(a.reduce((s, v) => s + v * v, 0) / a.length);
}
function finite(a) {
  for (const x of a) assert.ok(Number.isFinite(x) && Math.abs(x) <= 1.001);
}
test("oscillator pitch: saw, triangle and pulse within 0.1 Hz", () => {
  for (const wave of [0, 1, 2]) {
    const o = new Oscillator(),
      signal = Float64Array.from({ length: SR * 2 }, () =>
        o.tick(440, SR, wave, 0.5),
      );
    let crossings = 0,
      first = -1,
      last = 0;
    for (let i = SR / 2; i < signal.length; i++)
      if (signal[i - 1] < 0 && signal[i] >= 0) {
        crossings++;
        if (first < 0) first = i;
        last = i;
      }
    const pitch = ((crossings - 1) * SR) / (last - first);
    assert.ok(Math.abs(pitch - 440) < 0.1, `${wave}: ${pitch}`);
  }
});
test("PolyBLEP harmonic spectrum and alias energy improve over naive saw", () => {
  const sr = 32768,
    N = 8192,
    f = 6000,
    o = new Oscillator();
  const a = [],
    b = [];
  for (let i = 0; i < N; i++) {
    a.push(o.tick(f, sr, 0));
    b.push(2 * (((i * f) / sr) % 1) - 1);
  }
  function energy(x, hz) {
    let re = 0,
      im = 0;
    for (let i = 0; i < N; i++) {
      const t = (2 * Math.PI * hz * i) / sr;
      re += x[i] * Math.cos(t);
      im += x[i] * Math.sin(t);
    }
    return (re * re + im * im) / N ** 2;
  }
  const alias = sr - 3 * f;
  assert.ok(energy(a, alias) < energy(b, alias) * 0.45);
  assert.ok(energy(a, f) > energy(a, 2 * f) * 2);
});
test("ADSR attack/release timing and 60-second attack smoothness", () => {
  const e = new Envelope(SR);
  e.on();
  let t = 0;
  while (e.stage === 1 && t < SR) {
    e.tick(0.1, 0.2, 0.4, 0.3);
    t++;
  }
  assert.ok(Math.abs(t / SR - 0.1) < 0.003);
  for (let i = 0; i < SR; i++) e.tick(0.1, 0.2, 0.4, 0.3);
  assert.ok(Math.abs(e.value - 0.4) < 0.002);
  e.off();
  for (let i = 0; i < SR * 0.31; i++) e.tick(0.1, 0.2, 0.4, 0.3);
  assert.equal(e.stage, 0);
  e.on();
  let prev = 0;
  for (let i = 0; i < SR; i++) {
    const v = e.tick(60, 60, 0.5, 90);
    assert.ok(v >= prev && v - prev < 0.00001);
    prev = v;
  }
});
test("distinct filter response, attenuation and resonance stability", () => {
  const results = [];
  for (const F of [CEMFilter, OBFilter, JunoFilter]) {
    function response(hz, res = 0) {
      const f = new F(),
        out = [];
      for (let i = 0; i < SR; i++) {
        const y = f.tick(
          Math.sin((2 * Math.PI * hz * i) / SR) * 0.1,
          1000,
          res,
          SR,
        );
        if (i > SR / 2) out.push(y);
      }
      return rms(out);
    }
    const low = response(100),
      high = response(6000);
    assert.ok(high < low * 0.15, `${F.name}: ${low} / ${high}`);
    results.push(response(900, 0.85));
    const f = new F();
    for (let i = 0; i < SR; i++)
      assert.ok(Number.isFinite(f.tick(i === 0 ? 1 : 0, 10000, 0.94, SR)));
  }
  assert.equal(new Set(results.map((v) => v.toFixed(5))).size, 3);
});
test("12 voices, released-first stealing, repeated-note ownership, sustain and panic", () => {
  const e = new SynthEngine(SR);
  for (let i = 0; i < 12; i++) e.handle({ type: "on", id: "" + i, note: 60 });
  assert.equal(e.snapshot().voices, 12);
  render(e, 0.02);
  e.handle({ type: "off", id: "4" });
  e.tick();
  e.handle({ type: "on", id: "13", note: 70 });
  assert.equal(e.voices.find((v) => v.owner === "input:13").index, 4);
  assert.equal(e.steals, 1);
  e.handle({ type: "sustain", on: true });
  e.handle({ type: "off", id: "13" });
  assert.notEqual(e.voices[4].amp.stage, 4);
  e.handle({ type: "sustain", on: false });
  assert.equal(e.voices[4].amp.stage, 4);
  e.handle({ type: "off", id: "1" });
  assert.equal(e.voices.find((v) => v.owner === "input:0").down, true);
  e.handle({ type: "panic" });
  assert.equal(e.snapshot().voices, 0);
  assert.equal(e.held.size, 0);
});
test("sample-scheduled notes and full release", () => {
  const e = new SynthEngine(SR);
  e.schedule({ type: "on", id: "x", note: 60, at: 0.05 });
  assert.equal(rms(render(e, 0.049)), 0);
  assert.ok(rms(render(e, 0.1)) > 0.001);
  e.schedule({ type: "off", id: "x" });
  render(e, 1);
  assert.equal(e.voices.filter((v) => v.amp.stage).length, 0);
});
test("sustained CHARACTER transitions, extreme modulation and rapid controls remain finite", () => {
  const e = new SynthEngine(SR);
  for (let i = 0; i < 12; i++) e.noteOn("stress" + i, 36 + i * 5);
  for (const [k, v] of Object.entries({
    ampA: 0.002,
    resonance: 0.94,
    lfoRate: 20,
    lfoPitch: 2,
    lfoFilter: 4,
    polyMod: 2,
    sync: 1,
    delayFeedback: 0.88,
    delayMix: 1,
    reverbMix: 1,
    reverbSize: 1,
  }))
    e.param(k, v, false);
  let maxJump = 0,
    prev = 0;
  for (let n = 0; n < 10; n++) {
    e.param("character", n % 2, false);
    e.param("cutoff", n % 2 ? 18000 : 20, false);
    const a = render(e, 0.12);
    finite(a);
    for (const x of a) {
      maxJump = Math.max(maxJump, Math.abs(x - prev));
      prev = x;
    }
  }
  assert.ok(maxJump < 0.85, `jump ${maxJump}`);
  e.panic();
  finite(render(e, 0.3));
});
test("chorus, delay and reverb stereo paths and stable tails", () => {
  for (const effect of ["chorus", "delay", "reverb"]) {
    const e = new Effects(SR),
      p = {
        ...defaults,
        volume: 1,
        chorusMode: 0,
        chorusMix: 0,
        delayMix: 0,
        reverbMix: 0,
      };
    if (effect === "chorus") {
      p.chorusMode = 3;
      p.chorusMix = 1;
    }
    if (effect === "delay") {
      p.delayMix = 1;
      p.delayFeedback = 0.88;
      p.delayTime = 0.05;
    }
    if (effect === "reverb") {
      p.reverbMix = 1;
      p.reverbSize = 1;
    }
    let tail = 0,
      diff = 0;
    for (let i = 0; i < SR * 3; i++) {
      e.tick(i < 32 ? 0.25 : 0, i < 32 ? 0.25 : 0, p);
      assert.ok(Number.isFinite(e.left) && Math.abs(e.left) <= 1);
      if (i > SR * 0.1) tail += Math.abs(e.left);
      diff += Math.abs(e.left - e.right);
    }
    if (effect !== "chorus") assert.ok(tail > 0.001, effect);
    assert.ok(diff > 0.001, effect + " stereo");
  }
});
test("sync and audio-rate Poly-Mod affect harmonic output without runaway", () => {
  for (const character of [0, 0.5]) {
    function signal(sync, polyMod) {
      const e = new SynthEngine(SR);
      Object.assign(e.p, {
        character,
        sync,
        polyMod,
        osc2Tune: 7,
        ampA: 0.002,
        chorusMode: 0,
        reverbMix: 0,
      });
      Object.assign(e.target, e.p);
      e.noteOn("sync", 57);
      return render(e, 0.3);
    }
    const plain = signal(0, 0),
      synced = signal(1, 0),
      modded = signal(0, 1);
    finite(synced);
    finite(modded);
    assert.ok(rms(plain.map((x, i) => x - synced[i])) > 0.002);
    assert.ok(rms(plain.map((x, i) => x - modded[i])) > 0.002);
  }
});
test("fixed model trims match reference-chord endpoint RMS within 2 dB", () => {
  const levels = [];
  for (const character of [0, 0.5, 1]) {
    const e = new SynthEngine(SR);
    Object.assign(e.p, {
      character,
      chorusMode: 0,
      reverbMix: 0,
      envAmount: 0,
      filterS: 1,
      ampS: 1,
      cutoff: 2000,
      mixSub: 0,
    });
    Object.assign(e.target, e.p);
    for (let i = 0; i < 4; i++) e.noteOn("x" + i, 48 + i * 7);
    render(e, 0.5);
    levels.push(rms(render(e, 0.5)));
  }
  assert.ok(
    20 * Math.log10(Math.max(...levels) / Math.min(...levels)) < 2,
    levels.join(", "),
  );
});
