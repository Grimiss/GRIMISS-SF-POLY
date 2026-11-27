export function saturate(x) {
  x = clamp(x, -3, 3);
  const x2 = x * x;
  return (x * (27 + x2)) / (27 + 9 * x2);
}
export const TAU = 2 * Math.PI;
export const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
export const midiHz = (n) => 440 * 2 ** ((n - 69) / 12);
export function blep(t, dt) {
  if (t < dt) {
    t /= dt;
    return t + t - t * t - 1;
  }
  if (t > 1 - dt) {
    t = (t - 1) / dt;
    return t * t + t + t + 1;
  }
  return 0;
}
export class Oscillator {
  constructor() {
    this.phase = 0;
    this.triangle = -1;
    this.last = 0;
    this.syncTail = 0;
    this.lastWave = 0;
    this.transition = 0;
    this.transitionValue = 0;
  }
  tick(hz, sr, wave, pw = 0.5, reset = -1) {
    const selected = Math.round(wave);
    if (selected !== this.lastWave) {
      this.lastWave = selected;
      this.transition = 1;
      this.transitionValue = this.last;
    }
    const dt = clamp(hz / sr, 1e-8, 0.45);
    let p = this.phase;
    // A fractional master wrap resets the slave; a short causal BLEP smooths its jump.
    if (reset >= 0) {
      const before =
        selected===5?Math.sin(TAU*p):selected===0?2*p-1:selected===1?this.triangle:p<((selected===2||selected===4)?pw:.5)?1:-1;
      p = dt * reset;
      const after =
        selected===5?Math.sin(TAU*p):selected===0?2*p-1:selected===1?1-4*Math.abs(p-.5):p<((selected===2||selected===4)?pw:.5)?1:-1;
      if (selected===1) this.triangle = after;
      this.syncTail += before - after;
    }
    let out;
    if (selected===5) out = Math.sin(TAU*p);
    else if (selected===0) out = 2 * p - 1 - blep(p, dt);
    else {
      const duty = selected===2 || selected===4 ? pw : .5;
      let shifted = p - duty;
      if (shifted < 0) shifted += 1;
      const pulse = (p < duty ? 1 : -1) + blep(p, dt) - blep(shifted, dt);
      if (selected===1) {
        this.triangle = (this.triangle + 4 * dt * pulse) * (1 - 2 * dt * 0.001);
        this.triangle = clamp(this.triangle, -1.2, 1.2);
        out = this.triangle;
      } else out = pulse;
    }
    out += this.syncTail;
    this.syncTail *= 0.2;
    if (this.transition > 0.0001) {
      out =
        out * (1 - this.transition) + this.transitionValue * this.transition;
      this.transition *= 0.9;
    }
    this.phase = p + dt;
    if (this.phase >= 1) this.phase -= 1;
    this.last = out;
    return out;
  }
}
export class Envelope {
  constructor(sr) {
    this.sr = sr;
    this.value = 0;
    this.stage = 0;
    this.age = 0;
  }
  on() {
    this.stage = 1;
    this.age = 0;
  }
  off() {
    if (this.stage) this.stage = 4;
  }
  tick(a, d, s, r) {
    let target = 0,
      time = r;
    if (this.stage === 1) {
      target = 1.01;
      time = a / 4.615;
    } else if (this.stage === 2) {
      target = s;
      time = d / 4.605;
    } else if (this.stage === 3) {
      target = s;
      time = 0.01;
    } else if (this.stage === 4) {
      time = r / 9.21;
    } else return 0;
    this.value +=
      (target - this.value) *
      Math.min(1, 1 / (Math.max(0.0001, time) * this.sr));
    if (this.stage === 1 && this.value >= 1) {
      this.value = 1;
      this.stage = 2;
    }
    if (this.stage === 2 && Math.abs(this.value - s) < 0.001) this.stage = 3;
    if (this.stage === 4 && this.value < 0.0001) {
      this.value = 0;
      this.stage = 0;
    }
    this.age++;
    return this.value;
  }
}
// Four TPT one-poles with an algebraic feedback solution; saturation in the drive.
export class CEMFilter {
  constructor() {
    this.z = new Float64Array(4);
    this.hz = -1;
    this.G = 0;
    this.targetG = 0;
    this.inv = 1;
  }
  tick(x, hz, res, sr) {
    if (hz !== this.hz) {
      const g = Math.tan((Math.PI * clamp(hz, 10, sr * 0.43)) / sr);
      this.targetG = g / (1 + g);
      this.hz = hz;
    }
    this.G += (this.targetG - this.G) * 0.04;
    const G = this.G,
      z = this.z;
    const S = (z[3] + G * z[2] + G * G * z[1] + G ** 3 * z[0]) * (1 - G);
    let y =
      saturate(((x - 3.85 * res * S) / (1 + 3.85 * res * G ** 4)) * 1.15) /
      1.15;
    for (let i = 0; i < 4; i++) {
      const v = (y - z[i]) * G;
      y = v + z[i];
      z[i] = y + v;
    }
    return saturate(y*1.25)*(1+res*1.05);
  }
}
// SSM2044-inspired four-pole resonant lowpass, with a different
// feedback law and distributed stage saturation from our Curtis model.
// This is an original digital approximation, not a component-exact clone.
export class SSMFilter {
  constructor() {
    this.z = new Float64Array(4);
    this.hz = -1;
    this.g = 0;
    this.targetG = 0;
  }
  tick(x,hz,res,sr) {
    if (hz !== this.hz) {
      this.targetG = 1 - Math.exp(-TAU * clamp(hz,10,sr*.26)/sr);
      this.hz=hz;
    }
    this.g += (this.targetG-this.g)*.035;
    const g=this.g,z=this.z;
    let v=saturate(x*1.43-z[3]*(3.7*res));
    for(let i=0;i<4;i++) {
      const stage=saturate(v*1.55)/1.55;
      z[i]+=g*(stage-z[i]);
      v=z[i];
    }
    return v*(1.55+.45*res);
  }
}
// Discrete two-integrator topology-preserving state-variable lowpass.
export class OBFilter {
  constructor() {
    this.s1 = 0;
    this.s2 = 0;
    this.hz = -1;
    this.g = 0;
    this.targetG = 0;
  }
  tick(x, hz, res, sr) {
    if (hz !== this.hz) {
      this.targetG = Math.tan((Math.PI * clamp(hz, 10, sr * 0.43)) / sr);
      this.hz = hz;
    }
    this.g += (this.targetG - this.g) * 0.04;
    const g = this.g,
      k = 2 - 1.94 * res,
      a = 1 / (1 + g * (g + k));
    const v1 = a * (this.s1 + g * (saturate(x) - this.s2)),
      v2 = this.s2 + g * v1;
    this.s1 = 2 * v1 - this.s1;
    this.s2 = 2 * v2 - this.s2;
    return v2;
  }
}
// OTA-inspired four-stage cascade: soft-limited pole states and distributed drive.
export class JunoFilter {
  constructor() {
    this.z = new Float64Array(4);
    this.feedback = 0;
    this.hz = -1;
    this.g = 0;
    this.targetG = 0;
  }
  tick(x, hz, res, sr) {
    if (hz !== this.hz) {
      this.targetG = 1 - Math.exp((-TAU * clamp(hz, 10, sr * 0.23)) / sr);
      this.hz = hz;
    }
    this.g += (this.targetG - this.g) * 0.04;
    const g = this.g;
    let y = saturate(x*.9 - res*3.1*this.feedback);
    for (let i = 0; i < 4; i++) {
      this.z[i] += g * (saturate(y) - saturate(this.z[i]));
      y = this.z[i];
    }
    this.feedback = y;
    return y*(1+res*.25);
  }
}
// Vintage-inspired analogue filter algorithms; not component-exact circuit clones.
export class MS20Filter {
 constructor(){this.hp=0;this.lp=0;this.bp=0;this.hz=-1;this.g=0;this.hpG=0;this.targetG=0;this.oscPhase=0;this.oscLevel=0;}
 tick(x,hz,res,sr,hpf=150){
  // Nonlinear resonant high-pass into aggressive low-pass.
  const pitch=clamp(hz,20,sr*.3);
  if(pitch!==this.hz){this.targetG=Math.tan(Math.PI*pitch/sr);this.hz=pitch;}
  this.g+=(this.targetG-this.g)*.03;
  const hpTarget=1-Math.exp(-TAU*clamp(hpf,20,sr*.27)/sr);
  this.hpG+=(hpTarget-this.hpG)*.03;
  const drive=Math.tanh(x*2.9);
  this.hp+=this.hpG*(drive-this.hp);
  const high=drive-this.hp;
  const q=clamp(1.7-1.6*res,.13,1.8);
  const g=this.g,aa=1/(1+g*(g+q));
  const v1=aa*(this.bp+g*(high-this.lp)),v2=this.lp+g*v1;
  this.bp=2*v1-this.bp;this.lp=2*v2-this.lp;
  const filtered=Math.tanh(v2*(1.6+.6*res))*1.12;
  // Smooth, bounded cutoff-tracking feedback whistle above ~68% resonance.
  // Avoids the high-resonance null in the previous digital approximation.
  const amt=clamp((res-.64)/.30,0,1);
  // Keep the fierce resonance, but shift the prominent whistle into
  // the upper portion of the logarithmic cutoff fader travel.
  const cutoffPosition=clamp(Math.log(pitch/20)/Math.log(18000/20),0,1);
  const whistlePosition=clamp((cutoffPosition-.43)/.28,0,1);
  const whistleMix=whistlePosition*whistlePosition*(3-2*whistlePosition);
  const target=amt*amt*(.20+.50*amt)*whistleMix;
  this.oscLevel+=(target-this.oscLevel)*.004;
  this.oscPhase+=TAU*clamp(pitch,20,11000)/sr;
  if(this.oscPhase>=TAU)this.oscPhase-=TAU;
  return filtered*(1-.15*amt)+Math.sin(this.oscPhase)*this.oscLevel;
 }
}
export class SEMFilter {
 constructor(){this.low=0;this.band=0;this.hz=-1;this.g=0;this.targetG=0;}
 tick(x,hz,res,sr,morph=.5){
  const pitch=clamp(hz,20,sr*.29);
  if(pitch!==this.hz){this.targetG=Math.tan(Math.PI*pitch/sr);this.hz=pitch;}
  this.g+=(this.targetG-this.g)*.035;
  const g=this.g,q=clamp(1.8-1.55*res,.25,1.8),aa=1/(1+g*(g+q));
  const input=Math.tanh(x*(1.45+.35*res));
  const v1=aa*(this.band+g*(input-this.low)),low=this.low+g*v1;
  this.band=2*v1-this.band;this.low=2*low-this.low;
  const high=input-q*v1-low,notch=low+high,m=clamp(morph,0,1)*2;
  const shape=m<1?low*(1-m)+notch*m:notch*(2-m)+high*(m-1);
  return Math.tanh(shape*(1.35+.55*res))*1.28;
 }
}
export class LadderFilter {
 constructor(){this.z=new Float64Array(4);this.hz=-1;this.g=0;this.targetG=0;}
 tick(x,hz,res,sr){
  const pitch=clamp(hz,20,sr*.29);
  if(pitch!==this.hz){const t=Math.tan(Math.PI*pitch/sr);this.targetG=t/(1+t);this.hz=pitch;}
  this.g+=(this.targetG-this.g)*.035;
  let v=Math.tanh(x*(2.5+.7*res)-this.z[3]*(3.65*res));
  for(let i=0;i<4;i++){const target=Math.tanh(v*1.25);this.z[i]+=this.g*(target-this.z[i]);v=this.z[i];}
  return v*(1.45+.6*res);
 }
}
// Early digital-style tuned comb. Inspired by digital wavetable instrument
// filter effects, not a component-exact reconstruction.
export class DigitalCombFilter {
 constructor(){this.buffer=new Float32Array(8192);this.pos=0;this.delay=0;this.damped=0;}
 tick(x,hz,res,sr){
  const len=this.buffer.length;
  const target=clamp(sr/clamp(hz,32,8800),3,len-4);
  if(this.delay===0)this.delay=target;
  this.delay+=(target-this.delay)*.0018;
  let index=this.pos-this.delay;if(index<0)index+=len;
  const lo=Math.floor(index),frac=index-lo;
  const wet=this.buffer[lo]*(1-frac)+this.buffer[(lo+1)%len]*frac;
  const feedback=.1+clamp(res,0,.98)*.87;
  this.damped+=(wet-this.damped)*.48;
  this.buffer[this.pos]=Math.tanh(x*.88+this.damped*feedback);
  this.pos=(this.pos+1)%len;
  // Dry presence preserves articulation; resonance generates metallic ringing.
  return Math.tanh(x*.3+wet*(.75+.55*res))*1.18;
 }
}
export class Model {
  constructor(sr, index, kind) {
    this.sr = sr;
    this.kind = kind;
    this.osc = [new Oscillator(), new Oscillator(), new Oscillator(), new Oscillator()];
    this.thickOffset=Math.sin(index*2.77+kind*5.13);
    // Each model owns all three lightweight filter states; only the selected
    // filter processes samples. No allocations occur in the audio callback.
    this.filters = [new CEMFilter(), new SSMFilter(), new JunoFilter(),new MS20Filter(),new SEMFilter(),new LadderFilter(),new DigitalCombFilter()];
    this.filter = this.filters[kind];
    this.filterChoice = kind;
    this.previousFilter = kind;
    this.filterFade = 0;
    this.cal = Math.sin((index + 1) * 13.71 + kind * 5.27);
    this.drift = 0;
    this.hpIn = 0;
    this.hpOut = 0;
    this.phase = (index * 1.7 + kind) % TAU;
    this.counter = 0;
    this.f1 = 0;
    this.f2 = 0;
    this.sub = 0;
    this.pw = 0.5;
    this.cutoff = 1000;
    this.hp = 0.999;
  }
  tick(freq, p, env, lfo, noise) {
    const k = this.kind,
      sr = this.sr * 2;
    if ((this.counter++ & 31) === 0) {
      this.phase += 0.000096 * (1 + this.cal * 0.15);
      this.drift += (Math.sin(this.phase) * this.cal - this.drift) * 0.00064;
      const hz =
        freq *
        2 ** ((k === 2 ? 0 : this.cal * (0.008 + p.analogDetune * 0.28) + this.drift * (0.008 + p.analogDetune * 0.2)) / 12);
      this.f1 = hz * 2 ** ((p.osc1Tune + 12*Math.round(p.osc1Octave||0) + (p.osc1Fine||0)) / 12);
      this.f2 = hz * 2 ** ((p.osc2Tune + 12*Math.round(p.osc2Octave||0) + (p.osc2Fine||0) + (k === 1 ? this.cal * (0.02 + p.analogDetune * 0.14) : 0)) / 12);
      this.sub = hz / (Math.round(p.subOct) === 2 ? 4 : 2);
      // PLS: the PW slider sets a fixed duty cycle.
      // PWM: PW sets the centre and the LFO moves around that centre.
      // Both oscillators share the PW and LFO depth, but independently
      // choose PLS or PWM. This preserves existing waveform index mappings.
      this.pw = clamp(p.pw, 0.05, 0.95);
      // More audible movement: full LFO sweep around the shared PW centre.
      // Even at low modulation settings both oscillators respond distinctly;
      // existing PLS remains static under LFO changes.
      this.pwmWidth = clamp(p.pw + lfo * (0.30 + p.lfoPWM * 1.15 + p.mod * 0.22), 0.035, 0.965);
      this.cutoff = clamp(
        p.cutoff *
          2 **
            (env * p.envAmount +
              lfo * (p.lfoFilter + p.mod * 2) +
              this.cal * (k === 2 ? 0.015 : 0.08) * (0.3 + p.analog * 2.2)),
        15,
        this.sr * 0.42,
      );
      this.hp = Math.exp((-TAU * p.hpf) / sr);
    }
    const o = this.osc;
    const w1=Math.round(p.wave1),w2=Math.round(p.wave2);
    const pwm1=w1===4?this.pwmWidth:this.pw;
    const pwm2=w2===4?this.pwmWidth:this.pw;
    let out = 0;
    for (let n = 0; n < 2; n++) {
      let a, b;
      if (k === 0) {
        // Prophet: oscillator B is the sync source and an audio-rate Poly-Mod source for A.
        const dtB = this.f2 / sr,
          wrap = o[1].phase + dtB >= 1 ? (o[1].phase + dtB - 1) / dtB : -1;
        b = o[1].tick(this.f2, sr, p.wave2, pwm2);
        a = o[0].tick(
          this.f1 * (1 + p.polyMod * (b * 0.15 + env * 0.03)),
          sr,
          p.wave1,
          pwm1,
          p.sync > 0.5 ? wrap : -1,
        );
      } else {
        const dt = this.f1 / sr,
          wrap = o[0].phase + dt >= 1 ? (o[0].phase + dt - 1) / dt : -1;
        a = o[0].tick(this.f1, sr, p.wave1, pwm1);
        b =
          k === 2
            ? 0
            : o[1].tick(
                this.f2 * (1 + p.polyMod * 0.12 * a),
                sr,
                p.wave2,
                pwm2,
                p.sync > 0.5 ? wrap : -1,
              );
      }
      const sub = o[2].tick(this.sub, sr, 2, 0.5);
      let x =
        k === 1 ? a * p.mix1 + b * p.mix2 * 0.5 + sub * p.mixSub :
        k === 2
          ? a * p.mix1 +
            o[1].tick(this.f2, sr, p.wave2, pwm2) * p.mix2 +
            sub * p.mixSub
          : a * p.mix1 + b * p.mix2 + sub * p.mixSub;
      const body=clamp(p.analog,0,1);
      const extra=o[3].tick(this.f1*(1+.0013*(1+p.analogDetune*3)*(1+this.thickOffset*.4)),sr,p.wave1,pwm1);
      x += extra*p.mix1*body*.33;
      x += noise*p.mixNoise;
      const highRaw = x - this.hpIn + this.hp * this.hpOut;
      const high = [4,5].includes(Math.round(p.filterModel)) ? x : highRaw;
      this.hpIn = x;
      this.hpOut = high;
      const bodyDrive=1+p.analog*(k===1?2.1:1.75);
      const warm=Math.tanh((high+.055*p.analog*high*high)*bodyDrive)/(1+p.analog*.62);
      const selected = Math.round(p.filterModel);
      const filterIndex=selected===0?k:selected===1?2:selected===2?1:selected===3?0:selected-1;
      if (filterIndex !== this.filterChoice) {
        this.previousFilter = this.filterChoice;
        this.filterChoice = filterIndex;
        this.filterFade = 1;
      }
      const activeFilter=this.filters[this.filterChoice];
      const filterHz=this.cutoff*([1.42,1.06,.69,1,1,1,1][this.filterChoice]);
      const filterRes=clamp(p.resonance*([1.16,1.05,.86,1,1,1,1][this.filterChoice]),0,.97);
      const semMorph=clamp(Math.log(Math.max(10,p.hpf)/10)/Math.log(300),0,1);
      let filtered=activeFilter.tick(warm,filterHz,filterRes,sr,
        this.filterChoice===3?p.hpf:semMorph);
      if (this.filterFade > 0) {
        // Crossfade while both old and new filter memories are running.
        const oldIndex=this.previousFilter;
        const old=this.filters[oldIndex].tick(warm,
          this.cutoff*([1.42,1.06,.69,1,1,1,1][oldIndex]),
          clamp(p.resonance*([1.16,1.05,.86,1,1,1,1][oldIndex]),0,.97),sr,
          oldIndex===3?p.hpf:semMorph);
        filtered = filtered * (1-this.filterFade) + old * this.filterFade;
        this.filterFade = Math.max(0,this.filterFade - 1/(this.sr*.006));
      }
      out += Math.tanh(filtered*(1+.55*p.analog))*(1-.12*p.analog)*.5;
    }
    return out;
  }
}
export class Effects {
  constructor(sr) {
    this.sr = sr;
    this.pos = 0;
    this.phase = 0;
    this.delay = [new Float32Array(sr * 3), new Float32Array(sr * 3)];
    this.chorus = [new Float32Array(4096), new Float32Array(4096)];
    this.cpos = 0;
    this.color = [0, 0];
    this.time = 0.375;
    this.rvLengths = [
      0.0297, 0.0371, 0.0411, 0.0437, 0.0313, 0.0353, 0.0397, 0.0479,
    ].map((x) => Math.floor(x * sr));
    this.rv = this.rvLengths.map((n) => new Float32Array(n));
    this.rpos = new Int32Array(8);
    this.damp = new Float64Array(8);
    this.allpass = [
      new Float32Array(Math.floor(sr * 0.005)),
      new Float32Array(Math.floor(sr * 0.0017)),
    ];
    this.apos = new Int32Array(2);
    this.left = 0;
    this.right = 0;
    this.dcIn = [0, 0];
    this.dcOut = [0, 0];
    this.dcPole = Math.exp((-TAU * 15) / sr);
    this.chorusEnable = 0;
    this.bassShelfState = [0,0];
    this.boostSmoothed = 0;
    this.bassShelfCoeff = 1-Math.exp(-TAU * 100 / sr);
  }
  clear() {
    for (const b of [
      ...this.delay,
      ...this.chorus,
      ...this.rv,
      ...this.allpass,
    ])
      b.fill(0);
    this.damp.fill(0);
    this.color.fill(0);
    this.dcIn.fill(0);
    this.dcOut.fill(0);
    this.left = this.right = 0;
    this.bassShelfState.fill(0);
    this.boostSmoothed=0;
  }
  read(b, pos, delay) {
    let i = (pos - delay + b.length * 2) % b.length,
      j = Math.floor(i),
      f = i - j;
    return b[j] * (1 - f) + b[(j + 1) % b.length] * f;
  }
  tick(l, r, p) {
    const mode = Math.round(p.chorusMode);
    this.chorusEnable += ((mode && (p.chorusOn ?? 1) >= .5 ? 1 : 0) - this.chorusEnable) * 0.002;
    this.phase =
      (this.phase +
        (TAU * (mode === 2 ? 0.83 : mode === 3 ? 1.2 : 0.48)) / this.sr) %
      TAU;
    for (let c = 0; c < 2; c++) {
      let x = c ? r : l;
      this.chorus[c][this.cpos] = x;
      const d =
        (0.008 +
          (mode === 3 ? 0.0035 : 0.002) * Math.sin(this.phase + c * Math.PI)) *
        this.sr;
      const wet = this.read(this.chorus[c], this.cpos, d);
      this.color[c] += 0.28 * (wet - this.color[c]);
      const mix = p.chorusMix * this.chorusEnable;
      x = x * (1 - mix * 0.5) + this.color[c] * mix * 0.7;
      if (c) r = x;
      else l = x;
    }
    this.cpos = (this.cpos + 1) % 4096;
    this.time += (p.delayTime - this.time) * 0.00003;
    const dl = this.read(this.delay[0], this.pos, this.time * this.sr),
      dr = this.read(this.delay[1], this.pos, this.time * this.sr * 1.013);
    this.delay[0][this.pos] = saturate(l + dr * p.delayFeedback);
    this.delay[1][this.pos] = saturate(r + dl * p.delayFeedback);
    this.pos = (this.pos + 1) % this.delay[0].length;
    l += dl * p.delayMix * (p.delayOn ?? 1);
    r += dr * p.delayMix * (p.delayOn ?? 1);
    let input = (l + r) * 0.25;
    for (let i = 0; i < 2; i++) {
      const b = this.allpass[i],
        j = this.apos[i],
        v = b[j];
      b[j] = input + v * 0.55;
      input = v - input * 0.55;
      this.apos[i] = (j + 1) % b.length;
    }
    let rl = 0,
      rr = 0;
    for (let i = 0; i < 8; i++) {
      const b = this.rv[i],
        j = this.rpos[i],
        v = b[j];
      this.damp[i] += (v - this.damp[i]) * (0.03 + (1 - p.reverbDamp) * 0.65);
      b[j] = input + this.damp[i] * (0.45 + p.reverbSize * 0.49);
      this.rpos[i] = (j + 1) % b.length;
      if (i < 4) rl += v * 0.25;
      else rr += v * 0.25;
    }
    const dryL=l+rl*p.reverbMix*(p.reverbOn??1),
          dryR=r+rr*p.reverbMix*(p.reverbOn??1);
    // DeepMind-inspired post-VCA 100 Hz low-shelf, moderate +4.6 dB.
    // Single-pole low band is calculated continuously to prevent click on toggle.
    this.bassShelfState[0]+=this.bassShelfCoeff*(dryL-this.bassShelfState[0]);
    this.bassShelfState[1]+=this.bassShelfCoeff*(dryR-this.bassShelfState[1]);
    this.boostSmoothed+=((p.bassBoost||0)-this.boostSmoothed)*.0005;
    const boostGain=this.boostSmoothed*.70;
    const xl=dryL+this.bassShelfState[0]*boostGain,
          xr=dryR+this.bassShelfState[1]*boostGain;
    const yl = xl - this.dcIn[0] + this.dcPole * this.dcOut[0],
      yr = xr - this.dcIn[1] + this.dcPole * this.dcOut[1];
    this.dcIn[0] = xl;
    this.dcIn[1] = xr;
    this.dcOut[0] = yl;
    this.dcOut[1] = yr;
    // Revised master output: approximately +5 dB versus the previous build.
    // Saturation provides a ceiling for dense chords and boosted basses.
    this.left = saturate(yl * p.volume * 1.8);
    this.right = saturate(yr * p.volume * 1.8);
  }
}
