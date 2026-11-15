import test from 'node:test';
import assert from 'node:assert/strict';
import {createSimulation} from '../game/simulation.js';
import {createLocalCoop} from '../game/local-coop.js';
import {CAMP_HUB} from '../game/camp-layout.js';
import {CAMP_SERVICE,ROOM} from '../game/camp-services.js';
import {captureSession,restoreSession,decodeSave} from '../game/session-save.js';
const place=(c,p)=>Object.assign(c.player,p,{path:[],autoTimer:10000});
function ready(c){c.state.campBuildings={fire:true,fence:true,tent:true,house:true,workbench:true};c.state.campLevel=5;c.state.maxWood=30;c.state.coins=1000;c.refreshWorld();}
test('walking past the master never opens a menu or spends resources; ordering starts immediate delivery',()=>{
  const events=[],c=createSimulation({regional:true,emit:t=>events.push(t)});place(c,CAMP_HUB.counter);c.state.maxWood=10;
  for(let i=0;i<10;i++)c.forestry.addCargo(8);c.update(.5);assert.equal(c.state.wood,10);assert.ok(!events.includes('build-choice'));
  assert.ok(c.workshop.chooseBuild('fire'));assert.equal(c.state.wood,10);c.update(3);
  assert.equal(c.state.campBuildings.fire,true);assert.equal(c.state.wood,0);assert.equal(c.state.campFuel,0);assert.equal(c.state.workshopBuild,false);
});
test('co-op master accepts mixed material before logs and restores partial paid construction without charging stock',()=>{
  const g=createLocalCoop(),[a,b]=g.actors;ready(a);b.refreshWorld();b.state.maxWood=30;
  place(a,CAMP_HUB.counter);place(b,CAMP_HUB.counter);b.state.boardCargo=8;b.state.materialCargo.blocks=6;
  a.state.campIndustry.materials.boards=20;a.state.campIndustry.materials.blocks=20;
  assert.ok(a.workshop.chooseBuild('tower-west'));assert.equal(b.workshop.chooseBuild('kiln'),false);
  g.update(1);assert.ok(a.state.buildMaterials.boards>0);assert.equal(a.state.buildWood,0);
  const r=restoreSession(captureSession(g)),[x,y]=r.actors;x.state.maxWood=30;for(let i=0;i<20;i++)x.forestry.addCargo(8);
  r.update(8);assert.equal(x.state.campBuildings['tower-west'],true);assert.equal(y.state.boardCargo+y.state.materialCargo.blocks,0);assert.equal(x.state.wood,0);
  assert.equal(x.state.campIndustry.materials.boards,20);assert.equal(x.state.campIndustry.materials.blocks,20);assert.equal(x.state.buildProject,null);
});
test('upgrades and traps are selected at the master and use one shared receiving point',()=>{
  const c=createSimulation({regional:true});ready(c);place(c,{x:1775,y:1460});assert.equal(c.industry.selectUpgrade('house'),false);
  place(c,CAMP_HUB.counter);assert.ok(c.workshop.chooseUpgrade('house'));assert.equal(c.workshop.chooseBuild('kiln'),false);
  c.state.boardCargo=8;c.state.materialCargo.blocks=4;c.update(5);assert.equal(c.state.campIndustry.upgrades.house,1);assert.equal(c.state.workshopUpgrade,null);
  assert.ok(c.workshop.chooseDefense('trap-left'));c.forestry.addCargo(8);c.forestry.addCargo(8);c.update(1.2);
  assert.equal(c.defenses.get('trap-left').hp,1);assert.equal(c.state.wood,0);assert.equal(c.state.workshopDefense,null);
});
test('entering and leaving the shop transports both players without healing or changing their inventory',()=>{
  const g=createLocalCoop(),[a,b]=g.actors;place(a,CAMP_SERVICE.shopDoor);place(b,{x:3000,y:1800});
  b.state.health=0;b.state.stone=12;a.state.coins=123;
  assert.ok(a.camp.enter('shop'));assert.equal(a.player.room.id,'shop');assert.equal(b.player.room.id,'shop');assert.equal(b.state.health,0);assert.equal(b.state.stone,12);
  assert.equal(g.helpTarget(0),b);g.assist(0,true);g.update(3.1);assert.ok(b.state.health>0);
  a.player.room.x=ROOM.exit.x;a.player.room.y=ROOM.exit.y-10;assert.ok(a.camp.exit());
  assert.equal(a.player.room,null);assert.equal(b.player.room,null);assert.equal(a.state.coins,123);
  assert.equal(a.camp.enter('shop'),false);assert.equal(b.camp.enter('shop'),false);
});
test('transition is atomic if either player is using a menu or towing a cart',()=>{
  const g=createLocalCoop(),[a,b]=g.actors;place(a,CAMP_SERVICE.shopDoor);
  b.player.menuOpen=true;assert.equal(a.camp.enter('shop'),false);assert.equal(a.player.room,undefined);
  b.player.menuOpen=false;g.state.sawmill.cart.owner=1;assert.equal(a.camp.enter('shop'),false);assert.equal(b.player.room,undefined);
});
test('house manager hires from the interacting purse and rest heals only beside house beds',()=>{
  const c=createSimulation({regional:true});ready(c);place(c,CAMP_SERVICE.door);assert.ok(c.camp.enter());
  c.state.health=80;c.state.campIndustry.upgrades.house=1;c.update(4.1);assert.equal(c.state.health,80);
  Object.assign(c.player.room,{x:ROOM.bed.x,y:ROOM.bed.y+70,restStill:0,restTimer:0});c.update(4.1);assert.equal(c.state.health,82);
  Object.assign(c.player.room,{x:ROOM.manager.x,y:ROOM.manager.y+70});assert.ok(c.camp.atManager());assert.ok(c.workers.hire());assert.equal(c.state.coins,850);
  c.player.room.id='shop';c.update(4);assert.equal(c.state.health,82);
});
test('room IDs and orders survive saving; malformed material credits are rejected',()=>{
  const c=createSimulation({regional:true});ready(c);place(c,CAMP_SERVICE.shopDoor);assert.ok(c.camp.enter('shop'));
  const restored=restoreSession(captureSession(c));assert.equal(restored.player.room.id,'shop');
  const bad=captureSession(c);bad.actors[0].player.room.id='bogus';assert.equal(decodeSave(JSON.stringify(bad)),null);
  const badCost=captureSession(c);badCost.actors[0].state.buildMaterials={blocks:999};assert.equal(decodeSave(JSON.stringify(badCost)),null);
});

test('an unfinished workshop order never blocks automatic sales for either co-op player',()=>{
  const g=createLocalCoop({survival:false}),[a,b]=g.actors;ready(a);b.refreshWorld();
  place(a,CAMP_HUB.counter);assert.ok(a.workshop.chooseUpgrade('house'));
  g.update(.1);Object.assign(g.buyers[0],{x:1420,y:1775,phase:'waiting',slot:0,load:0,path:[]});
  place(b,g.sale);b.forestry.addCargo(40);const ac=a.state.coins,bc=b.state.coins;
  assert.ok(b.transferOneLog());assert.equal(a.state.coins,ac+40);assert.equal(b.state.coins,bc+40);
  assert.equal(a.state.workshopUpgrade,'house');assert.equal(b.state.wood,0);
});

test('the master accepts a building order from talking distance but only takes cargo at the counter',()=>{
  const c=createSimulation({regional:true});c.state.maxWood=10;
  place(c,{x:CAMP_HUB.counter.x,y:CAMP_HUB.counter.y+75});
  assert.ok(c.workshop.near());assert.ok(c.workshop.chooseBuild('fire'));
  for(let i=0;i<10;i++)c.forestry.addCargo(8);c.update(1);
  assert.equal(c.state.wood,10);assert.equal(c.state.buildWood,0);
  place(c,CAMP_HUB.counter);c.update(3);assert.equal(c.state.campBuildings.fire,true);
});
