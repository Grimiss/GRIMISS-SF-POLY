import {
  defaults,
  specs,
  toUnit,
  fromUnit,
  initialMusic,
} from "./parameters.js?v=20261128-arp-redesign-v1";
import { AudioClient } from "./audio/client.js?v=20261128-arp-monitor-v1";
import {
  factory,
  factoryGroups,
  patch,
  validatePatch,
  readUsers,
  writeUsers,
} from "./presets.js?v=20261128-ae-morph-v1";
import { createAutomationEditor } from "./automation-editor.js?v=20261128-ae-morph-v2";
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
  // The track viewer lives farther down in the module; invoked only
  // after initialization, when its bindings have been created.
  if(typeof updateMiniStatus==="function")updateMiniStatus(state);
  if(typeof updateArpMonitor==="function")updateArpMonitor(state);

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
 // Eleven physical graduation marks at positions 0–10 (ten intervals).
 // Angular travel is exactly -135° to +135°: no markings on the dead arc.
 // The SVG sits outside the knob bezel, scales with each knob diameter
 // and has no pointer events, leaving the full knob hit area available.
 const tickSvg=document.createElementNS("http://www.w3.org/2000/svg","svg");
 tickSvg.setAttribute("viewBox","0 0 100 100");
 tickSvg.setAttribute("aria-hidden","true");
 tickSvg.classList.add("sf-knob-ticks");
 for(let i=0;i<=10;i++){
   const radians=(-135+i*27)*Math.PI/180;
   const inner=i%5===0?39:42;
   const outer=48;
   const line=document.createElementNS("http://www.w3.org/2000/svg","line");
   line.setAttribute("x1",(50+inner*Math.sin(radians)).toFixed(3));
   line.setAttribute("y1",(50-inner*Math.cos(radians)).toFixed(3));
   line.setAttribute("x2",(50+outer*Math.sin(radians)).toFixed(3));
   line.setAttribute("y2",(50-outer*Math.cos(radians)).toFixed(3));
   line.classList.add(i%5===0?"sf-knob-major-tick":"sf-knob-minor-tick");
   tickSvg.append(line);
 }
 face.append(tickSvg);
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
 ["LFO",52,154],
 ["DCO",214,348],
 ["MIXER",570,211],
 ["HPF",789,82],
 ["FILTER",879,302],
 ["ENV 1 (FILTER)",1189,215],
 ["ENV 2 (AMP)",1412,215],
 ["MASTER",1635,90]
];
const upperSections=new Map();
for(const [name,x,w] of upperLayout)
 upperSections.set(name,section(name,x,96,w,231,"blue",true));
// Display names are decoupled from stable panel IDs used by the hardware skin.
upperSections.get("DCO").querySelector("h2").textContent="OSCILLATORS";
upperSections.get("ENV 1 (FILTER)").querySelector("h2").textContent="ENV 1 - FILTER";
upperSections.get("ENV 2 (AMP)").querySelector("h2").textContent="ENV 2 - AMP";
const lfoSection=upperSections.get("LFO"),
  dcoSection=upperSections.get("DCO"),
  mixerSection=upperSections.get("MIXER"),
  hpfSection=upperSections.get("HPF"),
  vcfSection=upperSections.get("FILTER");

function upperFaders(section,keys,centres,top=46,height=166,width=46){
 keys.forEach(([k,label],i)=>range(section,k,label,centres[i]-width/2,top,width,height));
}
// LFO waveform keys are now in the middle; both faders have full 166px travel.
upperFaders(lfoSection,[["lfoRate","RATE"],["lfoDelay","DELAY"]],[27,127],46,166,38);
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
const masterVolume=rotary(upperSections.get("MASTER"),"volume","VOLUME",7,43,76);
masterVolume.classList.add("master-volume");
const masterTune=rotary(upperSections.get("MASTER"),"tune","TUNE",17,140,56);
masterTune.classList.add("master-tune");

// Each oscillator uses a discrete octave display and two hardware arrows
// above a centred ±100-cent TUNE potentiometer. Saved parameter IDs remain
// unchanged, including legacy semitone offset compatibility.
for(const [osc,x] of [[1,11],[2,130]]){
 const heading=el("span","sf-osc-label",dcoSection);
 heading.textContent="OSC "+osc;
 heading.dataset.osc=String(osc);
 heading.style.left=x+"px";
 const key="osc"+osc+"Octave";
 const assembly=el("div","sf-octave-control",dcoSection);
 assembly.style.left=x+"px";
 const caption=el("span","sf-octave-caption",assembly);
 caption.textContent="OCTAVE";
 const display=el("output","sf-octave-display",assembly);
 display.setAttribute("aria-label","Oscillator "+osc+" octave");
 const arrowRow=el("div","sf-octave-arrows",assembly);
 const down=el("button","sf-octave-arrow",arrowRow);
 const up=el("button","sf-octave-arrow",arrowRow);
 for(const [arrow,step,label,glyph] of [
  [down,-1,"Decrease octave","◀"],[up,1,"Increase octave","▶"]
 ]){
  arrow.type="button";
  arrow.textContent=glyph;
  arrow.setAttribute("aria-label","Oscillator "+osc+": "+label);
  arrow.addEventListener("click",()=>{
   const next=Math.max(-2,Math.min(2,Math.round(params[key])+step));
   if(next!==Math.round(params[key]))setParam(key,next);
  });
 }
 // Existing update(k) broadcasts to bindings; the readouts therefore
 // follow preset loading, incoming MIDI automation and arrow clicks.
 const paint=v=>{
  const value=Math.max(-2,Math.min(2,Math.round(v)));
  display.textContent=value>0?"+"+value:String(value);
  down.disabled=value<=-2;
  up.disabled=value>=2;
 };
 if(!bindings.has(key))bindings.set(key,[]);
 bindings.get(key).push({input:{value:0},paint});
 paint(params[key]);
 const tune=rotary(dcoSection,"osc"+osc+"Fine","TUNE",x,143,53);
 tune.classList.add("sf-osc-knob","sf-fine-knob");
}
// SUB OCT and pulse width use the common mechanical travel and scale.
upperFaders(dcoSection,[["subOct","SUB OCT"],["pw","PW"]],[261,308],46,166,30);
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
 row.style.left=(osc===1?82:195)+"px";
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
  77,68+i*44,28,26,()=>{setParam("lfoWave",i);refreshSwitches();},"wave"));
const arp = section("ARPEGGIATOR", 52, 350, 316, 231, "white");
arp.classList.add("arp-vintage","arp-redesign","arp-monitor-revision");
function setArp(value){
 Object.assign(music.arp,value);
 send({type:"arp",value});
 refreshSwitches();
 markPatchDirty();
}
const arpText=(text,x,y,w)=>{
 const e=el("span","arp-panel-label",arp);
 e.textContent=text;
 e.style.cssText=`left:${x}px;top:${y}px;width:${w}px`;
 return e;
};
// Preserve prominent power buttons at upper left.
button(arp,"arpOn","ON",10,43,44,27,()=>setArp({on:!music.arp.on}),"arp-on");
button(arp,"arpHold","HOLD",10,75,44,27,()=>setArp({hold:!music.arp.hold}),"arp-hold");
button(arp,"arpSync","SYNC",59,43,46,27,()=>setArp({clock:music.arp.clock==="midi"?"internal":"midi"}),"arp-clock");
// Single CRT-style status monitor: real BPM + actual sync state + voice movement.
const monitor=el("div","arp-monitor",arp);
monitor.setAttribute("role","img");
monitor.setAttribute("aria-label","Arpeggiator tempo, clock and animated note direction");
const monitorTop=el("div","arp-monitor-top",monitor);
const monitorBpm=el("strong","arp-monitor-bpm",monitorTop);
const monitorClock=el("span","arp-monitor-clock",monitorTop);
const monitorMode=el("span","arp-monitor-mode",monitor);
const viz=document.createElementNS("http://www.w3.org/2000/svg","svg");
viz.setAttribute("class","arp-pattern-viz");viz.setAttribute("viewBox","0 0 170 29");viz.setAttribute("aria-hidden","true");monitor.append(viz);
const guide=document.createElementNS("http://www.w3.org/2000/svg","path");
guide.setAttribute("class","arp-pattern-guide");viz.append(guide);
const activeTrace=document.createElementNS("http://www.w3.org/2000/svg","path");
activeTrace.setAttribute("class","arp-pattern-trace");viz.append(activeTrace);
const spot=document.createElementNS("http://www.w3.org/2000/svg","circle");
spot.setAttribute("class","arp-pattern-spot");spot.setAttribute("r","3.3");viz.append(spot);
const patternHistory=[];
let lastVisualTick=-1,lastVisualMode="",lastArpPlaying=false,monitorSyncReady=false,midiClockStopped=false;
const modeNames={up:"UP",down:"DOWN",pendulum:"UP/DN",random:"RND",played:"PLAY",walk:"WALK"};
function arpGuide(mode){
 const samples={up:[.06,.23,.39,.56,.73,.92],down:[.92,.73,.56,.39,.23,.06],
 pendulum:[.06,.35,.65,.92,.65,.35],random:[.3,.8,.14,.67,.4,.92],
 played:[.25,.78,.47,.9,.14,.62],walk:[.3,.45,.6,.45,.3,.45]}[mode]||[.1,.3,.5,.7,.9];
 return samples.map((v,i)=>`${i?"L":"M"}${(5+i*160/(samples.length-1)).toFixed(1)} ${(25-v*21).toFixed(1)}`).join(" ");
}
function updateArpMonitor(state){
 const syncing=music.arp.clock==="midi";
 if(state)monitorSyncReady=!!state.arpSyncReady;
 monitorBpm.textContent=String(Math.round(music.arp.rate*15)).padStart(3,"0")+" BPM";
 monitorClock.textContent=syncing?(midiClockStopped?"STOP":monitorSyncReady?"SYNC":"WAIT"):"INT";
 monitorClock.classList.toggle("waiting",syncing&&!monitorSyncReady);
 monitorMode.textContent=modeNames[music.arp.mode]||"UP";
 const mode=music.arp.mode;
 if(mode!==lastVisualMode){guide.setAttribute("d",arpGuide(mode));lastVisualMode=mode;patternHistory.length=0;lastVisualTick=-1;}
 const playing=!!music.arp.on && !!state?.arpPlaying;
 if(state && playing && state.arpVisualTick!==lastVisualTick){
  if(lastVisualTick>=0 || state.arpVisualTick>0){
   patternHistory.push(Math.max(0,Math.min(1,Number(state.arpVisualPosition)||0)));
   if(patternHistory.length>10)patternHistory.shift();
  }
  lastVisualTick=state.arpVisualTick;
 }
 if(!playing&&lastArpPlaying)patternHistory.length=0;
 lastArpPlaying=playing;
 const trace=patternHistory.map((v,i)=>`${i?"L":"M"}${(5+i*160/Math.max(1,patternHistory.length-1)).toFixed(1)} ${(25-v*21).toFixed(1)}`).join(" ");
 activeTrace.setAttribute("d",playing?trace:"");
 if(playing&&patternHistory.length){
  const pos=patternHistory.at(-1),x=5+(patternHistory.length-1)*160/Math.max(1,patternHistory.length-1);
  spot.setAttribute("cx",x.toFixed(1));spot.setAttribute("cy",(25-pos*21).toFixed(1));
  spot.style.opacity="1";
 } else spot.style.opacity="0";
 monitor.classList.toggle("running",playing);
}
// Tidy lower hardware switch banks: note order, octave and rhythmic divisions.
arpText("ORDER",9,109,145);
for(const [id,mode,label,x,y] of [
 ["arpUp","up","UP",10,123],["arpDown","down","DN",61,123],
 ["arpPendulum","pendulum","UP/DN",112,123],
 ["arpRandom","random","RND",10,148],["arpPlayed","played","PLAY",61,148],
 ["arpWalk","walk","WALK",112,148]
])button(arp,id,label,x,y,46,22,()=>setArp({mode}),"arp-mode");
arpText("OCT",171,109,66);
for(let n=1;n<=4;n++)
 button(arp,"range"+n,String(n),172+((n-1)%2)*33,123+Math.floor((n-1)/2)*25,29,22,()=>setArp({range:n}),"arp-range");
arpText("DIV",241,109,67);
for(const [div,label,x,y] of [[4,"1/4",242,123],[8,"1/8",275,123],[16,"1/16",242,148],[32,"1/32",275,148]])
 button(arp,"arpDiv"+div,label,x,y,29,22,()=>setArp({division:div}),"arp-division");
for(const [key,label,x] of [
 ["arpRate","SPEED",11],["arpGate","GATE",72],["arpSwing","SWING",133],
 ["arpChance","CHANCE",194],["arpEvolve","EVOLVE",255]
]){
 const knob=rotary(arp,key,label,x,171,48);
 knob.classList.add("arp-pot","arp-pot-"+key);
}
let midiClockBpm=0,midiClockTicks=0,midiClockTime=0,midiClockLast=0;
function paintArp(v=music.arp.rate){
 music.arp.rate=v;
 const syncing=music.arp.clock==="midi";
 const speed=arp.querySelector(".arp-pot-arpRate input");
 if(speed)speed.disabled=syncing;
 updateArpMonitor();
}
function receiveArpMidiClock(event){
 const code=event.data?.[0];
 if(code===0xFA||code===0xFB){midiClockTicks=0;midiClockTime=0;midiClockLast=0;midiClockStopped=false;return true;}
 if(code===0xFC){midiClockTicks=0;midiClockTime=0;midiClockBpm=0;midiClockStopped=true;
  if(music.arp.clock==="midi"){send({type:"syncStop"});updateArpMonitor();}
  return true;
 }
 if(code!==0xF8)return false;
 midiClockStopped=false;
 const now=event.timeStamp||performance.now();
 if(midiClockLast&&now-midiClockLast>500){midiClockTicks=0;midiClockTime=0;midiClockBpm=0;}
 midiClockLast=now;
 if(!midiClockTime)midiClockTime=now;
 if(++midiClockTicks>=24){
  const elapsed=now-midiClockTime;
  midiClockTime=now;midiClockTicks=0;
  if(elapsed>80&&elapsed<6000){
   const measured=Math.max(15,Math.min(300,60000/elapsed));
   midiClockBpm=midiClockBpm?midiClockBpm*.7+measured*.3:measured;
   if(music.arp.clock==="midi"){
    const hz=Math.max(1,Math.min(20,midiClockBpm/15));
    music.arp.rate=hz;params.arpRate=hz;
    update("arpRate");
    send({type:"syncPulse",bpm:midiClockBpm});
    paintArp(hz);
   }
  }
 }
 return true;
}
bindings.get("arpRate").push({input:{value:0},paint:paintArp});
paintArp();
const au = section("AUTOMATION", 377, 350, 269, 231, "white");
function updateMiniStatus(state){
 const wasRecording=miniRecording;
 miniRecording=!!state.autoRecording;
 miniPlaying=!!state.autoPlaying;
 if(wasRecording&&!miniRecording&&audio.node){
  audio.snapshot().then(snap=>{music.automation=snap.automation;renderAutomationMini(snap.automation,snap.autoPosition||0);}).catch(()=>{});
 }
}
// Compact eight-lane overview; visual trial only — it does not edit or cap
// recorded automation. Reflect the existing engine's recorded event tracks.
const mini=el("div","sf-auto-mini",au);
mini.setAttribute("role","img");
mini.setAttribute("aria-label","Automation track timeline overview");
const miniHead=el("div","sf-mini-head",mini);
const miniTitle=el("span","",miniHead); miniTitle.textContent="TRACKS";
const miniCount=el("span","",miniHead); miniCount.textContent="0 / 8";
const miniTime=el("span","",miniHead); miniTime.textContent="0:00";
const miniRows=[];
for(let i=0;i<8;i++){
 const row=el("div","sf-mini-row",mini);
 const label=el("span","sf-mini-name",row);
 const track=el("div","sf-mini-track",row);
 const line=el("div","sf-mini-line",track);
 const playhead=el("div","sf-mini-playhead",track);
 miniRows.push({label,track,line,playhead});
}
function renderAutomationMini(auData=music.automation,position=0){
 const events=Array.isArray(auData?.events)?auData.events:[];
 const clips=Array.isArray(auData?.clips)?auData.clips:[];
 const duration=Math.max(.02,Number(auData?.duration)||0,...events.map(e=>Number(e.t)||0),...clips.map(c=>c.start+c.duration));
 const lanes=new Map();
 if(clips.length){
  for(const clip of clips){
   if(typeof clip.k!=="string")continue;
   if(!lanes.has(clip.k))lanes.set(clip.k,[]);
   lanes.get(clip.k).push(clip.start,clip.start+clip.duration);
  }
 }else for(const ev of events){
  if(typeof ev.k!=="string"||!Number.isFinite(ev.t))continue;
  if(!lanes.has(ev.k))lanes.set(ev.k,[]);
  lanes.get(ev.k).push(ev.t);
 }
 miniCount.textContent=lanes.size+" / 8";
 miniTime.textContent=Math.floor(duration/60)+":"+String(Math.floor(duration%60)).padStart(2,"0");
 const positionPercent=Math.max(0,Math.min(100,position/duration*100));
 let index=0;
 for(const [key,times] of lanes){
  if(index===8)break;
  const lane=miniRows[index++];
  const a=Math.max(0,Math.min(...times))/duration*100;
  const b=Math.min(duration,Math.max(...times))/duration*100;
  lane.label.textContent=key.replace(/([a-z])([A-Z])/g,"$1 $2").replace(/([a-z])([0-9])/g,"$1 $2").toUpperCase();
  lane.label.title=key;
  lane.track.classList.add("filled");
  lane.line.style.left=a+"%";lane.line.style.width=Math.max(2,b-a)+"%";
  lane.playhead.style.left=positionPercent+"%";
 }
 for(;index<8;index++){
  const lane=miniRows[index];
  lane.label.textContent="—";lane.label.removeAttribute("title");
  lane.track.classList.remove("filled");
  lane.line.style.width="0";
  lane.playhead.style.left=positionPercent+"%";
 }
 mini.setAttribute("aria-label",lanes.size+" recorded automation parameters; length "+miniTime.textContent);
}
renderAutomationMini();

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
    10 + i*42,
    197,
    37,
    28,
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
      ){
        send({ type });
        if(id==="autoClear"){
          music.automation.events=[];
          music.automation.clips=[];
          music.automation.duration=0;
          renderAutomationMini();
        }
      }
    },
    "transport",
  ),
);
// SPEED keeps its existing audio-engine parameter; the pot is only a
// visual/control replacement for the vertical speed slider.
const autoSpeedPot=rotary(au,"autoSpeed","SPEED",74,139,46);
autoSpeedPot.classList.add("sf-auto-speed-pot");
// MORPH is intentionally a *visual-only* proposed control in this trial.
// No value is sent to the DSP until the algorithm has been specified.
const morphPot=rotary(au,"autoMorph","MORPH",155,139,44);
morphPot.classList.add("sf-auto-morph-pot");
morphPot.title="Independent gentle tempo drift on each recorded automation parameter: zero to plus/minus 45%";
const automationEditor=createAutomationEditor({
 getAutomation:()=>music.automation,
 getSnapshot:()=>initialized?audio.snapshot():Promise.resolve(null),
 applyAutomation:data=>{
  music.automation={...music.automation,...data};
  renderAutomationMini(music.automation);
  send({type:"autoEdit",value:data});
  markPatchDirty();
 }
});
mini.style.cursor="pointer";
mini.tabIndex=0;
mini.setAttribute("role","button");
mini.setAttribute("aria-label","Open automation timeline editor");
mini.title="Open automation timeline editor";
mini.onclick=()=>automationEditor.open();
mini.onkeydown=e=>{
 if(e.key==="Enter"||e.key===" "){e.preventDefault();automationEditor.open();}
};
// Keep the miniature display up to date at the audio snapshot boundary, but
// never poll if the audio engine isn't running.
let miniRecording=false,miniPlaying=false,miniBusy=false;
setInterval(async()=>{
 if(!initialized||!audio.node||miniBusy||!miniRecording&&!miniPlaying)return;
 miniBusy=true;
 try{
  const snapshot=await audio.snapshot();
  renderAutomationMini(snapshot.automation,snapshot.autoPosition||0);
 }catch(e){}finally{miniBusy=false;}
},650);
const ch = section("CIRCUIT CHARACTER", 924, 350, 205, 231, "white");
// Panel descriptions evoke each engine without changing its patch identity.
const characters = [["DIGITAL","levelJuno","enableJuno"],["VINTAGE","levelP6","enableP6"],["CLASSIC","levelP5","enableP5"]];
const characterIds=characters.map(c=>c[2]);
const characterToggle=button(ch,"characterToggle","TOGGLE",77,158,49,24,()=>{
 const enabled=params.characterToggle<.5;
 setParam("characterToggle",enabled?1:0);
 if(enabled){
   // Deterministic initial selection; when already using multiple circuits
   // favour DIGITAL, otherwise retain the currently enabled circuit.
   const selected=characterIds.find(id=>params[id]>=.5) || characterIds[0];
   for(const id of characterIds){
     if(params[id]!==+(id===selected))setParam(id,+(id===selected));
   }
 }
 refreshSwitches();
},"character-toggle");
characterToggle.title="When ON, only one character circuit can be enabled at once";
characters.forEach(([label,level,enabled],i) => {
 const x = 16 + i*59;
 rotary(ch,level,label,x,65,54);
 const sw=button(ch,"engine-"+enabled,"ON",x+2,199,49,24,()=>{
   const next=params[enabled]>=.5?0:1;
   if(next&&params.characterToggle>=.5){
     for(const other of characterIds){
       if(other!==enabled&&params[other]!==0)setParam(other,0);
     }
   }
   setParam(enabled,next);
   refreshSwitches();
 },"engine-toggle");
 sw.setAttribute("aria-label",label+" engine enable");
});
// KEYBOARD and SEQ16 have moved to the performance controls by OCTAVE.
// Physical two-tier FX strips: two compact controls above one large
// MIX potentiometer, followed by a dedicated effect ON/OFF rocker.
for(const [name,x,w,top] of [
 ["DELAY",1137,192,[["delayTime","TIME"],["delayFeedback","FB"]]],
 ["REVERB",1337,182,[["reverbSize","SIZE"],["reverbDamp","DAMP"]]]
]){
 const sec=section(name,x,350,w,231);
 const inset=14;
 const right=w-14-54;
 top.forEach(([k,label],i)=>{
   const knob=rotary(sec,k,label,i?right:inset,130,54);
   knob.classList.add("sf-fx-top-knob");
 });
 const mix=rotary(sec,name==="DELAY"?"delayMix":"reverbMix","MIX",(w-76)/2,42,76);
 mix.classList.add("sf-fx-mix-knob");
 const key=name==="DELAY"?"delayOn":"reverbOn";
 const onOff=button(sec,"fx-"+key,"ON",(w-49)/2,199,49,24,()=>{
  setParam(key,params[key]>=.5?0:1);
  refreshSwitches();
 },"sf-fx-on");
 onOff.setAttribute("aria-label",name+" effect on/off");
}
const chorus = section("CHORUS",1527,350,198,231);
// Shared big MIX pot at the same top-row position and diameter as FX strips.
const chorusMix=rotary(chorus,"chorusMix","MIX",(198-76)/2,42,76);
chorusMix.classList.add("sf-fx-mix-knob");
// I and II retain their independent bitmask switches, so both may be on.
for(const [i,x] of [[1,42],[2,107]]){
 const sw=button(chorus,"chorus"+i,i===1?"I":"II",x,158,49,24,()=>{
   const next=Math.round(params.chorusMode)^i;
   setParam("chorusMode",next);
   setParam("chorusOn",next?1:0);
   refreshSwitches();
 },"sf-chorus-mode");
 sw.setAttribute("aria-label","Chorus "+i);
 const lamp=el("span","sf-chorus-lamp",chorus);
 lamp.style.left=(x+19.5)+"px";
 lamp.dataset.chorus=i;
}
const chorusOnSwitch=button(chorus,"chorus0","ON",(198-49)/2,199,49,24,()=>{
 const enabled=params.chorusOn<.5;
 if(enabled && Math.round(params.chorusMode)===0)setParam("chorusMode",1);
 setParam("chorusOn",enabled?1:0);
 refreshSwitches();
},"sf-chorus-off");
chorusOnSwitch.setAttribute("aria-label","Chorus effect on/off");
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
  setOn("characterToggle",params.characterToggle>=.5);
  setOn("fx-delayOn",params.delayOn>=.5);
  setOn("fx-reverbOn",params.reverbOn>=.5);
  // Faceplate legends are permanently engraved, regardless of switch state.
  // Active state is indicated only by the blue switch illumination.
  setOn("arpOn",music.arp.on);
  setOn("arpHold",music.arp.hold);
  setOn("arpSync",music.arp.clock==="midi");
  for(const [id,mode] of [["arpUp","up"],["arpPendulum","pendulum"],["arpDown","down"],["arpRandom","random"],["arpPlayed","played"],["arpWalk","walk"]])
   setOn(id,music.arp.mode===mode);
  if(typeof paintArp==="function")paintArp(music.arp.rate);
  for (let i = 1; i <= 4; i++) setOn("range" + i, music.arp.range === i);
  for(const n of [4,8,16,32])setOn("arpDiv"+n,(music.arp.division||16)===n);
  setOn("autoLoop", music.automation.loop);
  setOn("autoOverdub", music.automation.overdub);
  setOn("chorus0",params.chorusOn>=.5);
  for(const i of [1,2])
    setOn("chorus"+i,params.chorusOn>=.5 && !!(Math.round(params.chorusMode)&i));
  for(const lamp of document.querySelectorAll(".sf-chorus-lamp")){
    const on=params.chorusOn>=.5 && !!(Math.round(params.chorusMode)&Number(lamp.dataset.chorus));
    lamp.classList.toggle("lit",on);
  }
  for (const [, , enabled] of characters) {
    const sw = $("#engine-"+enabled);
    if(sw){sw.textContent="ON";setOn(sw.id,params[enabled]>=.5);}
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
     <span class="preset-sound-count">8 SOUND GROUPS · 160 PATCHES</span>
     <input id="preset-search" type="search" placeholder="Find a sound…" aria-label="Search presets">
   </div>
 </div>
 <div class="preset-browser-list" id="preset-browser-list" role="region" aria-label="All factory and user presets"></div>
`;
// Put the library above the advanced controls, not below them.
dialog.insertBefore(browser,dialog.querySelector(".actions"));
// Keep patch editing and modulation tools accessible, but collapsed to
// preserve the full sound library on one screen. Original DOM IDs survive.
const advanced=el("details","preset-advanced",dialog);
const summary=el("summary","",advanced);
summary.textContent="PATCH TOOLS & ADVANCED SYNTH CONTROLS";
for(const child of [...dialog.children]){
 if(child===advanced||child===browser||child.tagName==="FORM"||
    (child.tagName==="H2"&&child.textContent.includes("GRIMISS")))continue;
 advanced.append(child);
}

const presetResults=browser.querySelector("#preset-browser-list");
const presetSearch=browser.querySelector("#preset-search");
// Factory library is organised exclusively by sound category.
presetSearch.addEventListener("input",renderPresetBrowser);
function renderPresetBrowser(){
 const filter=presetSearch.value.trim().toLowerCase();
 presetResults.replaceChildren();
 const allFactory=el("div","preset-sound-columns",presetResults);
 for(const group of factoryGroups){
  const entries=group.indices
   .map(idx=>({id:"f"+idx,label:factory[idx].name}))
   .filter(item=>(item.label+" "+group.category).toLowerCase().includes(filter));
  if(!entries.length)continue;
  const col=el("section","preset-sound-column",allFactory);
  const title=el("h4","",col);
  title.textContent=group.category.toUpperCase()+" · "+entries.length;
  for(const entry of entries){
   const b=el("button","preset-sound-item",col);
   b.type="button";b.textContent=entry.label;b.title=entry.label;
   b.classList.toggle("selected",activePresetId===entry.id);
   b.setAttribute("aria-pressed",String(activePresetId===entry.id));
   b.onclick=()=>{loadPatch(presetEntry(entry.id),entry.id);select.value=entry.id;dialog.close();};
  }
 }
 if(!allFactory.children.length)el("p","preset-empty",allFactory).textContent="No matching factory presets.";
 const userMatches=users.map((p,i)=>({id:"u"+i,label:p.name}))
  .filter(entry=>(entry.label+" user").toLowerCase().includes(filter));
 const user=el("section","preset-user-section",presetResults);
 const title=el("h4","",user);title.textContent="USER PRESETS · "+userMatches.length;
 const grid=el("div","preset-user-grid",user);
 if(!userMatches.length)el("span","preset-no-users",grid).textContent=users.length?"No matching user presets":"Saved sounds appear here";
 for(const entry of userMatches){
  const b=el("button","preset-sound-item",grid);
  b.type="button";b.textContent=entry.label;
  b.classList.toggle("selected",activePresetId===entry.id);
  b.onclick=()=>{loadPatch(presetEntry(entry.id),entry.id);select.value=entry.id;dialog.close();};
 }
}

function fillPresets(selected = "init") {
  select.replaceChildren();
  const initOption = el("option", "", select);
  initOption.value = "init";
  initOption.textContent = "Initialize";
  // HTML selection is grouped by sound only; no engine-level duplication.
  for (const group of factoryGroups) {
    const g = el("optgroup", "", select);
    g.label = group.category;
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
  renderAutomationMini(music.automation);
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
const openPresets=()=>{
 releaseInputs();renderPresetBrowser();
 if(!dialog.open)dialog.show();
 presetSearch.focus();
};
// Non-modal, so the instrument and keyboard remain visible without dimming.
// An outside click dismisses the library, rather than blocking performance.
document.addEventListener("pointerdown",event=>{
 if(dialog.open&&!dialog.contains(event.target)&&event.target!==presetButton&&event.target!==$("#patches")){
  dialog.close();
 }
},true);
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
for(const [label,k] of [["ANALOG","analog"],["VOICE AGE DRIFT","analogDetune"]]){
 const wrap=el("label","track6-knob",controls);
 const labelText=el("span","analog-caption",wrap);labelText.textContent=label;
 if(k==="analogDetune"){wrap.classList.add("voice-age-control");labelText.title="Ageing voice cards: pitch, filter, level and envelope drift";}
 const rail=el("div","analog-rail",wrap);
 const scale=el("div","analog-scale",rail);
 const slot=el("div","analog-slot",rail);
 const cap=el("span","analog-cap",rail);
 const input=el("input","analog-input",rail);
 input.type="range";input.min=0;input.max=1;input.step=.001;input.setAttribute("aria-label",label);
 input.title=k==="analog"?"Warmth, thickness and increasing gentle drive above 70%":"Independent voice-card ageing and slowly changing drift";
 bind(k,input,v=>{const u=toUnit(k,v);cap.style.left=`calc(${(u*100).toFixed(3)}% - ${(u*19).toFixed(2)}px)`;input.setAttribute("aria-valuetext",Math.round(v*100)+"%");});
}
const modes=el("div","track6-modes",analogPanel);
for(const [label,value] of [["MONO",0],["UNISON",1],["POLY",2]]){
 const btn=el("button",null,modes);btn.type="button";btn.textContent=label;
 btn.onclick=()=>setParam("voiceMode",value);
 const paint=()=>btn.classList.toggle("selected",Math.round(params.voiceMode)===value);
 if(!bindings.has("voiceMode"))bindings.set("voiceMode",[]);
 bindings.get("voiceMode").push({input:{value:0},paint});paint();
}
