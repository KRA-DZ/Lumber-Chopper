import {pixelHash,random} from '../pixel-art.js';

// Trunk clearance is intentionally wider than player collision; crowns may overlap.
export const GROVE_SPACING=130;
export function composeForest(region,trees,canPlace){
  const rnd=random(pixelHash(region.gx+829,region.gy-419));
  const clearings=[],groves=[],placed=[];
  const candidate=()=>({x:Math.round(region.x+180+rnd()*(region.width-360)),y:Math.round(region.y+180+rnd()*(region.height-360))});
  for(let i=0;i<100&&clearings.length<2;i++){
    const p=candidate(),radius=155;
    if(canPlace(p.x,p.y)&&clearings.every(c=>Math.hypot(c.x-p.x,c.y-p.y)>650))clearings.push({...p,radius});
  }
  const outsideClearings=p=>clearings.every(c=>Math.hypot(c.x-p.x,c.y-p.y)>c.radius);
  const count=Math.max(3,Math.ceil(trees.length/5));
  for(let i=0;i<500&&groves.length<count;i++){
    const p=candidate();
    if(canPlace(p.x,p.y)&&outsideClearings(p)&&groves.every(c=>Math.hypot(c.x-p.x,c.y-p.y)>420))groves.push(p);
  }
  const free=p=>p.x>region.x+100&&p.x<region.x+region.width-100&&p.y>region.y+100&&p.y<region.y+region.height-100&&
    canPlace(p.x,p.y)&&outsideClearings(p)&&placed.every(t=>Math.hypot(t.x-p.x,t.y-p.y)>=GROVE_SPACING);
  let unchanged=0;
  for(const [i,tree] of trees.entries()){
    let point=null;
    const grove=groves[i%groves.length],radius=region.biome==='swamp'?260:region.biome==='field'?175:220;
    for(let attempt=0;grove&&attempt<90;attempt++){
      const a=rnd()*Math.PI*2,r=45+Math.sqrt(rnd())*radius,p={x:Math.round(grove.x+Math.cos(a)*r),y:Math.round(grove.y+Math.sin(a)*r)};
      if(free(p)){point=p;break;}
    }
    // Bounded fallback preserves the original resource set even around large buildings.
    for(let attempt=0;!point&&attempt<1000;attempt++){const p=candidate();if(free(p))point=p;}
    if(point)Object.assign(tree,point);else unchanged++;
    placed.push(tree);
  }
  return {groves,clearings,unchanged};
}

function projection(p,a,b){
  const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1)));
  return {x:a.x+dx*t,y:a.y+dy*t};
}
export function activityBranches(paths,targets,canWalk){
  const branches=[];
  for(const target of targets){
    if(branches.length===5)break;
    const options=[];
    for(const path of paths)for(let i=1;i<path.length;i++){
      const start=projection(target,path[i-1],path[i]);
      options.push({start,d:Math.hypot(start.x-target.x,start.y-target.y)});
    }
    options.sort((a,b)=>a.d-b.d);
    if(options[0]?.d<70)continue; // Already on a main trail; do not paint a redundant shortcut.
    for(const {start,d} of options){
      if(d<70||d>650)continue;
      const end={x:target.x,y:target.y};
      const route=[start,end],steps=Math.ceil(d/20);
      if(!Array.from({length:steps+1},(_,i)=>canWalk(start.x+(end.x-start.x)*i/steps,start.y+(end.y-start.y)*i/steps)).every(Boolean))continue;
      route.width=28;branches.push(route);break;
    }
  }
  return branches;
}

export function compositionChunkAffected(region,cx,cy){
  return cx*256<region.x+region.width&&cx*256+256>region.x&&cy*256<region.y+region.height&&cy*256+256>region.y;
}
