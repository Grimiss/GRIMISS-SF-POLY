import test from "node:test";
import assert from "node:assert/strict";
import { SynthEngine } from "../src/audio/engine.js";
import { factory, patch, validatePatch } from "../src/presets.js";
const SR = 8000;
function advance(e, seconds) {
  const l = new Float32Array(Math.round(e.sr * seconds)),
    r = new Float32Array(l.length);
  e.render(l, r);
}
function noteLog(e) {
  const log = [],
    on = e.noteOn.bind(e);
  e.noteOn = (id, n, v) => {
    log.push({ id, n, t: e.now() });
    return on(id, n, v);
  };
  return log;
}
test("arp octave expansion, pendulum, hold, removals and audio-clock rate", () => {
  const e = new SynthEngine(SR),
    log = noteLog(e);
  e.handle({
    type: "arp",
    value: { on: true, mode: "pendulum", range: 2, rate: 10 },
  });
  e.handle({ type: "on", id: "a", note: 60 });
  e.handle({ type: "on", id: "b", note: 64 });
  advance(e, 0.61);
  assert.deepEqual(
    log.slice(0, 6).map((x) => x.n),
    [60, 64, 72, 76, 72, 64],
  );
  for (let i = 1; i < log.length; i++)
    assert.ok(Math.abs(log[i].t - log[i - 1].t - 0.1) <= 32 / SR);
  e.handle({ type: "off", id: "a" });
  e.handle({ type: "off", id: "b" });
  const n = log.length;
  advance(e, 0.3);
  assert.equal(log.length, n);
  e.handle({ type: "arp", value: { hold: true } });
  e.handle({ type: "on", id: "c", note: 67 });
  e.handle({ type: "off", id: "c" });
  advance(e, 0.3);
  assert.ok(log.length > n);
  e.handle({ type: "arp", value: { hold: false } });
  assert.equal(e.latched.size, 0);
});
test("SEQ16 reverse, pendulum, length, root, pause and independent arp ownership", () => {
  const e = new SynthEngine(SR),
    log = noteLog(e);
  e.handle({
    type: "seq",
    value: {
      root: 48,
      length: 3,
      direction: "reverse",
      rate: 10,
      steps: [0, 2, 4],
    },
  });
  e.handle({ type: "seqPlay" });
  advance(e, 0.31);
  assert.deepEqual(
    log.slice(0, 3).map((x) => x.n),
    [52, 50, 48],
  );
  e.handle({ type: "seqPause" });
  let n = log.length;
  advance(e, 0.2);
  assert.equal(log.length, n);
  e.handle({ type: "seq", value: { direction: "pendulum" } });
  e.handle({ type: "seqStop" });
  e.handle({ type: "seqPlay" });
  advance(e, 0.41);
  assert.deepEqual(
    log.slice(n, n + 4).map((x) => x.n),
    [48, 50, 52, 50],
  );
  e.handle({ type: "arp", value: { on: true } });
  e.handle({ type: "on", id: "a", note: 72 });
  advance(e, 0.2);
  assert.ok(log.some((x) => x.id.startsWith("arp:")));
  assert.ok(log.some((x) => x.id.startsWith("seq:")));
  e.handle({ type: "seqStop" });
  assert.ok(e.music.arp.on);
});
test("simultaneous automation, speed scaling and loop", () => {
  const e = new SynthEngine(SR);
  e.handle({ type: "autoRec" });
  e.param("character", 0);
  e.param("cutoff", 300);
  advance(e, 0.1);
  e.param("character", 1);
  e.param("cutoff", 3000);
  advance(e, 0.1);
  e.handle({ type: "autoStop" });
  assert.equal(e.music.automation.events.length, 4);
  assert.ok(Math.abs(e.music.automation.duration - 0.2) < 0.001);
  e.param("autoSpeed", 2, false);
  e.handle({ type: "autoPlay" });
  advance(e, 0.05);
  assert.ok(Math.abs(e.autoPosition - 0.1) < 0.01);
  advance(e, 0.06);
  assert.equal(e.autoPlaying, false);
  assert.equal(e.target.character, 1);
  e.handle({ type: "autoOptions", value: { loop: true } });
  e.handle({ type: "autoPlay" });
  advance(e, 0.31);
  assert.equal(e.autoPlaying, true);
  assert.ok(e.autoPosition <= 0.2);
});
test("overdub preserves unrelated tracks and last write wins", () => {
  const e = new SynthEngine(SR);
  e.music.automation = {
    events: [
      { t: 0, k: "cutoff", v: 100 },
      { t: 0.1, k: "cutoff", v: 200 },
      { t: 0, k: "character", v: 0 },
      { t: 0.1, k: "character", v: 1 },
    ],
    duration: 0.2,
    loop: true,
    overdub: true,
  };
  e.handle({ type: "autoPlay" });
  e.handle({ type: "autoRec" });
  e.param("character", 0.7);
  advance(e, 0.05);
  assert.equal(e.target.character, 0.7);
  assert.ok(e.target.cutoff > 100);
  e.handle({ type: "autoStop" });
  assert.equal(
    e.music.automation.events.filter((x) => x.k === "cutoff").length,
    2,
  );
  e.handle({ type: "autoPlay" });
  e.tick();
  e.clocks();
  assert.ok(Math.abs(e.target.character - 0.7) < 0.01);
});
test("80 factory patch round trips; recall clears notes and transports", () => {
  assert.equal(factory.length, 80);
  for (const p of factory)
    assert.deepEqual(validatePatch(JSON.parse(JSON.stringify(p))), p);
  const e = new SynthEngine(SR),
    p = patch("Round trip");
  p.seq.steps[3] = -12;
  p.automation = {
    events: [{ t: 0, k: "character", v: 0.7, order: 0 }],
    duration: 1,
    loop: true,
    overdub: true,
  };
  e.handle({ type: "on", id: "a", note: 60 });
  e.autoPlaying = true;
  e.seqPlaying = true;
  e.handle({ type: "patch", patch: validatePatch(p) });
  assert.equal(e.snapshot().voices, 0);
  assert.equal(e.autoPlaying, false);
  assert.equal(e.seqPlaying, false);
  assert.equal(e.music.seq.steps[3], -12);
  assert.equal(e.music.automation.events[0].v, 0.7);
  assert.throws(() => validatePatch({ version: 9 }));
  assert.throws(() => validatePatch({ ...p, params: { cutoff: NaN } }));
});
test("automation 0.1× and 4× durations", () => {
  for (const speed of [0.1, 4]) {
    const e = new SynthEngine(SR);
    e.music.automation = {
      events: [
        { t: 0, k: "character", v: 0 },
        { t: 0.1, k: "character", v: 1 },
      ],
      duration: 0.1,
      loop: false,
      overdub: false,
    };
    e.param("autoSpeed", speed, false);
    e.handle({ type: "autoPlay" });
    advance(e, 0.1 / speed + 0.012);
    assert.equal(e.autoPlaying, false);
    assert.equal(e.target.character, 1);
  }
});
test("late first gesture records baseline and overdub retains musical duration", () => {
  const e = new SynthEngine(SR);
  e.handle({ type: "autoRec" });
  advance(e, 0.1);
  e.param("cutoff", 500);
  advance(e, 0.1);
  e.handle({ type: "autoStop" });
  assert.equal(e.music.automation.events[0].t, 0);
  assert.equal(e.music.automation.events[0].v, 3200);
  e.music.automation.overdub = true;
  e.music.automation.loop = true;
  e.param("autoSpeed", 0.1, false);
  e.handle({ type: "autoPlay" });
  e.handle({ type: "autoRec" });
  advance(e, 0.4);
  e.param("character", 0.8);
  e.handle({ type: "autoStop" });
  assert.ok(Math.abs(e.music.automation.duration - 0.2) < 0.001);
});
test("arpeggiator clock does not accumulate fractional-step drift", () => {
  const e = new SynthEngine(SR),
    log = noteLog(e);
  e.handle({ type: "arp", value: { on: true, rate: 7 } });
  e.handle({ type: "on", id: "a", note: 60 });
  advance(e, 3);
  for (let i = 0; i < log.length; i++)
    assert.ok(Math.abs(log[i].t - (i * Math.round(SR / 7)) / SR) < 32 / SR);
});
test("invalid note/parameter input cannot poison the DSP", () => {
  const e = new SynthEngine(SR);
  e.handle({ type: "on", id: "bad", note: NaN });
  e.param("cutoff", Infinity);
  e.param("__proto__", 1);
  advance(e, 0.1);
  assert.equal(e.snapshot().voices, 0);
  assert.ok(Number.isFinite(e.left));
  const p = patch("Root zero");
  p.seq.root = 0;
  assert.equal(validatePatch(p).seq.root, 0);
  assert.throws(() =>
    validatePatch({
      ...p,
      automation: { events: [{ k: "__proto__", v: 1, t: 0 }] },
    }),
  );
});
test("all fader mappings round-trip; speed detents match 0.1, 0.5, 1, 2, 4", async () => {
  const { specs, fromUnit, toUnit } = await import("../src/parameters.js");
  for (const k of Object.keys(specs))
    for (const u of [0, 0.1, 0.5, 0.9, 1])
      assert.ok(Math.abs(toUnit(k, fromUnit(k, u)) - u) < 1e-9, k);
  for (const [i, v] of [0.1, 0.5, 1, 2, 4].entries())
    assert.ok(Math.abs(fromUnit("autoSpeed", i / 4) - v) < 1e-9);
});
test("arpeggiator rate and SEQ16 pitch faders share global automation", () => {
  const e = new SynthEngine(SR);
  e.handle({ type: "autoRec" });
  e.param("arpRate", 3);
  e.param("seqStep0", -12);
  advance(e, 0.1);
  e.param("arpRate", 12);
  e.param("seqStep0", 12);
  advance(e, 0.1);
  e.handle({ type: "autoStop" });
  e.handle({ type: "autoPlay" });
  advance(e, 0.05);
  assert.ok(e.music.arp.rate > 3 && e.music.arp.rate < 12);
  assert.ok(e.music.seq.steps[0] > -12 && e.music.seq.steps[0] < 12);
});
