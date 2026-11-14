import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareGroundMaterials,surfaceWeights,sampleNaturalGround} from '../game/ground-surfaces.js';
import {scenicBranches} from '../game/scenery-trails.js';
import {createSimulation} from '../game/simulation.js';
import {captureSession} from '../game/session-save.js';
const fixture=()=>{
  const materials={};for(const name of ['forest','field','swamp','shore','web','ruins','dirt','water']){const d=new Uint8ClampedArray(64*64*4);for(let y=0;y<64;y++)for(let x=0;x<64;x++){const i=(y*64+x)*4,v=(x+y)%2?60:150;d.set([v,v+20,v-10,255],i);}materials[name]=d;}return materials;
};
const energy=d=>{let sum=0;for(let y=0;y<64;y++)for(let x=1;x<64;x++)sum+=Math.abs(d[(y*64+x)*4]-d[(y*64+x-1)*4]);return sum;};
test('PNG preparation reduces fine contrast, preserves source data and caches once per source pack',()=>{
  const m=fixture(),original=m.forest.slice(),prepared=prepareGroundMaterials(m);
  assert.ok(energy(prepared.forest)<energy(m.forest)*.25);assert.deepEqual(m.forest,original);assert.equal(prepareGroundMaterials(m),prepared);assert.equal(prepared.water,m.water);
  assert.ok(['sand','moss','stone','soil'].every(k=>prepared[k].length===64*64*4));
});
test('a single region contains broad grass, moss, soil, sand and stony patches with continuous weights',()=>{
  const maxima={grass:0,moss:0,soil:0,sand:0,stone:0};
  for(let y=320;y<2880;y+=32)for(let x=320;x<2880;x+=32){const w=surfaceWeights(x,y);assert.ok(Math.abs(Object.values(w).reduce((a,b)=>a+b)-1)<1e-9);for(const k in maxima)maxima[k]=Math.max(maxima[k],w[k]);}
  assert.ok(Object.values(maxima).every(v=>v>.6));
  for(const x of [-256,0,256,2880]){const a=surfaceWeights(x-1,1200),b=surfaceWeights(x+1,1200);for(const k in a)assert.ok(Math.abs(a[k]-b[k])<.04);}
  const p=prepareGroundMaterials(fixture());assert.deepEqual(sampleNaturalGround(p,-10,200),sampleNaturalGround(p,-10,200));
});
test('visual branches are bounded, winding, navigable and never mutate generated resources or saves',()=>{
  const c=createSimulation({regional:true});for(const r of c.regions.all){c.regions.unlocked.add(r.id);if(!c.state.unlockedRegions.includes(r.id))c.state.unlockedRegions.push(r.id);c.world.generate(r);}c.refreshWorld();
  const before=JSON.stringify(captureSession(c,{now:0})),roads=JSON.stringify(c.world.trails);let count=0,curved=0;
  for(const r of c.regions.all){const paths=scenicBranches(c.world,r);assert.ok(paths.length<=2);assert.deepEqual(scenicBranches(c.world,r),paths);
    for(const path of paths){count++;assert.equal(path.width,32);const a=path[0],b=path.at(-1);if(path.some(p=>Math.abs((b.x-a.x)*(p.y-a.y)-(b.y-a.y)*(p.x-a.x))>100))curved++;
      for(const p of path)assert.ok(c.nav.isWalkable(p.x,p.y),`${r.id} ${p.x},${p.y}`);
    }
  }
  assert.ok(count>=25,`Only ${count} branches`);assert.ok(curved>=count*.7);assert.equal(JSON.stringify(c.world.trails),roads);assert.equal(JSON.stringify(captureSession(c,{now:0})),before);
});
