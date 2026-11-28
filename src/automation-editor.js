/* SF-POLY automation clip editor — isolated UI; no synthesizer panel changes.
 * Converts legacy timestamp lanes into editable, non-destructive clips.
 * Editing is committed via the audio thread's autoEdit message. */
export function createAutomationEditor({getAutomation,applyAutomation,getSnapshot}){
 const mk=(tag,cls,parent,txt)=>{
  const e=document.createElement(tag);if(cls)e.className=cls;
  if(txt!==undefined)e.textContent=txt;
  parent?.append(e);return e;
 };
 const overlay=mk("div","sf-ae-overlay",document.body);
 overlay.hidden=true;
 const win=mk("section","sf-ae-window",overlay);
 win.setAttribute("role","dialog");
 win.setAttribute("aria-label","Automation editor");
 const header=mk("header","sf-ae-header",win);
 mk("strong","",header,"SF-POLY  /  AUTOMATION EDITOR");
 const close=mk("button","sf-ae-close",header,"×");
 close.setAttribute("aria-label","Close automation editor");
 const toolbar=mk("div","sf-ae-tools",win);
 const action=(caption,handler)=>{const b=mk("button","",toolbar,caption);b.type="button";b.onclick=handler;return b;};
 const timeline=mk("div","sf-ae-timeline",win);
 const ruler=mk("div","sf-ae-ruler",timeline);
 const playMarker=mk("div","sf-ae-ruler-playhead",ruler);
 const lanesBox=mk("div","sf-ae-lanes",timeline);
 const footer=mk("footer","sf-ae-footer",win);
 const hint=mk("span","",footer,"Select or drag a clip. Drag its edges to trim; double-click to split.");
 let state=null,selected=null,playhead=0,history=[],future=[],sequence=0,viewDuration=30;
 let pointer=null;
 const clone=x=>JSON.parse(JSON.stringify(x));
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 const fmt=v=>Math.floor(v/60)+":"+String(Math.floor(v%60)).padStart(2,"0");
 const name=k=>k.replace(/([a-z])([A-Z])/g,"$1 $2").replace(/([a-z])([0-9])/g,"$1 $2").toUpperCase();
 function fromEvents(automation){
  const groups=new Map();
  for(const e of automation.events||[]){
   if(!groups.has(e.k))groups.set(e.k,[]);
   groups.get(e.k).push({t:e.t,v:e.v});
  }
  const clips=[...(automation.clips||[])];
  if(!clips.length)for(const [k,points] of groups){
   points.sort((a,b)=>a.t-b.t);
   const length=Math.max(.02,automation.duration||0,points.at(-1)?.t||0);
   clips.push({id:"legacy-"+(++sequence),k,start:0,duration:length,
     sourceDuration:length,points:points.map(p=>({t:p.t,v:p.v}))});
  }
  const duration=Math.max(.02,automation.duration||0,...clips.map(c=>c.start+c.duration));
  return {clips,duration,loop:!!automation.loop,
    loopStart:clamp(automation.loopStart||0,0,duration),
    loopEnd:clamp(automation.loopEnd||duration,0,duration)};
 }
 function snapshot(){history.push(clone(state));if(history.length>40)history.shift();future=[];}
 function update(commit=true){
  state.duration=Math.max(.02,...state.clips.map(c=>c.start+c.duration));
  state.loopStart=clamp(state.loopStart,0,state.duration);
  state.loopEnd=clamp(state.loopEnd||state.duration,0,state.duration);
  viewDuration=Math.max(10,Math.ceil(Math.max(state.duration,state.loopEnd,playhead)/10)*10);
  if(commit)applyAutomation(clone(state));
  render();
 }
 function getSelected(){return state.clips.find(c=>c.id===selected);}
 function edit(fn){
  if(!state)return;
  snapshot();fn();
  update();
 }
 function pointValue(c,t){
  const pts=c.points;if(!pts?.length)return 0;
  if(t<=pts[0].t)return pts[0].v;
  for(let i=1;i<pts.length;i++)if(pts[i].t>=t){
   const a=pts[i-1],b=pts[i],f=(t-a.t)/Math.max(.000001,b.t-a.t);
   return a.v+(b.v-a.v)*f;
  }
  return pts.at(-1).v;
 }
 function slice(c,begin,end){
  const ratio=c.sourceDuration/c.duration;
  const lo=begin*ratio,hi=end*ratio;
  const points=[{t:0,v:pointValue(c,lo)}];
  for(const p of c.points)if(p.t>lo&&p.t<hi)
    points.push({t:p.t-lo,v:p.v});
  points.push({t:hi-lo,v:pointValue(c,hi)});
  return {...c,start:c.start+begin,duration:end-begin,
    sourceDuration:hi-lo,points};
 }
 function splitAt(){
  const c=getSelected();if(!c)return;
  const cut=playhead-c.start;if(cut<.05||cut>c.duration-.05)return;
  edit(()=>{
   const i=state.clips.indexOf(c);
   const left=slice(c,0,cut),right=slice(c,cut,c.duration);
   left.id=c.id;right.id="split-"+(++sequence);
   state.clips.splice(i,1,left,right);selected=right.id;
  });
 }
 function deleteSelected(){
  const c=getSelected();if(!c)return;
  edit(()=>{state.clips=state.clips.filter(x=>x.id!==c.id);selected=null;});
 }
 function duplicate(){
  const c=getSelected();if(!c)return;
  edit(()=>{
   const d=clone(c);d.id="copy-"+(++sequence);
   d.start=c.start+c.duration;
   state.clips.push(d);selected=d.id;
  });
 }
 function changeLength(factor){
  const c=getSelected();if(!c)return;
  edit(()=>{c.duration=clamp(c.duration*factor,.1,1200);});
 }
 action("UNDO",()=>{if(!history.length)return;future.push(clone(state));state=history.pop();selected=null;update();});
 action("REDO",()=>{if(!future.length)return;history.push(clone(state));state=future.pop();selected=null;update();});
 action("SPLIT AT PLAYHEAD",splitAt);
 action("DELETE",deleteSelected);
 action("DUPLICATE",duplicate);
 action("STRETCH −25%",()=>changeLength(.75));
 action("STRETCH +25%",()=>changeLength(1.25));
 const loopBtn=action("LOOP: OFF",()=>{
  edit(()=>{state.loop=!state.loop;});
 });
 const loopFields=mk("div","sf-ae-loop-fields",toolbar);
 mk("label","",loopFields,"LOOP START");
 const startInput=mk("input","",loopFields);startInput.type="number";startInput.min="0";startInput.step=".1";
 mk("label","",loopFields,"END");
 const endInput=mk("input","",loopFields);endInput.type="number";endInput.min=".1";endInput.step=".1";
 function readLoop(){
  edit(()=>{
   state.loopStart=clamp(+startInput.value||0,0,viewDuration);
   state.loopEnd=clamp(+endInput.value||viewDuration,state.loopStart+.1,viewDuration);
  });
 }
 startInput.onchange=readLoop;endInput.onchange=readLoop;
 ruler.onclick=e=>{
  const bounds=ruler.getBoundingClientRect();
  const x=clamp((e.clientX-bounds.left)/bounds.width,0,1);
  playhead=+((x*viewDuration).toFixed(2));render();
 };
 function render(){
  if(!state)return;
  loopBtn.textContent="LOOP: "+(state.loop?"ON":"OFF");
  startInput.value=state.loopStart.toFixed(1);
  endInput.value=state.loopEnd.toFixed(1);
  ruler.replaceChildren();
  for(let i=0;i<=10;i++){
   const tick=mk("span","sf-ae-tick",ruler,fmt(i*viewDuration/10));
   tick.style.left=(i*10)+"%";
  }
  const band=mk("div","sf-ae-loop-band",ruler);
  band.style.left=(state.loopStart/viewDuration*100)+"%";
  band.style.width=(Math.max(0,state.loopEnd-state.loopStart)/viewDuration*100)+"%";
  band.title="Drag to move loop; drag either end to resize";
  const bandLeft=mk("span","sf-ae-loop-handle left",band);
  const bandRight=mk("span","sf-ae-loop-handle right",band);
  band.addEventListener("pointerdown",e=>{
   if(e.button!==0)return;
   e.preventDefault();e.stopPropagation();
   const edge=e.target===bandLeft?"left":e.target===bandRight?"right":"move";
   const start=state.loopStart,end=state.loopEnd,origin=e.clientX;
   const width=ruler.getBoundingClientRect().width;
   let changed=false;
   band.setPointerCapture(e.pointerId);
   const onMove=ev=>{
    const dt=(ev.clientX-origin)/Math.max(1,width)*viewDuration;
    if(Math.abs(dt)<.01)return;
    if(!changed){snapshot();changed=true;}
    if(edge==="left")state.loopStart=clamp(start+dt,0,end-.1);
    else if(edge==="right")state.loopEnd=clamp(end+dt,start+.1,viewDuration);
    else{
     const length=end-start;
     state.loopStart=clamp(start+dt,0,viewDuration-length);
     state.loopEnd=state.loopStart+length;
    }
    band.style.left=(state.loopStart/viewDuration*100)+"%";
    band.style.width=(Math.max(0,state.loopEnd-state.loopStart)/viewDuration*100)+"%";
    startInput.value=state.loopStart.toFixed(1);
    endInput.value=state.loopEnd.toFixed(1);
   };
   const endMove=()=>{
    band.removeEventListener("pointermove",onMove);
    band.removeEventListener("pointerup",endMove);
    band.removeEventListener("pointercancel",endMove);
    if(changed)update();
   };
   band.addEventListener("pointermove",onMove);
   band.addEventListener("pointerup",endMove);
   band.addEventListener("pointercancel",endMove);
  });
  const head=mk("div","sf-ae-ruler-playhead",ruler);
  head.style.left=(playhead/viewDuration*100)+"%";
  lanesBox.replaceChildren();
  const groups=new Map();
  for(const clip of state.clips){
   if(!groups.has(clip.k))groups.set(clip.k,[]);
   groups.get(clip.k).push(clip);
  }
  for(const [key,clips] of [...groups].slice(0,8)){
   const row=mk("div","sf-ae-row",lanesBox);
   mk("label","sf-ae-lane-name",row,name(key));
   const strip=mk("div","sf-ae-strip",row);
   for(const c of clips){
    const block=mk("div","sf-ae-clip",strip);
    block.dataset.id=c.id;
    if(c.id===selected)block.classList.add("selected");
    block.style.left=(c.start/viewDuration*100)+"%";
    block.style.width=(Math.max(.02,c.duration)/viewDuration*100)+"%";
    block.title=name(key)+" · "+fmt(c.start)+" to "+fmt(c.start+c.duration);
    const line=mk("span","sf-ae-clip-line",block);
    mk("span","sf-ae-handle left",block);
    mk("span","sf-ae-handle right",block);
    block.addEventListener("dblclick",e=>{
     e.stopPropagation();selected=c.id;
     const rect=strip.getBoundingClientRect();
     playhead=clamp((e.clientX-rect.left)/rect.width*viewDuration,c.start,c.start+c.duration);
     splitAt();
    });
    block.addEventListener("pointerdown",e=>{
     if(e.button!==0)return;e.preventDefault();
     selected=c.id;
     const rect=strip.getBoundingClientRect();
     const edge=e.target.classList.contains("left")?"left":
       e.target.classList.contains("right")?"right":"move";
     pointer={id:c.id,edge,x:e.clientX,width:rect.width,original:clone(c),moved:false};
     block.setPointerCapture(e.pointerId);
     renderSelection();
    });
    block.addEventListener("pointermove",e=>{
     if(!pointer||pointer.id!==c.id)return;
     const dt=(e.clientX-pointer.x)/Math.max(1,pointer.width)*viewDuration;
     if(Math.abs(dt)<.04)return;
     pointer.moved=true;
     if(!pointer.saved){snapshot();pointer.saved=true;}
     const base=pointer.original;
     const target=getSelected();
     if(!target)return;
     if(pointer.edge==="move")target.start=clamp(base.start+dt,0,3600-base.duration);
     else if(pointer.edge==="right")target.duration=clamp(base.duration+dt,.1,3600-base.start);
     else{
      const amount=clamp(dt,-base.start,base.duration-.1);
      const sliced=slice(base,Math.max(0,amount),base.duration);
      // A negative left drag stretches without inventing parameter values.
      if(amount<0){target.start=base.start+amount;target.duration=base.duration-amount;
       target.sourceDuration=base.sourceDuration;target.points=base.points;}
      else Object.assign(target,sliced);
     }
     block.style.left=(target.start/viewDuration*100)+"%";
     block.style.width=(target.duration/viewDuration*100)+"%";
    });
    const finish=e=>{
     if(!pointer||pointer.id!==c.id)return;
     const changed=pointer.moved;pointer=null;
     if(changed)update();else renderSelection();
    };
    block.addEventListener("pointerup",finish);
    block.addEventListener("pointercancel",finish);
   }
  }
  const rows=groups.size;
  if(!rows)mk("p","sf-ae-empty",lanesBox,"No automation recorded yet. Record a parameter movement, then reopen this editor.");
  if(rows>8)mk("p","sf-ae-empty",lanesBox,"Only the first eight parameter lanes are shown.");
  hint.textContent="PLAYHEAD "+fmt(playhead)+" · "+state.clips.length+" CLIPS · Drag to move · Edge to trim · Double-click to split · Overlap clips to crossfade";
 }
 function renderSelection(){
  for(const e of lanesBox.querySelectorAll(".sf-ae-clip"))
   e.classList.toggle("selected",e.dataset.id===selected);
 }
 const hide=()=>{overlay.hidden=true;};
 close.onclick=hide;
 overlay.addEventListener("pointerdown",e=>{if(e.target===overlay)hide();});
 document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!overlay.hidden)hide();});
 async function open(){
  let source=getAutomation();
  try{const snap=await getSnapshot();if(snap?.automation)source=snap.automation;}catch{}
  state=fromEvents(source);
  selected=null;history=[];future=[];
  viewDuration=Math.max(10,Math.ceil(state.duration/10)*10);
  playhead=state.loopStart||0;
  overlay.hidden=false;
  update(false);
 }
 return {open,close:hide,isOpen:()=>!overlay.hidden};
}
