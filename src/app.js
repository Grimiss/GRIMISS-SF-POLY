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
  view = "key",
  patchDirty = false,
  activePresetId = "init";
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
  markPatchDirty();
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
  box.dataset.param = k;
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
    // Parameter value stays available to assistive technology while dragging.
    // Native browser title tooltips obscure the slot and are intentionally disabled.
    input.removeAttribute("title");
    input.setAttribute("aria-valuetext", v.toFixed(3));
  });
  return box;
}
// Reusable vintage potentiometer. Original parameter binding, wheel,
 // keyboard and audio routing are unchanged. Vertical pointer drag is precise.
function rotary(parent,k,label,x,y,size=53){
 const root=el("div","sf-rotary",parent);
 root.dataset.param=k;
 root.style.cssText="left:"+x+"px;top:"+y+"px;width:"+size+"px;height:95px";
 const caption=el("label","sf-rotary-label",root);
 caption.textContent=label;
 const face=el("div","sf-knob-face",root);
 const marker=el("i","sf-knob-marker",face);
 const input=el("input","sf-knob-input",face);
 input.type="range";input.min=0;input.max=1;input.step=.0001;
 input.setAttribute("aria-label",label+" "+k);
 input.id="knob-"+k+"-"+(bindings.get(k)?.length||0);
 caption.htmlFor=input.id;
 bind(k,input,v=>{
   const unit=toUnit(k,v);
   face.style.setProperty("--angle",(-135+unit*270)+"deg");
   input.setAttribute("aria-valuetext",String(Math.round(unit*100))+" percent");
 });
 let drag=null;
 input.addEventListener("pointerdown",e=>{
  drag={y:e.clientY,value:+input.value};
  input.setPointerCapture?.(e.pointerId);
  e.preventDefault();
 });
 input.addEventListener("pointermove",e=>{
  if(!drag)return;
  const scale=e.shiftKey?420:190;
  const value=Math.max(0,Math.min(1,drag.value+(drag.y-e.clientY)/scale));
  input.value=value;
  input.dispatchEvent(new Event("input",{bubbles:true}));
 });
 for(const event of ["pointerup","pointercancel","lostpointercapture"])
  input.addEventListener(event,()=>drag=null);
 return root;
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
// New 1980s panel layout: separate HPF/BOOST, large VCF and stacked DCO waves.
// All original parameter names and patch storage remain compatible.
// Balanced manufacturing grid, 8 mm-style consistent panel gaps.
// Main control-dense sections receive space reclaimed from HPF/FILTER/MASTER.
const upperLayout=[
 ["LFO",52,146],
 ["DCO",206,292],
 ["MIXER",506,211],
 ["HPF",725,82],
 ["FILTER",815,302],
 ["ENV 1 (FILTER)",1125,215],
 ["ENV 2 (AMP)",1348,215],
 ["MASTER",1571,154]
];
const upperSections=new Map();
for(const [name,x,w] of upperLayout)
 upperSections.set(name,section(name,x,96,w,231,"blue",true));
const lfoSection=upperSections.get("LFO"),
  dcoSection=upperSections.get("DCO"),
  mixerSection=upperSections.get("MIXER"),
  hpfSection=upperSections.get("HPF"),
  vcfSection=upperSections.get("FILTER");

function upperFaders(section,keys,centres,top=46,height=166,width=46){
 keys.forEach(([k,label],i)=>range(section,k,label,centres[i]-width/2,top,width,height));
}
// LFO waveform keys are now in the middle; both faders have full 166px travel.
upperFaders(lfoSection,[["lfoRate","RATE"],["lfoDelay","DELAY"]],[23,123],46,166,38);
upperFaders(mixerSection,[["mix1","OSC 1"],["mix2","OSC 2"],["mixSub","SUB"],["mixNoise","NOISE"]],[33,81,129,177],46,166,40);
upperFaders(hpfSection,[["hpf","HPF"]],[41],45,151,46);
const boostButton=button(hpfSection,"bassBoost","BOOST",23,195,36,26,()=>{
 setParam("bassBoost",params.bassBoost>=.5?0:1);
 refreshSwitches();
});
boostButton.title="100 Hz low-frequency shelving boost";
boostButton.setAttribute("aria-label","Bass boost");
upperFaders(vcfSection,[["cutoff","CUTOFF"],["resonance","RES"],["envAmount","ENV"]],[36,91,146],46,166,44);
for(const [name,base,xs] of [
 ["ENV 1 (FILTER)",[["filterA","A"],["filterD","D"],["filterS","S"],["filterR","R"]],[25,74,123,172]],
 ["ENV 2 (AMP)",[["ampA","A"],["ampD","D"],["ampS","S"],["ampR","R"]],[25,74,123,172]]
])upperFaders(upperSections.get(name),base,[29,81,133,185],46,166,42);
upperFaders(upperSections.get("MASTER"),[["tune","TUNE"],["volume","VOLUME"]],[40,114],46,166,42);

// Independent oscillator tune faders now have a full-size travel.
upperFaders(dcoSection,[["osc1Tune","TUNE 1"],["osc2Tune","TUNE 2"]],[25,137],46,166,40);
// SUB OCT and pulse width use the common mechanical travel and scale.
upperFaders(dcoSection,[["subOct","SUB OCT"],["pw","PW"]],[225,271],46,166,30);
// Each oscillator has its own vertical, tactile five-waveform column.
// Shared engraved waveform pictograms, matching the LFO switch artwork.
const waveLabels=["SAW","TRI","PLS","SQR","PWM","SINE"];
// Display from pure to harmonically rich, with the modulation mode last.
// Keep original parameter indices for every factory/user preset.
const waveDisplayOrder=[5,1,0,3,2,4];
const waveformShapes=[
 '<path d="M3 19V3L18 19V3L33 19V3" />',
 '<path d="M3 19L10.5 3L18 19L25.5 3L33 19" />',
 '<path d="M3 19V3H12V19H21V3H33V19" />',
 '<path d="M3 19V3H18V19H33V3" />',
 '<path d="M3 19V3H9V19H16V3H27V19H33V3" /><path d="M3 1H33" stroke-dasharray="3 4" stroke-width="1.2"/>',
 '<path d="M2 11C6 -1 12 -1 17 11S28 23 34 11" />'
];
const waveSvg = i=>'<svg class="sf-wave-icon" viewBox="0 0 36 22" aria-hidden="true" focusable="false">'+waveformShapes[i]+'</svg>';
for(let osc=1;osc<=2;osc++){
 const row=el("div","osc-wave-stack",dcoSection);
 row.style.left=(osc===1?55:166)+"px";
 row.setAttribute("role","group");
 row.setAttribute("aria-label","Oscillator "+osc+" waveform");
 waveDisplayOrder.forEach(i=>{
  const name=waveLabels[i];
  const b=el("button","osc-wave-button",row);b.id=`wave${osc}-${i}`;
  b.type="button";b.innerHTML=name==="PWM"?'<span class="sf-pwm-label">PWM</span>':waveSvg(i);
  b.title="Oscillator "+osc+": "+(name==="PLS"?"PULSE":name);
  b.setAttribute("aria-label",b.title);
  b.onclick=()=>{setParam("wave"+osc,i);refreshSwitches();};
  toggles.set(b.id,b);
 });
}
// Eight filter models form a compact column at right; no menus.
// Descriptive, original circuit-inspired sounds without borrowed instrument names.
// IDs and indices are unchanged, so existing saved presets select identical DSP.
const filterChoices=["NATIVE","SOFT","WARM","BITE","SCREAM","MORPH","LADDER","COMB"];
const filterBoard=el("div","filter-button-board",vcfSection);
filterChoices.forEach((name,i)=>{
 const b=el("button","filter-choice",filterBoard);
 b.type="button";b.textContent=name;
 b.title="Filter model "+name;b.setAttribute("aria-label",b.title);
 b.onclick=()=>setParam("filterModel",i);
 if(!bindings.has("filterModel"))bindings.set("filterModel",[]);
 bindings.get("filterModel").push({input:{value:0},paint:v=>{
  b.classList.toggle("on",Math.round(v)===i);
  b.setAttribute("aria-pressed",String(Math.round(v)===i));
 }});
 b.classList.toggle("on",Math.round(params.filterModel)===i);
});
// LFO shares the exact DCO waveform shapes, stroke and SVG viewport.
const lfoWaveIcons=[5,1,3].map(waveSvg);
// The three central LFO buttons use the same casing and icon measurements.
lfoWaveIcons.forEach((art,i)=>button(lfoSection,"lfo-"+i,art,
  59,68+i*44,28,26,()=>{setParam("lfoWave",i);refreshSwitches();},"wave"));
const arp = section("ARPEGGIATOR", 52, 350, 316, 231, "white");
arp.classList.add("arp-vintage");
function setArp(value){
 Object.assign(music.arp,value);
 send({type:"arp",value});
 refreshSwitches();
 markPatchDirty();
}
const arpText=(text,x,y,w,cls="")=>{
 const e=el("span","arp-panel-label "+cls,arp);
 e.textContent=text;
 e.style.cssText="left:"+x+"px;top:"+y+"px;width:"+w+"px";
 return e;
};
arpText("CLOCK",10,44,74);
arpText("POWER",92,44,36);
arpText("HOLD",134,44,34);
arpText("MODE",173,44,45);
arpText("RANGE",226,44,31);
arpText("TEMPO",265,44,45);
button(arp,"arpClockInternal","INT",11,66,69,25,()=>setArp({clock:"internal"}),"arp-clock");
button(arp,"arpClockMIDI","MIDI",11,97,69,25,()=>setArp({clock:"midi"}),"arp-clock");
button(arp,"arpOn","ON",91,74,37,35,()=>setArp({on:!music.arp.on}),"arp-on");
button(arp,"arpHold","HOLD",131,74,36,35,()=>setArp({hold:!music.arp.hold}),"arp-hold");
const clockReadout=el("div","arp-clock-status",arp);
clockReadout.style.cssText="left:11px;top:137px;width:69px";
clockReadout.textContent="INTERNAL";
const clockDescription=el("span","arp-clock-note",arp);
clockDescription.style.cssText="left:10px;top:185px;width:71px";
clockDescription.textContent="FREE RUN";
for(const [id,mode,label,y] of [
 ["arpUp","up","UP",66],
 ["arpPendulum","pendulum","UP/DN",98],
 ["arpDown","down","DOWN",130],
 ["arpRandom","random","RND",162]
])button(arp,id,label,172,y,46,26,()=>setArp({mode}),"arp-mode");
for(let n=1;n<=4;n++)
 button(arp,"range"+n,String(n),229,66+(n-1)*32,27,26,
 ()=>setArp({range:n}),"arp-range");
// Vertical fader uses the standard registered scale, with a readable BPM display.
// Existing arpRate (steps/sec) is retained: 4 steps per quarter note (16ths).
const arpTempo=range(arp,"arpRate","",267,66,37,129);
arpTempo.classList.add("arp-tempo");
const tempoDisplay=el("output","arp-tempo-display",arp);
tempoDisplay.style.cssText="left:260px;top:197px;width:53px";
function paintArp(v=music.arp.rate){
 music.arp.rate=v;
 arpTempo.querySelector("input").disabled=music.arp.clock==="midi";
 tempoDisplay.textContent=Math.round(v*15)+" BPM";
 if(music.arp.clock==="midi"&&midiClockBpm>0)
  clockReadout.textContent=Math.round(midiClockBpm)+" BPM";
 else clockReadout.textContent=music.arp.clock==="midi"?"WAIT":"INTERNAL";
 clockDescription.textContent=music.arp.clock==="midi"?"MIDI TEMPO":"FREE RUN";
}
let midiClockBpm=0,midiClockTicks=0,midiClockTime=0,midiClockLast=0;
function receiveArpMidiClock(event){
 const code=event.data?.[0];
 if(code===0xFA||code===0xFB){midiClockTicks=0;midiClockTime=0;return true;}
 if(code===0xFC){midiClockTicks=0;midiClockTime=0;clockReadout.textContent="STOP";return true;}
 if(code!==0xF8)return false;
 const now=event.timeStamp||performance.now();
 if(midiClockLast&&now-midiClockLast>500){midiClockTicks=0;midiClockTime=0;}
 midiClockLast=now;
 if(!midiClockTime)midiClockTime=now;
 if(++midiClockTicks>=24){
  const elapsed=now-midiClockTime;
  midiClockTime=now;midiClockTicks=0;
  if(elapsed>80&&elapsed<6000){
   const measured=Math.max(15,Math.min(300,60000/elapsed));
   midiClockBpm=midiClockBpm?midiClockBpm*.7+measured*.3:measured;
   if(music.arp.clock==="midi"){
    const hz=Math.max(.05,Math.min(20,midiClockBpm/15));
    music.arp.rate=hz;params.arpRate=hz;
    update("arpRate");
    send({type:"arp",value:{rate:hz}});
    paintArp(hz);
   }
  }
 }
 return true;
}
bindings.get("arpRate").push({input:{value:0},paint:paintArp});
paintArp();
const au = section("AUTOMATION", 377, 350, 269, 231, "white");
// Uniform screen-printed transport icons; colour belongs to the glyph, not the switch.
const ico = (paths,viewBox="0 0 24 24") =>
  '<span class="transport-icon"><svg viewBox="'+viewBox+'" aria-hidden="true">'+paths+'</svg></span>';
const autoActions = [
 ["autoRec",ico('<circle cx="12" cy="12" r="7" fill="currentColor"/>'),"REC","autoRec"],
 ["autoPlay",ico('<path d="M7 4L20 12 7 20Z" fill="currentColor"/>'),"PLAY","autoPlay"],
 ["autoStop",ico('<rect x="5" y="5" width="14" height="14" rx="1" fill="currentColor"/>'),"STOP","autoStop"],
 ["autoLoop",ico('<path d="M5 10a8 8 0 0 1 14-3l2 3M21 5v5h-5M19 14a8 8 0 0 1-14 3l-2-3M3 19v-5h5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>'),"LOOP",null],
 ["autoOverdub",ico('<rect x="4" y="4" width="11" height="11" rx="1" fill="none" stroke="currentColor" stroke-width="2.3"/><path d="M15 12v9M10.5 16.5h9" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>'),"OVR",null],
 ["autoClear",ico('<path d="M6 7h12M9 7V4h6v3M8 9l1 11h6l1-11M11 11v6M13 11v6" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"/>'),"CLR","autoClear"]
];
autoActions.forEach(([id, icon, label, type], i) =>
  button(
    au,
    id,
    icon + "<span>" + label + "</span>",
    13 + (i % 3) * 62,
    55 + Math.floor(i / 3) * 73,
    53,
    46,
    () => {
      if (id === "autoLoop" || id === "autoOverdub") {
        const k = id === "autoLoop" ? "loop" : "overdub";
        music.automation[k] = !music.automation[k];
        send({ type: "autoOptions", value: { [k]: music.automation[k] } });
        refreshSwitches();
        markPatchDirty();
      } else if (
        id !== "autoClear" ||
        confirm("Clear all recorded parameter automation?")
      )
        send({ type });
    },
    "transport",
  ),
);
range(au, "autoSpeed", "SPEED", 199, 54, 46, 156);
const spl = el("div", "speed-labels", au);
spl.innerHTML = "<span>4×</span><span>2×</span><span class=\"speed-unity\">1×</span><span>½×</span><span>⅒×</span>";
spl.style.left = "239px";
const ch = section("CIRCUIT CHARACTER", 924, 350, 235, 231, "white");
// Panel descriptions evoke each engine without changing its patch identity.
const characters = [["DIGITAL","levelJuno","enableJuno"],["VINTAGE","levelP6","enableP6"],["CLASSIC","levelP5","enableP5"]];
characters.forEach(([label,level,enabled],i) => {
 const x = 7 + i*75;
 rotary(ch,level,label,x+6,63,59);
 const sw = button(ch,"engine-"+enabled,"ON",x+7,199,49,24,()=>{
  setParam(enabled,params[enabled] >= .5 ? 0 : 1); refreshSwitches();
 },"engine-toggle");
 sw.setAttribute("aria-label",label+" engine enable");
});
// KEYBOARD and SEQ16 have moved to the performance controls by OCTAVE.
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
  const s = section(name, x, 350, w, 231);
  controls.forEach(([k, l], i) =>
    rotary(s,k,l,5 + i * ((w - 12) / 3),76,(w - 12)/3),
  );
}
const chorus = section("CHORUS", 1527, 350, 198, 231);
for (const [i, label, x, w] of [
  [1, "I", 12, 57],
  [2, "II", 76, 57],
  [0, "OFF", 12, 121],
])
  button(
    chorus,
    "chorus" + i,
    label,
    x,
    i===0 ? 121 : 76,
    i===0 ? 121 : w,
    i===0 ? 34 : 37,
    (e) => {
      setParam("chorusMode", i === 0 ? 0 : (Math.round(params.chorusMode) ^ i));
      refreshSwitches();
    },
  );
rotary(chorus, "chorusMix", "MIX", 139, 77, 52);
// Punched red lamp bezels above independent chorus I / II switches.
for(const [n,x] of [[1,37],[2,101]]){
 const lamp=el("span","sf-chorus-lamp",chorus);
 lamp.style.left=x+"px";
 lamp.dataset.chorus=n;
}
const perf = $("#performance"),
  wheel = el("div", "wheel-panel", perf);
let t = el("span", "wheel-title", wheel);
t.textContent = "OCTAVE";
t.style.cssText = "left:40px;top:36px;width:90px";
// The only display-mode selector is next to the keyboard octave controls.
button(wheel,"viewKey","KEYBOARD",9,6,74,25,()=>setView("key"));
button(wheel,"viewSeq","SEQ16",89,6,74,25,()=>setView("seq"));
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
  58,
  33,
  29,
  () => changeOct(-1),
);
button(
  wheel,
  "octUp",
  '<svg viewBox="0 0 24 24"><path d="M5 2L21 12 5 22Z"/></svg>',
  112,
  58,
  33,
  29,
  () => changeOct(1),
);
for (const [k, label, x] of [
  ["bend", "PITCH", 36],
  ["mod", "MOD", 109],
]) {
  t = el("span", "wheel-title", wheel);
  t.textContent = label;
  t.style.cssText = `left:${x - 8}px;top:96px;width:54px`;
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
    markPatchDirty();
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
  for(let osc=1;osc<=2;osc++) for(let i=3;i<6;i++) setOn(`wave${osc}-${i}`,Math.round(params["wave"+osc])===i);
  setOn("bassBoost",params.bassBoost>=.5);
  setOn("arpOn",music.arp.on);
  setOn("arpHold",music.arp.hold);
  setOn("arpClockInternal",music.arp.clock!=="midi");
  setOn("arpClockMIDI",music.arp.clock==="midi");
  for(const [id,mode] of [["arpUp","up"],["arpPendulum","pendulum"],["arpDown","down"],["arpRandom","random"]])
   setOn(id,music.arp.mode===mode);
  if(typeof paintArp==="function")paintArp(music.arp.rate);
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
  if(receiveArpMidiClock(event))return;
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
// Attempt to reconnect MIDI automatically after first browser permission grant.
// Web MIDI is independent of audio activation. Audio remains subject to a user
// gesture and is never started implicitly.
let midiConnecting=false;
async function connectMIDI(automatic=false){
  if(midiConnecting)return;
  if(midiAccess){
    for(const port of midiAccess.inputs.values())
      port.onmidimessage=(event)=>midiMessage(port,event);
    status("MIDI connected · "+midiAccess.inputs.size+" input(s)");
    return;
  }
  if(!navigator.requestMIDIAccess){
    if(!automatic)status("MIDI: Web MIDI is unavailable in this browser");
    return;
  }
  midiConnecting=true;
  try{
    midiAccess=await navigator.requestMIDIAccess({sysex:false});
    const bindPorts=()=>{
      for(const port of midiAccess.inputs.values())
        port.onmidimessage=(event)=>midiMessage(port,event);
      const n=midiAccess.inputs.size;
      $("#midi").textContent=n?"MIDI CONNECTED":"CONNECT MIDI";
      $("#midi").title=n?"MIDI connected · "+n+" input(s)":"No MIDI input detected; reconnect devices";
      status("MIDI connected · "+n+" input(s)");
    };
    midiAccess.onstatechange=(event)=>{
      if(event.port.state==="disconnected"){
        midiQueues.clear();
        panic();
      }
      bindPorts();
    };
    bindPorts();
  }catch(error){
    // Permission may require an explicit gesture. Retain the manual button.
    if(!automatic)status("MIDI: "+error.message);
  }finally{midiConnecting=false;}
}
$("#midi").onclick=()=>connectMIDI(false);
// Permission-aware automatic reconnection when the browser restores the page.
// Some browsers block Web MIDI without a gesture; the manual fallback remains.
window.addEventListener("load",()=>connectMIDI(true),{once:true});
const presetButton = el("button","preset-launch",$("#brand"));
presetButton.type="button";
presetButton.textContent="Initialize";
presetButton.setAttribute("aria-label","Open full preset browser");
presetButton.title="Current preset · click to browse";
const prevPresetButton=el("button","preset-header-nav preset-previous",$("#brand"));
prevPresetButton.type="button";prevPresetButton.textContent="‹";prevPresetButton.title="Previous preset";
prevPresetButton.setAttribute("aria-label","Previous preset");
const nextPresetButton=el("button","preset-header-nav preset-next",$("#brand"));
nextPresetButton.type="button";nextPresetButton.textContent="›";nextPresetButton.title="Next preset";
nextPresetButton.setAttribute("aria-label","Next preset");
const headerSaveButton=el("button","preset-header-save",$("#brand"));
headerSaveButton.type="button";headerSaveButton.textContent="SAVE PRESET";
headerSaveButton.title="Save current sound as a user preset";
function updatePresetHeader(){
 presetButton.textContent=current.name+(patchDirty?" *":"");
 presetButton.title=(patchDirty?"Modified · ":"")+"Open preset browser";
}
function markPatchDirty(){
 if(!patchDirty){patchDirty=true;updatePresetHeader();}
}
function presetEntry(id){
 if(id==="init") return patch("Initialize");
 return id?.startsWith("u")?users[Number(id.slice(1))]:factory[Number(id.slice(1))];
}
function navigatePresets(direction){
 const ids=[...factory.map((_,i)=>"f"+i),...users.map((_,i)=>"u"+i)];
 if(!ids.length)return;
 const ix=ids.indexOf(activePresetId);
 const next=ix<0?(direction>0?0:ids.length-1):(ix+direction+ids.length)%ids.length;
 const id=ids[next];
 loadPatch(presetEntry(id),id);
}
prevPresetButton.onclick=()=>navigatePresets(-1);
nextPresetButton.onclick=()=>navigatePresets(1);
headerSaveButton.onclick=()=>$("#save").click();

const dialog = $("#patch-dialog"),
  select = $("#preset");
const browser=el("div","preset-browser",dialog);
browser.innerHTML=`
 <div class="preset-browser-head">
   <div><span class="preset-eyebrow">SOUND LIBRARY</span><h3>Factory &amp; User Presets</h3></div>
   <div class="preset-browser-tools">
     <div class="preset-group-tabs" role="group" aria-label="Group factory presets">
       <button type="button" class="selected" data-group="engine" aria-pressed="true">BY SYNTH</button>
       <button type="button" data-group="category" aria-pressed="false">BY SOUND</button>
     </div>
     <input id="preset-search" type="search" placeholder="Find a sound…" aria-label="Search presets">
   </div>
 </div>
 <div class="preset-browser-list" id="preset-browser-list" role="region" aria-label="All factory and user presets"></div>
`;
// Put the library above the advanced controls, not below them.
dialog.insertBefore(browser,dialog.querySelector(".actions"));
const presetResults=browser.querySelector("#preset-browser-list");
const presetSearch=browser.querySelector("#preset-search");
let presetGrouping="engine";
browser.querySelectorAll("[data-group]").forEach(b=>b.onclick=()=>{
 presetGrouping=b.dataset.group;
 browser.querySelectorAll("[data-group]").forEach(el=>{
  const selected=el===b;
  el.classList.toggle("selected",selected);
  el.setAttribute("aria-pressed",String(selected));
 });
 renderPresetBrowser();
});
presetSearch.addEventListener("input",renderPresetBrowser);
function renderPresetBrowser(){
 const filter=presetSearch.value.trim().toLowerCase();
 presetResults.replaceChildren();
 const sections=new Map();
 for(const group of factoryGroups){
  const key=presetGrouping==="engine"?group.engine:group.category;
  if(!sections.has(key))sections.set(key,[]);
  for(const idx of group.indices){
   const label=factory[idx].name.replace(/^\d+\s*[·.-]\s*/,"");
   const meta=presetGrouping==="engine"?group.category:group.engine;
   if((label+" "+meta+" "+key).toLowerCase().includes(filter))
    sections.get(key).push({id:"f"+idx,label,meta});
  }
 }
 const userMatches=users.map((p,i)=>({id:"u"+i,label:p.name,meta:"USER"}))
  .filter(x=>(x.label+" user").toLowerCase().includes(filter));
 const appendGroup=(name,entries,userGroup=false)=>{
  if(!entries.length)return;
  const group=el("section","preset-browser-group",presetResults);
  const title=el("h4","",group);title.textContent=name+"  ·  "+entries.length;
  const grid=el("div","preset-browser-grid",group);
  for(const item of entries){
   const b=el("button","preset-tile",grid);b.type="button";
   b.classList.toggle("selected",activePresetId===item.id);
   b.setAttribute("aria-pressed",String(activePresetId===item.id));
   const label=el("strong","",b);label.textContent=item.label;
   const meta=el("small","",b);meta.textContent=item.meta;
   b.onclick=()=>{loadPatch(presetEntry(item.id),item.id);select.value=item.id;};
  }
 };
 for(const [name,entries] of sections)appendGroup(name,entries);
 appendGroup("USER PRESETS",userMatches,true);
 if(!presetResults.children.length)el("p","preset-empty",presetResults).textContent="No matching presets.";
}

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
function loadPatch(p,sourceId) {
  releaseLatchedKeys();
  activePresetId=sourceId??activePresetId;
  patchDirty=false;
  if(select)select.value=activePresetId;
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
  updatePresetHeader();
  renderPresetBrowser();
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
const openPresets=()=>{releaseInputs();renderPresetBrowser();dialog.showModal();presetSearch.focus();};
$("#patches").onclick=openPresets;
presetButton.onclick=openPresets;
select.onchange = () => loadPatch(presetEntry(select.value),select.value);
$("#save").onclick = async () => {
  const name = prompt("Name this patch", current.name);
  if (!name) return;
  try {
    const p = await capture(name);
    users.push(p);
    writeUsers(users);
    fillPresets("u" + (users.length - 1));
    current = p;
    activePresetId="u"+(users.length-1);
    patchDirty=false;
    updatePresetHeader();renderPresetBrowser();
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
      updatePresetHeader();renderPresetBrowser();
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
      loadPatch(factory[0],"f0");
    } catch (e) {
      patchError(e);
    }
  }
};
$("#init").onclick = () => loadPatch(patch("Initialize"),"init");
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
    loadPatch(p,"init");
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
  ["width", "Stereo width"],
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
updatePresetHeader();renderPresetBrowser();
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
const analogPanel=section("VOICES",654,350,262,231);
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
