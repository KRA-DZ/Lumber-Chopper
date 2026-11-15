import {sprite} from '../pixel-art.js';
const ROOT='./src/assets/interiors/';
const NAMES=['house','shop','bed','counter','chest','bench','workshop','warehouse','cupboard'];
export function preloadInteriors(scene){
  scene.load.json('interior.manifest',ROOT+'manifest.json');
  for(const name of NAMES)scene.load.image(`interior.${name}`,ROOT+name+'.png');
}
export function retainInteriors(scene){
  const manifest=scene.cache.json.get('interior.manifest'),images={};
  for(const name of NAMES){
    const key=`interior.${name}`;
    if(!manifest?.frames[name]||!scene.textures.exists(key))throw Error(`Missing interior PNG: ${name}`);
    images[name]=scene.textures.get(key).getSourceImage();scene.textures.remove(key);
  }
  scene.registry.set('interiorPack',{manifest,images});
}
// Bake into the existing shared atlas once; no extra per-frame textures or processing.
export function applyInteriorFrames(scene,sources){
  const pack=scene.registry.get('interiorPack');
  for(const [name,f] of Object.entries(pack.manifest.frames))
    sources.set(`interior.${name}`,sprite(f.width,f.height,...f.anchor,p=>p.g.drawImage(pack.images[name],0,0)));
}
