import test from "node:test";
import assert from "node:assert/strict";
import {createSimulation} from "../game/simulation.js";
import {createLocalCoop} from "../game/local-coop.js";
import {FOREST_CAMP as CAMP,LOOKOUT,CAMP_GUARDS} from "../game/forest-tasks-layout.js";
const make=(hazards=true)=>createSimulation({regional:true,survival:hazards});
function open(c,id){const r=c.regions.all.find(r=>r.id===id);c.regions.unlocked.add(id);c.state.unlockedRegions.push(id);c.world.generate(r);c.refreshWorld();}
const place=(c,p)=>Object.assign(c.player,p,{path:[],autoTimer:10000});
function spawn(c){open(c,CAMP.regionId);place(c,{x:CAMP.x,y:CAMP.y+350});c.state.health=c.state.maxHealth=100000;c.update(3.2);return c.survival.minions.filter(e=>e.campGuard);}
function clear(c){for(const e of spawn(c)){e.warning=0;assert.ok(c.survival.hit(e.id,1000,false));}}
test("the camp is physically reachable, spawns three existing minion roles, and axe damage really defeats a guard",()=>{
  const c=make(),guards=spawn(c);assert.equal(guards.length,3);assert.equal(guards.filter(g=>g.role==="ranged").length,1);
  assert.ok(c.nav.findPath(c.player,CAMP).length);assert.equal(c.forestTasks.claim(),false);
  const e=guards[0];e.warning=0;place(c,c.nav.nearestGround(e.x+30,e.y));c.state.axePower=100;c.player.clickTimer=0;assert.ok(c.tryAttack(e.id));
  assert.equal(c.state.forestTasks.guardHP[e.id],0);assert.equal(c.forestTasks.guards().length,2);
});
test("partial guard HP and defeats survive day/stream changes, without respawning the paid camp",()=>{
  const c=make(),guards=spawn(c),e=guards[0];e.warning=0;c.survival.hit(e.id,1,false);assert.equal(c.state.forestTasks.guardHP[e.id],e.maxHP-1);
  c.state.calendarDay++;c.update(.05);c.update(3.2);const again=c.survival.minions.find(n=>n.id===e.id);assert.ok(again);assert.equal(again.hp,e.maxHP-1);
  for(const g of c.survival.minions.filter(n=>n.campGuard)){g.warning=0;c.survival.hit(g.id,1000,false);}
  c.state.calendarDay++;c.update(3);assert.equal(c.survival.minions.filter(n=>n.campGuard).length,0);
});
test("cache is one atomic shared reward; blocked/remote/dead claims and full bank do not consume it",()=>{
  const c=make();clear(c);assert.equal(c.forestTasks.claim(),false);place(c,CAMP);
  c.state.campIndustry.materials.boards=199;assert.equal(c.forestTasks.claim(),false);assert.equal(c.state.forestTasks.claimed,false);
  c.state.campIndustry.materials.boards=0;c.state.health=0;assert.equal(c.forestTasks.claim(),false);c.state.health=100;
  const coins=c.state.coins;assert.ok(c.forestTasks.claim());assert.equal(c.state.coins,coins+60);assert.equal(c.state.campIndustry.materials.boards,4);assert.equal(c.state.campIndustry.materials.coal,2);
  assert.equal(c.forestTasks.claim(),false);assert.equal(c.state.coins,coins+60);
});
test("co-op shares camp progress and awards both wallets once",()=>{
  const g=createLocalCoop({survival:true}),[a,b]=g.actors;clear(a);b.refreshWorld();place(a,CAMP);place(b,CAMP);
  const before=[a.state.coins,b.state.coins];assert.ok(b.forestTasks.claim());assert.equal(a.forestTasks.claim(),false);
  assert.deepEqual([a.state.coins,b.state.coins],[before[0]+60,before[1]+60]);assert.equal(g.state.campIndustry.materials.boards,4);
});
test("tower takes partial real materials, reveals neighbouring POIs without unlocking land or charging twice",()=>{
  const c=make(false);open(c,LOOKOUT.regionId);place(c,LOOKOUT);c.state.campIndustry.materials.boards=6;c.state.campIndustry.materials.blocks=4;
  const count=c.regions.unlocked.size;
  for(let i=0;i<8;i++){c.forestry.addCargo(7);c.forestry.addCargo(12);assert.ok(c.worldWorks.contribute(LOOKOUT.id));}
  assert.ok(c.state.worldWorks.built[LOOKOUT.id]);assert.equal(c.regions.unlocked.size,count);assert.equal(c.state.forestTasks.surveyed.length,5);
  assert.ok(c.forestTasks.survey("1:1").includes("лесопилка"));assert.ok(!c.regions.unlocked.has("1:1"));assert.equal(c.forestTasks.reveal(),false);
  assert.equal(c.worldWorks.contribute(LOOKOUT.id),false);assert.equal(c.state.wood,0);
  assert.equal(make(false).state.forestTasks.surveyed.length,0);
});
test("guard pursuit stays local by day, joins the fifth-night hunt, and shares the bounded actor list",()=>{
  const c=make(),guards=spawn(c),e=guards[0];place(c,{x:e.home.x+360,y:e.home.y});c.update(.2);
  assert.notEqual(e.phase,"chase");c.state.calendarDay=4;c.state.worldTime=451;c.update(3.2);
  const fresh=c.survival.minions.filter(n=>n.campGuard);assert.equal(fresh.length,3);assert.ok(fresh.some(n=>n.phase==="chase"));assert.ok(c.survival.minions.length<=12);
});
