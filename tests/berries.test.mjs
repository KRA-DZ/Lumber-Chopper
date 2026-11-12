import test from "node:test";
import assert from "node:assert/strict";
import {createSimulation} from "../game/simulation.js";
import {createLocalCoop} from "../game/local-coop.js";
const make=()=>createSimulation({regional:true,survival:false});
const first=c=>c.world.berryBushes.find(b=>!b.decorative);
const place=(c,b)=>Object.assign(c.player,{x:b.x,y:b.y+40,path:[],autoTimer:10000});
test("starter forage is reachable, collection preserves logs, shared world state regenerates once at dawn",()=>{
  const c=make(),b=first(c);assert.deepEqual({x:b.x,y:b.y},{x:1184,y:2048});assert.ok(c.nav.findPath(c.player,b).length);
  c.forestry.addCargo(7);place(c,b);assert.ok(c.berries.harvest(b.id));assert.equal(c.state.exploration.items.berry,2);assert.deepEqual(c.state.cargo,[7]);
  assert.equal(c.berries.frame(b),"empty");assert.equal(c.berries.harvest(b.id),false);
  c.state.calendarDay++;assert.equal(c.berries.frame(b),"ripe");assert.ok(c.berries.harvest(b.id));assert.equal(c.state.exploration.items.berry,4);
});
test("remote, full, paused, indoor, dead and decorative harvests have no reward or cooldown mutation",()=>{
  const c=make(),b=first(c);assert.equal(c.berries.harvest(b.id),false);place(c,b);
  c.state.exploration.items.berry=11;assert.equal(c.berries.harvest(b.id),false);c.state.exploration.items.berry=0;
  c.paused=true;assert.equal(c.berries.harvest(b.id),false);c.paused=false;
  c.player.room={};assert.equal(c.berries.harvest(b.id),false);c.player.room=null;
  c.state.health=0;assert.equal(c.berries.harvest(b.id),false);c.state.health=100;
  const flower=c.world.berryBushes.find(b=>b.decorative);place(c,flower);assert.equal(c.berries.harvest(flower.id),false);
  assert.equal(c.berries.harvest("fake"),false);assert.deepEqual(c.state.exploration.berryDays,{});
});
test("co-op harvest pays only the first collector and personal berries heal without wasting food at full HP",()=>{
  const g=createLocalCoop({survival:false}),[a,b]=g.actors,bush=first(a);place(a,bush);place(b,bush);
  assert.ok(b.berries.harvest(bush.id));assert.equal(a.berries.harvest(bush.id),false);assert.equal(a.state.exploration.items.berry,0);
  assert.equal(b.exploration.useItem("berry"),false);assert.equal(b.state.exploration.items.berry,2);
  b.state.health=97;assert.ok(b.exploration.useItem("berry"));assert.equal(b.state.health,100);assert.equal(b.state.exploration.items.berry,1);
  assert.equal(a.state.health,100);assert.equal(a.exploration.useItem("fake"),false);
});
test("ordered approach walks to the real bush, collects once and can be cancelled by keyboard movement",()=>{
  const c=make(),b=first(c);assert.ok(c.berries.order(b.id));
  for(let i=0;i<300&&!c.state.exploration.items.berry;i++)c.update(.05);
  assert.equal(c.state.exploration.items.berry,2);assert.ok(Math.hypot(c.player.x-b.x,c.player.y-b.y)<=100);
  c.state.calendarDay++;Object.assign(c.player,{x:1600,y:1720,path:[]});assert.ok(c.berries.order(b.id));c.keys.add("KeyD");c.update(.1);c.clearKeys();c.update(.2);
  assert.equal(c.state.exploration.items.berry,2);
});
