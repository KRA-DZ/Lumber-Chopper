import test from 'node:test';
import assert from 'node:assert/strict';
import {createSimulation} from '../game/simulation.js';
import {createLocalCoop} from '../game/local-coop.js';
import {captureSession,decodeSave,restoreSession,createSaveStore,SAVE_KEY,SAVE_BACKUP_KEY} from '../game/session-save.js';
const create=()=>createSimulation({regional:true});
const memory=()=>{const map=new Map();return {map,getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};};
function open(c,id){const r=c.regions.all.find(r=>r.id===id);c.regions.unlocked.add(id);c.state.unlockedRegions.push(id);c.world.generate(r);c.refreshWorld();}
const roundTrip=c=>restoreSession(captureSession(c));
test('solo restores resources, upgrades, independent buildings, opened regions, cut trees and loose logs',()=>{
  const c=create();open(c,'1:0');c.state.coins=1000;assert.ok(c.purchaseUpgrade('axe'));assert.ok(c.purchaseUpgrade('carry'));
  c.forestry.addCargo(10);c.forestry.addCargo(20);c.state.stone=12;c.state.campBuildings={fire:true,house:true};c.state.campLevel=2;c.state.campFuel=320;c.state.logStore=[7,8,9];
  c.state.buildProject='fence';c.state.buildWood=17;c.state.regionWood['0:1']=12;c.state.regionStone['2:0']=5;
  c.state.worldWorks.built['west-bridge']=true;c.state.exploration.openedChests.push('saved-chest');c.state.exploration.berryDays.test=2;c.state.exploration.items.relic=2;c.state.story.pages=['test'];
  const tree=c.trees.find(t=>!t.workerOnly);tree.hp=0;c.forestry.fell(tree,0);
  c.update(.01);const data=captureSession(c,{runId:'same-run',name:'Лесоруб',now:1234});assert.ok(decodeSave(JSON.stringify(data)));
  const r=restoreSession(data);assert.deepEqual(r.state,c.state);assert.deepEqual(r.trees.find(t=>t.id===tree.id).hp,0);
  assert.equal(r.trees.find(t=>t.id===tree.id).cutDay,0);assert.deepEqual([...r.forestry.piles],[...c.forestry.piles]);
  assert.equal(r.regions.unlocked.size,2);assert.equal(r.trees.length,c.trees.length);assert.equal(r.elapsed,c.elapsed);
  assert.notEqual(r.state,c.state);r.forestry.takeCargo();assert.equal(c.state.wood,2);
  r.state.calendarDay=3;r.forestry.updateGrowth(r.trees,3);assert.equal(r.trees.find(t=>t.id===tree.id).hp,tree.maxHp);
});
test('co-op restores both personal accounts and downed state, while shared world references still work',()=>{
  const c=createLocalCoop(),[a,b]=c.actors;open(a,'1:0');
  a.state.coins=1000;b.state.coins=500;a.purchaseUpgrade('axe');b.purchaseUpgrade('carry');
  a.forestry.addCargo(10);b.forestry.addCargo(20);a.state.campBuildings={house:true};a.state.campLevel=1;
  a.state.campFuel=123;a.state.logStore=[8];b.state.health=0;b.player.hitCooldown=1.1;
  a.state.sawmill.cart={built:true,owner:0,x:a.player.x,y:a.player.y,logs:[7],boards:3};
  c.update(.05);const r=roundTrip(c),[x,y]=r.actors;
  assert.equal(r.coop,true);assert.deepEqual(x.state,a.state);assert.deepEqual({...x.state,...y.state},{...a.state,...b.state});
  assert.equal(y.state.health,0);assert.equal(y.player.hitCooldown,b.player.hitCooldown);assert.equal(x.state.priceMultiplier,1.75);
  y.state.campFuel=300;assert.equal(x.state.campFuel,300);y.state.logStore.push(9);assert.deepEqual(x.state.logStore,[8,9]);
  y.state.coins=25;assert.equal(x.state.coins,a.state.coins);assert.equal(x.survival,y.survival);assert.equal(x.forestry.piles,y.forestry.piles);
  assert.deepEqual([...r.regions.unlocked],['0:0','1:0']);
});
test('reload during fifth-night raid keeps wave, watcher, enemy HP, defeated roster and loot budget',()=>{
  const c=create();open(c,'1:0');c.state.calendarDay=4;c.state.worldTime=449.99;c.state.campBuildings={fire:true};c.state.campLevel=1;c.state.campFuel=500;
  c.update(12.2);assert.ok(c.survival.wave);assert.ok(c.survival.raiders.length);assert.ok(c.survival.monster);
  const target=c.survival.minions[0];target.warning=0;assert.ok(c.survival.hit(target.id,1000,false));
  c.state.combatLoot.smallCoins=40;const before=c.survival.snapshot(),data=captureSession(c),r=restoreSession(data);
  assert.equal(r.state.worldTime,c.state.worldTime);assert.equal(r.survival.wave.spawned,before.wave.spawned);assert.equal(r.survival.wave.killed,before.wave.killed);
  assert.deepEqual(r.survival.raiders.map(e=>[e.id,e.hp]),c.survival.raiders.map(e=>[e.id,e.hp]));
  assert.equal(r.survival.monster.phase,c.survival.monster.phase);assert.equal(r.survival.hitCooldown,c.survival.hitCooldown);
  assert.equal(r.state.combatLoot.smallCoins,40);assert.deepEqual([...r.combatLoot.piles],[...c.combatLoot.piles]);
  r.update(.05);assert.ok(!r.survival.minions.some(e=>e.id===target.id));assert.equal(r.state.combatLoot.smallCoins,40);
  r.update(2.1);assert.ok(!r.survival.minions.some(e=>e.id===target.id),'stream scan must not resurrect defeated minions');
});
test('production, workers, house position, purchased items and pending customer order survive',()=>{
  const c=create();open(c,'1:0');c.state.coins=1000;c.state.campBuildings={tent:true,house:true,workbench:true};c.state.campLevel=3;
  Object.assign(c.player,c.nav.nearestGround(1580,1760));assert.ok(c.workers.hire());
  const worker=c.workers.crew[0];worker.cargo=[8,8];worker.cutTimer=.8;c.state.workforce.stock=[8];
  c.state.campIndustry.queue=[{id:1,recipe:'boards',total:8,remaining:4}];c.state.sawmill.stage=3;c.state.sawmill.job={remaining:6,logs:[8,8,8,8,8,8,8,8]};
  c.state.sawmill.input=[8,8];c.state.buyerOrders.active={id:'logs',day:0,logs:[10]};c.state.exploration.rod=true;
  c.player.room={x:100,y:120};const r=roundTrip(c);
  assert.equal(r.player.room.x,100);assert.equal(r.player.room.y,120);assert.deepEqual(r.state.campIndustry.queue,c.state.campIndustry.queue);
  assert.deepEqual(r.state.sawmill,c.state.sawmill);assert.deepEqual(r.state.buyerOrders,c.state.buyerOrders);
  assert.equal(r.workers.crew[0].cutTimer,.8);assert.deepEqual(r.workers.crew[0].cargo,[8,8]);assert.equal(r.state.exploration.rod,true);
});
test('storage retains backup, recovers corruption, rejects incompatible and malformed saves',()=>{
  const storage=memory(),store=createSaveStore(storage),c=create();assert.equal(store.read().data,null);
  const first=captureSession(c,{now:1});assert.equal(store.write(first),true);c.state.coins=50;assert.equal(store.write(captureSession(c,{now:2})),true);
  assert.equal(store.read().data.actors[0].state.coins,50);storage.map.set(SAVE_KEY,'broken');assert.equal(store.read().data.actors[0].state.coins,0);assert.match(store.read().message,/резерв/);
  for(const mutate of [s=>s.version=999,s=>s.actors[0].state.worldTime=-1,s=>s.actors[0].state.unlockedRegions=['bad'],s=>s.world.survival.minions.actors=[{}],s=>s.actors[0].state.exploration.items=[],s=>s.world.buyers.buyers=null]){
    const s=structuredClone(first);mutate(s);assert.equal(decodeSave(JSON.stringify(s)),null);
  }
  assert.equal(decodeSave('{"__proto__":{}}'),null);assert.equal(decodeSave('x'.repeat(4_000_001)),null);
  storage.map.set(SAVE_BACKUP_KEY,'bad');assert.equal(store.read().data,null);assert.ok(store.read().message);assert.ok(store.clear());assert.equal(storage.map.size,0);
});
test('quota failure leaves last good save intact; blocked storage and finished runs fail safely',()=>{
  const storage=memory(),store=createSaveStore(storage),c=create();assert.ok(store.write(captureSession(c)));
  storage.setItem=()=>{throw Error('QuotaExceededError')};c.state.coins=999;assert.equal(store.write(captureSession(c)),false);assert.equal(store.read().data.actors[0].state.coins,0);
  const blocked=createSaveStore();assert.equal(blocked.read().data,null);assert.ok(blocked.read().message);assert.equal(blocked.write(captureSession(c)),false);assert.equal(blocked.clear(),false);
  c.defeat('test');assert.throws(()=>captureSession(c));
});
test('draining or flooding water never regenerates a different forest after resuming',()=>{
  for(const [before,after] of [['high','low'],['low','high']]){
    const c=create();c.state.worldWorks.level=before;open(c,'-1:0');open(c,'-1:1');
    const original=c.trees.map(t=>[t.id,t.x,t.y,t.type,t.hp]);c.state.worldWorks.level=after;
    const r=roundTrip(c);assert.equal(r.state.worldWorks.level,after);assert.deepEqual(r.trees.map(t=>[t.id,t.x,t.y,t.type,t.hp]),original);
  }
});
