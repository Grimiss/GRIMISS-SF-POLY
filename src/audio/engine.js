import { defaults, clampParam, initialMusic } from "../parameters.js?v=20261127-oscpitch-v2";
import { Envelope, Model, Effects, midiHz, TAU, clamp } from "./dsp.js?v=20261127-oscpitch-v2";
class Voice {
  constructor(sr, i) {
    this.index = i;
    this.models = [0, 1, 2].map((k) => new Model(sr, i, k));
    this.amp = new Envelope(sr);
    this.env = new Envelope(sr);
    this.owner = null;
    this.kind = 0;
    this.note = 60;
    this.velocity = 1;
    this.born = 0;
    this.down = false;
    this.fade = 1;
    this.tailL = 0;
    this.tailR = 0;
    this.lastL = 0;
    this.lastR = 0;
  }
  on(owner, note, velocity, frame, kind = 0) {
    this.kind = kind;
    this.tailL = this.lastL;
    this.tailR = this.lastR;
    this.fade = 0;
    this.owner = owner;
    this.note = note;
    this.velocity = velocity;
    this.born = frame;
    this.down = true;
    this.amp.on();
    this.env.on();
  }
  off() {
    this.down = false;
    this.amp.off();
    this.env.off();
  }
}
export class SynthEngine {
  constructor(sr = 48000) {
    this.sr = sr;
    this.frame = 0;
    this.p = { ...defaults };
    this.target = { ...defaults };
    this.keys = Object.keys(defaults);
    this.smooth = 1 - Math.exp(-8 / (sr * 0.012));
    this.voices = Array.from({ length: 12 }, (_, i) => new Voice(sr, i));
    this.fx = new Effects(sr);
    this.events = [];
    this.held = new Map();
    this.latched = new Map();
    this.sustain = false;
    this.lfoPhase = 0;
    this.seed = 1234567;
    this.music = initialMusic();
    this.arpIndex = 0;
    this.nextArp = 0;
    this.arpOwner = null;
    this.seqPlaying = false;
    this.seqIndex = 0;
    this.seqCount = 0;
    this.nextSeq = 0;
    this.seqOwner = null;
    this.autoPlaying = false;
    this.autoRecording = false;
    this.autoStart = 0;
    this.recordStart = 0;
    this.autoPosition = 0;
    this.autoLast = 0;
    this.autoTouched = new Set();
    this.left = 0;
    this.right = 0;
    this.steals = 0;
    this.serial = 0;
    this.autoTracks = new Map();
    this.tracksDirty = true;
    this.recordWasPlaying = false;
    this.autoBaseline = {};
    this.voiceCursor = [0, 0, 0];
  }
  now() {
    return this.frame / this.sr;
  }
  schedule(event) {
    const at = Number.isFinite(event.at)
      ? Math.max(this.now(), event.at)
      : this.now();
    this.events.push({ ...event, frame: Math.round(at * this.sr) });
    this.events.sort((a, b) => a.frame - b.frame);
  }
  param(k, v, record = true) {
    v = clampParam(k, v);
    if (v === undefined) return;
    const before = this.target[k];
    this.target[k] = v;
    if (k === "arpRate") this.music.arp.rate = v;
    if (k.startsWith("seqStep"))
      this.music.seq.steps[+k.slice(7)] = Math.round(v);
    if (record && this.autoRecording && k !== "autoSpeed") {
      const t = this.autoPlaying
        ? this.autoPosition
        : (this.frame - this.recordStart) / this.sr;
      if (t > 0 && !this.music.automation.events.some((e) => e.k === k))
        this.music.automation.events.push({
          t: 0,
          k,
          v: this.autoBaseline[k] ?? before,
          order: this.serial++,
        });
      this.music.automation.events.push({ t, k, v, order: this.serial++ });
      this.tracksDirty = true;
      this.autoTouched.add(k);
    }
  }
  enabledKinds() {
    return [this.target.enableP5, this.target.enableP6, this.target.enableJuno]
      .map((on, kind) => on >= 0.5 ? kind : -1).filter(k => k >= 0);
  }
  noteOn(owner, note, velocity = 1) {
    if (!Number.isFinite(note) || !Number.isFinite(velocity)) return null;
    note = clamp(note, 0, 127);
    const kinds = this.enabledKinds();
    if (!kinds.length) return null;
    const mode = Math.round(this.target.voiceMode);
    if (mode < 2) for (const v of this.voices) if (v.down) v.off();
    const size = 12 / kinds.length;
    let last = null;
    for (let group = 0; group < kinds.length; group++) {
      const pool = this.voices.slice(group * size, (group + 1) * size);
      const choices = mode === 1 ? pool : [pool.find(v => !v.amp.stage) ||
        pool.filter(v => !v.down).sort((a,b) => a.amp.value-b.amp.value)[0] ||
        pool.reduce((a,b) => a.born < b.born ? a : b)];
      for (const v of choices) {
        if (v.amp.stage) this.steals++;
        v.on(owner, note, clamp(velocity, 0, 1), this.frame, kinds[group]);
        last = v;
      }
    }
    return last;
  }
  noteOff(owner) {
    for (const v of this.voices)
      if (v.owner === owner) {
        if (this.sustain && owner.startsWith("input:")) v.down = false;
        else v.off();
      }
  }
  releaseSource(prefix) {
    for (const v of this.voices) if (v.owner?.startsWith(prefix)) v.off();
  }
  stopAutomation() {
    if (this.autoRecording) {
      this.music.automation.duration = Math.max(
        this.music.automation.duration,
        this.recordWasPlaying ? 0 : (this.frame - this.recordStart) / this.sr,
        0.02,
      );
      this.music.automation.events.sort(
        (a, b) => a.t - b.t || (a.order || 0) - (b.order || 0),
      );
    }
    this.autoRecording = false;
    this.autoPlaying = false;
    this.autoTouched.clear();
    this.tracksDirty = true;
  }
  panic() {
    for (const v of this.voices) {
      v.off();
      v.amp.value = 0;
      v.amp.stage = 0;
      v.env.stage = 0;
      v.lastL = v.lastR = v.tailL = v.tailR = 0;
    }
    this.events = [];
    this.held.clear();
    this.latched.clear();
    this.sustain = false;
    this.seqPlaying = false;
    this.arpOwner = this.seqOwner = null;
    this.lfoPhase = 0;
    this.fx.clear();
    for (const v of this.voices)
      for (const m of v.models) {
        for (const f of m.filters) {
          if (f.z) f.z.fill(0);
          f.s1=f.s2=f.feedback=0;
          f.hp=f.lp=f.bp=f.low=f.band=0;
          f.g=f.G=f.hpG=0;f.hz=-1;
          if(f.buffer)f.buffer.fill(0);
          f.pos=f.delay=f.damped=f.oscPhase=f.oscLevel=0;
        }
        m.filterFade=0;
        m.hpIn = m.hpOut = 0;
      }
  }
  handle(e) {
    switch (e.type) {
      case "param":
        this.param(e.k, e.v);
        break;
      case "on": {
        if (!Number.isFinite(e.note)) break;
        const id = "input:" + e.id;
        this.noteOff(id);
        this.held.set(id, e.note);
        if (this.music.arp.on) {
          if (this.music.arp.hold && this.held.size === 1) this.latched.clear();
          this.latched.set(id, e.note);
        } else this.noteOn(id, e.note, e.velocity);
        break;
      }
      case "off": {
        const id = "input:" + e.id;
        this.held.delete(id);
        if (!this.music.arp.hold) this.latched.delete(id);
        this.noteOff(id);
        break;
      }
      case "sustain":
        this.sustain = !!e.on;
        if (!e.on) for (const v of this.voices) if (!v.down) v.off();
        break;
      case "panic":
        this.panic();
        this.stopAutomation();
        break;
      case "arp": {
        const before = this.music.arp.on;
        Object.assign(this.music.arp, e.value);
        if (e.value.rate !== undefined) this.param("arpRate", e.value.rate);
        if (!this.music.arp.hold) this.latched = new Map(this.held);
        if (before !== this.music.arp.on) {
          if (this.music.arp.on) this.latched = new Map(this.held);
          this.releaseSource("input:");
          this.releaseSource("arp:");
          this.nextArp = this.frame;
          this.arpIndex = 0;
          if (!this.music.arp.on)
            for (const [id, n] of this.held) this.noteOn(id, n);
        }
        break;
      }
      case "seq":
        Object.assign(this.music.seq, e.value);
        if (e.value.steps)
          e.value.steps.forEach((v, i) => {
            if (i < 16 && v !== this.target["seqStep" + i])
              this.param("seqStep" + i, v);
          });
        break;
      case "seqPlay":
        this.seqPlaying = true;
        this.nextSeq = this.frame;
        break;
      case "seqPause":
        this.seqPlaying = false;
        this.releaseSource("seq:");
        break;
      case "seqStop":
        this.seqPlaying = false;
        this.seqCount = 0;
        this.seqIndex = 0;
        this.releaseSource("seq:");
        break;
      case "autoRec":
        if (this.autoRecording) {
          this.stopAutomation();
          break;
        }
        if (!this.music.automation.overdub) {
          this.autoPlaying = false;
          this.music.automation.events = [];
          this.music.automation.duration = 0;
        }
        this.autoBaseline = { ...this.target };
        this.recordWasPlaying = this.autoPlaying;
        this.autoTouched.clear();
        this.autoRecording = true;
        this.recordStart = this.frame;
        this.tracksDirty = true;
        break;
      case "autoPlay":
        this.stopAutomation();
        this.autoPlaying = true;
        this.autoStart = this.frame;
        this.autoPosition = 0;
        this.autoLast = this.frame;
        break;
      case "autoStop":
        this.stopAutomation();
        break;
      case "autoOptions":
        Object.assign(this.music.automation, e.value);
        break;
      case "autoClear":
        this.stopAutomation();
        this.music.automation.events = [];
        this.music.automation.duration = 0;
        this.tracksDirty = true;
        break;
      case "patch":
        this.panic();
        this.stopAutomation();
        for (const k of this.keys)
          this.param(k, e.patch.params?.[k] ?? defaults[k], false);
        this.music = initialMusic();
        for (const k of ["arp", "seq", "automation"])
          Object.assign(
            this.music[k],
            JSON.parse(JSON.stringify(e.patch[k] || {})),
          );
        this.param("arpRate", this.music.arp.rate, false);
        this.music.seq.steps.forEach((v, i) =>
          this.param("seqStep" + i, v, false),
        );
        this.tracksDirty = true;
        this.serial = this.music.automation.events.reduce(
          (n, e) => Math.max(n, (e.order || 0) + 1),
          0,
        );
        break;
    }
  }
  random() {
    let x = this.seed;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.seed = x;
    return (x >>> 0) / 4294967296;
  }
  clocks() {
    const a = this.music.arp;
    if (a.on && this.frame >= this.nextArp) {
      if (this.arpOwner) this.noteOff(this.arpOwner);
      const notes = [
          ...new Set((a.hold ? this.latched : this.held).values()),
        ].sort((a, b) => a - b),
        expanded = [];
      for (let oct = 0; oct < a.range; oct++)
        for (const n of notes) expanded.push(n + oct * 12);
      if (expanded.length) {
        let i = this.arpIndex++,
          N = expanded.length;
        if (a.mode === "random") i = Math.floor(this.random() * N);
        else if (a.mode === "down") i = N - 1 - (i % N);
        else if (a.mode === "pendulum") {
          const period = Math.max(1, 2 * N - 2);
          i %= period;
          i = i < N ? i : period - i;
        } else i %= N;
        this.arpOwner = "arp:" + this.frame;
        this.noteOn(this.arpOwner, expanded[i], 0.8);
      }
      this.nextArp += Math.round(this.sr / clamp(a.rate, 0.05, 40));
    }
    if (this.seqPlaying && this.frame >= this.nextSeq) {
      if (this.seqOwner) this.noteOff(this.seqOwner);
      const s = this.music.seq,
        N = clamp(Math.round(s.length), 1, 16);
      let i = this.seqCount++;
      if (s.direction === "reverse") i = N - 1 - (i % N);
      else if (s.direction === "pendulum") {
        const period = Math.max(1, 2 * N - 2);
        i %= period;
        i = i < N ? i : period - i;
      } else i %= N;
      this.seqIndex = i;
      this.seqOwner = "seq:" + this.frame;
      this.noteOn(this.seqOwner, s.root + (s.steps[i] || 0), 0.8);
      this.nextSeq += Math.round(this.sr / clamp(s.rate, 0.05, 40));
    }
    // Gate note sources at 80%; clocks remain entirely on the audio thread.
    if (
      this.arpOwner &&
      this.frame >= this.nextArp - (this.sr / clamp(a.rate, 0.05, 40)) * 0.2
    )
      this.noteOff(this.arpOwner);
    if (
      this.seqPlaying &&
      this.seqOwner &&
      this.frame >=
        this.nextSeq - (this.sr / clamp(this.music.seq.rate, 0.05, 40)) * 0.2
    )
      this.noteOff(this.seqOwner);
    if (this.autoPlaying) {
      const au = this.music.automation,
        D = au.duration;
      if (D <= 0) {
        this.autoPlaying = false;
        return;
      }
      this.autoPosition +=
        ((this.frame - this.autoLast) / this.sr) * this.target.autoSpeed;
      this.autoLast = this.frame;
      if (this.autoPosition > D) {
        if (au.loop) {
          this.autoPosition %= D;
          this.autoTouched.clear();
        } else {
          this.autoPosition = D;
          this.autoPlaying = false;
        }
      }
      if (this.tracksDirty) {
        this.autoTracks.clear();
        for (const e of au.events) {
          if (!this.autoTracks.has(e.k)) this.autoTracks.set(e.k, []);
          this.autoTracks.get(e.k).push(e);
        }
        for (const track of this.autoTracks.values())
          track.sort((a, b) => a.t - b.t || (a.order || 0) - (b.order || 0));
        this.tracksDirty = false;
      }
      const pos = this.autoPosition;
      for (const [k, track] of this.autoTracks) {
        if (this.autoRecording && this.autoTouched.has(k)) continue;
        let lo = 0,
          hi = track.length;
        while (lo < hi) {
          const mid = (lo + hi) >>> 1;
          if (track[mid].t <= pos) lo = mid + 1;
          else hi = mid;
        }
        const prev = track[lo - 1],
          next = track[lo];
        if (prev) {
          const v = next
            ? prev.v + ((next.v - prev.v) * (pos - prev.t)) / (next.t - prev.t)
            : prev.v;
          this.param(k, v, false);
        }
      }
    }
  }
  tick() {
    while (this.events.length && this.events[0].frame <= this.frame)
      this.handle(this.events.shift());
    if (this.frame % 32 === 0) this.clocks();
    if ((this.frame & 7) === 0)
      for (const k of this.keys)
        this.p[k] = k === "filterModel" ? this.target[k] :
          this.p[k] + (this.target[k] - this.p[k]) * this.smooth;
    const p = this.p;
    this.lfoPhase = (this.lfoPhase + p.lfoRate / this.sr) % 1;
    let lfo =
      p.lfoWave < 0.5
        ? Math.sin(TAU * this.lfoPhase)
        : p.lfoWave < 1.5
          ? 1 - 4 * Math.abs(this.lfoPhase - 0.5)
          : this.lfoPhase < 0.5
            ? 1
            : -1;
    const noise = this.random() * 2 - 1;
    const levels = [p.levelP5, p.levelP6, p.levelJuno];
    const enabled = [p.enableP5, p.enableP6, p.enableJuno];
    const total = enabled.reduce((sum,on,i)=>sum+(on>=0.5?levels[i]*levels[i]:0),0);
    const gain = total > 1 ? 1/Math.sqrt(total) : 1;
    let l = 0, r = 0;
    for (const v of this.voices) {
      if (!v.amp.stage) continue;
      const age = (this.frame - v.born) / this.sr,
        lf = lfo * (p.lfoDelay ? Math.min(1, age / p.lfoDelay) : 1),
        amp = v.amp.tick(p.ampA, p.ampD, p.ampS, p.ampR),
        env = v.env.tick(
          p.filterA * (1 + v.models[1].cal * 0.025),
          p.filterD,
          p.filterS,
          p.filterR,
        ),
        freq = midiHz(
          v.note + p.tune + p.bend + lf * (p.lfoPitch + p.mod * 1.2),
        );
      const kind = v.kind;
      const sample = enabled[kind] >= 0.5 && levels[kind] > 0.0001
        ? v.models[kind].tick(freq, p, env, lf, noise) : 0;
      const x = sample * levels[kind] * gain * amp * v.velocity * 0.14;
      const pan = ((v.index % 6) / 5 - 0.5) * p.width * 0.85;
      v.fade = Math.min(1, v.fade + 1 / (this.sr * 0.004));
      const vl = x * Math.sqrt(0.5 - pan) * v.fade + v.tailL * (1 - v.fade),
        vr = x * Math.sqrt(0.5 + pan) * v.fade + v.tailR * (1 - v.fade);
      v.lastL = vl;
      v.lastR = vr;
      l += vl;
      r += vr;
    }
    this.fx.tick(l, r, p);
    this.left = Number.isFinite(this.fx.left) ? this.fx.left : 0;
    this.right = Number.isFinite(this.fx.right) ? this.fx.right : 0;
    this.frame++;
  }
  render(left, right) {
    for (let i = 0; i < left.length; i++) {
      this.tick();
      left[i] = this.left;
      right[i] = this.right;
    }
  }
  snapshot() {
    return {
      params: { ...this.target },
      ...JSON.parse(JSON.stringify(this.music)),
      automation: {
        ...JSON.parse(JSON.stringify(this.music.automation)),
        duration:
          this.autoRecording && !this.recordWasPlaying
            ? Math.max(
                this.music.automation.duration,
                (this.frame - this.recordStart) / this.sr,
              )
            : this.music.automation.duration,
      },
      frame: this.frame,
      voices: this.voices.filter((v) => v.amp.stage).length,
      voiceActivity: this.voices.map(v => v.amp.stage ? Math.max(0.08, Math.min(1, v.amp.value)) : 0),
      seqPlaying: this.seqPlaying,
      seqIndex: this.seqIndex,
      autoPlaying: this.autoPlaying,
      autoRecording: this.autoRecording,
      autoPosition: this.autoPosition,
      steals: this.steals,
    };
  }
}
