import test from 'node:test';
import assert from 'node:assert/strict';
import {createSimulation} from '../game/simulation.js';
import {createLocalCoop} from '../game/local-coop.js';
import {MINIONS} from '../game/minions.js';
import {BIOME_ENEMIES} from '../game/biome-enemies.js';
import {SURVIVAL} from '../game/survival.js';
import {AXE_TIERS,applyUpgrades,upgradeOffer} from '../economy.js';
import {pushPlayer} from '../game/hit-impact.js';
import {COMBAT_LOOT} from '../game/combat-loot.js';
const create=emit=>createSimulation({regional:true,emit});
function dummy(g,hp=6,id='dummy'){
  const p=g.nav.nearestGround(g.player.x+35,g.player.y);
  const e={id,kind:'raider',role:'attacker',...p,hp,maxHP:hp,path:[],home:p,windup:0,cooldown:1000,stun:1000,repath:0};g.survival.raiders.push(e);return e;
}
test('combat shares the automatic axe timer and manual spam cannot add damage',()=>{
  const g=create(),e=dummy(g);g.player.autoTimer=0;assert.ok(g.tryAttack(e.id));assert.equal(e.hp,5);
  for(let i=0;i<100;i++){g.player.clickTimer=0;g.selectEnemy(e.id);assert.equal(g.attackNearby(),false);assert.equal(g.tryAttack(e.id,'active'),false);assert.equal(g.tryAttack(e.id),false);}
  assert.equal(e.hp,5);g.player.autoTimer=0;g.nav.clearSegment=()=>false;assert.equal(g.tryAttack(e.id),false);
});
test('all axe tiers keep their damage and actual HP loss clamps overkill',()=>{
  for(let level=0;level<AXE_TIERS.length;level++){
    const events=[],g=create((t,e)=>events.push([t,e]));g.state.axeLevel=level;applyUpgrades(g.state);const e=dummy(g);let strikes=0;
    while(e.hp>0&&strikes<10){Object.assign(g.player,g.nav.nearestGround(e.x-28,e.y));g.player.autoTimer=0;assert.ok(g.tryAttack(e.id));strikes++;}
    assert.equal(strikes,Math.ceil(6/AXE_TIERS[level].power));assert.equal(events.filter(([t])=>t==='enemy-hit').reduce((n,[,e])=>n+e.actualDamage,0),6);
  }
});
test('manual combat command has no effect in empty space or beside a tree',()=>{
  const g=create(),before=JSON.stringify(g.state);assert.equal(g.attackNearby(),false);assert.equal(JSON.stringify(g.state),before);
});
test('damage tiers remain distinct, immunity prevents repeated damage/push and knockback stays walkable',()=>{
  assert.ok(MINIONS.hp<BIOME_ENEMIES.hp);assert.ok(MINIONS.damage<BIOME_ENEMIES.damage&&BIOME_ENEMIES.damage<SURVIVAL.monsterDamage);
  for(const [damage,source] of [[MINIONS.damage,'minion'],[BIOME_ENEMIES.damage,'resident'],[SURVIVAL.monsterDamage,'watcher']]){
    const events=[],g=create((t,e)=>events.push([t,e]));let enemy;
    if(source==='watcher'){
      g.state.worldTime=450;g.survival.nightStarted(1);g.survival.update(12.1);enemy=g.survival.monster;
      Object.assign(enemy,{phase:'windup',phaseTime:0,warning:0,attack:{x:g.player.x,y:g.player.y,radius:96,duration:.06}});
    }else{
      const r=g.regions.all.find(r=>r.id==='1:0');g.regions.unlocked.add(r.id);g.world.generate(r);g.refreshWorld();Object.assign(g.player,g.nav.nearestGround(r.cx+600,r.cy+500));g.state.worldTime=450;g.survival.update(3.1);
      enemy=source==='minion'?g.survival.minions.find(e=>e.role==='melee'):g.survival.regionalBosses[0];
      for(const other of g.survival.residents){other.warning=1000;other.cooldown=1000;}
      Object.assign(enemy,{warning:0,cooldown:0,windup:0,attack:null,path:[],repath:0});
    }
    const point=Array.from({length:8},(_,i)=>({x:g.player.x+Math.cos(i*Math.PI/4)*32,y:g.player.y+Math.sin(i*Math.PI/4)*32})).find(p=>g.nav.clearSegment(g.player,p));assert.ok(point);Object.assign(enemy,point);
    const before={x:g.player.x,y:g.player.y};for(let i=0;i<20&&g.state.health===100;i++)g.survival.update(.05);
    assert.equal(g.state.health,100-damage,source);assert.ok(Math.hypot(g.player.x-before.x,g.player.y-before.y)>0&&g.nav.isWalkable(g.player.x,g.player.y));
    const x=g.player.x;for(let i=0;i<24;i++)g.survival.update(.05);assert.equal(g.player.x,x);assert.equal(g.state.health,100-damage);
    assert.equal(events.filter(([t])=>t==='player-hurt').length,1);
  }
  const g=create();Object.assign(g.player,g.nav.nearestGround(332,1600));pushPlayer(g.nav,g.player,{x:g.player.x+40,y:g.player.y},'minion');assert.ok(g.nav.isWalkable(g.player.x,g.player.y));assert.ok(g.player.x>=330);
});
test('co-op damage and recoil affect only the targeted player and clamp lethal HP loss',()=>{
  const events=[],g=createLocalCoop({emit:(t,e)=>events.push([t,e])}),[a,b]=g.actors;
  g.party.focus(b);b.state.health=5;g.party.hurt(40,'watcher',{x:b.player.x-50,y:b.player.y});assert.equal(a.state.health,100);assert.equal(b.state.health,0);
  assert.equal(events.find(([t])=>t==='player-hurt')[1].actualDamage,5);assert.ok(!g.state.gameOver);
});
test('the immortal watcher cannot lose HP or create a hit reward',()=>{
  const events=[],g=create((t,e)=>events.push([t,e]));g.state.worldTime=449.99;g.update(.02);
  const w=g.survival.monster;Object.assign(w,{x:g.player.x+35,y:g.player.y,warning:0});g.player.clickTimer=0;
  assert.equal(g.attackNearby(),false);assert.ok(w.invulnerable);assert.equal(w.hp,undefined);assert.ok(!events.some(([t])=>t==='enemy-hit'));
});
test('balance keeps early trading useful rather than making one monster pay for an axe',()=>{
  const g=create(),price=upgradeOffer(g.state,'axe').price;assert.equal(price,75);
  assert.equal(Math.ceil(price/COMBAT_LOOT.minionCoins),19);assert.equal(Math.ceil(price/COMBAT_LOOT.bossCoins),3);
  assert.equal(Math.ceil(price/COMBAT_LOOT.minionDailyCoins),2);assert.equal(Math.ceil(price/g.trees.find(t=>t.type==='oak').value),8);
  assert.equal(Math.ceil(MINIONS.hp/AXE_TIERS[0].power),18);assert.equal(Math.ceil(BIOME_ENEMIES.hp/AXE_TIERS[0].power),120);
});
