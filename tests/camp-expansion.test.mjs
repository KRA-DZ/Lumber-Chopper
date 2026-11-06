import test from "node:test";
import assert from "node:assert/strict";
import { createSimulation } from "../game/simulation.js";
import { createLocalCoop } from "../game/local-coop.js";
import { createCycleManager, NIGHT_START, timePeriod } from "../game/cycle.js";
import { createInitialState, DAY_SECONDS } from "../game/config.js";
import { upgradeOffer } from "../economy.js";
import { CAMP_SERVICE, ROOM } from "../game/camp-services.js";
import { CENTER } from "../game/config.js";

const make = () => createSimulation({regional:true,survival:false});
const place = (c,p) => Object.assign(c.player,p,{path:[],autoTimer:10000,moving:false});
function unlock(c,id) { const r=c.regions.all.find(r=>r.id===id);c.regions.unlocked.add(id);c.world.generate(r);c.refreshWorld();return r; }

test("night is the last quarter; morning/evening trade and night events have one boundary",()=>{
  const state=createInitialState(),events=[];state.worldTime=0;
  const cycle=createCycleManager(state,(t)=>events.push(t));
  assert.equal(NIGHT_START,450);assert.equal(DAY_SECONDS-NIGHT_START,150);
  assert.deepEqual([10,120,400,500].map(timePeriod),["Утро","День","Вечер","Ночь"]);
  cycle.update(449.99);assert.ok(!cycle.isNight);cycle.update(.02);assert.ok(cycle.isNight);
  cycle.update(149.99);assert.equal(state.nightsSurvived,1);assert.equal(events.filter(t=>t==="night-started").length,1);
  const c=make();c.state.worldTime=400;c.update(.1);assert.ok(c.buyers.length);c.state.worldTime=451;c.update(.1);assert.equal(c.activeBuyer(),null);
});

test("regions require camp stage and full wood plus stone; duplicate payments cannot consume resources",()=>{
  const c=make(),r=c.regions.all.find(r=>r.id==="1:0");
  assert.equal(c.regions.deposit(r.id),null);c.state.campLevel=1;
  for(let i=0;i<r.cost;i++)c.regions.deposit(r.id);
  assert.ok(c.regions.unlocked.has(r.id));assert.equal(c.regions.deposit(r.id),null);
  const far=c.regions.all.find(r=>r.id==="2:0");assert.ok(far.cost>r.cost*2&&far.stoneCost>0);
  assert.equal(c.regions.deposit(far.id),null);c.state.campLevel=2;
  for(let i=0;i<far.cost;i++)c.regions.deposit(far.id);
  assert.ok(!c.regions.unlocked.has(far.id));
  for(let i=0;i<far.stoneCost;i++)c.regions.deposit(far.id,"stone");
  assert.ok(c.regions.unlocked.has(far.id));assert.equal(c.regions.deposit(far.id,"stone"),null);
});

test("nearby boulders yield finite personal stone, regrow at dawn, and cannot be mined remotely",()=>{
  const c=make();unlock(c,"1:0");const rock=c.world.boulders.find(r=>r.regionId==="1:0");
  assert.equal(c.mining.hit(rock.id),false);place(c,c.nav.nearestGround(rock.x,rock.y+65));
  c.state.axePower=20;assert.ok(c.mining.hit(rock.id));assert.equal(c.state.stone,8);
  c.player.clickTimer=0;assert.equal(c.mining.hit(rock.id),false);
  c.state.calendarDay++;c.update(.05);c.player.clickTimer=0;assert.ok(c.mining.hit(rock.id));assert.equal(c.state.stone,16);
});

test("fuel burns once in co-op, cannot protect before building, and a real log relights the shared camp",()=>{
  const g=createLocalCoop(),[a,b]=g.actors;
  assert.equal(g.survival.isSafe(a.player),false);g.state.campLevel=1;g.state.campFuel=1;
  g.update(.5);assert.ok(Math.abs(g.state.campFuel-.5)<1e-8);g.update(.51);assert.equal(g.state.campFuel,0);
  assert.equal(g.survival.isSafe(a.player),false);place(b,{x:CENTER.x,y:CENTER.y+60});b.forestry.addCargo(10);
  assert.ok(b.camp.stoke());assert.equal(a.state.campFuel,60);assert.equal(b.state.wood,0);assert.ok(g.survival.isSafe(a.player));
});

test("storage keeps exact log value, is shared, is distance guarded and cannot duplicate inventory",()=>{
  const g=createLocalCoop({survival:false}),[a,b]=g.actors;
  a.forestry.addCargo(8);a.forestry.addCargo(15);place(a,{x:1900,y:1900});assert.equal(a.camp.store(),0);
  place(a,CAMP_SERVICE.store);assert.equal(a.camp.store(),2);assert.equal(a.state.wood,0);assert.deepEqual(g.state.logStore,[15,8]);
  place(b,CAMP_SERVICE.store);assert.equal(b.camp.store("withdraw"),2);assert.equal(a.state.logStore.length,0);assert.equal(b.state.cargoValue,23);
  assert.equal(b.camp.store("withdraw"),0);
});

test("co-op sale credits both wallets while pricier personal purchases debit only the buyer",()=>{
  const g=createLocalCoop({survival:false}),[a,b]=g.actors;
  g.update(.1);const buyer=g.buyers[0];Object.assign(buyer,{x:1420,y:1775,phase:"waiting",slot:0,load:0,path:[]});
  a.forestry.addCargo(40);place(a,g.sale);assert.ok(a.transferOneLog("sell"));assert.equal(a.state.coins,40);assert.equal(b.state.coins,40);
  assert.equal(upgradeOffer(b.state,"carry").price,35);assert.ok(b.purchaseUpgrade("carry"));
  assert.equal(b.state.coins,5);assert.equal(a.state.coins,40);assert.equal(a.state.maxWood,2);assert.equal(b.state.maxWood,4);
});

test("finished house enters a distinct walkable room without pausing the other player",()=>{
  const g=createLocalCoop(),[a,b]=g.actors;g.state.campLevel=4;g.state.campFuel=600;for(const c of g.actors)c.refreshWorld();
  place(a,CAMP_SERVICE.door);assert.ok(a.camp.enter());const outside={x:a.player.x,y:a.player.y},x=a.player.room.x;
  a.keys.add("KeyA");b.keys.add("ArrowRight");const bx=b.player.x;g.update(.1);
  assert.ok(a.player.room.x<x&&b.player.x>bx);assert.equal(a.player.x,outside.x);assert.equal(a.player.y,outside.y);assert.ok(!g.paused);
  g.party.focus(a);g.party.hurt(100,"watcher");assert.equal(a.state.health,100);
  Object.assign(a.player.room,ROOM.exit);assert.ok(a.camp.exit());assert.equal(a.player.room,null);assert.ok(a.nav.isWalkable(a.player.x,a.player.y));
});

test("four gates form a complete perimeter, admit friendlies, and stop enemies until opened or destroyed",()=>{
  const c=createSimulation({regional:true});c.state.campLevel=3;c.refreshWorld();const gates=c.defenses.all().filter(g=>g.kind==="gate");
  assert.equal(gates.length,4);
  for(const gate of gates){
    assert.ok(!c.nav.isWalkable(gate.x,gate.y));
    assert.ok(c.defenses.toggleGate(gate.id,true));assert.ok(c.nav.isWalkable(gate.x,gate.y));
    c.defenses.toggleGate(gate.id,false);assert.ok(c.defenses.damage(gate.id,90));assert.ok(c.nav.isWalkable(gate.x,gate.y));
    assert.ok(c.defenses.deposit(gate.id));assert.ok(!c.nav.isWalkable(gate.x,gate.y));
  }
});

test("a personal menu cancels movement and resource actions without freezing the partner or fuel",()=>{
  const g=createLocalCoop({survival:false}),[a,b]=g.actors;
  g.state.campLevel=1;g.state.campFuel=60;
  a.setDestination(a.player.x+100,a.player.y);a.player.menuOpen=true;
  a.keys.add("KeyD");b.keys.add("ArrowRight");const before=[a.player.x,b.player.x,g.state.worldTime];g.update(.3);
  assert.equal(a.player.x,before[0]);assert.ok(b.player.x>before[1]+40);assert.ok(g.state.worldTime>before[2]);
  assert.ok(Math.abs(g.state.campFuel-59.7)<1e-8);assert.equal(a.player.path.length,0);
});

test("two miners share a finite boulder and a full stone bag never consumes its HP",()=>{
  const g=createLocalCoop({survival:false}),[a,b]=g.actors;unlock(a,"1:0");b.refreshWorld();
  const rock=g.world.boulders.find(r=>r.regionId==="1:0"),p=a.nav.nearestGround(rock.x,rock.y+65);
  for(const c of [a,b]){place(c,p);c.state.axePower=20;}
  a.state.stone=39;assert.equal(a.mining.hit(rock.id),false);assert.equal(g.state.boulderHP[rock.id],undefined);
  a.state.stone=0;assert.ok(a.mining.hit(rock.id));assert.equal(b.mining.hit(rock.id),false);
  assert.equal(a.state.stone+b.state.stone,8);
});
