import test from 'node:test';
import assert from 'node:assert/strict';
import { SynthEngine } from '../src/audio/engine.js';
const set = (e,k,v) => e.handle({type:'param',k,v});
test('three engines distribute twelve cards 4/4/4',()=>{
 const e=new SynthEngine(48000);e.noteOn('a',60);
 assert.equal(e.snapshot().voices,3);
 assert.deepEqual(e.voices.filter(v=>v.down).map(v=>v.index),[0,4,8]);
 assert.deepEqual(e.voices.filter(v=>v.down).map(v=>v.kind),[0,1,2]);
 for(let i=1;i<4;i++)e.noteOn('n'+i,60+i);
 assert.equal(e.snapshot().voices,12);
});
test('one engine has twelve playable notes, two have six',()=>{
 const e=new SynthEngine(48000);set(e,'enableP5',0);set(e,'enableP6',0);
 for(let i=0;i<12;i++)e.noteOn('n'+i,60+i);
 assert.equal(e.snapshot().voices,12);
 e.panic();set(e,'enableP6',1);
 for(let i=0;i<6;i++)e.noteOn('n'+i,60+i);
 assert.equal(e.snapshot().voices,12);
});
test('unison stacks twelve cards; mono layers one per engine',()=>{
 const e=new SynthEngine(48000);set(e,'voiceMode',1);e.noteOn('a',60);
 assert.equal(e.snapshot().voices,12);
 e.panic();set(e,'voiceMode',0);e.noteOn('a',60);
 assert.equal(e.snapshot().voices,3);
});
test('analog and fader controls render finite audio',()=>{
 const e=new SynthEngine(48000);set(e,'analog',1);set(e,'analogDetune',1);
 e.noteOn('a',60);const l=new Float32Array(512),r=new Float32Array(512);
 e.render(l,r);assert.ok(l.every(Number.isFinite));assert.ok(r.every(Number.isFinite));
 assert.equal(e.snapshot().voiceActivity.length,12);
});
