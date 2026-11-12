import test from "node:test";
import assert from "node:assert/strict";
import {createSimulation} from "../game/simulation.js";
import {createLocalCoop} from "../game/local-coop.js";
import {CAMP_SERVICE} from "../game/camp-services.js";
const make=()=>createSimulation({regional:true,survival:false});
function setup(c){c.state.campBuildings={fire:true};c.state.campLevel=1;Object.assign(c.player,CAMP_SERVICE.fuelPad,{path:[],autoTimer:10000});c.forestry.addCargo(7);c.forestry.addCargo(12);}
test("built cold fire ignites from the pad by day or night and spends exact hand logs gradually",()=>{
  for(const time of [120,500]){const c=make();setup(c);c.state.worldTime=time;
    assert.ok(c.nav.isWalkable(c.player.x,c.player.y));assert.ok(c.camp.atFuelPad());
    c.update(.4);assert.equal(c.state.wood,2);assert.equal(c.state.campFuel,0);
    c.update(.45);assert.equal(c.state.wood,1);assert.ok(c.camp.lit());assert.ok(c.state.campFuel>59&&c.state.campFuel<=60);
    c.update(.85);assert.equal(c.state.wood,0);assert.ok(c.state.campFuel>118&&c.state.campFuel<120);
    c.update(2);assert.equal(c.state.wood,0);assert.equal(c.state.campIndustry.materials.coal,0);
  }
});
test("no automatic fuel before construction, outside pad, in a room/menu, while dead or paused",()=>{
  const c=make();setup(c);c.state.campBuildings={};c.update(1);assert.equal(c.state.wood,2);
  c.state.campBuildings={fire:true};c.player.x+=80;c.update(1);assert.equal(c.state.wood,2);
  c.player.x=CAMP_SERVICE.fuelPad.x;c.player.menuOpen=true;c.update(1);assert.equal(c.state.wood,2);c.player.menuOpen=false;
  c.player.room={x:100,y:100};c.update(1);assert.equal(c.state.wood,2);c.player.room=null;
  c.state.health=0;c.update(1);assert.equal(c.state.wood,2);c.state.health=100;
  c.paused=true;c.update(3);assert.equal(c.state.wood,2);assert.equal(c.state.campFuel,0);
});
test("leaving resets dwell time and a nearly full fire never wastes logs",()=>{
  const c=make();setup(c);c.update(.4);c.player.x+=80;c.update(.1);c.player.x=CAMP_SERVICE.fuelPad.x;c.update(.45);assert.equal(c.state.wood,2);
  c.state.campFuel=590;c.update(1);assert.equal(c.state.wood,2);assert.ok(c.state.campFuel<590);
});
test("both players can fuel but compete atomically for the last available fuel slot",()=>{
  const g=createLocalCoop({survival:false}),[a,b]=g.actors;setup(a);setup(b);a.state.campFuel=540;
  g.update(.85);assert.equal(a.state.wood+b.state.wood,3);assert.ok(g.state.campFuel>599&&g.state.campFuel<=600);
  a.state.campFuel=0;g.update(.9);assert.equal(a.state.wood+b.state.wood,1);assert.ok(g.state.campFuel>119&&g.state.campFuel<=120);
});
