import test from 'node:test';
import assert from 'node:assert/strict';
import {factory,factoryGroups,validatePatch} from '../src/presets.js';
test('factory has four banks of twenty, subdivided into eight categories',()=>{
 assert.equal(factory.length,80);
 for(const engine of ['Juno-106','Polysix','Prophet-5','Hybrid']){
  const groups=factoryGroups.filter(g=>g.engine===engine);
  assert.equal(groups.length,8);
  assert.equal(groups.reduce((n,g)=>n+g.indices.length,0),20);
  for(const g of groups) assert.ok(g.indices.every(i=>i>=0&&i<80));
 }
});
test('factory engines are isolated; hybrids use multiple engines',()=>{
 const expected={'Juno-106':[1,0,0],'Polysix':[0,1,0],'Prophet-5':[0,0,1]};
 for(const group of factoryGroups) for(const i of group.indices){
  const p=validatePatch(factory[i]);
  const active=['enableJuno','enableP6','enableP5'].map(k=>p.params[k]);
  if(group.engine==='Hybrid') assert.ok(active.reduce((a,b)=>a+b,0)>=2);
  else assert.deepEqual(active,expected[group.engine]);
 }
});
