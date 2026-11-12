import test from "node:test";
import assert from "node:assert/strict";
import {createSimulation} from "../game/simulation.js";
import {STREAM_OUTLINE,STREAM_CROSSINGS,streamWater,streamCollision,streamReserved} from "../game/camp-stream.js";
import {worksSurfaces,worksWater} from "../game/world-works-layout.js";
const make=()=>createSimulation({regional:true,survival:false});
function west(c){const r=c.regions.all.find(r=>r.id==="-1:0");c.regions.unlocked.add(r.id);c.state.unlockedRegions.push(r.id);c.world.generate(r);c.refreshWorld();}
const place=(c,p)=>Object.assign(c.player,p,{path:[],autoTimer:10000});
test("one stable outline joins the existing lake, blocks deep water, and leaves the fishing bank usable",()=>{
  const c=make();west(c);assert.equal(c.world.streamOutline,STREAM_OUTLINE);
  assert.ok(streamWater(c.world.pond.x,c.world.pond.y));assert.ok(c.world.inWater(650,1980));
  assert.equal(c.nav.isWalkable(650,1980),false);assert.equal(c.nav.clearSegment({x:650,y:1870},{x:650,y:2070}),false);
  const fish=c.exploration.get("fishing");assert.ok(c.nav.isWalkable(fish.x,fish.y));
  assert.ok(c.nav.findPath(c.player,fish).length);
  assert.equal(c.nav.isWalkable(c.world.pond.x,c.world.pond.y),false);
});
test("both free fords accept real feet and wide approach paths while nearby deep water stays blocked",()=>{
  const c=make();west(c);
  for(const f of STREAM_CROSSINGS){
    assert.ok(streamWater(f.x,f.y));assert.equal(streamCollision(f.x,f.y,10),false);
    const a={x:f.x,y:f.y-f.height/2-35},b={x:f.x,y:f.y+f.height/2+35};
    assert.ok(c.nav.clearSegment(a,b),f.id);assert.ok(c.nav.findPath(a,b).length);
    assert.ok(streamReserved(f.x,f.y));
  }
  assert.ok(c.trees.every(t=>!streamWater(t.x,t.y,60)));
  assert.ok(c.world.boulders.every(t=>!streamReserved(t.x,t.y,55)));
});
test("start still reaches west border and fish, and a physical cart can cross and return with its exact load",()=>{
  const c=make();const gate=c.regions.frontiers().find(g=>g.region.id==="-1:0");assert.ok(c.nav.findPath(c.player,gate).length);west(c);
  const f=STREAM_CROSSINGS[0];place(c,{x:f.x,y:f.y-130});c.state.sawmill.cart.built=true;Object.assign(c.state.sawmill.cart,{x:c.player.x,y:c.player.y});c.state.sawmill.cart.owner=0;c.state.sawmill.cart.logs=[7,12];
  c.setDestination(f.x,f.y+130);for(let i=0;i<100&&c.player.path.length;i++)c.update(.05);
  assert.ok(Math.abs(c.player.y-f.y-130)<2);assert.deepEqual(c.state.sawmill.cart.logs,[7,12]);
  c.setDestination(f.x,f.y-130);for(let i=0;i<100&&c.player.path.length;i++)c.update(.05);
  assert.ok(Math.abs(c.player.y-f.y+130)<2);assert.ok(Math.abs(c.state.sawmill.cart.y-c.player.y)<.1);
});
test("low-water painting and collision use the same translated channels",()=>{
  const c=make();c.state.worldWorks.level="low";
  for(const r of worksSurfaces(c.state).filter(r=>r.kind==="water"))assert.ok(worksWater(c.state,r.x+r.width/2,r.y+r.height/2));
  assert.ok(worksSurfaces(c.state).some(r=>r.kind==="water"&&r.width===64&&r.x<-900));
});
