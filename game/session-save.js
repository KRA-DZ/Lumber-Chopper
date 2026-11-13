import {createSimulation} from './simulation.js';
import {createLocalCoop} from './local-coop.js';
import {createInitialState, DAY_SECONDS} from './config.js';
import {REGIONS, REGION_SIZE} from './regions.js';
import {applyUpgrades} from '../economy.js';
import {RECIPES} from './camp-industry-config.js';
import {BUYER_ORDERS} from './buyer-orders.js';

export const SAVE_KEY = 'lumber-session-v1';
export const SAVE_BACKUP_KEY = SAVE_KEY + '-backup';
const VERSION = 1, MAX_BYTES = 4_000_000;
const regionIds = new Set(REGIONS.map(r => r.id));
const clone = value => JSON.parse(JSON.stringify(value));
const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const point = p => object(p) && Number.isFinite(p.x) && Number.isFinite(p.y);
const check = ok => { if (!ok) throw Error('Invalid save'); };

function safeData(value, depth = 0) {
  check(depth < 35);
  if (typeof value === 'number') check(Number.isFinite(value));
  if (value && typeof value === 'object') {
    check(Object.keys(value).length <= 15000);
    for (const [key, v] of Object.entries(value)) {
      check(!['__proto__', 'constructor', 'prototype'].includes(key));
      safeData(v, depth + 1);
    }
  }
}
// Missing fields from compatible updates get defaults; malformed field types do not.
function defaults(value, template) {
  if (value === undefined) return clone(template);
  if (template === null) return value;
  if (Array.isArray(template)) { check(Array.isArray(value)); return value; }
  if (object(template)) {
    check(object(value));
    for (const [key, v] of Object.entries(template)) value[key] = defaults(value[key], v);
    return value;
  }
  check(typeof value === typeof template);
  return value;
}
function validState(s) {
  check(object(s)); defaults(s, createInitialState());
  check(Number.isInteger(s.calendarDay) && s.calendarDay >= 0 && s.worldTime >= 0 && s.worldTime < DAY_SECONDS);
  check(!s.gameOver && s.health >= 0 && s.health <= s.maxHealth && s.coins >= 0);
  check(Array.isArray(s.unlockedRegions) && s.unlockedRegions.includes('0:0') && s.unlockedRegions.every(id => regionIds.has(id)));
  for (const key of ['regionWood','regionStone','boulderHP','defenseHP','defenseWood','gateOpen']) check(object(s[key]));
  check(s.campBuildings === null || object(s.campBuildings));
  check(s.buildProject === null || typeof s.buildProject === 'string');
  check(s.cargo.every(v => typeof v === 'number' && v >= 0) && s.cargo.length === s.wood && s.cargoValue === s.cargo.reduce((n,v) => n+v, 0));
  check(s.workforce.crew.length <= 4 && s.workforce.crew.every(w => point(w) && Array.isArray(w.cargo) && Array.isArray(w.path)));
  check(s.sawmill.job === null || object(s.sawmill.job)); check(object(s.sawmill.cart));
  check(s.buyerOrders.active === null || object(s.buyerOrders.active));
  check(s.campIndustry.queue.length<=3&&s.campIndustry.queue.every(j=>object(j)&&RECIPES.some(r=>r.id===j.recipe)&&Number.isFinite(j.remaining)&&j.remaining>=0&&Number.isFinite(j.total)));
  if(s.sawmill.job)check(Number.isFinite(s.sawmill.job.remaining)&&Array.isArray(s.sawmill.job.logs)&&s.sawmill.job.logs.every(Number.isFinite));
  if(s.buyerOrders.active)check(BUYER_ORDERS.some(o=>o.id===s.buyerOrders.active.id)&&Array.isArray(s.buyerOrders.active.logs)&&Number.isInteger(s.buyerOrders.active.day));
}
function bodies(list, max, regional = false) {
  check(Array.isArray(list) && list.length <= max);
  for (const e of list) {
    check(point(e) && typeof e.id === 'string' && Array.isArray(e.path));
    if (regional) check(regionIds.has(e.regionId) && point(e.home) && Number.isFinite(e.hp) && e.hp > 0 && e.hp <= e.maxHP);
  }
}
function validate(data) {
  check(object(data) && data.version === VERSION && data.regionSize === REGION_SIZE && Number.isFinite(data.savedAt));
  check(typeof data.runId === 'string' && typeof data.name === 'string' && [1,2].includes(data.actors?.length));
  for (const a of data.actors) {
    validState(a.state); check(point(a.player)); check(a.player.room == null || point(a.player.room));
    check(object(a.runtime) && Number.isFinite(a.runtime.elapsed) && a.runtime.elapsed >= 0 && object(a.runtime.tutorial));
  }
  check(data.actors.some(a=>a.state.health>0));
  const w = data.world;
  check(object(w) && Array.isArray(w.trees) && Array.isArray(w.piles));
  check(object(w.generationLevels)&&Object.entries(w.generationLevels).every(([id,level])=>regionIds.has(id)&&['high','low'].includes(level)));
  check(data.actors[0].state.unlockedRegions.every(id=>Object.hasOwn(w.generationLevels,id)));
  for (const t of w.trees) check(typeof t.id === 'string' && Number.isFinite(t.hp) && (t.cutDay === null || Number.isInteger(t.cutDay)));
  for (const [id,p] of w.piles) check(typeof id === 'string' && point(p) && Number.isFinite(p.count) && p.count > 0);
  check(object(w.buyers) && Array.isArray(w.buyers.buyers) && w.buyers.buyers.every(b => point(b) && typeof b.id === 'number' && Array.isArray(b.path)));
  check(Number.isFinite(w.buyers.buyerSequence) && Number.isFinite(w.buyers.buyerSpawnTimer));
  const loot = w.loot;
  check(object(loot) && ['piles','seen','bosses'].every(k => Array.isArray(loot[k])) && ['day','sequence','pickupTimer'].every(k => Number.isFinite(loot[k])));
  for (const [id,p] of loot.piles) check(typeof id === 'string' && point(p) && ['coins','resin','age'].every(k => Number.isFinite(p[k])));
  const d = w.survival;
  check(object(d) && ['pending','sequence','warningTimer','hitCooldown'].every(k => Number.isFinite(d[k])));
  check(d.monster === null || point(d.monster) && Array.isArray(d.monster.path)); bodies(d.raiders, 128);
  check(d.wave === null || object(d.wave)); check(object(d.watcher) && Number.isFinite(d.watcher.clock));
  check(d.watcher.noise===null||point(d.watcher.noise));
  if(d.wave)check(['night','spawned','killed','escaped','reward'].every(k=>Number.isFinite(d.wave[k]))&&['warning','active','won','escaped','withdrawn'].includes(d.wave.status));
  for (const [key, clock, max] of [['minions','epoch',12], ['residents','observedNight',8]]) {
    const group = d[key]; check(object(group) && Number.isFinite(group[clock]) && Array.isArray(group.defeated)); bodies(group.actors, max, true);
    check(group.defeated.every(id=>typeof id==='string'));
  }
  check(Number.isFinite(d.minions.shotSequence)&&typeof d.minions.wasHunt==='boolean'&&Number.isFinite(d.raidShots?.sequence));
  for (const [shots,max] of [[d.minions.projectiles,8],[d.raidShots?.shots,4]]) {
    check(Array.isArray(shots) && shots.length <= max);
    for (const s of shots) check(point(s) && Number.isFinite(s.age) && Number.isFinite(s.duration));
  }
  return data;
}
export function decodeSave(raw) {
  try {
    check(typeof raw === 'string' && raw.length <= MAX_BYTES);
    const data = JSON.parse(raw); safeData(data); return validate(data);
  } catch { return null; }
}
// Mutable progress only: PNG, generated terrain and navigation caches are rebuilt.
export function captureSession(core, {name='Лесоруб',runId='run',now=Date.now()} = {}) {
  const actors = core.actors || [core], first = actors[0];
  if (first.state.gameOver) throw Error('Finished run');
  return clone({version:VERSION,regionSize:REGION_SIZE,savedAt:now,name,runId,
    actors:actors.map(a => ({state:{...first.state,...a.state},runtime:a.snapshotRuntime(),player:Object.fromEntries(
      ['x','y','room','direction','hitCooldown','clickTimer','autoTimer'].filter(k => a.player[k] !== undefined).map(k => [k,a.player[k]]))})),
    world:{generationLevels:first.world.generationLevels,trees:first.trees.filter(t => t.hp !== t.maxHp || t.cutDay != null).map(t => ({id:t.id,hp:t.hp,cutDay:t.cutDay ?? null})),
      piles:[...first.forestry.piles],buyers:first.buyerSystem.snapshot(),loot:first.combatLoot.snapshot(),survival:first.survival.snapshot()},
  });
}
export function restoreSession(input, options = {}) {
  const data = decodeSave(JSON.stringify(input)); check(data);
  const states = data.actors.map(a => a.state);
  for (const s of states) applyUpgrades(s);
  const setup={...options,generationLevels:data.world.generationLevels};
  const core = states.length === 2 ? createLocalCoop({...setup,savedStates:states}) : createSimulation({...setup,regional:true,savedState:states[0]});
  const actors = core.actors || [core], first = actors[0], trees = new Map(first.trees.map(t => [t.id,t]));
  for (const t of data.world.trees) { const target = trees.get(t.id); if (!target||t.hp<0||t.hp>target.maxHp) throw Error('World changed'); Object.assign(target,t); }
  first.forestry.piles.clear(); for (const [id,p] of data.world.piles) first.forestry.piles.set(id,p);
  for (const [i,a] of actors.entries()) {
    a.restoreRuntime(data.actors[i].runtime);
    Object.assign(a.player,data.actors[i].player,{path:[],moving:false,menuOpen:false,swing:0}); a.clearKeys(); a.refreshWorld();
    if (!a.player.room && !a.nav.isWalkable(a.player.x,a.player.y)) Object.assign(a.player,a.nav.nearestGround(a.player.x,a.player.y));
    for (const worker of a.workers?.crew || []) { worker.path=[]; worker.routeKey=''; }
  }
  first.buyerSystem.restore(data.world.buyers); first.combatLoot.restore(data.world.loot); first.survival.restore(data.world.survival);
  return core;
}
export function createSaveStore(storage) {
  function read() {
    try {
      const raw=storage.getItem(SAVE_KEY), backup=storage.getItem(SAVE_BACKUP_KEY), data=decodeSave(raw);
      if (data) return {data,message:'',exists:true};
      const recovered=decodeSave(backup);
      if (recovered) return {data:recovered,message:'Восстановлена резервная копия сохранения.',exists:true};
      return {data:null,message:raw || backup ? 'Сохранение повреждено или создано другой версией. Можно начать новую игру.' : '',exists:raw!==null||backup!==null};
    } catch { return {data:null,message:'Хранилище браузера недоступно. Прогресс не будет сохраняться.',exists:false}; }
  }
  return {read,
    write(data) {
      try {
        const raw=JSON.stringify(data); check(raw.length<=MAX_BYTES && decodeSave(raw));
        const old=storage.getItem(SAVE_KEY);
        storage.setItem(SAVE_KEY,raw); // A failed write preserves the previous save.
        if (decodeSave(old)) try { storage.setItem(SAVE_BACKUP_KEY,old); } catch { /* Primary save succeeded. */ }
        return true;
      } catch { return false; }
    },
    clear() { try { storage.removeItem(SAVE_KEY); storage.removeItem(SAVE_BACKUP_KEY); return true; } catch { return false; } },
  };
}
