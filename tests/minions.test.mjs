import { NIGHT_START } from "../game/cycle.js";
import test from "node:test";
import assert from "node:assert/strict";
import { createSimulation } from "../game/simulation.js";
import { createMinions, MINIONS, MINION_ROLES, minionHuntNight } from "../game/minions.js";
import { createBiomeEnemies, BIOME_ENEMIES } from "../game/biome-enemies.js";
import { regionAt } from "../game/regions.js";

function fixture({ day = 0, time = 120, fence = false, all = false } = {}) {
  const g = createSimulation({ regional: true });
  for (const r of g.regions.all)
    if (all || r.id === "1:0") {
      g.regions.unlocked.add(r.id);
      g.world.generate(r);
    }
  g.state.calendarDay = day;
  g.state.worldTime = time;
  if (fence) g.state.campLevel = 3;
  g.nav.rebuildObstacles();
  Object.assign(g.player, { x: 3520, y: 1600, path: [], autoTimer: 10000 });
  const damage = [],
    events = [];
  const options = {
    state: g.state,
    player: g.player,
    regions: g.regions,
    nav: g.nav,
    defenses: g.defenses,
    isSafe: (p) => Math.hypot(p.x - 1600, p.y - 1600) < 310,
    hurtPlayer: (...args) => damage.push(args),
    emit: (...args) => events.push(args),
  };
  const m = createMinions(options);
  const step = (seconds) => {
    for (let t = 0; t < seconds - 1e-9; t += 0.05)
      m.update(Math.min(0.05, seconds - t));
  };
  step(3.2);
  function isolate(role = "melee") {
    const e = m.actors.find((e) => e.role === role);
    assert.ok(e);
    for (const other of m.actors) if (other !== e) other.warning = 1000;
    return e;
  }
  return { g, m, step, damage, events, options, isolate };
}

test("small monsters exist by day, persist through dawn, reset at each dusk and never spawn in the camp square", () => {
  const f = fixture();
  assert.equal(f.m.actors.length, 3);
  assert.ok(
    f.m.actors.every((e) => e.tier === "minion" && e.regionId !== "0:0"),
  );
  assert.deepEqual(
    f.m.actors.map((e) => e.maxHP),
    [6, 12, 4],
  );
  const e = f.isolate();
  assert.ok(f.m.hit(e.id, 6, false));
  f.step(4);
  assert.ok(!f.m.actors.some((a) => a.id === e.id));
  f.g.state.worldTime = NIGHT_START + 1;
  f.step(0.05);
  assert.equal(f.m.actors.length, 3);
  const ids = f.m.actors.map((e) => e.id);
  f.g.state.calendarDay = 1;
  f.g.state.worldTime = 0;
  f.step(0.05);
  assert.deepEqual(
    f.m.actors.map((e) => e.id),
    ids,
  );
  assert.equal(f.g.state.coins, 0);
  f.g.state.gameOver = true;
  const before = JSON.stringify(f.m.actors);
  f.step(3);
  assert.equal(JSON.stringify(f.m.actors), before);
});

test("global pursuit starts at dusk on nights 5,10,...; it never begins in the fifth daytime", () => {
  for (let day = 0; day < 15; day++) {
    assert.equal(minionHuntNight({ calendarDay: day, worldTime: 120 }), false);
    assert.equal(
      minionHuntNight({ calendarDay: day, worldTime: NIGHT_START + 1 }),
      (day + 1) % 5 === 0,
    );
  }
  const f = fixture({ day: 4 });
  let e = f.isolate();
  Object.assign(f.g.player, f.g.nav.nearestGround(2810, 1800));
  Object.assign(e, f.g.nav.nearestGround(2920, 1800), {
    warning: 0,
    path: [],
    repath: 0,
  });
  f.step(2);
  assert.equal(regionAt(e.x, e.y).id, "1:0");
  f.g.state.worldTime = NIGHT_START + 1;
  f.step(0.05);
  e = f.isolate();
  Object.assign(e, f.g.nav.nearestGround(2920, 1800), {
    warning: 0,
    path: [],
    repath: 0,
  });
  f.step(3);
  assert.equal(regionAt(e.x, e.y).id, "0:0");
  f.g.state.calendarDay = 5;
  f.g.state.worldTime = 0;
  f.step(0.05);
  assert.equal(e.phase, "retreat");
});

test("a melee pursuer actually damages and breaches the real camp fence, then advances through the gap", () => {
  const f = fixture({ day: 4, time: NIGHT_START + 1, fence: true }),
    e = f.isolate();
  Object.assign(f.g.player, { x: 1600, y: 1720 });
  const section = f.g.defenses
    .all()
    .filter((s) => s.kind === "fence")
    .sort((a, b) => b.x - a.x)[0];
  Object.assign(e, f.g.nav.nearestGround(section.x + 45, section.y), {
    path: [],
    repath: 0,
    warning: 0,
  });
  const before = Math.hypot(e.x - f.g.player.x, e.y - f.g.player.y);
  assert.ok(!f.g.nav.clearSegment(e, f.g.player));
  f.step(2);
  assert.ok(f.g.defenses.all().some((s) => s.kind === "fence" && s.hp < 60));
  f.step(18);
  assert.ok(f.g.defenses.all().some((s) => s.kind === "fence" && s.hp === 0));
  assert.ok(Math.hypot(e.x - f.g.player.x, e.y - f.g.player.y) < before - 40);
  assert.equal(
    f.g.state.campHealth,
    200,
    "small pursuers target the player, not automatic camp damage",
  );
});

test("ranged attacks arc over an intact fence, lock their landing point and allow a dodge", () => {
  const f = fixture({ day: 4, time: NIGHT_START + 1, fence: true }),
    e = f.isolate("ranged");
  Object.assign(f.g.player, f.g.nav.nearestGround(1795, 1640));
  Object.assign(e, f.g.nav.nearestGround(1925, 1640), {
    path: [],
    repath: 0,
    warning: 0,
  });
  assert.ok(!f.g.nav.hasLineOfSight(e, f.g.player));
  const fences = JSON.stringify(f.g.state.defenseHP);
  f.step(0.4);
  assert.equal(f.m.projectiles.length, 1);
  const shot = f.m.projectiles[0];
  const target = { x: shot.x, y: shot.y };
  Object.assign(
    f.g.player,
    f.g.nav.nearestGround(f.g.player.x, f.g.player.y + 100),
  );
  f.step(0.7);
  assert.equal(f.damage.length, 0);
  assert.deepEqual({ x: shot.x, y: shot.y }, target);
  for (let i = 0; i < 50 && !f.m.projectiles.length; i++) f.step(0.05);
  assert.ok(f.m.projectiles.length);
  f.step(0.7);
  assert.deepEqual(f.damage[0].slice(0,2), [MINIONS.projectileDamage, "minion"]);
  assert.ok(Number.isFinite(f.damage[0][2].x));
  assert.equal(JSON.stringify(f.g.state.defenseHP), fences);
  f.g.state.calendarDay = 5;
  f.g.state.worldTime = 0;
  f.step(0.05);
  assert.equal(f.m.projectiles.length, 0);
});

test("hunting pursuers remain active far from their home; all open regions still respect actor and projectile caps", () => {
  const f = fixture({ day: 4, time: NIGHT_START + 1, all: true }),
    e = f.isolate();
  assert.ok(f.m.actors.length <= MINIONS.max);
  Object.assign(e, f.g.nav.nearestGround(6000, 1600), {
    warning: 0,
    path: [],
    repath: 0,
  });
  Object.assign(f.g.player, { x: 1600, y: 1720 });
  f.step(2.2);
  assert.ok(f.m.actors.includes(e));
  assert.equal(e.phase, "chase");
  assert.ok(f.m.actors.length <= MINIONS.max);
  assert.ok(f.m.projectiles.length <= MINIONS.maxProjectiles);
});

test("the same purchased axe damage and cadence apply to small monsters; pause and zero time cannot deal damage", () => {
  const { g } = fixture();
  g.update(3.2);
  const enemy = g.survival.minions.find((e) => e.role === "melee");
  assert.ok(enemy);
  Object.assign(g.player, g.nav.nearestGround(enemy.x + 30, enemy.y), {
    path: [],
    autoTimer: 10000,
    clickTimer: 0,
  });
  assert.ok(g.selectEnemy(enemy.id));
  const initial = g.state.autoInterval;
  g.state.coins = 1000;
  assert.ok(g.purchaseUpgrade("axe"));
  assert.equal(g.state.axePower, 2);
  assert.ok(g.state.autoInterval < initial);
  enemy.warning = 1;
  assert.equal(g.tryAttack(enemy.id), false);
  assert.equal(g.player.clickTimer, 0);
  enemy.warning = 0;
  assert.ok(g.tryAttack(enemy.id));
  assert.equal(enemy.hp, 4);
  assert.equal(g.tryAttack(enemy.id), false);
  g.update(0);
  assert.equal(enemy.hp, 4);
  g.paused = true;
  g.update(10);
  assert.equal(enemy.hp, 4);
  assert.equal(g.tryAttack(enemy.id), false);
  g.paused = false;
  g.player.autoTimer = 0;
  g.update(0.01);
  assert.equal(enemy.hp, 2);
  g.update(g.state.autoInterval + 0.01);
  assert.ok(!g.survival.minions.includes(enemy));
  assert.equal(g.state.raidsWon, 0);
  assert.equal(g.survival.wave, null);
});

test("bosses have a narrower notice radius, retain committed strikes after hits and resume chase quickly", () => {
  const f = fixture();
  f.g.state.worldTime = NIGHT_START + 1;
  const bosses = createBiomeEnemies(f.options);
  for (let i = 0; i < 70; i++) bosses.update(0.05);
  const e = bosses.actors[0];
  assert.equal(e.maxHP, 120);
  Object.assign(f.g.player, f.g.nav.nearestGround(e.x + 220, e.y));
  bosses.update(0.05);
  assert.equal(e.phase, "patrol");
  Object.assign(f.g.player, f.g.nav.nearestGround(e.x + 30, e.y));
  bosses.update(0.05);
  assert.ok(e.attack);
  const attack = e.attack;
  assert.ok(bosses.hit(e.id, 1, false));
  assert.equal(e.attack, attack);
  for (let i = 0; i < 5; i++) bosses.update(0.05);
  assert.ok(f.damage.length > 0);
  e.cooldown = 0;
  bosses.update(0.05);
  assert.ok(e.attack);
  Object.assign(f.g.player, f.g.nav.nearestGround(e.x, e.y + 140));
  bosses.update(0.05);
  assert.equal(e.attack, null);
  assert.equal(e.phase, "chase");
  assert.ok(BIOME_ENEMIES.sense < 280);
});

// Flat, open arena isolates tactics; tests above cover real terrain, fences and navigation.
function roleArena(){
  const f=fixture(),nav={...f.g.nav,
    nearestGround:(x,y)=>({x,y}),isWalkable:()=>true,hasLineOfSight:()=>true,clearSegment:()=>true,
    followPath(e,dt,speed){const p=e.path[0];if(!p)return 0;const d=Math.hypot(p.x-e.x,p.y-e.y),n=Math.min(d,dt*speed);if(d){e.x+=(p.x-e.x)*n/d;e.y+=(p.y-e.y)*n/d;}if(n>=d)e.path.shift();return n;},
  };
  const m=createMinions({...f.options,nav});m.update(3.2);
  Object.assign(f.g.player,{x:3520,y:1600});
  const isolate=role=>{const e=m.actors.find(e=>e.role===role);assert.ok(e);for(const other of m.actors)other.warning=1000;Object.assign(e,{x:3700,y:1600,warning:0,path:[],repath:0,cooldown:0,attack:null,windup:0});return e;};
  const step=t=>{for(let i=0;i<t-1e-9;i+=.05)m.update(Math.min(.05,t-i));};
  return {...f,m,nav,isolate,step};
}
test('pursuer closes distance, while heavy closes more slowly and hits harder after a longer windup',()=>{
  const melee=roleArena(),a=melee.isolate('melee'),heavy=roleArena(),b=heavy.isolate('heavy');
  melee.step(.5);heavy.step(.5);
  assert.ok(a.x<b.x,'pursuer closes the same gap faster');assert.equal(b.maxHP,12);
  for(const f of [melee,heavy]){const e=f.m.actors.find(e=>e.warning===0);Object.assign(e,{x:3550,y:1600,path:[],repath:0,cooldown:0,windup:0,attack:null});}
  melee.step(.4);heavy.step(.4);assert.equal(melee.damage[0][0],8);assert.equal(heavy.damage.length,0);
  heavy.step(.2);assert.equal(heavy.damage[0][0],10);
  melee.step(1.3);heavy.step(1.3);assert.equal(melee.damage.length,2);assert.equal(heavy.damage.length,1);
  assert.ok(b.hp<BIOME_ENEMIES.hp&&MINION_ROLES.heavy.damage<BIOME_ENEMIES.damage);
});
test('thrower creates distance when approached, stops fleeing at its preferred range, then fires',()=>{
  const f=roleArena(),e=f.isolate('ranged');e.x=3590;
  f.step(.05);assert.equal(e.phase,'evade');assert.ok(e.x>3590);assert.equal(f.m.projectiles.length,0);
  f.step(1.5);assert.ok(Math.hypot(e.x-f.g.player.x,e.y-f.g.player.y)>=MINIONS.retreatEnd);
  assert.equal(e.phase,'aim');assert.ok(f.m.projectiles.length>0);
  const position=e.x;f.step(.2);assert.equal(e.x,position,'no back-and-forth jitter at preferred range');
});
test('a cornered thrower attacks rather than retreating through walls or across its region boundary',()=>{
  const f=roleArena(),e=f.isolate('ranged');e.x=3590;
  f.nav.clearSegment=(a,b)=>Math.hypot(b.x-f.g.player.x,b.y-f.g.player.y)<=100;
  f.step(.4);assert.equal(e.x,3590);assert.equal(e.phase,'aim');assert.equal(f.m.projectiles.length,1);
  const edge=roleArena(),r=edge.g.regions.all.find(r=>r.id==='1:0'),b=edge.isolate('ranged');
  Object.assign(edge.g.player,{x:r.x+r.width-75,y:r.cy});Object.assign(b,{x:r.x+r.width-5,y:r.cy});
  edge.step(3);assert.equal(regionAt(b.x,b.y)?.id,r.id);assert.ok(edge.m.projectiles.length||edge.events.some(([type])=>type==='minion-projectile-impact'));
});
test('all three roles revive at dusk and keep the existing cap and fifth-night global hunt',()=>{
  const f=fixture({day:4}),roles=()=>f.m.actors.map(e=>e.role).sort();
  assert.deepEqual(roles(),['heavy','melee','ranged']);for(const e of [...f.m.actors])f.m.hit(e.id,1000,false);
  assert.equal(f.m.actors.length,0);f.g.state.worldTime=NIGHT_START+1;f.step(.05);
  assert.deepEqual(roles(),['heavy','melee','ranged']);assert.ok(f.m.hunt);assert.ok(f.m.actors.length<=MINIONS.max);
});
