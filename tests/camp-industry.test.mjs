import test from "node:test";
import assert from "node:assert/strict";
import { createSimulation } from "../game/simulation.js";
import { createLocalCoop } from "../game/local-coop.js";
import { createInitialState } from "../game/config.js";
import { createCampPreparation } from "../game/camp-preparation.js";
import { INDUSTRY_PROJECTS } from "../game/camp-industry-config.js";
import { chooseBuildProject } from "./helpers/build-project.mjs";

const make=()=>createSimulation({regional:true});
const place=(c,p)=>Object.assign(c.player,p,{path:[],autoTimer:10000});
function built(c,ids){c.state.campBuildings=Object.fromEntries(ids.map(id=>[id,true]));c.state.campLevel=ids.length;c.refreshWorld();}
function supply(c,amount=100){for(const id of Object.keys(c.state.campIndustry.materials))c.state.campIndustry.materials[id]=amount;}

test("industry deposits conserve personal resources and queue inputs; invalid or remote actions debit nothing",()=>{
  const g=createLocalCoop(),[a,b]=g.actors;built(a,["workbench"]);b.refreshWorld();
  a.forestry.addCargo(8);a.forestry.addCargo(15);b.state.stone=17;
  assert.equal(a.industry.deposit("logs"),2);assert.deepEqual(a.state.logStore,[15,8]);
  assert.equal(b.industry.deposit("stone"),17);assert.equal(b.state.stone,0);assert.equal(a.state.stone,0);
  assert.equal(a.industry.data,b.industry.data);assert.ok(b.industry.enqueue("boards"));
  assert.equal(a.state.logStore.length,0);assert.equal(a.industry.data.queue.length,1);
  const snapshot=JSON.stringify(a.industry.data);place(a,{x:2500,y:2400});
  assert.equal(a.industry.enqueue("blocks"),false);assert.equal(a.industry.deposit("stone"),0);assert.equal(a.industry.upgrade("fire"),false);
  assert.equal(JSON.stringify(a.industry.data),snapshot);
});
test("a bounded shared queue ticks once in co-op, freezes on pause and holds ready output when stock is full",()=>{
  const g=createLocalCoop(),[a,b]=g.actors;built(a,["workbench"]);a.state.logStore=Array(10).fill(10);
  for(let i=0;i<3;i++)assert.ok(b.industry.enqueue("boards"));
  assert.equal(a.industry.enqueue("boards"),false);assert.equal(a.state.logStore.length,4);
  g.paused=true;g.update(100);assert.equal(a.industry.data.queue[0].remaining,8);g.paused=false;
  g.update(8.05);assert.equal(a.industry.data.materials.boards,1);assert.equal(a.industry.data.queue.length,2);
  a.industry.data.materials.boards=200;g.update(8);assert.equal(a.industry.data.queue[0].remaining,0);
  assert.equal(a.industry.data.queue.length,2);assert.equal(a.industry.data.materials.boards,200);
  a.industry.data.materials.boards--;g.update(.01);assert.equal(a.industry.data.materials.boards,200);assert.equal(a.industry.data.queue.length,1);
});
test("manufacturing projects validate prerequisites and finish atomically with shared processed materials",()=>{
  const c=make();place(c,c.build);c.builder.update();assert.equal(c.builder.choose("kiln"),false);
  built(c,["workbench"]);place(c,c.build);chooseBuildProject(c,"kiln");
  c.state.maxWood=30;for(let i=0;i<24;i++)c.forestry.addCargo(8);c.update(6);
  assert.equal(c.state.buildWood,24);assert.equal(c.state.buildProject,"kiln");assert.equal(c.state.wood,0);
  c.industry.data.materials.blocks=4;c.update(.1);assert.equal(c.state.campBuildings.kiln,true);
  assert.equal(c.industry.data.materials.blocks,0);assert.equal(c.state.buildProject,null);c.update(1);assert.equal(c.industry.data.materials.blocks,0);
});
test("coal is finite efficient fuel and fire upgrades increase capacity without granting free fuel",()=>{
  const c=make();built(c,["fire","workbench","kiln"]);c.state.logStore=[8,10,15];
  assert.ok(c.industry.enqueue("coal"));c.update(25.1);assert.equal(c.industry.data.materials.coal,2);
  place(c,{x:1600,y:1660});assert.ok(c.camp.stoke(false,"coal"));assert.equal(c.state.campFuel,180);assert.equal(c.industry.data.materials.coal,1);
  supply(c);assert.ok(c.industry.upgrade("fire"));assert.equal(c.camp.maxFuel(),900);assert.equal(c.state.campFuel,180);
  assert.equal(c.survival.safeRadius(),330);assert.ok(c.industry.upgrade("fire"));assert.equal(c.camp.maxFuel(),1200);
  const bank=JSON.stringify(c.industry.data.materials);assert.equal(c.industry.upgrade("fire"),false);assert.equal(JSON.stringify(c.industry.data.materials),bank);
  c.state.campFuel=1100;assert.equal(c.camp.stoke(false,"coal"),false);assert.equal(JSON.stringify(c.industry.data.materials),bank);
});
test("reinforcement adds real HP without reviving breaches; kits repair nearby structures and reject full targets",()=>{
  const c=make();built(c,["fence","workbench"]);supply(c);
  const fence=c.defenses.all().find(d=>d.kind==="fence"),gate=c.defenses.all().find(d=>d.kind==="gate");
  c.defenses.damage(fence.id,60);assert.ok(c.industry.upgrade("fence"));
  assert.equal(c.defenses.get(fence.id).hp,0);assert.equal(c.defenses.get(fence.id).maxHP,100);assert.equal(c.defenses.get(gate.id).maxHP,140);
  c.industry.data.materials.kits=2;assert.equal(c.preparation.repair(fence.id),false);
  place(c,c.nav.nearestGround(fence.x,fence.y+45));assert.ok(c.preparation.repair(fence.id));assert.equal(c.defenses.get(fence.id).hp,60);
  assert.ok(!c.nav.isWalkable(fence.x,fence.y));assert.ok(c.preparation.repair(fence.id));assert.equal(c.defenses.get(fence.id).hp,100);
  c.industry.data.materials.kits=1;assert.equal(c.preparation.repair(fence.id),false);assert.equal(c.industry.data.materials.kits,1);
});
test("house improvements expand storage and heal only living stationary indoor players",()=>{
  const c=make();built(c,["house","workbench"]);supply(c);assert.ok(c.industry.upgrade("house"));assert.equal(c.camp.storageLimit(),600);
  place(c,{x:1680,y:1500});assert.ok(c.camp.enter());c.state.health=80;c.update(4.1);assert.equal(c.state.health,82);
  c.paused=true;c.update(10);assert.equal(c.state.health,82);c.paused=false;
  c.keys.add("KeyD");c.update(1);assert.equal(c.state.health,82);
});
test("towers consume bounded ammunition, ignore invulnerable targets and stop when destroyed or by day",()=>{
  const state=createInitialState();state.campBuildings={"tower-west":true};state.worldTime=500;state.campIndustry.materials.coal=2;
  const enemy={id:"raider",x:1300,y:1310,hp:20},watcher={id:"watcher",x:1310,y:1320,hp:999,invulnerable:true},hits=[];
  let hp=120;
  const prep=createCampPreparation({state,player:{x:1600,y:1720},defenses:{get:()=>({hp})},nav:{hasLineOfSight:()=>true},canUse:()=>true,
    getSurvival:()=>({raiders:[watcher,enemy],residents:[],hit:(id,damage)=>{hits.push(id);enemy.hp-=damage;return true;}})});
  for(let i=0;i<20;i++)prep.update(.1);
  assert.equal(enemy.hp,18);assert.deepEqual(hits,["raider","raider"]);assert.equal(watcher.hp,999);
  assert.equal(state.campIndustry.materials.coal,1);assert.equal(state.campIndustry.towerAmmo["tower-west"],6);
  hp=0;prep.update(5);assert.equal(enemy.hp,18);hp=120;state.worldTime=120;prep.update(5);assert.equal(enemy.hp,18);
});
test("placed lanterns share one fuel clock, cost coal and light the gate without creating a sanctuary",()=>{
  const g=createLocalCoop(),[a,b]=g.actors;built(a,["lamp-north"]);const p=INDUSTRY_PROJECTS.find(p=>p.id==="lamp-north").site;
  place(a,p);place(b,p);a.industry.data.materials.coal=1;
  assert.ok(a.preparation.refuelLamp("lamp-north"));assert.equal(b.preparation.refuelLamp("lamp-north"),false);
  g.update(1);assert.ok(Math.abs(a.industry.data.lampFuel["lamp-north"]-179)<1e-7);
  assert.equal(a.preparation.lights().length,1);assert.equal(g.survival.isSafe(a.player),false);
});
test("a buyer order accepts partial real stacks and credits both wallets exactly once",()=>{
  const g=createLocalCoop(),[a,b]=g.actors;place(a,g.sale);place(b,g.sale);assert.ok(a.orders.accept("logs"));assert.equal(b.orders.accept("logs"),false);
  for(let i=0;i<6;i++){const c=i%2?a:b;c.forestry.addCargo(8);c.forestry.addCargo(15);assert.ok(c.orders.deliver(true));assert.ok(c.orders.deliver(true));}
  assert.equal(a.state.coins,180);assert.equal(b.state.coins,180);assert.equal(a.orders.data.completed,1);assert.equal(a.orders.current,null);
  assert.equal(a.orders.deliver(true),false);assert.equal(a.orders.accept("logs"),false);
});
test("night expiry and cancellation refund exact log values without repeat payouts or unbounded escrow",()=>{
  const c=make();place(c,c.sale);assert.ok(c.orders.accept("logs"));c.forestry.addCargo(8);c.forestry.addCargo(15);
  c.orders.deliver(true);c.orders.deliver(true);c.state.worldTime=449.99;c.update(.02);
  assert.equal(c.orders.current,null);assert.equal(c.orders.data.refund.length,2);assert.equal(c.state.coins,0);
  assert.equal(c.orders.accept("logs"),false);assert.equal(c.orders.takeRefund(),2);assert.equal(c.state.cargoValue,23);assert.equal(c.orders.takeRefund(),0);
  c.state.worldTime=120;assert.ok(c.orders.accept("logs"));assert.ok(c.orders.cancel());assert.equal(c.orders.data.refund.length,0);
});
test("processed orders consume the shared batch atomically and never alter ordinary buyer capacities",()=>{
  const c=make();built(c,["workbench"]);place(c,c.sale);c.industry.data.materials.boards=5;
  assert.ok(c.orders.accept("boards"));assert.equal(c.orders.deliver(true),false);assert.equal(c.industry.data.materials.boards,5);
  c.industry.data.materials.boards++;assert.ok(c.orders.deliver(true));assert.equal(c.industry.data.materials.boards,0);assert.equal(c.state.coins,210);
  c.update(.1);assert.ok(c.buyers.every(b=>b.capacity===(b.kind==="cart"?15:5)));
});
