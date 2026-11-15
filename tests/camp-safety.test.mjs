import test from 'node:test';
import assert from 'node:assert/strict';
import {createSimulation} from '../game/simulation.js';
import {createLocalCoop} from '../game/local-coop.js';
import {CAMP_SERVICE} from '../game/camp-services.js';
import {WORKERS} from '../game/workers.js';
import {SAWMILL_REFUGE} from '../game/sawmill.js';
import {repairFromStock} from '../game/building-repair.js';
import {captureSession,restoreSession} from '../game/session-save.js';
const place=(c,p)=>Object.assign(c.player,p,{path:[],autoTimer:10000});
function camp(c){c.state.campBuildings={fire:true,fence:true,tent:true};c.state.campLevel=3;c.state.coins=1000;c.refreshWorld();}
test('region platforms accept stone first and both resources in the same transfer interval',()=>{
  const c=createSimulation({regional:true});camp(c);c.update(.05);
  const gate=c.regions.frontiers().find(g=>g.region.id==='2:0');assert.ok(gate);place(c,gate);
  c.state.stone=2;c.update(.6);assert.equal(c.state.regionStone['2:0'],2);assert.equal(c.state.regionWood['2:0']||0,0);
  c.state.stone=2;c.forestry.addCargo(13);c.update(.4);
  assert.equal(c.state.regionWood['2:0'],1);assert.ok(c.state.regionStone['2:0']>2);
  assert.equal(c.state.wood,0);assert.ok(!c.regions.unlocked.has('2:0'));
});
test('two players unload mixed materials; a full log store never blocks other resources',()=>{
  const g=createLocalCoop(),[a,b]=g.actors;camp(a);b.refreshWorld();a.state.logStore=Array(400).fill(8);
  place(a,CAMP_SERVICE.storagePad);place(b,{x:CAMP_SERVICE.storagePad.x+8,y:CAMP_SERVICE.storagePad.y});
  a.forestry.addCargo(12);a.state.stone=2;a.state.boardCargo=1;b.state.stone=3;b.state.materialCargo.blocks=2;
  g.update(1.2);
  assert.equal(a.state.wood,1);assert.equal(a.state.logStore.length,400);
  assert.equal(a.state.stone+b.state.stone+a.state.boardCargo+b.state.materialCargo.blocks,0);
  assert.deepEqual([a.state.campIndustry.materials.stone,a.state.campIndustry.materials.boards,a.state.campIndustry.materials.blocks],[5,1,2]);
  assert.equal(b.state.campIndustry.materials,a.state.campIndustry.materials);
});
test('ordinary lumberjack automatically repairs camp and fence for three logs and then returns to work',()=>{
  const c=createSimulation({regional:true});camp(c);place(c,WORKERS.depot);assert.ok(c.workers.hire());
  c.state.campHealth=130;c.state.logStore=[8,8,8];const fence=c.defenses.all().find(d=>d.kind==='fence');c.defenses.damage(fence.id,40);
  for(let i=0;i<1800&&(c.state.campHealth<200||c.defenses.get(fence.id).hp<fence.maxHP);i++)c.update(.05);
  assert.equal(c.state.campHealth,200);assert.equal(c.defenses.get(fence.id).hp,fence.maxHP);assert.equal(c.state.logStore.length,0);
  assert.equal(c.workers.crew[0].role,'lumberjack');assert.equal(c.workers.data.repaired,3);
  c.update(1);assert.equal(c.workers.crew[0].job,'oak');
});
test('stone repair spends stone only, repairs forty HP and never charges a full target',()=>{
  const c=createSimulation({regional:true}),s=c.state;s.logStore=[12];s.campIndustry.materials.stone=2;
  const wall={id:'stone-wall',material:'stone',kind:'fence',hp:10,maxHP:60};
  const defenses={restore:(_,amount)=>{wall.hp=Math.min(wall.maxHP,wall.hp+amount);return true;}};
  assert.ok(repairFromStock(s,defenses,wall));assert.equal(wall.hp,50);assert.equal(s.campIndustry.materials.stone,1);assert.deepEqual(s.logStore,[12]);
  assert.ok(repairFromStock(s,defenses,wall));assert.equal(wall.hp,60);assert.equal(s.campIndustry.materials.stone,0);
  assert.equal(repairFromStock(s,defenses,wall),false);assert.deepEqual(s.logStore,[12]);
});
test('sawmill refuge activates with its region, needs no fuel, persists after loading and repels the Watcher',()=>{
  const c=createSimulation({regional:true}),p=SAWMILL_REFUGE;
  assert.equal(c.outposts.safeZone(p),null);assert.ok(!c.outposts.lights().some(l=>l.kind==='sawmill-refuge'));
  const r=c.regions.all.find(r=>r.id===p.regionId);c.regions.unlocked.add(r.id);c.state.unlockedRegions.push(r.id);c.world.generate(r);c.refreshWorld();
  assert.ok(c.nav.isWalkable(p.x,p.y));place(c,p);
  assert.equal(c.outposts.safeZone(p).id,p.id);c.outposts.update(10000);assert.equal(c.outposts.safeZone(p).id,p.id);
  c.state.worldTime=449.99;c.update(.02);c.update(12.1);const watcher=c.survival.monster;
  Object.assign(watcher,{x:p.x,y:p.y+40,warning:0,phase:'chase',phaseTime:0,path:[],repath:0});
  c.update(.05);assert.equal(watcher.phase,'repelled');assert.equal(c.state.health,100);assert.equal(c.state.campFuel,0);
  const resumed=restoreSession(captureSession(c));assert.ok(resumed.survival.isSafe(resumed.player));assert.ok(resumed.outposts.lights().some(l=>l.kind==='sawmill-refuge'));
});
