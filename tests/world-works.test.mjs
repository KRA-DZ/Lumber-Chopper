import test from "node:test";
import assert from "node:assert/strict";
import { createSimulation } from "../game/simulation.js";
import { createLocalCoop } from "../game/local-coop.js";
import { WORKS_PROJECTS, worksReserved, worksCollision, worksChunkAffected } from "../game/world-works-layout.js";
const make=()=>createSimulation({regional:true,survival:false});
const site=id=>WORKS_PROJECTS.find(p=>p.id===id);
const place=(c,p)=>Object.assign(c.player,p,{path:[],autoTimer:10000});
function open(c,id){const r=c.regions.all.find(r=>r.id===id);c.regions.unlocked.add(id);c.state.unlockedRegions.push(id);c.world.generate(r);c.refreshWorld();}
function supply(c,id){const p=site(id);c.state.maxWood=82;for(let i=0;i<p.cost.logs;i++)c.forestry.addCargo(11);for(const [key,n] of Object.entries(p.cost))if(key!=="logs")c.state.campIndustry.materials[key]=n;}
function finish(c,id){place(c,site(id));supply(c,id);assert.ok(c.worldWorks.contribute(id));assert.ok(c.state.worldWorks.built[id]);}
const length=(start,path)=>path.reduce((s,p,i)=>s+Math.hypot(p.x-(i?path[i-1]:start).x,p.y-(i?path[i-1]:start).y),0);

test("locked, remote, dead and forged project payments mutate no resources",()=>{
  const c=make();supply(c,"old-dam");const snapshot=()=>JSON.stringify([c.state.cargo,c.state.campIndustry.materials,c.state.worldWorks]);
  let before=snapshot();assert.equal(c.worldWorks.contribute("old-dam"),false);assert.equal(snapshot(),before);
  open(c,"-1:0");assert.equal(c.worldWorks.contribute("bad-id"),false);place(c,site("old-dam"));c.state.health=0;before=snapshot();assert.equal(c.worldWorks.contribute("old-dam"),false);assert.equal(snapshot(),before);
  c.state.health=100;c.player.room={};assert.equal(c.worldWorks.contribute("old-dam"),false);c.player.room=null;
  assert.equal(c.exploration.perform("old-dam","works:contribute"),false); // Needs an actual inspection context.
  assert.equal(c.worldWorks.setLevel("low"),false);assert.equal(c.state.worldWorks.level,"high");
});
test("co-op contributions use personal logs and one common material ledger with no repeat payment",()=>{
  const g=createLocalCoop({survival:false}),[a,b]=g.actors;open(a,"-1:0");b.refreshWorld();place(a,site("old-dam"));place(b,site("old-dam"));
  a.state.campIndustry.materials.boards=a.state.campIndustry.materials.blocks=4;
  for(let i=0;i<4;i++){const c=i%2?a:b;c.forestry.addCargo(9);c.forestry.addCargo(15);assert.ok(c.worldWorks.contribute("old-dam"));}
  assert.equal(a.state.worldWorks,b.state.worldWorks);assert.deepEqual(a.state.worldWorks.paid["old-dam"],{logs:8,boards:4,blocks:4});
  assert.equal(a.state.campIndustry.materials.boards,0);assert.equal(b.state.wood,0);assert.equal(a.state.worldWorks.level,"high");
  b.forestry.addCargo(13);assert.equal(a.worldWorks.contribute("old-dam"),false);assert.equal(b.state.cargoValue,13);assert.equal(a.state.worldWorks.revision,1);
});
test("draining opens a real ford and basin, keeps the lake, and still leaves the station gate locked",()=>{
  const c=make();open(c,"-1:0");finish(c,"old-dam");
  assert.equal(c.nav.isWalkable(-1040,1280),false);assert.equal(c.nav.isWalkable(-1400,996),false);
  assert.ok(c.worldWorks.setLevel("low"));assert.equal(c.nav.isWalkable(-1040,1280),true);assert.equal(c.nav.isWalkable(-1400,996),true);
  assert.equal(c.nav.isWalkable(c.world.pond.x,c.world.pond.y),false);
  assert.equal(c.nav.clearSegment({x:-1148,y:996},{x:-1400,y:996}),false);
  assert.equal(c.exploration.available(c.exploration.get("chest:-1:0:2")),false);
  assert.equal(c.worldWorks.setLevel("low"),false);assert.equal(c.worldWorks.setLevel("bad"),false);
});
test("raising water cannot flood either player, a downed body, workers or buyers; built decks remain safe",()=>{
  const g=createLocalCoop({survival:false}),[a,b]=g.actors;open(a,"-1:0");b.refreshWorld();finish(a,"old-dam");a.worldWorks.setLevel("low");
  place(b,{x:-1040,y:1280});b.state.health=0;assert.equal(a.worldWorks.setLevel("high"),false);assert.match(a.worldWorks.levelReason("high"),/затопления/);
  place(b,{x:1600,y:1720});const worker={x:-1040,y:1000};a.workers.crew.push(worker);assert.equal(a.worldWorks.setLevel("high"),false);a.workers.crew.pop();
  g.buyers.push({x:-1040,y:1000});assert.equal(a.worldWorks.setLevel("high"),false);g.buyers.pop();
  finish(a,"river-bridge");place(a,site("old-dam"));place(b,{x:-960,y:760});assert.ok(a.worldWorks.setLevel("high"));
  assert.equal(worksCollision(a.state,b.player.x,b.player.y,10),false);assert.equal(a.nav.isWalkable(-1040,1280),false);
});
test("the restored river bridge shortens the actual path and respects the edge of its footprint",()=>{
  const c=make();open(c,"-1:0");const start={x:-768,y:760},end={x:-1168,y:760};
  assert.equal(c.nav.clearSegment(start,end),false);const before=c.nav.findPath(start,end);assert.ok(before.length);
  finish(c,"river-bridge");assert.equal(c.nav.clearSegment(start,end),true);const after=c.nav.findPath(start,end);
  assert.ok(length(start,before)>length(start,after)+100);assert.equal(after.length,1);
  assert.equal(worksCollision(c.state,-960,705,10),true);assert.equal(c.state.unlockedRegions.length,2);
});
test("the northern boardwalk opens a shorter fortress approach without changing locked neighboring regions",()=>{
  const c=make();open(c,"0:-1");const start={x:1600,y:-80},end={x:1600,y:-400},before=c.nav.findPath(start,end);
  assert.ok(before.length);assert.equal(c.nav.clearSegment(start,end),false);finish(c,"north-boardwalk");
  assert.equal(c.nav.clearSegment(start,end),true);assert.ok(length(start,before)>length(start,c.nav.findPath(start,end))+300);
  assert.equal(c.regions.unlocked.has("-1:-1"),false);
});
test("station gate and archive require drainage; restored passage leads to one finite keyed chest",()=>{
  const c=make();open(c,"-1:0");place(c,site("sluice-gate"));supply(c,"sluice-gate");assert.equal(c.worldWorks.contribute("sluice-gate"),false);
  c.state.cargo=[];c.state.wood=0;c.state.cargoValue=0;finish(c,"old-dam");c.worldWorks.setLevel("low");finish(c,"sluice-gate");
  assert.ok(c.nav.clearSegment({x:-1148,y:996},{x:-1400,y:996}));const chest=c.exploration.get("chest:-1:0:2");assert.ok(c.exploration.available(chest));
  place(c,{x:chest.x,y:chest.y+40});assert.ok(c.exploration.request(chest.id));c.paused=true;
  assert.equal(c.exploration.perform(chest.id,"open-chest"),false);c.state.exploration.items.key=1;assert.ok(c.exploration.perform(chest.id,"open-chest"));
  assert.equal(c.state.coins,75);assert.equal(c.state.exploration.items.relic,1);assert.equal(c.exploration.perform(chest.id,"open-chest"),false);
  assert.equal(c.state.coins,75);assert.equal(c.state.exploration.items.key,0);
});
test("new terrain and infrastructure reserve generation space and only invalidate their bounded chunk areas",()=>{
  const c=make();for(const id of ["-1:0","0:-1"])open(c,id);
  assert.ok(c.world.trees.filter(t=>["-1:0","0:-1"].includes(t.regionId)).every(t=>!worksReserved(t.x,t.y)));
  assert.ok(c.world.boulders.every(r=>!worksReserved(r.x,r.y)));
  assert.ok(worksChunkAffected(-4,3));assert.equal(worksChunkAffected(6,6),false);
  assert.deepEqual(make().state.worldWorks,{level:"high",built:{},paid:{},revision:0});
});
