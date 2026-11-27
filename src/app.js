import {
  defaults,
  specs,
  toUnit,
  fromUnit,
  initialMusic,
} from "./parameters.js";
import { AudioClient } from "./audio/client.js";
import {
  factory,
  factoryGroups,
  patch,
  validatePatch,
  readUsers,
  writeUsers,
} from "./presets.js";
const $ = (s) => document.querySelector(s),
  el = (tag, cls, parent) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    parent?.append(n);
    return n;
  };
let current = patch("Initialize"),
  params = { ...defaults },
  music = initialMusic(),
  users = readUsers(),
  octave = 0,
  initialized = false,
  activeInput = null,
  view = "key";
const bindings = new Map(),
  toggles = new Map(),
  keys = new Map(),
  heldPointers = new Map(),
  computerHeld = new Map();
const status = (t) => ($("#status").textContent = t);
const audio = new AudioClient((state) => {
  for (const [k, v] of Object.entries(state.params)) {
    params[k] = v;
    update(k);
  }
  refreshSwitches();
  document.querySelectorAll(".voice-light").forEach((led,i) => {
    const value = state.voiceActivity?.[i] || 0;
    led.style.opacity = String(0.18 + value * 0.82);
    led.classList.toggle("lit",value > 0.03);
  });
  for (let i = 0; i < 16; i++)
    document
      .querySelector(`[data-step="${i}"]`)
      ?.classList.toggle("active", state.seqPlaying && state.seqIndex === i);
  setOn("autoRec", state.autoRecording);
  setOn("autoPlay", state.autoPlaying);
});
let readyPromise;
async function ready() {
  if (!readyPromise)
    readyPromise = (async () => {
      try {
        await audio.start();
        if (!initialized) {
          audio.send({
            type: "patch",
            patch: { ...current, params, ...music },
          });
          initialized = true;
        }
        $("#audio").textContent = "AUDIO ON";
        status("Ready · play keys or connect MIDI · Space: panic");
      } catch (e) {
        status("Audio error: " + e.message);
        readyPromise = null;
        throw e;
      }
    })();
  await readyPromise;
  if (audio.context.state !== "running") await audio.context.resume();
}
async function send(e) {
  try {
    await ready();
    audio.send(e);
  } catch {}
}
function bind(k, input, paint) {
  if (!bindings.has(k)) bindings.set(k, []);
  bindings.get(k).push({ input, paint });
  input.addEventListener("pointerdown", () => (activeInput = input));
  input.addEventListener("pointerup", () => (activeInput = null));
  input.addEventListener("pointercancel", () => (activeInput = null));
  input.addEventListener("input", () => {
    const v = fromUnit(k, +input.value);
    setParam(k, v);
  });
  paint(params[k]);
}
function update(k) {
  for (const b of bindings.get(k) || []) {
    if (b.input !== activeInput) b.input.value = toUnit(k, params[k]);
    b.paint(params[k]);
  }
}
function setParam(k, v) {
  params[k] = v;
  update(k);
  send({ type: "param", k, v });
}
function setOn(id, on) {
  toggles.get(id)?.classList.toggle("on", !!on);
  toggles.get(id)?.setAttribute("aria-pressed", !!on);
}
function button(parent, id, text, x, y, w, h, fn, cls = "") {
  const b = el("button", "hardware " + cls, parent);
  b.type = "button";
  b.id = id;
  b.innerHTML = text;
  b.style.cssText = `left:${x}px;top:${y}px;width:${w}px;height:${h}px`;
  b.addEventListener("click", fn);
  toggles.set(id, b);
  return b;
}
function range(parent, k, label, x, y, w, h) {
  const box = el("div", "fader", parent);
  box.style.cssText = `left:${x}px;top:${y}px;width:${w}px;height:${h}px`;
  const lab = el("label", "", box);
  lab.textContent = label;
  const id = "param-" + k + "-" + (bindings.get(k)?.length || 0);
  lab.htmlFor = id;
  el("div", "scale", box);
  el("div", "slot", box);
  const cap = el("span", "cap", box),
    input = el("input", "", box);
  input.type = "range";
  input.min = 0;
  input.max = 1;
  input.step = 0.0001;
  input.id = id;
  input.setAttribute("aria-label", k);
  input.value = toUnit(k, params[k]);
  bind(k, input, (v) => {
    const u = toUnit(k, v);
    cap.style.top = 27 + (1 - u) * (h - 43) + "px";
    input.title = `${label}: ${v.toFixed(3)}`;
    input.setAttribute("aria-valuetext", v.toFixed(3));
  });
  return box;
}
function horizontal(parent, k, x, y, w) {
  const box = el("div", "horizontal", parent);
  box.style.cssText = `left:${x}px;top:${y}px;width:${w}px`;
  const cap = el("span", "cap", box),
    input = el("input", "", box);
  input.type = "range";
  input.min = 0;
  input.max = 1;
  input.step = 0.0001;
  input.setAttribute("aria-label", k);
  input.value = toUnit(k, params[k]);
  bind(k, input, (v) => {
    cap.style.left = toUnit(k, v) * (w - 19) + "px";
    input.title = `${k}: ${v.toFixed(3)}`;
  });
  return input;
}
function section(name, x, y, w, h, color = "blue", upper = false) {
  const s = el(
    "section",
    `section ${color} ${upper ? "upper" : "lower"}`,
    $("#panel"),
  );
  s.style.cssText = `left:${x}px;top:${y}px;width:${w}px;height:${h}px`;
  s.dataset.section = name;
  el("h2", "", s).textContent = name;
  return s;
}
const upper = [
  [
    "LFO",
    52,
    160,
    [
      ["lfoRate", "RATE"],
      ["lfoDelay", "DELAY"],
    ],
  ],
  [
    "DCO",
    221,
    274,
    [
      ["osc1Tune", "OSC 1"],
      ["osc2Tune", "OSC 2"],
      ["subOct", "SUB"],
      ["pw", "PW"],
    ],
  ],
  [
    "MIXER",
    503,
    219,
    [
      ["mix1", "OSC 1"],
      ["mix2", "OSC 2"],
      ["mixSub", "SUB"],
      ["mixNoise", "NOISE"],
    ],
  ],
  [
    "HPF / VCF",
    729,
    252,
    [
      ["hpf", "HPF"],
      ["cutoff", "CUTOFF"],
      ["resonance", "RES"],
      ["envAmount", "ENV"],
    ],
  ],
  [
    "ENV 1 (FILTER)",
    989,
    242,
    [
      ["filterA", "A"],
      ["filterD", "D"],
      ["filterS", "S"],
      ["filterR", "R"],
    ],
  ],
  [
    "ENV 2 (AMP)",
    1239,
    241,
    [
      ["ampA", "A"],
      ["ampD", "D"],
      ["ampS", "S"],
      ["ampR", "R"],
    ],
  ],
  [
    "MASTER",
    1488,
    235,
    [
      ["tune", "TUNE"],
      ["width", "WIDTH"],
      ["volume", "VOLUME"],
    ],
  ],
];
let lfoSection, dcoSection, vcfSection;
for (const [name, x, w, controls] of upper) {
  const s = section(
    name,
    x,
    112,
    w,
    231,
    name.startsWith("ENV") || name.startsWith("HPF") ? "red" : "blue",
    true,
  );
  if (name === "LFO") lfoSection = s;
  if (name === "DCO") dcoSection = s;
  if (name === "HPF / VCF") vcfSection = s;
  let centers;
  if (name === "DCO") centers = [33, 118, 195, 247];
  else if (name === "LFO") centers = [49, 121];
  else
    centers = {
      MIXER: [35, 85, 138, 190],
      "HPF / VCF": [36, 98, 159, 214],
      "ENV 1 (FILTER)": [37, 93, 150, 205],
      "ENV 2 (AMP)": [38, 94, 149, 203],
      MASTER: [40, 113, 194],
    }[name];
  controls.forEach(([k, label], i) =>
    range(s, k, label, centers[i] - 25, name === "HPF / VCF" ? 96 : 46, 50, name === "LFO" ? 132 : name === "DCO" ? 114 : name === "HPF / VCF" ? 116 : 168),
  );
}
// All filter models have dedicated on-panel hardware buttons, no dropdown.
const filterChoices=["NATIVE","ROLAND","SSM","CURTIS","MS-20","SEM","LADDER","COMB"];
const filterBoard=el("div","filter-button-board",vcfSection);
filterChoices.forEach((name,i)=>{
 const b=el("button","filter-choice",filterBoard);
 b.type="button";b.textContent=name;b.title="VCF model: "+name;
 b.setAttribute("aria-label",b.title);
 b.classList.toggle("on",Math.round(params.filterModel)===i);
 b.setAttribute("aria-pressed",String(Math.round(params.filterModel)===i));
 b.onclick=()=>setParam("filterModel",i);
 if(!bindings.has("filterModel"))bindings.set("filterModel",[]);
 bindings.get("filterModel").push({input:{value:0},paint:v=>{
  b.classList.toggle("on",Math.round(v)===i);
  b.setAttribute("aria-pressed",Math.round(v)===i?"true":"false");
 }});
});
["∿", "⋀", "⊓"].forEach((label, i) =>
  button(
    lfoSection,
    "lfo-" + i,
    label,
    21 + i * 46,
    188,
    39,
    31,
    () => {
      setParam("lfoWave", i);
      refreshSwitches();
    },
    "wave",
  ),
);
// Shared extended waveform palette. Original 0/1/2 codes remain compatible.
// Compact hardware waveform rows clear of all four DCO faders.
const waveLabels=["SAW","TRI","PULSE","SQR","PWM"];
for(let osc=1;osc<=2;osc++){
 const row=el("div","osc-wave-row",dcoSection);
 row.style.top=(osc===1?173:202)+"px";
 const name=el("span","osc-row-name",row);name.textContent="OSC "+osc;
 waveLabels.forEach((label,i)=>{
  const b=el("button","osc-wave-button",row);b.id=`wave${osc}-${i}`;
  b.type="button";b.textContent=label==="PULSE"?"PLS":label;
  b.title="Oscillator "+osc+" · "+label;
  b.setAttribute("aria-label",b.title);
  b.onclick=()=>{setParam("wave"+osc,i);refreshSwitches();};
  toggles.set(b.id,b);
 });
}
const arp = section("ARPEGGIATOR", 52, 368, 316, 186, "white");
function setArp(value) {
  Object.assign(music.arp, value);
  send({ type: "arp", value });
  refreshSwitches();
}
const arpButtons = [
  [
    "arpOn",
    '<span class="led"></span>',
    "ON",
    () => setArp({ on: !music.arp.on }),
  ],
  ["arpUp", "▱", "UP", (e) => setArp({ mode: e.shiftKey ? "pendulum" : "up" })],
  ["arpDown", "▱", "DOWN", () => setArp({ mode: "down" })],
  ["arpRandom", "▥", "RND", () => setArp({ mode: "random" })],
  ["arpHold", "Hᴅ", "HOLD", () => setArp({ hold: !music.arp.hold })],
];
arpButtons.forEach(([id, text, label, fn], i) => {
  button(
    arp,
    id,
    text,
    [22, 88, 146, 204, 259][i],
    51,
    [39, 49, 49, 49, 46][i],
    34,
    fn,
  );
  const l = el("span", "button-label", arp);
  l.textContent = label;
  l.style.cssText = `left:${[17, 86, 144, 202, 257][i]}px;top:90px;width:52px`;
});
let t = el("span", "button-label", arp);
t.textContent = "RANGE";
t.style.cssText = "left:22px;top:115px";
for (let i = 1; i <= 4; i++)
  button(arp, "range" + i, "" + i, 22 + (i - 1) * 43, 138, 37, 29, () =>
    setArp({ range: i }),
  );
t = el("span", "button-label", arp);
t.textContent = "RATE";
t.style.cssText = "left:239px;top:115px";
const ar = el("div", "horizontal", arp);
ar.style.cssText = "left:205px;top:138px;width:96px";
const arc = el("span", "cap", ar),
  ari = el("input", "", ar);
ari.type = "range";
ari.min = 0.05;
ari.max = 20;
ari.step = 0.01;
ari.value = music.arp.rate;
ari.setAttribute("aria-label", "Arpeggiator rate");
function paintArp(v = music.arp.rate) {
  music.arp.rate = v;
  ari.value = music.arp.rate;
  arc.style.left = ((music.arp.rate - 0.05) / 19.95) * 77 + "px";
}
ari.oninput = () => {
  setParam("arpRate", +ari.value);
};
bindings.set("arpRate", [{ input: ari, paint: paintArp }]);
$("#arpUp").addEventListener("dblclick", () => setArp({ mode: "pendulum" }));
$("#arpUp").addEventListener("contextmenu", (e) => {
  e.preventDefault();
  setArp({ mode: "pendulum" });
});
const au = section("AUTOMATION", 377, 368, 269, 186, "white");
const autoActions = [
  ["autoRec", '<span class="round-led"></span>', "REC", "autoRec"],
  [
    "autoPlay",
    '<span class="glyph"><svg viewBox="0 0 24 24"><path d="M5 2L21 12 5 22Z"/></svg></span>',
    "PLAY",
    "autoPlay",
  ],
  [
    "autoStop",
    '<span class="glyph"><svg viewBox="0 0 24 24"><path d="M4 4H20V20H4Z"/></svg></span>',
    "STOP",
    "autoStop",
  ],
  ["autoLoop", '<span class="glyph">↻</span>', "LOOP", null],
  [
    "autoOverdub",
    '<span class="glyph"><svg viewBox="0 0 24 24"><path d="M4 4H20V20H4Z"/></svg></span>',
    "OVR",
    null,
  ],
  [
    "autoClear",
    '<span class="glyph"><svg viewBox="0 0 24 24"><path d="M4 4H20V20H4Z"/></svg></span>',
    "CLR",
    "autoClear",
  ],
];
autoActions.forEach(([id, icon, label, type], i) =>
  button(
    au,
    id,
    icon + "<span>" + label + "</span>",
    13 + (i % 3) * 62,
    47 + Math.floor(i / 3) * 61,
    53,
    53,
    () => {
      if (id === "autoLoop" || id === "autoOverdub") {
        const k = id === "autoLoop" ? "loop" : "overdub";
        music.automation[k] = !music.automation[k];
        send({ type: "autoOptions", value: { [k]: music.automation[k] } });
        refreshSwitches();
      } else if (
        id !== "autoClear" ||
        confirm("Clear all recorded parameter automation?")
      )
        send({ type });
    },
    "transport",
  ),
);
range(au, "autoSpeed", "SPEED", 203, 39, 43, 124);
const spl = el("div", "speed-labels", au);
spl.innerHTML = "4x<br>2x<br><b>1x</b><br>0.5x<br>0.1x";
spl.style.left = "244px";
const ch = section("CHARACTER / VIEW", 924, 368, 235, 186, "white");
const characters = [["J-106","levelJuno","enableJuno"],["P-6","levelP6","enableP6"],["P-5","levelP5","enableP5"]];
characters.forEach(([label,level,enabled],i) => {
 const x = 7 + i*75;
 range(ch,level,label,x,63,65,81);
 const sw = button(ch,"engine-"+enabled,"ON",x+7,39,49,21,()=>{
  setParam(enabled,params[enabled] >= .5 ? 0 : 1); refreshSwitches();
 },"engine-toggle");
 sw.setAttribute("aria-label",label+" engine enable");
});
button(ch,"viewKey","KEYBOARD",13,152,100,26,()=>setView("key"));
button(ch,"viewSeq","SEQ16",122,152,100,26,()=>setView("seq"));
for (const [name, x, w, controls] of [
  [
    "DELAY",
    1167,
    177,
    [
      ["delayTime", "TIME"],
      ["delayFeedback", "FB"],
      ["delayMix", "MIX"],
    ],
  ],
  [
    "REVERB",
    1352,
    167,
    [
      ["reverbSize", "SIZE"],
      ["reverbDamp", "DAMP"],
      ["reverbMix", "MIX"],
    ],
  ],
]) {
  const s = section(name, x, 368, w, 186);
  controls.forEach(([k, l], i) =>
    range(s, k, l, 6 + i * ((w - 12) / 3), 38, (w - 12) / 3, 134),
  );
}
const chorus = section("CHORUS", 1527, 368, 198, 186);
for (const [i, label, x, w] of [
  [1, "I", 8, 41],
  [2, "II", 54, 41],
  [0, "OFF", 100, 43],
])
  button(
    chorus,
    "chorus" + i,
    label,
    x,
    87,
    w,
    40,
    (e) => {
      setParam("chorusMode", i === 0 ? 0 : (Math.round(params.chorusMode) ^ i));
      refreshSwitches();
    },
  );
range(chorus, "chorusMix", "MIX", 147, 38, 44, 134);
const perf = $("#performance"),
  wheel = el("div", "wheel-panel", perf);
t = el("span", "wheel-title", wheel);
t.textContent = "OCTAVE";
t.style.cssText = "left:40px;top:12px;width:90px";
const oct = el("output", "octave-value", wheel);
oct.textContent = "0";
function changeOct(n) {
  octave = Math.max(-3, Math.min(3, octave + n));
  oct.textContent = octave;
}
button(
  wheel,
  "octDown",
  '<svg viewBox="0 0 24 24"><path d="M19 2L3 12 19 22Z"/></svg>',
  27,
  35,
  37,
  35,
  () => changeOct(-1),
);
button(
  wheel,
  "octUp",
  '<svg viewBox="0 0 24 24"><path d="M5 2L21 12 5 22Z"/></svg>',
  112,
  35,
  37,
  35,
  () => changeOct(1),
);
for (const [k, label, x] of [
  ["bend", "PITCH", 36],
  ["mod", "MOD", 109],
]) {
  t = el("span", "wheel-title", wheel);
  t.textContent = label;
  t.style.cssText = `left:${x - 8}px;top:73px;width:54px`;
  const w = el("div", "wheel", wheel);
  w.style.left = x + "px";
  const i = el("input", "", w);
  i.type = "range";
  i.min = 0;
  i.max = 1;
  i.step = 0.001;
  i.value = toUnit(k, params[k]);
  i.setAttribute("aria-label", label + " wheel");
  bind(k, i, (v) => {
    i.title = v.toFixed(2);
    w.style.setProperty("--wheel-px",Math.round((1-toUnit(k,v))*52+3)+"px");
    w.style.filter = `brightness(${1 + Math.abs(v) * 0.12})`;
  });
  if (k === "bend") {
    const centre = () => setParam(k,0);
    i.addEventListener("pointerup",centre);
    i.addEventListener("pointercancel",centre);
    i.addEventListener("change",centre);
  }
}
// Physical-style keyboard latching. HOLD is independent of exclusive ADD/REPLACE.
// These controls affect manual computer/on-screen notes; MIDI note velocity is also
// handled by VELOCITY. Latches use stable IDs and are explicitly released on panic.
let keyHold=false,keyHoldMode="add",velocitySensitive=false;
const latchedKeys=new Map();
const keyControlPanel=el("div","key-control-panel",wheel);
const holdButton=el("button","key-option",keyControlPanel);
holdButton.type="button";holdButton.textContent="HOLD";
const addButton=el("button","key-option",keyControlPanel);
addButton.type="button";addButton.textContent="ADD";
const replaceButton=el("button","key-option",keyControlPanel);
replaceButton.type="button";replaceButton.textContent="REPLACE";
const velocityButton=el("button","key-option key-velocity",keyControlPanel);
velocityButton.type="button";velocityButton.textContent="VELOCITY";
velocityButton.title="Enable note velocity sensitivity (off by default)";
function releaseLatchedKeys(){
 for(const [note,id] of latchedKeys){send({type:"off",id});visualNote(note-octave*12,false);visualNote(note,false);}
 latchedKeys.clear();
}
let latchSerial=0;
function latchNote(note, velocity, visual=note){
 if(keyHoldMode==="replace") releaseLatchedKeys();
 if(latchedKeys.has(note)){
   send({type:"off",id:latchedKeys.get(note)});
   latchedKeys.delete(note);
 }
 const id="latch:"+note+":"+(++latchSerial);
 latchedKeys.set(note,id);
 visualNote(visual,true);
 send({type:"on",id,note,velocity:velocitySensitive?velocity:1});
}
function updateKeyOptions(){
 for(const [b,on] of [[holdButton,keyHold],[addButton,keyHoldMode==="add"],[replaceButton,keyHoldMode==="replace"],[velocityButton,velocitySensitive]]){
  b.classList.toggle("selected",on);b.setAttribute("aria-pressed",String(on));
 }
 velocityButton.textContent="VELOCITY";
}
holdButton.onclick=()=>{keyHold=!keyHold;if(!keyHold)releaseLatchedKeys();updateKeyOptions();};
addButton.onclick=()=>{keyHoldMode="add";updateKeyOptions();};
replaceButton.onclick=()=>{keyHoldMode="replace";updateKeyOptions();};
velocityButton.onclick=()=>{velocitySensitive=!velocitySensitive;updateKeyOptions();};
updateKeyOptions();
const keyboard = el("div", "keyboard", perf);
keyboard.id = "keyboard-view";
const whites = [];
for (let n = 48; n <= 96; n++)
  if (![1, 3, 6, 8, 10].includes(n % 12)) whites.push(n);
for (const n of whites) {
  const b = el("button", "key white", keyboard);
  b.setAttribute("aria-label", "Note " + n);
  b.dataset.note = n;
  keys.set(n, b);
}
for (let n = 48; n <= 96; n++)
  if (!whites.includes(n)) {
    const b = el("button", "key black", keyboard),
      before = whites.filter((x) => x < n).length;
    b.style.left = (before / whites.length) * 1482 - 16 + "px";
    b.setAttribute("aria-label", "Note " + n);
    b.dataset.note = n;
    keys.set(n, b);
  }
function visualNote(n, on) {
  keys.get(n)?.classList.toggle("pressed", on);
}
function noteOn(id,n,velocity=.8){
 if(keyHold){latchNote(n+octave*12,velocity,n);return;}
 visualNote(n,true);
 send({type:"on",id,note:n+octave*12,velocity:velocitySensitive?velocity:1});
}
function noteOff(id,n){
 if(keyHold) return;
 visualNote(n,false);
 send({type:"off",id});
}
keyboard.addEventListener("pointerdown", (e) => {
  const n = +e.target.dataset.note;
  if (!Number.isFinite(n)) return;
  e.preventDefault();
  keyboard.setPointerCapture(e.pointerId);
  heldPointers.set(e.pointerId, n);
  noteOn("pointer" + e.pointerId, n);
});
keyboard.addEventListener("pointermove", (e) => {
  if (!heldPointers.has(e.pointerId)) return;
  const hit = document.elementFromPoint(e.clientX, e.clientY),
    n = +hit?.dataset.note;
  if (Number.isFinite(n) && n !== heldPointers.get(e.pointerId)) {
    noteOff("pointer" + e.pointerId, heldPointers.get(e.pointerId));
    heldPointers.set(e.pointerId, n);
    noteOn("pointer" + e.pointerId, n);
  }
});
function releasePointer(e) {
  if (heldPointers.has(e.pointerId)) {
    noteOff("pointer" + e.pointerId, heldPointers.get(e.pointerId));
    heldPointers.delete(e.pointerId);
  }
}
keyboard.addEventListener("pointerup", releasePointer);
keyboard.addEventListener("pointercancel", releasePointer);
keyboard.addEventListener("lostpointercapture", releasePointer);
const seq = el("div", "", perf);
seq.id = "seq-view";
for (let i = 0; i < 16; i++) {
  const step = el("div", "seq-step", seq);
  step.dataset.step = i;
  step.style.left = 17 + i * 91 + "px";
  el("span", "step-number", step).textContent = String(i + 1).padStart(2, "0");
  const f = el("div", "fader", step),
    lab = el("label", "", f);
  lab.textContent = "0";
  el("div", "scale", f);
  el("div", "slot", f);
  const cap = el("span", "cap", f),
    input = el("input", "", f);
  input.type = "range";
  input.min = -12;
  input.max = 12;
  input.step = 1;
  input.value = 0;
  input.setAttribute("aria-label", "Step " + (i + 1));
  function paint(value = music.seq.steps[i]) {
    const v = Math.round(value);
    music.seq.steps[i] = v;
    input.value = v;
    lab.textContent = (v > 0 ? "+" : "") + v;
    cap.style.top = 27 + ((12 - v) / 24) * 87 + "px";
  }
  input.oninput = () => {
    setParam("seqStep" + i, +input.value);
  };
  bindings.set("seqStep" + i, [{ input, paint }]);
  step.paint = paint;
  paint();
}
const so = el("div", "seq-options", seq);
so.innerHTML =
  '<button class="hardware" id="seqPlay">▶ PLAY</button><button class="hardware" id="seqPause">Ⅱ PAUSE</button><button class="hardware" id="seqStop">■ STOP</button><label>ROOT <input id="seqRoot" type="number" min="0" max="127" value="48"></label><label>LENGTH <input id="seqLength" type="number" min="1" max="16" value="16"></label><label>DIRECTION <select id="seqDirection"><option value="forward">FORWARD</option><option value="reverse">REVERSE</option><option value="pendulum">PENDULUM</option></select></label><label>RATE <input id="seqRate" type="number" min="0.05" max="40" step=".05" value="4"></label>';
for (const id of ["seqPlay", "seqPause", "seqStop"])
  $("#" + id).onclick = () => send({ type: id });
for (const [id, k, min, max] of [
  ["seqRoot", "root", 0, 127],
  ["seqLength", "length", 1, 16],
  ["seqRate", "rate", 0.05, 40],
  ["seqDirection", "direction"],
])
  $("#" + id).onchange = (e) => {
    const v =
      min === undefined
        ? e.target.value
        : Math.max(min, Math.min(max, +e.target.value || min));
    music.seq[k] = v;
    e.target.value = v;
    send({ type: "seq", value: { [k]: v } });
  };
function setView(v) {
  view = v;
  keyboard.style.display = v === "key" ? "flex" : "none";
  seq.style.display = v === "seq" ? "block" : "none";
  setOn("viewKey", v === "key");
  setOn("viewSeq", v === "seq");
}
function refreshSwitches() {
  for (let i = 0; i < 3; i++) {
    setOn("lfo-" + i, Math.round(params.lfoWave) === i);
    for (let osc = 1; osc <= 2; osc++)
      setOn(`wave${osc}-${i}`, Math.round(params["wave" + osc]) === i);
  }
  for(let osc=1;osc<=2;osc++) for(let i=3;i<5;i++) setOn(`wave${osc}-${i}`,Math.round(params["wave"+osc])===i);
  setOn("arpOn", music.arp.on);
  setOn("arpHold", music.arp.hold);
  setOn("arpUp", ["up", "pendulum"].includes(music.arp.mode));
  $("#arpUp").title =
    "UP · Shift-click: UP/DOWN" +
    (music.arp.mode === "pendulum" ? " (active)" : "");
  setOn("arpDown", music.arp.mode === "down");
  setOn("arpRandom", music.arp.mode === "random");
  for (let i = 1; i <= 4; i++) setOn("range" + i, music.arp.range === i);
  setOn("autoLoop", music.automation.loop);
  setOn("autoOverdub", music.automation.overdub);
  for (const i of [0,1,2])
    setOn("chorus"+i,i===0 ? Math.round(params.chorusMode)===0 : !!(Math.round(params.chorusMode)&i));
  for (const [, , enabled] of characters) {
    const sw = $("#engine-"+enabled);
    if(sw) { sw.textContent = params[enabled] >= .5 ? "ON" : "OFF"; setOn(sw.id,params[enabled]>=.5); }
  }
}
const computerCodes = [
  "KeyA",
  "KeyW",
  "KeyS",
  "KeyE",
  "KeyD",
  "KeyF",
  "KeyT",
  "KeyG",
  "KeyY",
  "KeyH",
  "KeyU",
  "KeyJ",
  "KeyK",
  "KeyO",
  "KeyL",
  "KeyP",
  "Semicolon",
];
window.addEventListener("keydown", (e) => {
  if (e.target.matches("input,select,textarea") || $("#patch-dialog").open)
    return;
  if (e.code === "Space") {
    e.preventDefault();
    panic();
    return;
  }
  const i = computerCodes.indexOf(e.code);
  if (i < 0 || e.repeat) return;
  e.preventDefault();
  computerHeld.set(e.code, 60 + i);
  noteOn("computer" + e.code, 60 + i);
});
window.addEventListener("keyup", (e) => {
  if (computerHeld.has(e.code)) {
    noteOff("computer" + e.code, computerHeld.get(e.code));
    computerHeld.delete(e.code);
  }
});
function releaseInputs() {
  for (const [id, n] of heldPointers) noteOff("pointer" + id, n);
  heldPointers.clear();
  for (const [id, n] of computerHeld) noteOff("computer" + id, n);
  computerHeld.clear();
}
window.addEventListener("blur", releaseInputs);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) releaseInputs();
});
function panic() {
  latchedKeys.clear();
  midiQueues.clear();
  audio.send({ type: "panic" });
  heldPointers.clear();
  computerHeld.clear();
  document
    .querySelectorAll(".pressed")
    .forEach((k) => k.classList.remove("pressed"));
  status("Panic · notes and transports stopped");
}
$("#audio").onclick = () => ready().catch(() => {});
$("#panic").onclick = panic;
let midiAccess;
const midiQueues = new Map();
let midiSerial = 0;
function midiMessage(port, event) {
  const [code, n, v = 0] = event.data,
    ch = code & 15,
    type = code & 240,
    key = port.id + ":" + ch + ":" + n;
  if (type === 144 && v > 0) {
    const id = "midi:" + key + ":" + midiSerial++;
    if (!midiQueues.has(key)) midiQueues.set(key, []);
    midiQueues.get(key).push(id);
    if(keyHold) latchNote(n,v/127,n);
    else {send({type:"on",id,note:n,velocity:velocitySensitive?v/127:1});visualNote(n,true);}
  } else if (type === 128 || (type === 144 && v === 0)) {
    const id = midiQueues.get(key)?.shift();
    if (id && !keyHold) send({ type: "off", id });
    if (!keyHold) visualNote(n, false);
  } else if (type === 176) {
    if (n === 64) send({ type: "sustain", on: v >= 64 });
    else if (n === 1) setParam("mod", v / 127);
    else if (n === 120 || n === 123) {
      midiQueues.clear();
      panic();
    }
  } else if (type === 224) setParam("bend", ((n + v * 128 - 8192) / 8192) * 2);
}
$("#midi").onclick = async () => {
  try {
    await ready();
    if (!navigator.requestMIDIAccess)
      throw Error("Web MIDI is unavailable in this browser");
    midiAccess = await navigator.requestMIDIAccess({ sysex: false });
    const connect = () => {
      for (const port of midiAccess.inputs.values())
        port.onmidimessage = (e) => midiMessage(port, e);
      status(`MIDI connected · ${midiAccess.inputs.size} input(s)`);
    };
    midiAccess.onstatechange = (e) => {
      if (e.port.state === "disconnected") {
        midiQueues.clear();
        panic();
      }
      connect();
    };
    connect();
  } catch (e) {
    status("MIDI: " + e.message);
  }
};
const presetButton = el("button","preset-launch",$("#brand"));
presetButton.type="button";
presetButton.textContent="FACTORY PRESETS  ▾";
const dialog = $("#patch-dialog"),
  select = $("#preset");
function fillPresets(selected = "init") {
  select.replaceChildren();
  const initOption = el("option", "", select);
  initOption.value = "init";
  initOption.textContent = "Initialize";
  // HTML supports one optgroup level; labels combine engine and sound category.
  for (const group of factoryGroups) {
    const g = el("optgroup", "", select);
    g.label = `${group.engine} / ${group.category}`;
    for (const i of group.indices) {
      const o = el("option", "", g);
      o.value = "f" + i;
      o.textContent = factory[i].name;
    }
  }
  const userGroup = el("optgroup", "", select);
  userGroup.label = "User / Saved patches";
  users.forEach((p, i) => {
    const o = el("option", "", userGroup);
    o.value = "u" + i;
    o.textContent = p.name;
  });
  select.value = selected;
}
function loadPatch(p) {
  releaseLatchedKeys();
  current = validatePatch(p);
  params = { ...current.params };
  music = {
    arp: structuredClone(current.arp),
    seq: structuredClone(current.seq),
    automation: structuredClone(current.automation),
  };
  if (initialized) audio.send({ type: "patch", patch: current });
  for (const k of Object.keys(params)) update(k);
  refreshSwitches();
  paintArp();
  for (const st of document.querySelectorAll(".seq-step")) st.paint();
  for (const [id, k] of [
    ["seqRoot", "root"],
    ["seqLength", "length"],
    ["seqDirection", "direction"],
    ["seqRate", "rate"],
  ])
    $("#" + id).value = music.seq[k];
  document
    .querySelectorAll(".pressed")
    .forEach((k) => k.classList.remove("pressed"));
  setOn("autoRec", false);
  setOn("autoPlay", false);
  $("#patch-status").textContent = "Loaded " + current.name;
}
async function capture(name = current.name) {
  let state = { params, ...music };
  if (initialized) {
    await ready();
    state = await audio.snapshot();
  }
  return validatePatch({
    ...patch(name),
    params: state.params,
    arp: state.arp,
    seq: state.seq,
    automation: state.automation,
  });
}
function patchError(e) {
  $("#patch-status").textContent = e.message;
}
const openPresets=()=>{releaseInputs();dialog.showModal();select.focus();};
$("#patches").onclick=openPresets;
presetButton.onclick=openPresets;
select.onchange = () =>
  loadPatch(
    select.value === "init"
      ? patch("Initialize")
      : (select.value[0] === "f" ? factory : users)[+select.value.slice(1)],
  );
$("#save").onclick = async () => {
  const name = prompt("Name this patch", current.name);
  if (!name) return;
  try {
    const p = await capture(name);
    users.push(p);
    writeUsers(users);
    fillPresets("u" + (users.length - 1));
    current = p;
    $("#patch-status").textContent = "Saved " + name;
  } catch (e) {
    patchError(e);
  }
};
$("#rename").onclick = () => {
  if (select.value[0] !== "u") {
    patchError(Error("Save a user copy before renaming."));
    return;
  }
  const i = +select.value.slice(1),
    name = prompt("New patch name", users[i].name);
  if (name) {
    users[i].name = name.slice(0, 100);
    current.name = users[i].name;
    try {
      writeUsers(users);
      fillPresets("u" + i);
    } catch (e) {
      patchError(e);
    }
  }
};
$("#delete").onclick = () => {
  if (select.value[0] !== "u") return;
  if (confirm("Delete this user patch?")) {
    users.splice(+select.value.slice(1), 1);
    try {
      writeUsers(users);
      fillPresets();
      loadPatch(factory[0]);
    } catch (e) {
      patchError(e);
    }
  }
};
$("#init").onclick = () => loadPatch(patch("Initialize"));
$("#export").onclick = async () => {
  try {
    const p = await capture(),
      url = URL.createObjectURL(
        new Blob([JSON.stringify(p, null, 2)], { type: "application/json" }),
      ),
      a = el("a", "", document.body);
    a.href = url;
    a.download = p.name.replace(/[^a-z0-9]/gi, "_") + ".json";
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (e) {
    patchError(e);
  }
};
$("#import").onchange = async (e) => {
  try {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 10e6) throw Error("Patch file exceeds 10 MB.");
    const p = validatePatch(JSON.parse(await file.text()));
    loadPatch(p);
    $("#patch-status").textContent =
      "Imported " + p.name + " · Save as to keep in browser";
  } catch (e) {
    patchError(e);
  }
  e.target.value = "";
};
for (const [k, label] of [
  ["sync", "Hard sync"],
  ["polyMod", "Poly-Mod / cross modulation"],
  ["lfoPitch", "LFO → pitch"],
  ["lfoPWM", "LFO → PWM"],
  ["lfoFilter", "LFO → filter"],
]) {
  const l = el("label", "", $("#context-controls"));
  l.append(document.createTextNode(label));
  const i = el("input", "", l);
  i.type = "range";
  i.min = 0;
  i.max = 1;
  i.step = k === "sync" ? 1 : 0.001;
  i.value = toUnit(k, params[k]);
  i.setAttribute("aria-label", label);
  bind(k, i, (v) => {
    i.title = v.toFixed(3);
  });
}
function scale() {
  // Fit the complete 1774×887 panel within the usable viewport. No scrollbars.
  // Reserve footer height and a few pixels for browser rounding.
  const footer = document.querySelector("footer");
  const footerHeight = footer ? footer.getBoundingClientRect().height : 48;
  const availW = Math.max(1,window.innerWidth-8);
  const availH = Math.max(1,window.innerHeight-footerHeight-8);
  const s=Math.min(availW/1774,availH/887);
  $("#instrument").style.zoom=s;
  $("#instrument").style.transform="none";
  $("#viewport").style.height=Math.floor(887*s)+"px";
  $("#instrument").style.marginBottom="0px";
}
window.addEventListener("resize", scale);
scale();
fillPresets();
document.addEventListener("wheel",e=>{
 const input=e.target.closest?.('input[type="range"]');
 if(!input || input.disabled) return;
 e.preventDefault();
 const min=Number(input.min||0),max=Number(input.max||1),configured=Number(input.step);
 const step=Number.isFinite(configured)&&configured>=.1?configured:(max-min)/(e.shiftKey?100:50);
 input.value=Math.max(min,Math.min(max,Number(input.value)+(e.deltaY<0?step:-step)));
 input.dispatchEvent(new Event("input",{bubbles:true}));
},{passive:false});
refreshSwitches();
setView(view);
paintArp();
// Explicit test surface, also useful for offline render diagnostics in development.
window.sfpoly = {
  audio,
  setParam,
  send,
  loadPatch,
  capture,
  setView,
  get params() {
    return params;
  },
  get music() {
    return music;
  },
};

// Track 6 analogue hardware inside the main control row.
const analogPanel=section("ANALOGUE VOICES",654,368,262,186);
analogPanel.classList.add("track6-analog");
const ledRow=el("div","voice-leds",analogPanel);
ledRow.innerHTML=Array.from({length:12},(_,i)=>'<span class="voice-cell"><i class="voice-light"></i><small>'+(i+1)+'</small></span>').join("");
const controls=el("div","track6-controls",analogPanel);
for(const [label,k] of [["ANALOG","analog"],["DETUNE","analogDetune"]]){
 const wrap=el("label","track6-knob",controls);
 const labelText=el("span","analog-caption",wrap);labelText.textContent=label;
 const rail=el("div","analog-rail",wrap);
 const scale=el("div","analog-scale",rail);
 const slot=el("div","analog-slot",rail);
 const cap=el("span","analog-cap",rail);
 const input=el("input","analog-input",rail);
 input.type="range";input.min=0;input.max=1;input.step=.001;input.setAttribute("aria-label",label);
 bind(k,input,v=>{const u=toUnit(k,v);cap.style.left=(5+u*84)+"px";input.title=label+": "+Math.round(v*100)+"%";});
}
const modes=el("div","track6-modes",analogPanel);
for(const [label,value] of [["MONO",0],["UNISON",1],["POLY",2]]){
 const btn=el("button",null,modes);btn.type="button";btn.textContent=label;
 btn.onclick=()=>setParam("voiceMode",value);
 const paint=()=>btn.classList.toggle("selected",Math.round(params.voiceMode)===value);
 if(!bindings.has("voiceMode"))bindings.set("voiceMode",[]);
 bindings.get("voiceMode").push({input:{value:0},paint});paint();
}
