import test from "node:test";
import assert from "node:assert/strict";
import { patch } from "../src/presets.js";
test("worklet reset preserves later incoming notes and returns serializable snapshots", async () => {
  let Processor;
  globalThis.sampleRate = 48000;
  globalThis.AudioWorkletProcessor = class {
    constructor() {
      this.port = { postMessage: (data) => this.messages.push(data) };
      this.messages = [];
    }
  };
  globalThis.registerProcessor = (name, cls) => {
    assert.equal(name, "sf-poly");
    Processor = cls;
  };
  await import("../src/audio/worklet.js");
  const p = new Processor();
  p.port.onmessage({ data: { type: "patch", patch: patch("Initial") } });
  p.port.onmessage({ data: { type: "on", id: "first", note: 60 } });
  const output = [[new Float32Array(128), new Float32Array(128)]];
  assert.equal(p.process([], output), true);
  assert.equal(p.engine.snapshot().voices, 1);
  p.port.onmessage({ data: { type: "snapshot", id: 42 } });
  assert.equal(p.messages[0].id, 42);
  assert.ok(JSON.stringify(p.messages[0]).includes("params"));
  p.port.onmessage({ data: { type: "panic" } });
  p.process([], output);
  assert.equal(p.engine.snapshot().voices, 0);
});
