import test from 'node:test';
import assert from 'node:assert/strict';
import {createSimulation} from '../game/simulation.js';
import {createMinions,MINIONS,MINION_ROLES} from '../game/minions.js';
import {captureSession,restoreSession} from '../game/session-save.js';
import {menuStep,ownerKey} from '../phaser/menu-navigation.js';
test('four-direction navigation reaches the final back action and respects ownership',()=>{
  let n=0;for(let i=0;i<5;i++)n=menuStep(n,'ArrowRight',6,2);assert.equal(n,5);assert.equal(menuStep(n,'ArrowRight',6,2),0);
  assert.equal(menuStep(0,'KeyD',12,4),1);assert.equal(menuStep(1,'KeyS',12,4),5);assert.equal(menuStep(5,'KeyA',12,4),4);assert.equal(menuStep(4,'KeyW',12,4),0);
  assert.ok(ownerKey('ArrowRight','1'));assert.ok(ownerKey('Enter','1'));assert.ok(!ownerKey('KeyE','1'));assert.ok(ownerKey('KeyE','0'));
});
test('a committed small-enemy attack survives repeated axe hits and actually deals damage',()=>{
  const c=createSimulation({regional:true}),r=c.regions.all.find(r=>r.id==='1:0');c.regions.unlocked.add(r.id);c.state.unlockedRegions.push(r.id);c.world.generate(r);
  Object.assign(c.player,{x:r.cx+300,y:r.cy+300});const hits=[];
  const nav={...c.nav,nearestGround:(x,y)=>({x,y}),isWalkable:()=>true,clearSegment:()=>true,hasLineOfSight:()=>true,moveBody:()=>{},followPath:()=>0};
  const m=createMinions({state:c.state,player:c.player,regions:c.regions,nav,isSafe:()=>false,hurtPlayer:damage=>hits.push(damage)});m.update(3.2);
  const e=m.actors.find(e=>e.role==='melee');for(const a of m.actors)a.warning=1000;Object.assign(e,{x:c.player.x+30,y:c.player.y,warning:0,cooldown:0});
  m.update(.05);const committed=e.attack;assert.ok(committed);
  for(let i=0;i<5;i++){m.hit(e.id,1,false);assert.equal(e.attack,committed);m.update(.03);}
  m.update(.1);assert.deepEqual(hits,[MINIONS.damage]);assert.ok(e.hp>0);
});
test('legacy saves upgrade living enemy tiers once without reviving defeated guards',()=>{
  const c=createSimulation({regional:true}),r=c.regions.all.find(r=>r.id==='1:0');c.regions.unlocked.add(r.id);c.state.unlockedRegions.push(r.id);c.world.generate(r);c.refreshWorld();
  Object.assign(c.player,c.nav.nearestGround(r.cx+200,r.cy+300));c.update(3.2);
  const data=captureSession(c);delete data.actors[0].state.combatBalanceVersion;
  const e=data.world.survival.minions.actors.find(e=>e.role==='ranged');assert.ok(e);e.hp=2;e.maxHP=4;
  data.actors[0].state.forestTasks.guardHP={'forest-guard:0':0,'forest-guard:1':5};
  const restored=restoreSession(data),upgraded=restored.survival.minions.find(a=>a.id===e.id);
  assert.equal(upgraded.maxHP,14);assert.equal(upgraded.hp,7);assert.equal(restored.state.forestTasks.guardHP['forest-guard:0'],0);assert.equal(restored.state.forestTasks.guardHP['forest-guard:1'],20);
  const again=restoreSession(captureSession(restored));assert.equal(again.survival.minions.find(a=>a.id===e.id).hp,7);assert.equal(again.state.combatBalanceVersion,2);
  assert.ok(MINION_ROLES.heavy.damage>MINION_ROLES.melee.damage);
});
