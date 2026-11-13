// Four approved visual palettes. "original" leaves the source pixels untouched.
export const HERO_PALETTES=Object.freeze({
  original:{name:'Исходные',hair:null,jacket:null,pants:null},
  forest:{name:'Лесные',hair:'#352a27',jacket:'#58664e',pants:'#454449'},
  burgundy:{name:'Бордовые',hair:'#7d3e2b',jacket:'#733f46',pants:'#4e6071'},
  mist:{name:'Туманные',hair:'#947c68',jacket:'#566977',pants:'#625063'},
});
export const HERO_MATERIALS=Object.freeze(['hair','jacket','pants']);
export function normalizeHeroColors(value){
  return Object.fromEntries(HERO_MATERIALS.map(k=>[k,typeof value?.[k]==='string'&&Object.hasOwn(HERO_PALETTES,value[k])?value[k]:'original']));
}
export function heroColorKey(value){const selected=normalizeHeroColors(value);return HERO_MATERIALS.map(k=>selected[k]).join('/');}

// Source material midtones calibrate the original hand-painted shadows, not skin or gear.
const BASE={hero2:[74,64,62],hero3:[104,86,67]};
export function recolorHeroPixels(pixels,labels,role,colors){
  const selected=normalizeHeroColors(colors),targets=HERO_MATERIALS.map(k=>{
    const color=HERO_PALETTES[selected[k]][k];return color?[1,3,5].map(n=>parseInt(color.slice(n,n+2),16)):null;
  });
  for(let i=0;i<labels.length;i++){
    const material=labels[i]-1,target=targets[material];
    if(!target||!pixels[i*4+3])continue;
    const rgb=target,j=i*4;
    const shade=Math.max(.35,Math.min(1.7,(pixels[j]*.21+pixels[j+1]*.72+pixels[j+2]*.07)/(BASE[role]?.[material]||80)));
    for(let c=0;c<3;c++)pixels[j+c]=Math.min(255,Math.round(rgb[c]*shade));
  }
  return pixels;
}
