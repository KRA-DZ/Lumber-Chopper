import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createSimulation} from '../game/simulation.js';
import {REGIONS} from '../game/regions.js';
import {treeYield} from '../forestry.js';
import {GROVE_SPACING,activityBranches,compositionChunkAffected} from '../game/forest-composition.js';
const baseline=JSON.parse(readFileSync(new URL('./fixtures/forest-economy.json',import.meta.url)));
function world(order=REGIONS){const g=createSimulation({regional:true,survival:false});for(const r of order){g.regions.unlocked.add(r.id);g.world.generate(r);}g.nav.rebuildObstacles();return g;}

test('all 25 regions retain exact original tree economy, stone and berry locations',()=>{
  const g=world();
  for(const r of REGIONS){const trees=g.trees.filter(t=>t.regionId===r.id);
    const actual={trees:trees.length,logs:trees.reduce((n,t)=>n+treeYield(t),0),
      signature:createHash('sha256').update(JSON.stringify(trees.map(({id,type,size,value,maxHp})=>({id,type,size,value,maxHp})))).digest('hex'),
      rocks:g.world.boulders.filter(t=>t.regionId===r.id).map(({id,x,y,yield:v})=>[id,x,y,v]),
      berries:g.world.berryBushes.filter(t=>t.regionId===r.id).map(({id,x,y,decorative})=>[id,x,y,decorative])};
    assert.deepEqual(actual,baseline[r.id],r.id);
  }
});
test('groves are deterministic regardless of exploration order and never drop unplaceable resources',()=>{
  const a=world(),b=world([...REGIONS].reverse());
  for(const r of REGIONS){assert.deepEqual(a.trees.filter(t=>t.regionId===r.id),b.trees.filter(t=>t.regionId===r.id));
    const layout=a.world.forestLayouts.get(r.id);assert.equal(layout.unchanged,0,r.id);assert.equal(layout.clearings.length,2);
    const before=a.trees.length;a.world.generate(r);assert.equal(a.trees.length,before);
  }
});
test('every grove has clear trunk gaps, open glades, wide banks and visible berry approaches',()=>{
  const g=world();
  for(const r of REGIONS){const trees=g.trees.filter(t=>t.regionId===r.id),layout=g.world.forestLayouts.get(r.id);
    for(const [i,t] of trees.entries()){
      assert.ok(!g.world.waterCollision(t.x,t.y,130),t.id);
      assert.ok(layout.clearings.every(c=>Math.hypot(t.x-c.x,t.y-c.y)>c.radius));
      assert.ok(trees.slice(i+1).every(b=>Math.hypot(t.x-b.x,t.y-b.y)>=GROVE_SPACING),t.id);
      assert.ok(!g.world.nearTrail(t,90),t.id);
      for(const b of g.world.berryBushes.filter(b=>b.regionId===r.id))assert.ok(!(Math.abs(t.x-b.x)<145&&t.y>b.y-30&&t.y<b.y+340),`${t.id} conceals ${b.id}`);
    }
    for(const clearing of layout.clearings)assert.ok(g.nav.isWalkable(clearing.x,clearing.y),r.id);
  }
});
test('narrow activity branches are navigable with real trees, water, buildings and boulders',()=>{
  const g=world();let count=0;
  for(const path of g.world.trails.filter(p=>p.width===28)){
    count++;const [a,b]=path,n=Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/16);
    for(let i=0;i<=n;i++){const x=a.x+(b.x-a.x)*i/n,y=a.y+(b.y-a.y)*i/n;assert.ok(g.nav.isWalkable(x,y),`branch ${x},${y}`);}
  }
  assert.ok(count>=10);
});
test('blocked shortcuts never paint a road through water and chunk invalidation stays local',()=>{
  assert.deepEqual(activityBranches([[{x:0,y:0},{x:100,y:0}]],[{x:50,y:200}],(x,y)=>y<100),[]);
  assert.deepEqual(activityBranches([[{x:0,y:0},{x:100,y:0}],[{x:0,y:300},{x:100,y:300}]],[{x:50,y:20}],()=>true),[]);
  const r={x:-256,y:0,width:256,height:256};
  assert.ok(compositionChunkAffected(r,-1,0));assert.ok(!compositionChunkAffected(r,0,0));assert.ok(!compositionChunkAffected(r,-1,-1));
});
