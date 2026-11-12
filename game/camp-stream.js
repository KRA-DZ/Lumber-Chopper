import {CENTER} from "./config.js";
import {REGION_SIZE} from "./world-grid.js";

const lakeX=CENTER.x-REGION_SIZE;
const knots=[{x:lakeX,y:1600},{x:lakeX+200,y:1640},{x:lakeX+400,y:1740},{x:-260,y:1850},
  {x:80,y:1900},{x:400,y:1980},{x:650,y:1980},{x:860,y:1960},{x:1060,y:1940}];
const points=[];
// Bake one smooth centreline and outline; terrain and feet use the exact same polygon.
for(let i=0;i<knots.length-1;i++)for(let j=0;j<8;j++){
  const t=j/8,a=knots[Math.max(0,i-1)],b=knots[i],c=knots[i+1],d=knots[Math.min(knots.length-1,i+2)],p={};
  for(const k of ["x","y"])p[k]=.5*((2*b[k])+(-a[k]+c[k])*t+(2*a[k]-5*b[k]+4*c[k]-d[k])*t*t+(-a[k]+3*b[k]-3*c[k]+d[k])*t*t*t);
  points.push(p);
}
points.push(knots.at(-1));
const left=[],right=[],normals=[],widths=[];
for(let i=0;i<points.length;i++){
  const a=points[Math.max(0,i-1)],b=points[Math.min(points.length-1,i+1)],len=Math.hypot(b.x-a.x,b.y-a.y),
    n={x:-(b.y-a.y)/len,y:(b.x-a.x)/len},r=30+4*Math.sin(i*.23);
  normals.push(n);widths.push(r);left.push({x:points[i].x+n.x*r,y:points[i].y+n.y*r});right.push({x:points[i].x-n.x*r,y:points[i].y-n.y*r});
}
const cap=(i,start)=>Array.from({length:8},(_,j)=>{const n=normals[i],a=Math.atan2(n.y,n.x)+(start?Math.PI:0)-(j+1)*Math.PI/8;
  return {x:points[i].x+Math.cos(a)*widths[i],y:points[i].y+Math.sin(a)*widths[i]};});
export const STREAM_OUTLINE=Object.freeze([...left,...cap(points.length-1,false),...right.reverse(),...cap(0,true)]);
export const STREAM_CROSSINGS=Object.freeze([
  {id:"camp-stream-ford",regionId:"0:0",x:832,y:1963,width:104,height:156},
  {id:"lake-stream-ford",regionId:"-1:0",x:-448,y:1789,width:112,height:160},
]);
const bounds={left:Math.min(...STREAM_OUTLINE.map(p=>p.x)),right:Math.max(...STREAM_OUTLINE.map(p=>p.x)),top:Math.min(...STREAM_OUTLINE.map(p=>p.y)),bottom:Math.max(...STREAM_OUTLINE.map(p=>p.y))};
export function streamWater(x,y,pad=0){
  if(x<bounds.left-pad||x>bounds.right+pad||y<bounds.top-pad||y>bounds.bottom+pad)return false;
  let inside=false;
  for(let i=0,j=STREAM_OUTLINE.length-1;i<STREAM_OUTLINE.length;j=i++){
    const a=STREAM_OUTLINE[j],b=STREAM_OUTLINE[i];
    if((a.y>y)!==(b.y>y)&&x<(b.x-a.x)*(y-a.y)/(b.y-a.y)+a.x)inside=!inside;
    if(pad>0){const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((x-a.x)*dx+(y-a.y)*dy)/(dx*dx+dy*dy||1)));
      if(Math.hypot(x-a.x-t*dx,y-a.y-t*dy)<=pad)return true;}
  }return inside;
}
export const inStreamFord=(x,y,pad=0)=>STREAM_CROSSINGS.some(f=>Math.abs(x-f.x)<=f.width/2-pad&&Math.abs(y-f.y)<=f.height/2-pad);
export const streamCollision=(x,y,r=10)=>streamWater(x,y,r)&&!inStreamFord(x,y,r);
export const streamReserved=(x,y,pad=0)=>streamWater(x,y,pad)||STREAM_CROSSINGS.some(f=>Math.abs(x-f.x)<f.width/2+pad&&Math.abs(y-f.y)<f.height/2+pad);
