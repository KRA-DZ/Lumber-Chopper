import test from "node:test";
import assert from "node:assert/strict";
import { createSimulation } from "../game/simulation.js";
import { createLocalCoop } from "../game/local-coop.js";
import { createInitialState } from "../game/config.js";
import { createWorkers } from "../game/workers.js";
import { strikeBoulder } from "../game/mining.js";
const make=(survival=false)=>createSimulation({regional:true,survival});
const place=(c,p)=>Object.assign(c.player,p,{path:[],autoTimer:10000});
function base(g,house=0){g.state.campBuildings={tent:true,fire:true,fence:true,...(house?{house:true}:{})};g.state.campLevel=Object.keys(g.state.campBuildings).length;g.state.campIndustry.upgrades.house=house;g.state.coins=10000;g.refreshWorld();place(g,{x:1600,y:1720});}
function open(g){const r=g.regions.all.find(r=>r.id==="1:0");g.regions.unlocked.add(r.id);g.state.unlockedRegions.push(r.id);g.world.generate(r);g.refreshWorld();return r;}
function until(g,predicate,seconds=90){for(let i=0;i<seconds*20&&!predicate();i++)g.update(.05);assert.ok(predicate(),JSON.stringify(g.workers.crew.map(w=>({role:w.role,phase:w.phase,reason:w.reason,job:w.job,cargo:w.cargo,stone:w.stoneCargo,x:w.x,y:w.y}))));}

test("all professions hire without an open oak, base places are limited and house upgrades unlock exactly four",()=>{
  const g=make();base(g);const w=g.workers;
  assert.ok(w.hire("miner"));assert.ok(w.hire("repairer"));const coins=g.state.coins;
  assert.equal(w.hire("lumberjack"),false);assert.equal(g.state.coins,coins);assert.equal(w.slots(),2);
  g.state.campIndustry.upgrades.house=1;assert.equal(w.slots(),2); // A nonexistent house grants no effects.
  g.state.campBuildings.house=true;assert.equal(w.slots(),3);assert.ok(w.hire("lumberjack"));
  g.state.campIndustry.upgrades.house=2;assert.equal(w.slots(),4);assert.ok(w.hire("miner"));
  assert.equal(w.hire(),false);assert.equal(w.hire("unknown"),false);g.update(3);
  assert.match(w.crew[0].reason,/камня/);assert.match(w.crew[2].reason,/Дубовую/);
});
test("log destination delivers into the real shared store, preserves old stock values and never silently sells them",()=>{
  const g=make();base(g);open(g);const w=g.workers;w.hire();w.setLogTarget("store");
  w.data.stock.push(11,15);until(g,()=>g.state.logStore.length>=4);
  assert.equal(w.data.earned,0);assert.equal(w.data.stock.length,2);assert.equal(g.state.logStore.length,w.data.delivered);
  assert.ok(g.state.logStore.every(v=>v===8));assert.equal(w.transferStock(),2);assert.deepEqual(g.state.logStore.slice(-2),[15,11]);
  assert.equal(w.transferStock(),0);g.state.logStore=Array(400).fill(8);w.data.stock=[13];assert.equal(w.transferStock(),0);assert.deepEqual(w.data.stock,[13]);
  assert.equal(w.setLogTarget("invalid"),false);
});
test("miner walks to a real boulder, depletes shared HP and unloads exactly one finite eight-stone yield",()=>{
  const g=make();base(g);open(g);const w=g.workers;w.hire("miner");
  const before=new Map(g.world.boulders.map(r=>[r.id,r.maxHP]));
  until(g,()=>w.data.stoneDelivered>=8);w.setRecalled(true);
  until(g,()=>w.crew[0].phase==="resting");
  const depleted=g.world.boulders.filter(r=>g.state.boulderHP[r.id]===0);
  assert.ok(depleted.length>=1);assert.equal(g.state.campIndustry.materials.stone,w.data.stoneDelivered);
  assert.equal(g.state.stone,0);assert.equal(w.crew[0].stoneCargo,0);assert.equal(g.state.logStore.length,0);
  assert.equal([...before.values()].every(n=>n===12),true);assert.equal(g.state.coins,9850);
  const amount=w.data.stoneDelivered;g.update(5);assert.equal(w.data.stoneDelivered,amount);
});
test("player and worker strikes share the same final-hit claim, so a depleted rock never pays twice",()=>{
  const g=make();base(g);open(g);const w=g.workers;w.hire("miner");until(g,()=>w.crew[0].phase==="mining");
  const npc=w.crew[0],rock=g.world.boulders.find(r=>r.id===npc.workTarget);
  g.state.boulderHP[rock.id]=1;place(g,g.nav.nearestGround(npc.x+20,npc.y));g.player.clickTimer=0;
  assert.ok(g.mining.hit(rock.id));assert.equal(g.state.stone,8);assert.equal(strikeBoulder(g.state,rock,1),null);
  g.update(.1);assert.equal(npc.stoneCargo,0);assert.equal(g.state.campIndustry.materials.stone,0);
});
test("miner unloading holds cargo at the material limit; profession change returns that cargo first",()=>{
  const g=make();base(g);const w=g.workers;w.hire("miner");const npc=w.crew[0];npc.stoneCargo=8;
  Object.assign(npc,{x:1710,y:1780,job:"depot",path:[]});g.state.campIndustry.materials.stone=200;
  assert.ok(w.assign(npc.id,"repairer"));g.update(2);assert.equal(npc.role,"miner");assert.equal(npc.stoneCargo,8);
  assert.match(npc.reason,/заполнен/);g.state.campIndustry.materials.stone=192;
  until(g,()=>npc.role==="repairer",20);assert.equal(g.state.campIndustry.materials.stone,200);assert.equal(npc.stoneCargo,0);assert.equal(w.data.stoneDelivered,8);
});
test("repairer restores real breaches, spends one log per twenty HP and stops exactly at the fuel reserve",()=>{
  const g=make(true);base(g);const w=g.workers;w.hire("repairer");g.state.logStore=Array(10).fill(13);
  const sections=g.defenses.all().filter(d=>d.kind==="fence").slice(0,2);for(const s of sections)g.defenses.damage(s.id,60);
  until(g,()=>w.data.repaired===4,60);g.update(5);
  assert.equal(g.state.logStore.length,6);assert.ok(g.state.logStore.every(v=>v===13));assert.equal(w.data.repaired,4);
  assert.equal(sections.reduce((n,s)=>n+g.defenses.get(s.id).hp,0),80);
  assert.ok(sections.some(s=>g.defenses.get(s.id).hp>0&&!g.nav.isWalkable(s.x,s.y)));
  assert.equal(w.setRepairReserve(-1),false);assert.equal(w.setRepairReserve(41),false);assert.equal(w.setRepairReserve(1.5),false);
  w.setRepairReserve(0);until(g,()=>w.data.repaired===6,30);assert.equal(g.state.logStore.length,4);
});
test("night repair requires fire and stops for threats; recall and paused updates preserve all cargo and resources",()=>{
  const g=make(true);base(g);g.workers.hire("repairer");const npc=g.workers.crew[0],section=g.defenses.all().find(d=>d.kind==="fence");
  g.defenses.damage(section.id,40);g.state.logStore=Array(12).fill(8);g.state.worldTime=500;
  g.update(5);assert.equal(g.workers.data.repaired,0);g.state.campFuel=100;
  until(g,()=>g.workers.data.repaired>=1,20);
  g.paused=true;const snap=JSON.stringify(g.state.workforce),logs=g.state.logStore.length;g.update(50);
  assert.equal(JSON.stringify(g.state.workforce),snap);assert.equal(g.state.logStore.length,logs);
  g.paused=false;
  g.survival.raiders.push({id:"test-threat",kind:"raider",role:"attacker",x:npc.x+10,y:npc.y,hp:100,path:[],repath:100,warning:100,cooldown:100});
  g.update(1);assert.notEqual(npc.phase,"repairing");assert.equal(g.state.logStore.length,logs);assert.match(npc.reason,/враги/);
  g.workers.setRecalled(true);g.update(1);assert.notEqual(npc.phase,"repairing");
});
test("co-op shares the crew but charges the opener's purse; repairs tick once even after focus changes",()=>{
  const g=createLocalCoop(),[a,b]=g.actors;base(a);b.refreshWorld();place(b,{x:1600,y:1720});b.state.coins=1000;
  assert.ok(b.workers.hire("repairer"));assert.equal(b.state.coins,850);assert.equal(a.state.coins,10000);assert.equal(a.workers.crew,b.workers.crew);
  const section=a.defenses.all().find(d=>d.kind==="fence");a.defenses.damage(section.id,60);a.state.logStore=Array(10).fill(8);
  Object.assign(a.workers.crew[0],a.nav.nearestGround(section.x,section.y+45),{path:[]});g.focus(1);
  g.update(1);assert.equal(a.workers.data.repaired,0);g.update(1.1);assert.equal(a.workers.data.repaired,1);assert.equal(a.state.logStore.length,9);
  a.state.health=0;assert.equal(a.workers.assign(0,"miner"),false);assert.equal(a.workers.setLogTarget("store"),false);
});
test("four mixed professions keep one fair path budget and never produce at blocked remote targets",()=>{
  const state=createInitialState();state.campBuildings={tent:true,house:true,fence:true};state.campIndustry.upgrades.house=2;state.coins=10000;state.logStore=Array(10).fill(8);
  const searches=[],rock={id:"stone",x:2200,y:1600,radius:26,maxHP:12,yield:8},section={id:"fence-test",kind:"fence",x:1800,y:1600,hp:0,maxHP:60};let clock=0;
  const nav={version:1,nearestGround:(x,y)=>({x,y}),hasLineOfSight:()=>true,findPath:(w)=>{searches.push({id:w.id,clock});return [];},followPath:()=>0};
  const w=createWorkers({state,player:{x:1710,y:1780},world:{ancientTree:{x:3520,y:1600},boulders:[rock]},regions:{isOpen:()=>true},nav,
    defenses:{all:()=>[section],get:()=>section,deposit:()=>{throw Error("remote repair");}},forestry:{addCargo:()=>false},activeBuyer:()=>null,sale:{x:1420,y:1690,radius:53},getSurvival:()=>null});
  for(const role of ["lumberjack","miner","repairer","miner"])assert.ok(w.hire(role));
  for(let i=0;i<240;i++){clock+=.05;w.update(.05);}
  assert.equal(new Set(searches.map(s=>s.id)).size,4);assert.ok(searches.length<=41);
  for(let i=1;i<searches.length;i++)assert.ok(searches[i].clock-searches[i-1].clock>=.299);
  assert.ok(w.crew.every(n=>!n.cargo.length&&!n.stoneCargo));assert.equal(state.boulderHP.stone,undefined);assert.equal(state.logStore.length,10);
});
