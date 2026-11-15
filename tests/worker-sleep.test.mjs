import test from 'node:test';
import assert from 'node:assert/strict';
import {createSimulation} from '../game/simulation.js';
import {createLocalCoop} from '../game/local-coop.js';
import {WORKERS} from '../game/workers.js';
import {NIGHT_START} from '../game/cycle.js';
import {captureSession,restoreSession} from '../game/session-save.js';
function ready(c){
  c.state.campBuildings={tent:true,fire:true,fence:true};c.state.campLevel=3;c.state.coins=1000;c.state.campFuel=600;
  c.refreshWorld();Object.assign(c.player,WORKERS.depot);c.update(.1);
}
function until(c,predicate,seconds=60){
  for(let i=0;i<seconds*20&&!predicate();i++)c.update(.05);
  assert.ok(predicate(),JSON.stringify(c.workers.crew));
}
test('co-op workers unload once, walk to the tent, sleep and resume at dawn',()=>{
  const g=createLocalCoop({survival:false}),a=g.actors[0];ready(a);
  assert.ok(a.workers.hire());assert.ok(a.workers.hire('miner'));
  const [w,m]=a.workers.crew;w.cargo.push(9,15);m.stoneCargo=2;
  a.state.worldTime=WORKERS.recallTime+1;g.update(.05);
  assert.ok(!w.sleeping);assert.ok(Math.hypot(w.x-WORKERS.sleepEntrance.x,w.y-WORKERS.sleepEntrance.y)>24);
  until(g,()=>a.workers.crew.every(w=>w.sleeping));
  assert.deepEqual(a.state.logStore,[15,9]);assert.equal(a.state.campIndustry.materials.stone,2);
  assert.ok(a.workers.crew.every(w=>!w.cargo.length&&!w.stoneCargo&&Math.hypot(w.x-WORKERS.sleepEntrance.x,w.y-WORKERS.sleepEntrance.y)<24));
  a.state.worldTime=NIGHT_START+1;g.update(2);assert.ok(w.sleeping);
  a.state.worldTime=0;g.update(.05);assert.equal(w.sleeping,false);assert.equal(m.sleeping,false);
});
test('full storage preserves sleeping cargo across saving and permits delivery after dawn',()=>{
  const c=createSimulation({regional:true,survival:true});ready(c);assert.ok(c.workers.hire());Object.assign(c.player,{x:1600,y:1700});
  const w=c.workers.crew[0];w.cargo.push(19);c.state.logStore=Array(c.camp.storageLimit()).fill(8);c.state.worldTime=NIGHT_START+1;
  until(c,()=>w.sleeping);assert.deepEqual(w.cargo,[19]);
  const r=restoreSession(captureSession(c)),sleeper=r.workers.crew[0];r.update(.05);
  assert.equal(sleeper.sleeping,true);assert.deepEqual(sleeper.cargo,[19]);
  r.state.logStore.pop();r.state.worldTime=0;until(r,()=>sleeper.cargo.length===0);
  assert.equal(sleeper.sleeping,false);assert.equal(r.state.logStore.at(-1),19);
});
test('an idle repairer sleeps, wakes for an affordable night repair, then returns to the tent',()=>{
  const c=createSimulation({regional:true,survival:true});ready(c);assert.ok(c.workers.hire('repairer'));
  c.state.worldTime=NIGHT_START+1;c.state.logStore=Array(12).fill(8);
  const w=c.workers.crew[0];until(c,()=>w.sleeping,15);
  const gate=c.defenses.all().find(d=>d.kind==='gate');c.defenses.damage(gate.id,20);w.workScan=0;
  until(c,()=>!w.sleeping,5);until(c,()=>c.defenses.get(gate.id).hp===gate.maxHP,20);
  until(c,()=>w.sleeping,20);assert.ok(c.state.logStore.length<12);
});
