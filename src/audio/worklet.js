import { SynthEngine } from "./engine.js?v=20261128-voice-age-v1";
class SFPolyProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.engine = new SynthEngine(sampleRate);
    this.blocks = 0;
    this.port.onmessage = ({ data }) => {
      if (data.type === "snapshot") {
        this.port.postMessage({
          type: "snapshot",
          id: data.id,
          state: this.engine.snapshot(),
        });
      } else if (data.type === "panic" || data.type === "patch")
        this.engine.handle(data);
      else this.engine.schedule(data);
    };
  }
  process(inputs, outputs) {
    const out = outputs[0];
    if (out.length < 2) return true;
    this.engine.render(out[0], out[1]);
    if (++this.blocks % 16 === 0) {
      const e = this.engine;
      this.port.postMessage({
        type: "state",
        params: { ...e.target },
        seqIndex: e.seqIndex,
        seqPlaying: e.seqPlaying,
        autoPlaying: e.autoPlaying,
        autoRecording: e.autoRecording,
        voices: e.voices.filter((v) => v.amp.stage).length,
        voiceActivity: e.voices.map(v => v.amp.stage ? Math.max(0.08, Math.min(1, v.amp.value)) : 0),
      });
    }
    return true;
  }
}
registerProcessor("sf-poly", SFPolyProcessor);
