import test from 'node:test';
import assert from 'node:assert/strict';
import {createLocalCoop} from '../game/local-coop.js';
import {createSimulation} from '../game/simulation.js';
import {fencePlan} from '../construction.js';
import {CAMP} from '../game/camp-layout.js';
import {CENTER} from '../game/config.js';
import {captureSession,restoreSession} from '../game/session-save.js';
function fence(c){c.state.campBuildings={fire:true,fence:true};c.state.campLevel=2;c.state.campFuel=600;for(const a of c.actors||[c])a.refreshWorld();}
test('real co-op customers arrive after fence construction and buy both stacks without duplicated proceeds',()=>{
  const c=createLocalCoop(),[a,b]=c.actors;fence(c);
  for(const p of c.actors){Object.assign(p.player,{x:c.sale.x,y:c.sale.y,path:[]});p.forestry.addCargo(10);p.forestry.addCargo(10);}
  for(let i=0;i<2400&&a.state.wood+b.state.wood;i++)c.update(.05);
  assert.equal(a.state.wood+b.state.wood,0);assert.equal(a.state.coins,40);assert.equal(b.state.coins,40);
  assert.equal(c.buyers.find(b=>b.slot===0).load,4);assert.ok(c.buyers.length<=5);
  // Rebuilding and reloading an existing queue must still finish the next sale.
  const r=restoreSession(captureSession(c));r.actors[1].forestry.addCargo(12);
  for(let i=0;i<100&&r.actors[1].state.wood;i++)r.update(.05);
  assert.equal(r.actors[1].state.wood,0);assert.equal(r.actors[0].state.coins,52);assert.equal(r.actors[1].state.coins,52);
  for(const a of r.actors){a.forestry.addCargo(10);a.forestry.addCargo(10);}
  for(let i=0;i<2400&&r.actors.some(a=>a.state.wood);i++)r.update(.05);
  assert.ok(r.actors.every(a=>a.state.wood===0&&a.state.coins===92));
});
test('square perimeter has four centred gates and clear routes to all services',()=>{
  const plan=fencePlan(CENTER),c=createSimulation({regional:true});fence(c);
  for(const p of plan.posts)assert.ok(Math.abs(p.x-CENTER.x)===CAMP.fenceRX||Math.abs(p.y-CENTER.y)===CAMP.fenceRY);
  assert.equal(plan.gates.length,4);
  for(const g of plan.gates){const mid={x:(g.a.x+g.b.x)/2,y:(g.a.y+g.b.y)/2};assert.ok(mid.x===CENTER.x||mid.y===CENTER.y);assert.ok(c.nav.findPath(c.player,{x:mid.x+(mid.x-CENTER.x)*.15,y:mid.y+(mid.y-CENTER.y)*.15}).length);}
  assert.ok(c.nav.isWalkable(1420,1775));assert.ok(c.nav.findPath(c.player,c.sale).length);
});
test('grove unlock requires exactly fire and fence, consumes no logs and emits once for the whole party',()=>{
  for(const buildings of [{fire:true},{fence:true},{tent:true,house:true}]){
    const c=createSimulation({regional:true,survival:false});c.state.campBuildings=buildings;c.state.campLevel=4;c.update(.01);assert.ok(!c.regions.unlocked.has('1:0'));assert.equal(c.regions.deposit('1:0'),null);
  }
  const events=[],c=createLocalCoop({emit:(t,e)=>events.push(t)});fence(c);c.actors[0].forestry.addCargo(10);c.actors[1].forestry.addCargo(20);
  c.update(.01);assert.ok(c.regions.unlocked.has('1:0'));assert.equal(c.state.regionWood['1:0'],undefined);assert.equal(c.actors[0].state.wood,1);assert.equal(c.actors[1].state.wood,1);
  const trees=c.world.trees.length;c.update(1);assert.equal(c.world.trees.length,trees);assert.equal(events.filter(t=>t==='region-open').length,1);
  const r=restoreSession(captureSession(c));r.update(.01);assert.equal(r.regions.unlocked.size,2);assert.equal(r.trees.length,trees);
});
test('watcher runs away into the forest instead of waiting at the fire boundary',()=>{
  const c=createSimulation({regional:true});fence(c);c.state.worldTime=449.99;c.update(.02);c.update(12.1);
  const m=c.survival.monster;Object.assign(m,{x:1980,y:1600,phase:'chase',path:[],repath:0,phaseTime:0,retreatGoal:null});
  for(let i=0;i<100;i++)c.update(.05);
  assert.equal(m.phase,'repelled');assert.ok(Math.hypot(m.x-CENTER.x,m.y-CENTER.y)>650);assert.ok(m.speed>190);assert.equal(c.state.health,100);
  const r=restoreSession(captureSession(c));assert.deepEqual(r.survival.monster.retreatGoal,m.retreatGoal);
});
