import {pixelHash} from '../pixel-art.js';
import {sampleBiomeGround,sampleMaterial} from './biome-terrain.js';
const cache=new WeakMap();
const clamp=v=>Math.max(0,Math.min(1,v));
const smooth=(a,b,v)=>{const t=clamp((v-a)/(b-a));return t*t*(3-2*t);};
function noise(x,y,size,salt){
  const px=x/size,py=y/size,ix=Math.floor(px),iy=Math.floor(py),fx=smooth(0,1,px-ix),fy=smooth(0,1,py-iy);
  const n=(dx,dy)=>(pixelHash(ix+dx+salt,iy+dy-salt)%65536)/65535;
  return (n(0,0)*(1-fx)+n(1,0)*fx)*(1-fy)+(n(0,1)*(1-fx)+n(1,1)*fx)*fy;
}
// All inputs are world coordinates: no tile-local random seeds or region-shaped patches.
export function surfaceWeights(x,y){
  const warp=(noise(x,y,1100,73)-.5)*180;
  const cover=noise(x+warp,y-warp,390,137),rock=noise(x-80,y+170,620,929);
  const stone=smooth(.66,.86,rock)*.88;
  const moss=(1-smooth(.19,.43,cover))*.88*(1-stone);
  const sand=smooth(.63,.85,cover)*.9*(1-stone);
  const soil=smooth(.34,.46,cover)*(1-smooth(.50,.61,cover))*.72*(1-stone);
  return {grass:Math.max(0,1-moss-sand-soil-stone),moss,sand,soil,stone};
}
export function prepareGroundMaterials(materials){
  if(cache.has(materials))return cache.get(materials);
  const out={};
  for(const [name,source] of Object.entries(materials)){
    if(name==='water'){out[name]=source;continue;}
    const target=new Uint8ClampedArray(source.length),mean=[0,0,0];
    for(let i=0;i<source.length;i+=4)for(let c=0;c<3;c++)mean[c]+=source[i+c]/4096;
    const detail=['forest','field','swamp'].includes(name)?.5:name==='web'?.7:.5;
    for(let y=0;y<64;y++)for(let x=0;x<64;x++){
      const i=(y*64+x)*4,bx=x&~1,by=y&~1;
      for(let c=0;c<3;c++){
        const block=(source[(by*64+bx)*4+c]+source[(by*64+bx+1)*4+c]+source[((by+1)*64+bx)*4+c]+source[((by+1)*64+bx+1)*4+c])/4;
        target[i+c]=mean[c]*(1-detail)+block*detail*.65+source[i+c]*detail*.35;
      }target[i+3]=255;
    }out[name]=target;
  }
  function derive(name,a,b,weight,tint){
    const target=new Uint8ClampedArray(64*64*4),first=out[a]||out.forest,second=out[b]||out.forest;
    for(let i=0;i<target.length;i+=4){for(let c=0;c<3;c++)target[i+c]=first[i+c]*(1-weight)+second[i+c]*weight+tint[c];target[i+3]=255;}out[name]=target;
  }
  derive('moss','forest','swamp',.65,[-3,1,-4]);
  derive('sand','shore','dirt',.2,[12,8,1]);
  derive('soil','dirt','swamp',.2,[-4,-2,-3]);
  derive('stone','ruins','shore',.15,[-2,0,1]);
  cache.set(materials,out);return out;
}
// Existing PNG palettes remain the source; only contrast and patch composition change.
export function sampleNaturalGround(prepared,x,y){
  const rgb=sampleBiomeGround(prepared,x,y),weights=surfaceWeights(x*2,y*2);
  const result=rgb.map(c=>c*weights.grass);
  for(const id of ['moss','sand','soil','stone'])if(weights[id]>.001){
    const sample=sampleMaterial(prepared,id,x,y);for(let c=0;c<3;c++)result[c]+=sample[c]*weights[id];
  }
  return result;
}
