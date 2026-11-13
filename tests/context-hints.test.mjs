import test from 'node:test';
import assert from 'node:assert/strict';
import {createSimulation} from '../game/simulation.js';
import {createLocalCoop} from '../game/local-coop.js';
import {EVENING_START,NIGHT_START} from '../game/cycle.js';
import {CAMP_SERVICE} from '../game/camp-services.js';
const create=()=>createSimulation({regional:true,survival:false});
function invite(g){g.tutorial.cut=true;g.update(.01);return g.contextHints.current;}
function ready(g){g.state.worldTime=EVENING_START;g.state.campBuildings={...(g.state.campBuildings||{}),fire:true};g.state.campFuel=550;}
test('one nearby invitation uses actual berries and never adds a second reward or daily repeat',()=>{
  const g=create();assert.equal(g.contextHints.current,null);const h=invite(g);assert.equal(h.id,'explore-berry');
  const before=JSON.stringify(g.state);for(let i=0;i<10;i++)assert.equal(g.contextHints.current.targetId,h.targetId);assert.equal(JSON.stringify(g.state),before);
  const origin={x:g.player.x,y:g.player.y};Object.assign(g.player,{x:2400,y:500});assert.equal(g.contextHints.current,null);Object.assign(g.player,origin);assert.equal(g.contextHints.current.targetId,h.targetId);
  assert.ok(g.contextHints.activate(h));for(let i=0;i<240&&!g.contextHints.explored;i++)g.update(.05);
  assert.equal(g.state.exploration.items.berry,2);assert.equal(g.state.coins,0);assert.ok(g.contextHints.explored);assert.equal(g.contextHints.current,null);
  g.cycle.update(600);g.update(.01);assert.equal(g.contextHints.current,null);assert.equal(create().contextHints.explored,false);
});
test('visiting with sight clears an invitation without granting resources, and stale buttons do nothing',()=>{
  const g=create(),h=invite(g),b=g.berries.get(h.targetId);Object.assign(g.player,{x:b.x,y:b.y+45,path:[]});
  const sight=g.nav.hasLineOfSight;g.nav.hasLineOfSight=()=>false;g.update(.01);assert.ok(!g.contextHints.explored);
  g.nav.hasLineOfSight=sight;g.update(.01);assert.ok(g.contextHints.explored);assert.equal(g.state.exploration.items.berry,0);assert.equal(g.contextHints.activate(h),false);
});
test('notes are suggested only in open territory and visiting never reads or rewards them automatically',()=>{
  const g=create();for(const b of g.world.berryBushes)g.state.exploration.berryDays[b.id]=g.state.calendarDay;
  const r=g.regions.all.find(r=>r.id==='-1:0');g.regions.unlocked.add(r.id);g.world.generate(r);g.refreshWorld();
  for(const b of g.world.berryBushes)g.state.exploration.berryDays[b.id]=g.state.calendarDay;
  const note=g.world.clues.find(p=>p.id==='pond-note');Object.assign(g.player,g.nav.nearestGround(note.x+220,note.y+120),{path:[]});
  const h=invite(g);assert.equal(h.id,'explore-note');assert.equal(h.targetId,note.id);assert.ok(g.contextHints.activate(h));
  Object.assign(g.player,g.nav.nearestGround(note.x,note.y+40),{path:[]});g.update(.01);assert.ok(g.contextHints.explored);assert.ok(!g.state.readClues.includes(note.id));assert.equal(g.state.coins,0);
});
test('preparation respects project choice and routes to fuel, storage or logs without creating resources',()=>{
  const g=create();g.state.worldTime=EVENING_START;g.state.buildProject='fence';let h=g.contextHints.current;
  assert.equal(h.id,'prep-fire');g.contextHints.activate(h);assert.equal(g.state.buildProject,'fence');assert.equal(g.state.wood,0);
  g.state.campBuildings={fire:true};g.state.campFuel=0;assert.equal(g.contextHints.current.id,'prep-logs');
  g.state.logStore.push(10);h=g.contextHints.current;assert.equal(h.id,'prep-store');g.contextHints.activate(h);assert.equal(g.player.targetX,CAMP_SERVICE.store.x);assert.equal(g.state.logStore.length,1);
  g.forestry.addCargo(10);h=g.contextHints.current;assert.equal(h.id,'prep-fuel');g.contextHints.activate(h);assert.equal(g.player.targetX,CAMP_SERVICE.fuelPad.x);assert.equal(g.state.campFuel,0);assert.equal(g.state.wood,1);
});
test('health advice uses personal existing food; ready players get silence and night guidance stays in charge',()=>{
  const g=create();ready(g);g.state.health=40;g.state.exploration.items.berry=1;let h=g.contextHints.current;
  assert.equal(h.id,'prep-heal');assert.equal(g.contextHints.activate(h),'bag');assert.equal(g.state.health,40);
  assert.ok(g.exploration.useItem('berry'));assert.equal(g.state.health,46);assert.equal(g.contextHints.current.id,'prep-forage');
  g.state.health=100;assert.equal(g.contextHints.current,null);assert.ok(g.contextHints.preparing);
  g.state.worldTime=NIGHT_START;assert.ok(!g.contextHints.preparing);assert.equal(g.contextHints.current,null);
});
test('fuel estimate follows the selected cycle speed and unavailable actors cannot activate a hint',()=>{
  const g=create();ready(g);g.state.worldTime=400;g.state.campFuel=150;assert.equal(g.contextHints.current.id,'prep-logs');g.state.cycleSpeed=2.5;assert.equal(g.contextHints.current,null);
  g.state.campFuel=0;const h=g.contextHints.current;
  g.paused=true;assert.equal(g.contextHints.activate(h),false);g.paused=false;
  g.player.menuOpen=true;assert.equal(g.contextHints.current,null);g.player.menuOpen=false;
  g.state.health=0;assert.equal(g.contextHints.activate(h),false);
});
test('co-op hints follow the selected actor while shared harvest and fire do not duplicate',()=>{
  const g=createLocalCoop({survival:false}),[a,b]=g.actors;
  for(const c of [a,b]){Object.assign(c.player,{x:1600,y:1720,path:[]});c.tutorial.cut=true;}
  g.update(.01);const h=a.contextHints.current;assert.equal(b.contextHints.current.targetId,h.targetId);
  const bush=a.berries.get(h.targetId);Object.assign(b.player,{x:bush.x,y:bush.y+40});assert.ok(b.berries.harvest(bush.id));g.update(.01);assert.equal(a.contextHints.current,null);assert.equal(a.state.exploration.items.berry,0);
  ready(a);a.state.health=40;a.state.exploration.items.berry=1;g.focus(0);assert.equal(g.contextHints.current.id,'prep-heal');g.focus(1);assert.equal(g.contextHints.current,null);
});
test('healthy players outside the light still get a return route before dusk',()=>{
  const g=createSimulation({regional:true});ready(g);Object.assign(g.player,g.nav.nearestGround(1184,2048),{path:[]});
  assert.ok(!g.survival.isSafe(g.player));const h=g.contextHints.current;assert.equal(h.id,'prep-return');assert.ok(g.contextHints.activate(h));assert.ok(g.player.path.length);
});
