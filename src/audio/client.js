export class AudioClient {
  constructor(onstate) {
    this.onstate = onstate;
    this.context = null;
    this.node = null;
    this.pending = new Map();
    this.nextId = 1;
    this.starting = null;
  }
  async start() {
    if (this.node) {
      if (this.context.state !== "running") await this.context.resume();
      return;
    }
    if (this.starting) return this.starting;
    this.starting = this.init();
    try {
      await this.starting;
    } finally {
      this.starting = null;
    }
  }
  async init() {
    this.context = new AudioContext({ latencyHint: "interactive" });
    await this.context.audioWorklet.addModule(
      new URL("./worklet.js?v=20261128-arp-redesign-v1", import.meta.url),
    );
    this.node = new AudioWorkletNode(this.context, "sf-poly", {
      numberOfInputs: 0,
      numberOfOutputs: 1,
      outputChannelCount: [2],
    });
    this.node.connect(this.context.destination);
    this.node.port.onmessage = ({ data }) => {
      if (data.type === "snapshot") {
        this.pending.get(data.id)?.(data.state);
        this.pending.delete(data.id);
      } else this.onstate(data);
    };
    await this.context.resume();
  }
  send(event) {
    this.node?.port.postMessage(event);
  }
  snapshot() {
    return new Promise((resolve, reject) => {
      if (!this.node) return reject(new Error("Audio is not started"));
      const id = this.nextId++;
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error("Audio snapshot timed out"));
      }, 3000);
      this.pending.set(id, (x) => {
        clearTimeout(timer);
        resolve(x);
      });
      this.send({ type: "snapshot", id });
    });
  }
}
