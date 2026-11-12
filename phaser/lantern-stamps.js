import {lanternHalfAngle} from "../game/light-shapes.js";
const smooth=(a,b,n)=>{const t=Math.max(0,Math.min(1,(n-a)/(b-a)));return t*t*(3-2*t);};
// Five bounded stamps, baked once. No per-frame blur, raycasts or texture allocation.
export function createLanternStamps(){
  return Array.from({length:5},(_,level)=>{
    const canvas=document.createElement("canvas");canvas.width=canvas.height=384;
    const ctx=canvas.getContext("2d"),pixels=ctx.createImageData(384,384),half=lanternHalfAngle(level);
    for(let y=0;y<384;y++)for(let x=192;x<384;x++){
      const dx=(x+.5-192)/192,dy=(y+.5-192)/192,r=Math.hypot(dx,dy),a=Math.abs(Math.atan2(dy,dx));
      pixels.data[(y*384+x)*4+3]=Math.round(255*.97*(1-smooth(.18,1,r))*(1-smooth(half*.6,half,a)));
    }
    ctx.putImageData(pixels,0,0);return canvas;
  });
}
