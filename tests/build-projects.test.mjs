import test from "node:test";
import assert from "node:assert/strict";
import { createSimulation } from "../game/simulation.js";
import { createLocalCoop } from "../game/local-coop.js";
import { CAMP_PROJECTS, hasCampBuilding } from "../game/camp-projects.js";
import { CAMP_SERVICE } from "../game/camp-services.js";

const place = (c,p) => Object.assign(c.player,p,{path:[],autoTimer:10000});
function leaveAndReturn(session,c) {
  place(c,{x:c.build.x+140,y:c.build.y});session.update(.01);
  place(c,c.build);session.update(.01);
}
test("first entry requests a free choice even empty handed; cancel never spends wood",()=>{
  const events=[],c=createSimulation({regional:true,emit:t=>events.push(t)});
  place(c,c.build);c.update(.01);assert.equal(events.filter(t=>t==="build-choice").length,1);
  c.forestry.addCargo(10);c.update(1);assert.equal(c.state.wood,1);assert.equal(c.state.buildWood,0);
  assert.equal(c.state.campLevel,0);assert.equal(c.camp.lit(),false);
  leaveAndReturn(c,c);assert.equal(events.filter(t=>t==="build-choice").length,2);
});
test("every project can be first, only its own effects activate, and payment requires re-entry",()=>{
  for(const project of CAMP_PROJECTS){
    const events=[],c=createSimulation({regional:true,emit:t=>events.push(t)});
    place(c,c.build);c.update(.01);assert.ok(c.builder.choose(project.id));
    c.state.maxWood=project.cost;for(let i=0;i<project.cost;i++)c.forestry.addCargo(10);
    c.update(.5);assert.equal(c.state.wood,project.cost);assert.equal(c.state.buildWood,0);
    leaveAndReturn(c,c);c.update(project.cost*.2+.3);
    assert.equal(c.state.campLevel,1);assert.equal(c.state.wood,0);assert.equal(c.state.campFuel,0);
    for(const other of CAMP_PROJECTS)assert.equal(hasCampBuilding(c.state,other.id),other.id===project.id);
    assert.equal(c.defenses.all().filter(d=>d.kind==="gate").length,project.id==="fence"?4:0);
    assert.equal(c.survival.isSafe(c.player),false);
    if(project.id!=="fire")assert.ok(c.nav.isWalkable(1600,1600),"No invisible fire collider");
    assert.ok(!c.builder.choices.some(p=>p.id===project.id));assert.equal(c.builder.choose(project.id),false);
    assert.equal(events.filter(t=>t==="build-choice").length,2);
    if(project.id==="house"){place(c,CAMP_SERVICE.door);assert.ok(c.camp.enter());}
  }
});
test("a built fire starts cold; E-equivalent top-ups work morning, day, evening and night",()=>{
  const c=createSimulation({regional:true,survival:false});place(c,c.build);c.update(.01);c.builder.choose("fire");
  c.state.maxWood=10;for(let i=0;i<10;i++)c.forestry.addCargo(10);
  leaveAndReturn(c,c);c.update(2.2);assert.ok(hasCampBuilding(c.state,"fire"));assert.equal(c.state.campFuel,0);
  for(const time of [20,150,400,500]){
    c.state.worldTime=time;place(c,{x:1600,y:1660});c.forestry.addCargo(8);
    const fuel=c.state.campFuel;assert.ok(c.camp.stoke());assert.equal(c.state.campFuel,fuel+60);
  }
});
test("one shared project blocks both players already on the pad, then charges only the returning builder",()=>{
  const g=createLocalCoop({survival:false}),[a,b]=g.actors;
  for(const c of [a,b]){place(c,c.build);c.forestry.addCargo(10);c.forestry.addCargo(10);}
  g.update(.01);assert.ok(b.builder.choose("fire"));assert.equal(a.builder.choose("fence"),false);
  g.update(.5);assert.equal(a.state.wood,2);assert.equal(b.state.wood,2);
  leaveAndReturn(g,b);g.update(.4);assert.equal(b.state.wood,0);assert.equal(a.state.wood,2);
  assert.equal(a.state.buildWood,2);assert.equal(a.state.buildProject,"fire");
});
