import test from "node:test";
import assert from "node:assert/strict";
import {createSimulation} from "../game/simulation.js";
import {REGIONS, REGION_SIZE, REGION_BOUNDS, regionAt} from "../game/regions.js";
import {upgradeOffer, buyUpgrade} from "../economy.js";
import {nightSight} from "../mystery.js";

test("larger squares cover the world without gaps and keep landmarks in their own regions",()=>{
  const c=createSimulation({regional:true,survival:false});
  assert.ok(REGION_SIZE**2/1920**2>1.75);
  assert.equal(REGION_BOUNDS.width,REGION_SIZE*5);
  for(const r of REGIONS){
    assert.equal(regionAt(r.x+.1,r.y+.1),r);
    assert.equal(regionAt(r.x+r.width-.1,r.y+r.height-.1),r);
  }
  for(const [p,id] of [[c.world.ancientTree,"1:0"],[c.world.pond,"-1:0"],[c.world.merchant,"0:1"]])assert.equal(regionAt(p.x,p.y).id,id);
  assert.ok(c.trees.some(t=>t.x>2560||t.y>2560||t.x<640||t.y<640));
  assert.ok(c.trees.length<75); // Extra area does not multiply NPCs/trees.
});
test("lantern offers match actual light and expose every finite upgrade limit",()=>{
  const c=createSimulation({regional:true,survival:false});c.state.coins=1e8;
  for(let i=0;i<4;i++){
    const o=upgradeOffer(c.state,"lantern");assert.equal(o.maxLevel,4);
    assert.ok(o.description.includes(String(nightSight(i+1))));
    assert.ok(buyUpgrade(c.state,"lantern"));assert.equal(nightSight(i+1)-nightSight(i),64);
  }
  assert.equal(upgradeOffer(c.state,"lantern").maxed,true);
  assert.equal(buyUpgrade(c.state,"lantern"),false);
  assert.ok(nightSight(4)>nightSight(0)*2.5);
  for(const [id,max] of [["carry",40],["axe",5],["boots",5],["pickup",5]])assert.equal(upgradeOffer(c.state,id).maxLevel,max);
});
