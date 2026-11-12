import test from "node:test";
import assert from "node:assert/strict";
import {playerLights,lightContains,lanternRange,lanternHalfAngle} from "../game/light-shapes.js";
import {createInitialState} from "../game/config.js";
import {createRegionWorld} from "../game/region-world.js";
import {createRegions,REGIONS} from "../game/regions.js";
test("the beam follows all four facing directions and lights nearby feet but not the world behind",()=>{
  const s=createInitialState();
  for(const [direction,dx,dy] of [["right",1,0],["left",-1,0],["up",0,-1],["down",0,1]]){
    const [beam,glow]=playerLights(s,{x:0,y:24,direction});
    assert.ok(lightContains(beam,dx*100,dy*100));assert.equal(lightContains(beam,-dx*100,-dy*100),false);
    assert.ok(lightContains(glow,-dx*20,-dy*20));assert.equal(lightContains(glow,-dx*100,-dy*100),false);
  }
});
test("upgrades extend and widen the beam while dead/indoor actors emit no personal light",()=>{
  const s=createInitialState(),p={x:0,y:24,direction:"right"};
  assert.equal(lightContains(playerLights(s,p)[0],300,100),false);
  s.lanternLevel=4;assert.ok(lightContains(playerLights(s,p)[0],300,100));
  for(let i=0;i<4;i++){assert.ok(lanternRange(i+1)>lanternRange(i));assert.ok(lanternHalfAngle(i+1)>lanternHalfAngle(i));}
  s.health=0;assert.deepEqual(playerLights(s,p),[]);s.health=100;p.room={};assert.deepEqual(playerLights(s,p),[]);
});
test("generated forest dressing contains natural plants instead of fake bags, tracks or lantern loot",()=>{
  const s=createInitialState(),r=createRegions(s),w=createRegionWorld(r,s);
  for(const region of REGIONS)w.generate(region);
  for(const [id,details] of w.biomeDetails)for(const d of details){
    assert.ok(!["lostSatchel","forestTracks","clawMarks","sunkenLantern"].includes(d.kind));
    if(REGIONS.find(r=>r.id===id).biome==="forest")assert.ok(["fern","flowers","mushroom"].includes(d.kind));
  }
  assert.ok(w.clues.some(c=>c.id==="tracks")); // Explicit readable story evidence stays.
});
