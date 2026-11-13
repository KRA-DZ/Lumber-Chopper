import {recolorHeroPixels,normalizeHeroColors,HERO_MATERIALS} from '../game/hero-colors.js';
export function paintHeroFrame(ctx,pack,id,colors){
  const f=pack.manifest.frames[id];if(!f)throw Error(`Missing hero frame: ${id}`);
  ctx.drawImage(pack.image,f.x,f.y,f.width,f.height,0,0,f.width,f.height);
  const selected=normalizeHeroColors(colors);if(!HERO_MATERIALS.some(k=>selected[k]!=='original'))return;
  const image=ctx.getImageData(0,0,f.width,f.height),labels=new Uint8Array(f.width*f.height),stride=pack.manifest.size[0];
  for(let y=0;y<f.height;y++)labels.set(pack.materials.subarray((f.y+y)*stride+f.x,(f.y+y)*stride+f.x+f.width),y*f.width);
  recolorHeroPixels(image.data,labels,id.split('-')[0],selected);ctx.putImageData(image,0,0);
}
export function heroPreviewFrame(pack,id,colors){
  const f=pack.manifest.frames[id],canvas=document.createElement('canvas');canvas.width=f.width;canvas.height=f.height;
  paintHeroFrame(canvas.getContext('2d'),pack,id,colors);return canvas;
}
