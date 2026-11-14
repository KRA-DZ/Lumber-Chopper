import test from 'node:test';
import assert from 'node:assert/strict';
import {createSimulation} from '../game/simulation.js';
import {createLocalCoop} from '../game/local-coop.js';
import {CAMP_STATIONS,CAMP,inCamp} from '../game/camp-layout.js';
import {CAMP_SERVICE} from '../game/camp-services.js';
import {WORKERS} from '../game/workers.js';
import {captureSession,restoreSession,decodeSave} from '../game/session-save.js';
function prepare(c){
  c.state.campBuildings={fire:true,fence:true,tent:true,house:true,workbench:true,kiln:true,'tower-west':true};
  c.state.campLevel=7;c.state.maxWood=20;c.state.coins=10000;c.refreshWorld();
}
const place=(c,p)=>Object.assign(c.player,p,{path:[],autoTimer:1000});
test('square camp corners and all relocated station platforms are reachable with full buildings and fence',()=>{
  const c=createSimulation({regional:true});prepare(c);
  assert.ok(inCamp({x:1600+CAMP.fenceRX-25,y:1600+CAMP.fenceRY-25}));
  for(const site of [...CAMP_STATIONS,CAMP_SERVICE.store,WORKERS.depot]){
    assert.ok(c.nav.isWalkable(site.x,site.y),`walkable ${site.id||'storage'}`);
    assert.ok(c.nav.findPath(c.player,site).length,`reachable ${site.id||'storage'}`);
  }
});
test('warehouse transfers exact selected quantities, preserves priced logs and respects both carry pools',()=>{
  const c=createSimulation({regional:true});prepare(c);place(c,CAMP_SERVICE.store);
  c.state.logStore=[8,12,15];c.state.campIndustry.materials.boards=10;c.state.campIndustry.materials.stone=50;c.state.campIndustry.materials.blocks=20;
  assert.equal(c.storage.transfer('logs',2),2);assert.equal(c.state.cargoValue,27);
  assert.equal(c.storage.transfer('boards',3),3);assert.equal(c.state.boardCargo,3);assert.equal(c.state.campIndustry.materials.boards,7);
  assert.equal(c.storage.transfer('blocks',99),15);assert.equal(c.forestry.addCargo(10),false);
  assert.equal(c.storage.transfer('stone',99),40);assert.equal(c.state.stone,40);
  assert.equal(c.storage.transfer('logs',2,'deposit'),2);assert.equal(c.state.cargoValue,0);assert.deepEqual(c.state.logStore,[8,12,15]);
  const before=JSON.stringify(c.state);
  assert.equal(c.storage.transfer('bogus',1),0);assert.equal(c.storage.transfer('boards',-1),0);assert.equal(c.storage.transfer('boards',1.5),0);
  assert.equal(JSON.stringify(c.state),before);
  place(c,{x:1600,y:1600});assert.equal(c.storage.transfer('stone',1),0);
});
test('two players carry separate goods and complete one persisted physical house upgrade without charging the bank twice',()=>{
  const game=createLocalCoop(),[a,b]=game.actors;prepare(a);b.refreshWorld();b.state.maxWood=20;
  const site=CAMP_STATIONS.find(p=>p.id==='house');
  a.state.campIndustry.materials.boards=8;a.state.campIndustry.materials.blocks=4;
  place(a,CAMP_SERVICE.store);place(b,CAMP_SERVICE.store);
  assert.equal(a.storage.transfer('boards',5),5);assert.equal(b.storage.transfer('boards',3),3);assert.equal(b.storage.transfer('blocks',4),4);
  assert.equal(a.state.boardCargo,5);assert.equal(b.state.boardCargo,3);assert.equal(a.state.materialCargo.blocks,0);
  place(a,site);assert.ok(a.industry.selectUpgrade('house'));game.update(.8);
  assert.equal(a.state.campIndustry.upgradePaid.house.boards,2);
  assert.ok(a.industry.selectUpgrade('house'));assert.equal(a.state.campIndustry.upgradePaid.house.boards,2);
  const resumed=restoreSession(captureSession(game)),[x,y]=resumed.actors;
  assert.equal(x.state.boardCargo,3);assert.equal(y.state.materialCargo.blocks,4);assert.equal(x.state.campIndustry.upgradePaid.house.boards,2);
  place(x,site);place(y,site);resumed.update(4);
  assert.equal(x.state.campIndustry.upgrades.house,1);assert.equal(y.state.campIndustry.upgrades.house,1);
  assert.equal(x.state.boardCargo+y.state.boardCargo+y.state.materialCargo.blocks,0);
  assert.equal(x.state.campIndustry.materials.boards,0);assert.equal(x.state.campIndustry.materials.blocks,0);
  assert.equal(x.workers.slots(),3);assert.equal(x.camp.storageLimit(),600);
  assert.equal(x.state.campIndustry.upgradeSelected.house,undefined);resumed.update(2);assert.equal(x.state.campIndustry.upgrades.house,1);
});
test('worker rest assignment unloads first, resumes on assignment and shared-store mode preserves old stock',()=>{
  const c=createSimulation({regional:true,survival:false});prepare(c);place(c,WORKERS.depot);
  assert.ok(c.workers.hire());c.workers.data.stock=[8,12];assert.ok(c.workers.useSharedStore());assert.deepEqual(c.state.logStore,[12,8]);
  const w=c.workers.crew[0];w.cargo=[8,8];assert.ok(c.workers.assign(w.id,'rest'));
  for(let i=0;i<600&&w.role!=='rest';i++)c.update(.05);
  assert.equal(w.role,'rest');assert.equal(w.cargo.length,0);assert.equal(c.state.logStore.length,4);
  const before=c.state.logStore.length;c.update(10);assert.equal(w.phase,'resting');assert.equal(c.state.logStore.length,before);
  assert.ok(c.workers.assign(w.id,'lumberjack'));c.update(1);assert.equal(w.role,'lumberjack');
});
test('compatible saves receive empty cargo defaults; invalid deliveries cannot inject negative or excessive materials',()=>{
  const c=createSimulation({regional:true});prepare(c);
  const old=captureSession(c);delete old.actors[0].state.materialCargo;
  delete old.actors[0].state.campIndustry.upgradePaid;delete old.actors[0].state.campIndustry.upgradeSelected;
  const resumed=restoreSession(old);assert.deepEqual(resumed.state.materialCargo,{blocks:0,coal:0,kits:0});
  for(const invalid of [-1,1.5]){const data=captureSession(c);data.actors[0].state.materialCargo.blocks=invalid;assert.equal(decodeSave(JSON.stringify(data)),null);}
  const data=captureSession(c),s=data.actors[0].state;s.campIndustry.upgradeSelected.house=true;s.campIndustry.upgradePaid.house={boards:999};
  assert.equal(decodeSave(JSON.stringify(data)),null);
});
