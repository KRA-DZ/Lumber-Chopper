import test from "node:test";
import assert from "node:assert/strict";
import { createSimulation } from "../game/simulation.js";
import { createLocalCoop } from "../game/local-coop.js";
import { MILL, MILL_STAGES } from "../game/sawmill-production-config.js";
import { createMinions } from "../game/minions.js";
import { createBiomeEnemies } from "../game/biome-enemies.js";
import { createWatcher } from "../game/watcher.js";

const make=()=>createSimulation({regional:true,survival:false});
test("map summary is safe before the sawmill region is generated",()=>{
  const c=make();assert.match(c.exploration.regionSummary("1:1"),/Ремонт 0\/3/);
});
const place=(c,p)=>Object.assign(c.player,p,{path:[],autoTimer:10000});
function open(c){for(const id of ["1:0","1:1"]){const r=c.regions.all.find(r=>r.id===id);c.regions.unlocked.add(id);c.state.unlockedRegions.push(id);c.world.generate(r);}c.refreshWorld();}
const site=(c,id)=>c.sawmill.sites.find(s=>s.id===id);
function base(c){c.state.campBuildings={tent:true,fire:true};c.state.campLevel=2;c.state.coins=10000;c.refreshWorld();place(c,{x:1600,y:1720});}
function supply(c,cost){c.state.maxWood=82;for(let i=0;i<cost.logs;i++)c.forestry.addCargo(11);for(const [key,n] of Object.entries(cost))if(key!=="logs")c.state.campIndustry.materials[key]=n;}
function operator(c){base(c);c.workers.hire("lumberjack");const w=c.workers.crew[0];c.state.sawmill.stage=3;c.state.sawmill.enabled=true;Object.assign(w,MILL.operator,{role:"operator",job:"mill",path:[],clock:10,dangerUntil:0});return w;}
function until(c,done,seconds=100){for(let i=0;i<seconds*20&&!done();i++)c.update(.05);assert.ok(done(),JSON.stringify({time:c.state.worldTime,crew:c.workers.crew.map(w=>({role:w.role,phase:w.phase,reason:w.reason,x:w.x,y:w.y})),mill:c.state.sawmill}));}

test("restoration uses partial shared payments and retains the original manual-drive/discovery prerequisites",()=>{
  const c=make();open(c);place(c,site(c,"sawmill-restoration"));supply(c,MILL_STAGES[0].cost);
  const wood=c.state.wood;assert.equal(c.sawmill.restore(),false);assert.equal(c.state.wood,wood);
  c.state.exploration.debrisHP["sawmill-fallen-beams"]=0;assert.ok(c.sawmill.restore());assert.equal(c.state.sawmill.stage,1);
  supply(c,MILL_STAGES[1].cost);assert.equal(c.sawmill.restore(),false);
  c.state.exploration.debrisHP["sawmill-heavy-collapse"]=0;assert.equal(c.sawmill.restore(),false);
  c.state.exploration.openedPassages.push("sawmill-machine-cache");assert.ok(c.sawmill.restore());assert.equal(c.state.sawmill.stage,2);
  supply(c,MILL_STAGES[2].cost);assert.equal(c.sawmill.restore(),false);c.state.exploration.discoveries.push("sawmill-shift-tag");assert.ok(c.sawmill.restore());
  assert.equal(c.state.sawmill.stage,3);assert.ok(c.state.exploration.openedPassages.includes("sawmill-machine-cache"));assert.ok(c.state.exploration.discoveries.includes("sawmill-shift-tag"));
  const snapshot=JSON.stringify([c.state.sawmill,c.state.campIndustry.materials,c.state.cargo]);assert.equal(c.sawmill.restore(),false);assert.equal(JSON.stringify([c.state.sawmill,c.state.campIndustry.materials,c.state.cargo]),snapshot);
});
test("two players can pay one repair from private hands without double charging common materials",()=>{
  const g=createLocalCoop({survival:false}),[a,b]=g.actors;open(a);b.refreshWorld();a.state.exploration.debrisHP["sawmill-fallen-beams"]=0;
  a.state.campIndustry.materials.boards=6;a.state.campIndustry.materials.blocks=4;place(a,site(a,"sawmill-restoration"));place(b,site(b,"sawmill-restoration"));
  for(let i=0;i<6;i++){const c=i%2?a:b;c.forestry.addCargo(8);c.forestry.addCargo(15);assert.ok(c.sawmill.restore());}
  assert.equal(a.state.sawmill,b.state.sawmill);assert.equal(a.state.sawmill.stage,1);assert.deepEqual(a.state.sawmill.paid[0],{logs:12,boards:6,blocks:4});
  assert.equal(a.state.campIndustry.materials.boards,0);assert.equal(b.state.wood,0);assert.equal(a.state.coins,0);
});
test("an existing helper returns old cargo then physically walks to the machine; only one operator is allowed",()=>{
  const c=make();open(c);base(c);c.workers.hire("lumberjack");c.workers.hire("repairer");c.workers.setAutoSell(false);
  const worker=c.workers.crew[0];worker.cargo.push(9,15);c.state.sawmill.stage=3;c.state.sawmill.enabled=true;c.state.sawmill.input=Array(8).fill(11);
  assert.equal(c.workers.hire("operator"),false);assert.ok(c.workers.assign(worker.id,"operator"));assert.equal(c.workers.assign(1,"operator"),false);
  c.update(1);assert.equal(c.state.sawmill.job,null);until(c,()=>!!c.state.sawmill.job,140);
  assert.ok(Math.hypot(worker.x-MILL.operator.x,worker.y-MILL.operator.y)<65);assert.equal(worker.cargo.length,0);assert.equal(c.workers.data.delivered,2);assert.deepEqual(c.workers.data.stock,[15,9]);
  assert.equal(c.workers.crew.length,2);assert.equal(c.state.sawmill.input.length,0);
});
test("co-op processing reserves eight actual logs, ticks once, pauses, and never overfills output",()=>{
  const g=createLocalCoop({survival:false}),[a,b]=g.actors;open(a);b.refreshWorld();operator(a);b.refreshWorld();a.state.sawmill.input=Array(16).fill(13);
  g.update(6);assert.equal(a.state.sawmill.input.length,8);assert.ok(Math.abs(a.state.sawmill.job.remaining-6)<.06);
  g.paused=true;const snapshot=JSON.stringify(a.state.sawmill);g.update(50);assert.equal(JSON.stringify(a.state.sawmill),snapshot);g.paused=false;g.focus(1);g.update(6.1);
  assert.equal(a.state.sawmill.batches,1);assert.equal(a.state.sawmill.output,4);assert.equal(a.state.sawmill.input.length,0);
  assert.equal(a.state.campIndustry.materials.boards,0);a.state.sawmill.output=24;const left=a.state.sawmill.job.remaining;g.update(20);assert.equal(a.state.sawmill.job.remaining,left);assert.equal(a.state.sawmill.output,24);
});
test("production halts for a missing or recalled operator and resumes the same paid batch",()=>{
  const c=make();open(c);const w=operator(c);c.state.sawmill.input=Array(8).fill(9);c.update(2);
  const left=c.state.sawmill.job.remaining;c.workers.setRecalled(true);c.update(3);assert.equal(c.state.sawmill.job.remaining,left);assert.equal(c.state.sawmill.output,0);
  c.workers.setRecalled(false);Object.assign(w,MILL.operator,{job:"mill",path:[],dangerUntil:0});c.update(10.1);assert.equal(c.state.sawmill.output,4);assert.equal(c.state.sawmill.batches,1);
});
test("boards use personal carry slots and cannot become shared materials until a bounded camp unloading",()=>{
  const c=make();open(c);c.state.sawmill.stage=3;c.state.sawmill.output=6;place(c,site(c,"sawmill-loading"));
  assert.ok(c.sawmill.freight.collect());assert.equal(c.state.boardCargo,2);assert.equal(c.state.sawmill.output,4);assert.equal(c.forestry.addCargo(12),false);assert.equal(c.state.campIndustry.materials.boards,0);
  place(c,MILL.camp);c.state.campIndustry.materials.boards=199;assert.ok(c.sawmill.freight.unload());assert.equal(c.state.boardCargo,1);assert.equal(c.state.campIndustry.materials.boards,200);
  assert.equal(c.sawmill.freight.unload(),false);assert.equal(c.state.boardCargo,1);c.state.campIndustry.materials.boards=0;c.sawmill.freight.unload();assert.equal(c.state.boardCargo,0);
});
test("cart ownership, combined capacity, exact log values, slowing, room entry and downed release are conserved",()=>{
  const g=createLocalCoop({survival:false}),[a,b]=g.actors;base(a);b.refreshWorld();place(a,MILL.camp);place(b,MILL.camp);a.state.sawmill.stage=1;supply(a,MILL.cartCost);
  assert.ok(a.sawmill.buildCart());assert.equal(a.sawmill.buildCart(),false);a.state.maxWood=2;
  a.state.logStore=Array.from({length:27},(_,i)=>8+i);const values=[...a.state.logStore];assert.ok(a.sawmill.freight.load());assert.equal(a.state.sawmill.cart.logs.length,24);assert.equal(a.state.logStore.length,3);
  assert.ok(b.sawmill.freight.attach());assert.equal(a.sawmill.freight.attach(),false);assert.equal(a.sawmill.freight.load(),false);
  const x=b.player.x;b.keys.add("KeyD");g.update(1);b.clearKeys();assert.ok(Math.abs(b.player.x-x-160)<2);assert.ok(Math.abs(b.state.sawmill.cart.x-b.player.x)<.1);
  b.state.campBuildings.house=true;place(b,{x:1680,y:1485});assert.equal(b.camp.enter(),false);
  b.state.health=0;g.update(.1);assert.equal(a.state.sawmill.cart.owner,null);assert.deepEqual([...a.state.logStore,...a.state.sawmill.cart.logs].sort((x,y)=>x-y),values);
});
test("actual cart trip delivers raw logs to the mill and boards back without a capacity or money shortcut",()=>{
  const c=make();open(c);base(c);c.state.sawmill.stage=3;c.state.sawmill.cart.built=true;c.state.logStore=Array(24).fill(17);place(c,MILL.camp);
  c.sawmill.freight.load();c.sawmill.freight.attach();const target=site(c,"sawmill-loading");c.setDestination(target.x,target.y);until(c,()=>!c.player.path.length,130);
  assert.ok(c.sawmill.freight.deposit());assert.equal(c.state.sawmill.input.length,24);assert.ok(c.state.sawmill.input.every(n=>n===17));assert.equal(c.state.sawmill.cart.logs.length,0);
  c.state.sawmill.output=8;assert.ok(c.sawmill.freight.collect());assert.equal(c.state.boardCargo,0);assert.equal(c.state.sawmill.cart.boards,8);c.setDestination(MILL.camp.x,MILL.camp.y);until(c,()=>!c.player.path.length,130);
  assert.ok(c.sawmill.freight.unload());assert.equal(c.state.campIndustry.materials.boards,8);assert.equal(c.state.sawmill.cart.boards,0);assert.equal(c.state.maxWood,2);
});
test("night work is opt-in, emits bounded local noise only while producing, and honors manual stop",()=>{
  const events=[],c=createSimulation({regional:true,survival:false,emit:(t,e)=>events.push([t,e])});open(c);operator(c);c.state.sawmill.input=Array(8).fill(8);c.state.worldTime=500;
  c.update(.1);assert.equal(c.state.sawmill.job,null);assert.equal(c.sawmill.noise(),null);
  c.state.sawmill.nightWork=true;c.update(.2);assert.ok(c.sawmill.noise());assert.equal(c.sawmill.noise().radius,600);assert.ok(events.some(([t])=>t==="mill-noise"));
  place(c,site(c,"sawmill-production"));assert.ok(c.sawmill.perform("sawmill-production","mill:toggle"));const left=c.state.sawmill.job.remaining;
  assert.equal(c.sawmill.noise(),null);c.update(2);assert.equal(c.state.sawmill.job.remaining,left);
});
test("nearby local minions investigate the machine, then resume patrol; fifth-night pursuit still wins",()=>{
  const c=make();open(c);operator(c);c.state.sawmill.input=Array(8).fill(8);c.state.sawmill.nightWork=true;c.state.worldTime=500;c.update(.1);
  const player={x:2400,y:2200},nav={nearestGround:(x,y)=>({x,y}),isWalkable:()=>true,clearSegment:()=>true,hasLineOfSight:()=>true,findPath:(e,p)=>[p],followPath:()=>0};
  const minions=createMinions({state:c.state,player,regions:c.regions,nav,isSafe:()=>false,hurtPlayer:()=>{},emit:()=>{},getNoise:c.sawmill.noise});
  minions.update(.01);const enemy=minions.actors.find(e=>e.regionId==="1:1");assert.ok(enemy);for(const e of minions.actors)e.warning=1000;
  Object.assign(enemy,{x:MILL.operator.x-400,y:MILL.operator.y,warning:0,repath:0,path:[]});minions.update(.25);assert.equal(enemy.phase,"investigate");assert.equal(enemy.path.at(-1).x,MILL.operator.x);
  c.state.sawmill.noise=0;minions.update(.25);assert.equal(enemy.phase,"patrol");c.state.calendarDay=4;c.state.sawmill.noise=2;minions.update(.01);
  const hunter=minions.actors.find(e=>e.regionId==="1:1");Object.assign(hunter,{x:MILL.operator.x-400,y:MILL.operator.y,warning:0,repath:0,path:[]});minions.update(.25);assert.equal(hunter.phase,"chase");
});
test("regional bosses investigate local noise without acquiring a player outside their region",()=>{
  const c=make();open(c);operator(c);c.state.sawmill.input=Array(8).fill(8);c.state.sawmill.nightWork=true;c.state.worldTime=500;c.update(.1);
  const player={x:2400,y:2200},nav={nearestGround:(x,y)=>({x,y}),isWalkable:()=>true,clearSegment:()=>true,hasLineOfSight:()=>true,findPath:(e,p)=>[p],followPath:()=>0};
  const enemies=createBiomeEnemies({state:c.state,player,regions:c.regions,nav,isSafe:()=>false,hurtPlayer:()=>{},emit:()=>{},getNoise:c.sawmill.noise});
  enemies.update(.01);const boss=enemies.actors.find(e=>e.regionId==="1:1");assert.ok(boss);for(const e of enemies.actors)e.warning=1000;
  Object.assign(boss,{x:MILL.operator.x-400,y:MILL.operator.y,warning:0,repath:0,path:[]});enemies.update(.25);assert.equal(boss.phase,"investigate");
  assert.equal(boss.path.at(-1).x,MILL.operator.x);c.state.sawmill.noise=0;enemies.update(.25);assert.equal(boss.phase,"patrol");
});
test("machine hearing extends only the explicit noise source, while normal chopping keeps its radius",()=>{
  const player={x:5000,y:5000},monster={x:3420,y:3616,phase:"waking",phaseTime:0,warning:0,windup:0,path:[]};
  const ai=createWatcher({player,nav:{nearestGround:(x,y)=>({x,y}),clearSegment:()=>false},accessible:()=>true,isSafe:()=>false,safeRadius:()=>0,emit:()=>{},hurt:()=>{},damage:40,windupSeconds:.06});
  ai.hear(MILL.operator);for(let i=0;i<50;i++)ai.tick(.01,monster,190);assert.equal(monster.lastKnown,undefined);
  ai.hear(MILL.operator,600);for(let i=0;i<50;i++)ai.tick(.01,monster,190);assert.deepEqual(monster.lastKnown,{x:MILL.operator.x,y:MILL.operator.y});
});
