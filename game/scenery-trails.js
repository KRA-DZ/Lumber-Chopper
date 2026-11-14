import {streamCollision} from './camp-stream.js';
import {worksCollision} from './world-works-layout.js';
const highWater={worldWorks:{level:'high',built:{}}};
function project(p,a,b){const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1)));return {x:a.x+dx*t,y:a.y+dy*t};}
// Cosmetic only. Never used by resource placement, collision, saves, or navigation generation.
export function scenicBranches(world,region){
  const targets=world.forestLayouts.get(region.id)?.clearings||[],paths=world.trails.filter(p=>p.every(q=>q.x>=region.x&&q.x<=region.x+region.width&&q.y>=region.y&&q.y<=region.y+region.height));
  const trunks=world.trees.filter(t=>t.regionId===region.id),rocks=world.boulders.filter(t=>t.regionId===region.id),locations=world.locations.filter(l=>l.regionId===region.id);
  const pond=world.pond;
  const safe=p=>p.x>region.x+35&&p.x<region.x+region.width-35&&p.y>region.y+35&&p.y<region.y+region.height-35&&
    !streamCollision(p.x,p.y,28)&&!worksCollision(highWater,p.x,p.y,28)&&
    ((p.x-pond.x)/(pond.rx+26))**2+((p.y-pond.y)/(pond.ry+26))**2>=1&&
    trunks.every(t=>Math.hypot(t.x-p.x,t.y-p.y)>34)&&rocks.every(t=>Math.hypot(t.x-p.x,t.y-p.y)>t.radius+28)&&
    Math.hypot(p.x-world.ancientTree.x,p.y-world.ancientTree.y)>95&&Math.hypot(p.x-world.merchant.x,p.y-world.merchant.y)>125&&
    (region.id!=='0:0'||Math.max(Math.abs(p.x-region.cx),Math.abs(p.y-region.cy))>435)&&
    locations.every(l=>p.x<l.bounds.x-25||p.x>l.bounds.x+l.bounds.width+25||p.y<l.bounds.y-25||p.y>l.bounds.y+l.bounds.height+25);
  const branches=[];
  for(const target of targets){
    const options=[];for(const path of paths)for(let i=1;i<path.length;i++){const start=project(target,path[i-1],path[i]);const d=Math.hypot(start.x-target.x,start.y-target.y);if(d>85&&d<1000)options.push({start,d});}
    options.sort((a,b)=>a.d-b.d);
    for(const {start,d} of options.slice(0,8)){
      let found=false;
      for(const bend of [110,-110,160,-160,50,-50,0]){
        const dx=target.x-start.x,dy=target.y-start.y,route=[];
        const count=Math.ceil(d/14);
        for(let i=0;i<=count;i++){const t=i/count,wave=Math.sin(Math.PI*t)*bend+Math.sin(Math.PI*2*t)*bend*.24;route.push({x:start.x+dx*t-dy/d*wave,y:start.y+dy*t+dx/d*wave});}
        if(!route.every(safe))continue;
        route.width=32;route.scenic=true;branches.push(route);found=true;break;
      }if(found)break;
    }
  }
  return branches;
}
