import { defaults, initialMusic, clampParam, specs } from "./parameters.js?v=20261127-oscpitch-v2";
export function patch(name, params = {}) {
  return {
    format: "grimiss-sf-poly",
    version: 1,
    name,
    params: { ...defaults, ...params },
    ...initialMusic(),
  };
}
// Sound-first library: eight distinct categories, twenty unique named
// patches apiece. Circuit architecture is a timbral ingredient, not a bank.
// All parameter values remain within the v1 patch format and bounds.
// Patches are deliberately varied by oscillator topology, filter circuit,
// envelopes, modulation, tuning and wet effects; auditioning is still needed.
export const namesByCategory={
 Strings:[
 "Silken Strings","Cold Bow","Glass Quartet","Orchestra North","Deep Cellos",
 "Air Violins","Dusk Ensemble","Broken Rosin","Wide Octaves","Night Strings",
 "Shimmer Bow","Tape Violins","Cathedral Section","Quiet Viola","Brilliant Staccato",
 "Winter Chamber","Saw Ensemble","Velvet Tremor","Muted Ensemble","Silver Arco"],
 Pads:[
 "Blue Horizon","Cloud Chamber","Afterglow","Low Tide","Moonlit Haze",
 "Halo Drift","Frozen Glass","Warm Currents","Violet Mist","Ghost Choir",
 "Slow Motion","Northern Light","Soft Focus","Static Dream","Thick Atmosphere",
 "Open Sky","Dark Matter","Wavering Air","Gentle Motion","Deep Space"],
 Bass:[
 "Round Bottom","Pulse Bass","Deep Current","Sub Foundation","Rubber Note",
 "Dry Electric","Wide Body","Dark Rumble","Click Bass","Warm Low",
 "Metal Bottom","Rising Weight","Three Octaves","Sync Bottom","Buzzy Floor",
 "Slow Boom","Broken Bass","Classic Analog","Muted Growl","Soft Sub"],
 Brass:[
 "Warm Horns","Slow Brass","Bright Stabs","Soft Trumpets","Wide Ensemble",
 "Copper Sweep","Dark Trombones","Reedy Horn","Muted Brass","Fanfare",
 "Velvet Horns","Air Brass","Sharp Section","Low Sax Brass","Blue Trumpet",
 "Fading Section","Vintage Brass","Filter Horn","Sforzando","Dusky Winds"],
 Leads:[
 "Velvet Lead","Sync Motion","Glide Wire","Nasal Signal","Thin Electric",
 "Wide Solo","Bright Pulse","Hollow Point","Nocturne Lead","Cutting Edge",
 "Smooth Glide","Glass Lead","Screaming Top","Rounded Solo","Vibrato Wire",
 "Vintage Solo","Metallic Path","Soft Focus Lead","Octave Prophet","Sharp Edge"],
 Keys:[
 "Electric Haze","Gentle Plucks","Bell Tine","Muted Keys","Glass Mallet",
 "Worn Electric","Soft Organ","Night Piano","Tiny Bells","Hollow Keys",
 "Wire Pluck","Aged Reed","Velvet Pluck","Copper Keys","Wooden Tap",
 "Deep Tines","Bright Bell","Dream Organ","Soft Chime","Tremolo Keys"],
 Arpeggios:[
 "Night Runner","Clockwork","Falling Stars","Glitter Sequence","Low Pulse",
 "Rising Ladder","Glass Circuit","Slow Steps","Chiming Pulse","Random Walk",
 "Broken Clock","Wide Sequence","Mechanical Rain","Soft Patterns","Dark Engine",
 "Silver Steps","Double Motion","Drifting Notes","Narrow Grid","Last Train"],
 Drones:[
 "Endless Air","Deep Boreal","Harmonic Stone","Quiet Engine","Night Chamber",
 "Metallic Fog","Slow Orbit","Tape Breathing","Polar Wind","Hollow Mass",
 "Dark Current","Low Foundation","Still Air","Tonal Drift","Distant Machine",
 "Old Cathedral","Grain Cloud","Aurora Drone","Heavy Weather","Infinite Floor"]
};
const soundTemplates={
 Strings:{wave1:0,wave2:2,cutoff:3100,resonance:.16,ampA:.6,ampD:1.5,ampS:.78,ampR:2.5,filterA:.6,filterD:1.3,filterS:.7,filterR:1.8,chorusMix:.42,reverbMix:.24,mixSub:.1},
 Pads:{wave1:0,wave2:1,cutoff:2200,resonance:.26,ampA:2.2,ampD:3.1,ampS:.8,ampR:5.2,filterA:1.7,filterD:2.9,filterS:.68,filterR:3.1,chorusMix:.42,reverbMix:.35,delayMix:.1},
 Bass:{wave1:2,wave2:0,cutoff:580,resonance:.18,ampA:.006,ampD:.28,ampS:.6,ampR:.2,filterA:.005,filterD:.3,filterS:.1,filterR:.19,mixSub:.52,chorusMix:.04,reverbMix:.02,voiceMode:0},
 Brass:{wave1:0,wave2:0,cutoff:1400,resonance:.2,envAmount:3.7,ampA:.07,ampD:.5,ampS:.72,ampR:.52,filterA:.05,filterD:.63,filterS:.33,filterR:.44,chorusMix:.1,reverbMix:.12},
 Leads:{wave1:3,wave2:0,cutoff:2900,resonance:.32,envAmount:2.8,ampA:.015,ampD:.35,ampS:.74,ampR:.3,filterA:.016,filterD:.42,filterS:.45,filterR:.36,chorusMix:.14,delayMix:.18,voiceMode:0},
 Keys:{wave1:1,wave2:5,cutoff:4100,resonance:.17,envAmount:2.3,ampA:.005,ampD:.57,ampS:.15,ampR:1,filterA:.005,filterD:.68,filterS:.1,filterR:.9,chorusMix:.12,reverbMix:.2},
 Arpeggios:{wave1:2,wave2:0,cutoff:2400,resonance:.3,ampA:.006,ampD:.19,ampS:.2,ampR:.22,filterA:.008,filterD:.32,filterS:.15,filterR:.25,delayMix:.19,delayFeedback:.33},
 Drones:{wave1:0,wave2:1,cutoff:1300,resonance:.32,ampA:4,ampD:6,ampS:.95,ampR:9,filterA:3,filterD:4,filterS:.85,filterR:6,chorusMix:.44,reverbMix:.4,delayMix:.18}
};
const circuits=[
 {enableJuno:1,enableP6:0,enableP5:0,levelJuno:1,levelP6:1,levelP5:1,filterModel:1,analog:.24,analogDetune:.13},
 {enableJuno:0,enableP6:1,enableP5:0,levelJuno:1,levelP6:1,levelP5:1,filterModel:2,analog:.55,analogDetune:.31},
 {enableJuno:0,enableP6:0,enableP5:1,levelJuno:1,levelP6:1,levelP5:1,filterModel:3,analog:.36,analogDetune:.23},
 {enableJuno:1,enableP6:1,enableP5:0,levelJuno:.75,levelP6:.7,levelP5:1,filterModel:6,analog:.47,analogDetune:.39},
 {enableJuno:1,enableP6:0,enableP5:1,levelJuno:.73,levelP6:1,levelP5:.67,filterModel:5,analog:.36,analogDetune:.28},
 {enableJuno:0,enableP6:1,enableP5:1,levelJuno:1,levelP6:.7,levelP5:.64,filterModel:4,analog:.61,analogDetune:.35},
 {enableJuno:1,enableP6:1,enableP5:1,levelJuno:.64,levelP6:.6,levelP5:.63,filterModel:0,analog:.4,analogDetune:.33},
 {enableJuno:1,enableP6:0,enableP5:0,levelJuno:1,levelP6:1,levelP5:1,filterModel:7,analog:.13,analogDetune:.08}
];
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
function designSound(category,index){
 const base=soundTemplates[category];
 const idx=index%5,version=Math.floor(index/5);
 const circuit=circuits[(index*3+version+(Object.keys(soundTemplates).indexOf(category)*2))%circuits.length];
 const timbres=[
  {wave1:5,wave2:1,mix1:.65,mix2:.35,mixSub:.06,filterModel:1},
  {wave1:0,wave2:0,mix1:.75,mix2:.63,pw:.45,osc2Tune:.13},
  {wave1:2,wave2:4,mix1:.68,mix2:.76,pw:.29,lfoPWM:.27},
  {wave1:3,wave2:5,mix1:.68,mix2:.48,pw:.67,osc2Tune:-.22},
  {wave1:4,wave2:2,mix1:.76,mix2:.68,pw:.38,lfoPWM:.3}
 ];
 const cutoffFactor=[.52,1,1.8,2.7,.8][idx]*[.8,1,1.35,.67][version];
 const attackFactor=[.28,1,2.5,.65,1.7][idx]*[1,.7,1.6,1.2][version];
 const releaseFactor=[.65,1,1.8,.4,1.25][idx]*[1,1.4,.7,2.1][version];
 const preset={
  ...base,...circuit,...timbres[idx],
  // Restrict output peaks and keep distinct voices approachable.
  mix1:timbres[idx].mix1,
  mix2:timbres[idx].mix2,
  cutoff:clamp(Math.round(base.cutoff*cutoffFactor),35,17000),
  resonance:clamp((base.resonance??.2)+[-.09,.04,.22,.11,.31][idx]+[0,.05,-.05,.08][version],0,.88),
  filterModel:[circuit.filterModel,1,2,4,5,6,7,3][(index+version)%8],
  envAmount:clamp((base.envAmount??2)+[-1.3,1,.4,2.3,-.6][idx],-6,8),
  ampA:clamp(base.ampA*attackFactor,.002,58),
  ampR:clamp(base.ampR*releaseFactor,.006,85),
  ampD:clamp(base.ampD*[.7,1,1.35,1.7,.48][idx],.005,55),
  ampS:clamp(base.ampS*[1,.8,1.08,.56,.94][idx],0,1),
  filterA:clamp(base.filterA*attackFactor,.002,58),
  filterR:clamp(base.filterR*releaseFactor,.005,85),
  lfoRate:[.065,.13,.31,1.2,.018][idx]*[1,2,.75,1.55][version],
  lfoPWM:[.05,.13,.3,.06,.36][idx],
  chorusMode:[1,3,2,0][version],
  chorusMix:clamp((base.chorusMix??.1)*[1.4,.65,1.05,0,.8][idx],0,.9),
  reverbMix:clamp((base.reverbMix??.14)*[1.4,.55,.95,1.15,.7][idx],0,.75),
  delayMix:clamp((base.delayMix??.04)*[1,1.8,.65,1.3,2.1][idx],0,.65),
  delayFeedback:clamp(.19+version*.12+idx*.07,0,.8),
  analogDetune:clamp(circuit.analogDetune+[0,.07,.19,-.04,.12][idx],0,.8),
  width:clamp([.4,.65,.95,.25,.8][idx],0,1),
  bassBoost:(category==="Bass"&&index%3===0)?1:0,
 };
 if(category==="Bass"){preset.mixSub=[.15,.6,.82,.04,.45][idx];preset.voiceMode=0;}
 if(category==="Keys"){preset.ampS=[0,.18,.55,.04,.35][idx];preset.ampD=[.18,.75,1.7,.4,2.8][idx];}
 if(category==="Strings"){preset.ampA=clamp(base.ampA*[.05,.7,1.8,.23,3.8][idx],.005,10);preset.ampS=[.3,.8,.93,.6,.95][idx];}
 if(category==="Drones"){preset.ampA=clamp(base.ampA*[.16,.65,1.4,2.1,.95][idx],.04,30);preset.filterR=clamp(base.filterR*releaseFactor,.05,60);}
 if(category==="Brass"){preset.filterA=clamp(base.filterA*[.15,1,2.2,.5,1.7][idx],.002,3);preset.filterS=[.1,.34,.65,.04,.48][idx];}
 if(category==="Leads"&&index%4===0){preset.sync=1;preset.polyMod=.25;}
 if(category==="Arpeggios"){preset.delayMix=clamp(.06+idx*.09+version*.04,0,.6);preset.arpRate=2+idx*1.35+version*.7;}
 return preset;
}
export const factory=[];
export const factoryGroups=[];
for(const [category,names] of Object.entries(namesByCategory)){
 const group={category,indices:[]};
 names.forEach((name,index)=>{
   const params=designSound(category,index);
   const item=patch(name,params);
   if(category==="Arpeggios")item.arp={
    ...item.arp,on:true,mode:["up","pendulum","down","random"][index%4],
    hold:false,range:1+Math.floor(index/5),rate:params.arpRate
   };
   factory.push(item);
   group.indices.push(factory.length-1);
 });
 factoryGroups.push(group);
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
  // Import legacy semitone tune into the new octave/fine display while
  // preserving exact original sound even for offsets outside ±100 cents.
  for(const osc of [1,2]){
    const octKey="osc"+osc+"Octave",fineKey="osc"+osc+"Fine";
    const tuneKey="osc"+osc+"Tune";
    if(input.params?.[octKey]===undefined && input.params?.[fineKey]===undefined){
      const original=out.params[tuneKey];
      const octave=Math.max(-2,Math.min(2,Math.round(original/12)));
      const fine=Math.max(-1,Math.min(1,original-octave*12));
      out.params[octKey]=octave;
      out.params[fineKey]=fine;
      out.params[tuneKey]=original-octave*12-fine;
    }
  }
  // Old saved sounds had only chorusMode; infer the new power switch.
  if(input.params?.chorusOn===undefined)
    out.params.chorusOn=Math.round(out.params.chorusMode)!==0?1:0;
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
