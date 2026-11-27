// Screen-printed knockout headers: true transparent letterforms reveal the
// black powder-coated faceplate underneath, rather than overlaid black text.
// This draws once after the Orbitron Black font has loaded. No audio changes.
function paintFaceplateHeadings(){
 for(const section of document.querySelectorAll("#panel .section")){
  const title=section.querySelector("h2");
  if(!title)continue;
  const label=title.textContent.trim();
  const width=Math.max(40,Math.round(title.offsetWidth));
  const height=Math.round(title.offsetHeight)||35;
  const c=document.createElement("canvas");
  const ratio=2;
  c.width=width*ratio;c.height=height*ratio;
  const ctx=c.getContext("2d");
  if(!ctx)continue;
  ctx.scale(ratio,ratio);
  const plate=ctx.createLinearGradient(0,0,0,height);
  plate.addColorStop(0,"#fff2db");
  plate.addColorStop(.60,"#eadbc1");
  plate.addColorStop(1,"#d1bda0");
  ctx.fillStyle=plate;
  ctx.beginPath();
  const r=10;
  ctx.moveTo(r,0);ctx.lineTo(width-r,0);
  ctx.quadraticCurveTo(width,0,width,r);
  ctx.lineTo(width,height);ctx.lineTo(0,height);ctx.lineTo(0,r);
  ctx.quadraticCurveTo(0,0,r,0);
  ctx.closePath();ctx.fill();
  // Subtle silkscreen edge light, without a bordered software-panel look.
  ctx.fillStyle="rgba(255,255,255,.21)";ctx.fillRect(12,1,width-24,1);
  ctx.globalCompositeOperation="destination-out";
  // One readable Orbitron Black size for every physical nameplate.
  // Never autosize by caption length: consistency is a hardware requirement.
  ctx.font=label==='CIRCUIT CHARACTER'?'900 14px Orbitron, Arial, sans-serif':'900 17px Orbitron, Arial, sans-serif';
  ctx.textBaseline="middle";
  ctx.textAlign="left";
  ctx.fillStyle="#000";
  ctx.fillText(label,14,height/2+1);
  ctx.globalCompositeOperation="source-over";
  title.style.setProperty("background-image",'url("'+c.toDataURL("image/png")+'")',"important");
  title.style.setProperty("background-size","100% 100%","important");
  title.style.setProperty("background-repeat","no-repeat","important");
 }
}
const renderHeadings=async()=>{
 try{await document.fonts.load('900 17px "Orbitron"');}catch{}
 paintFaceplateHeadings();
};
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",renderHeadings,{once:true});
else renderHeadings();
