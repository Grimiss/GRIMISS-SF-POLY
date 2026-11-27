import { defaults, initialMusic, clampParam, specs } from "./parameters.js";
export function patch(name, params = {}) {
  return {
    format: "grimiss-sf-poly",
    version: 1,
    name,
    params: { ...defaults, ...params },
    ...initialMusic(),
  };
}
// 80 curated factory starting patches, grouped by engine and category.
// These are parameter-designed patches, not yet auditioned against hardware references.
const namesByCategory = {
  Strings: ["Silken Strings", "Slow Ensemble", "Glass Strings", "Vintage Section"],
  Pads: ["Blue Horizon", "Soft Focus", "Afterglow", "Cloud Chamber"],
  Bass: ["Round Bottom", "Pulse Bass", "Deep Current"],
  Brass: ["Warm Horns", "Slow Brass"],
  Leads: ["Velvet Lead", "Sync Motion"],
  Keys: ["Electric Haze", "Gentle Plucks"],
  Arpeggios: ["Night Runner", "Clockwork"],
  Drones: ["Endless Air"],
};
const categoryBase = {
  Strings: {wave1:0,wave2:2,mixSub:0.12,cutoff:2800,resonance:0.13,ampA:0.75,ampD:1.8,ampS:0.78,ampR:2.9,filterA:0.7,filterR:1.8,chorusMix:0.55,reverbMix:0.27},
  Pads: {wave1:0,wave2:1,cutoff:1900,resonance:0.22,ampA:2.1,ampD:3.1,ampS:0.76,ampR:5.2,filterA:1.6,filterR:3.1,chorusMix:0.42,reverbMix:0.38,delayMix:0.12},
  Bass: {wave1:0,wave2:2,mixSub:0.56,cutoff:420,resonance:0.19,envAmount:3.2,filterA:0.008,filterD:0.28,filterS:0.13,ampA:0.005,ampD:0.35,ampS:0.68,ampR:0.18,chorusMix:0,reverbMix:0,delayMix:0,voiceMode:0},
  Brass: {wave1:0,wave2:0,cutoff:1150,envAmount:3.8,filterA:0.09,filterD:0.65,filterS:0.36,ampA:0.035,ampD:0.48,ampS:0.7,ampR:0.38,chorusMix:0.16,reverbMix:0.14},
  Leads: {wave1:1,wave2:0,cutoff:2300,resonance:0.34,envAmount:2.5,ampA:0.012,ampR:0.3,filterD:0.4,chorusMix:0.16,delayMix:0.17,voiceMode:0},
  Keys: {wave1:1,wave2:0,cutoff:3000,envAmount:2.7,filterD:0.62,filterS:0.14,ampA:0.008,ampD:0.85,ampS:0.15,ampR:1.2,chorusMix:0.27,reverbMix:0.2},
  Arpeggios: {wave1:1,wave2:0,cutoff:1600,resonance:0.28,filterD:0.28,filterS:0.18,ampA:0.005,ampD:0.28,ampS:0.28,ampR:0.24,delayMix:0.2,delayFeedback:0.3},
  Drones: {wave1:0,wave2:1,cutoff:1200,resonance:0.28,ampA:4.2,ampD:6,ampS:0.95,ampR:9,filterA:3.8,filterR:6,chorusMix:0.45,reverbMix:0.45,delayMix:0.16},
};
const engineSettings = {
  "Juno-106": {enableJuno:1,enableP6:0,enableP5:0,levelJuno:0.85,levelP6:0,levelP5:0,analog:0.19,analogDetune:0.13,chorusMode:1,mix2:0.24},
  "Polysix": {enableJuno:0,enableP6:1,enableP5:0,levelJuno:0,levelP6:0.84,levelP5:0,analog:0.48,analogDetune:0.31,chorusMode:2,mix2:0.3},
  "Prophet-5": {enableJuno:0,enableP6:0,enableP5:1,levelJuno:0,levelP6:0,levelP5:0.83,analog:0.35,analogDetune:0.25,chorusMode:0,mix2:0.56},
};
const hybridMixes = [
  [0.65,0.65,0], [0.7,0,0.7], [0,0.72,0.65], [0.62,0.54,0.48],
  [0.78,0.44,0], [0.5,0,0.82], [0,0.8,0.55], [0.5,0.7,0.52],
  [0.67,0.62,0], [0.6,0,0.76], [0,0.65,0.78], [0.7,0.5,0.48],
  [0.55,0,0.82], [0.65,0.57,0], [0,0.68,0.8], [0.56,0.58,0.56],
  [0.72,0.5,0], [0.58,0,0.73], [0,0.76,0.68], [0.6,0.57,0.61],
];
export const factory = [];
export const factoryGroups = [];
for (const engine of ["Juno-106", "Polysix", "Prophet-5", "Hybrid"]) {
  let slot = 0;
  for (const [category, names] of Object.entries(namesByCategory)) {
    const group = {engine, category, indices:[]};
    for (const name of names) {
      const variant = slot % 4;
      const mix = engine === "Hybrid" ? hybridMixes[slot] : null;
      const eng = mix ? {
        enableJuno:+(mix[0]>0),enableP6:+(mix[1]>0),enableP5:+(mix[2]>0),
        levelJuno:mix[0],levelP6:mix[1],levelP5:mix[2],
        analog:0.25+(slot%5)*0.07,analogDetune:0.15+(slot%4)*0.07,
        chorusMode:1,
      } : engineSettings[engine];
      const params = {
        ...categoryBase[category], ...eng,
        cutoff:Math.round(categoryBase[category].cutoff*[0.8,1,1.3,1.08][variant]),
        resonance:Math.min(0.9,(categoryBase[category].resonance||0.15)+[0,0.04,0.08,-0.025][variant]),
        pw:[0.37,0.48,0.62,0.43][variant],
        osc2Tune:[-0.09,0.07,0.16,-0.13][variant],
        lfoRate:[0.13,0.22,0.4,0.08][variant],
        lfoPWM:[0.05,0.1,0.17,0.08][variant],
        width:[0.5,0.7,0.9,0.8][variant],
      };
      if (category === "Leads" && variant === 1 && engine === "Prophet-5") {params.sync=1;params.polyMod=0.15;}
      if (category === "Arpeggios") {params.voiceMode=2;params.arpRate=3.5+variant*1.25;}
      const preset = patch(`${String(slot+1).padStart(2,"0")} · ${name}`, params);
      if (category === "Arpeggios") preset.arp = {on:true,mode:["up","down","pendulum","random"][variant],hold:false,range:variant%2+1,rate:params.arpRate};
      factory.push(preset);
      group.indices.push(factory.length-1);
      slot++;
    }
    factoryGroups.push(group);
  }
}

export function validatePatch(input) {
  if (!input || input.format !== "grimiss-sf-poly" || input.version !== 1)
    throw Error("Unsupported patch format or version.");
  const out = patch(String(input.name || "Imported patch").slice(0, 100));
  for (const k of Object.keys(specs)) {
    const v = input.params?.[k];
    if (v !== undefined) {
      if (!Number.isFinite(v)) throw Error("Invalid parameter: " + k);
      out.params[k] = clampParam(k, v);
    }
  }
  const a = input.arp || {},
    s = input.seq || {},
    u = input.automation || {};
  out.arp = {
    on: !!a.on,
    hold: !!a.hold,
    clock: a.clock === "midi" ? "midi" : "internal",
    mode: ["up", "down", "pendulum", "random"].includes(a.mode) ? a.mode : "up",
    range: Math.max(1, Math.min(4, Math.round(a.range) || 1)),
    rate: Math.max(0.05, Math.min(20, +a.rate || 5)),
  };
  out.seq = {
    root: Math.max(
      0,
      Math.min(127, Number.isFinite(s.root) ? Math.round(s.root) : 48),
    ),
    length: Math.max(1, Math.min(16, Math.round(s.length) || 16)),
    direction: ["forward", "reverse", "pendulum"].includes(s.direction)
      ? s.direction
      : "forward",
    rate: Math.max(0.05, Math.min(40, +s.rate || 4)),
    steps: Array.from({ length: 16 }, (_, i) =>
      Math.max(-12, Math.min(12, Math.round(s.steps?.[i]) || 0)),
    ),
  };
  out.params.arpRate = out.arp.rate;
  out.seq.steps.forEach((v, i) => (out.params["seqStep" + i] = v));
  out.automation = {
    loop: !!u.loop,
    overdub: !!u.overdub,
    duration: Math.max(0, Math.min(3600, +u.duration || 0)),
    events: [],
  };
  if (Array.isArray(u.events)) {
    if (u.events.length > 100000) throw Error("Too many automation events.");
    out.automation.events = u.events
      .map((e, i) => {
        if (
          !Object.hasOwn(specs, e.k) ||
          !Number.isFinite(e.v) ||
          !Number.isFinite(e.t) ||
          e.t < 0 ||
          e.t > 3600
        )
          throw Error("Invalid automation event.");
        return { k: e.k, v: clampParam(e.k, e.v), t: e.t, order: i };
      })
      .sort((a, b) => a.t - b.t);
  }
  return out;
}
export function readUsers() {
  try {
    return JSON.parse(localStorage.getItem("sf-poly-patches-v1") || "[]").map(
      validatePatch,
    );
  } catch {
    return [];
  }
}
export function writeUsers(users) {
  localStorage.setItem(
    "sf-poly-patches-v1",
    JSON.stringify(users.map(validatePatch)),
  );
}
