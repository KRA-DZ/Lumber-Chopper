import {sprite} from "../pixel-art.js";
export function preloadPlants(scene){scene.load.json("plants.manifest","./src/assets/plants/manifest.json");scene.load.image("plants.source","./src/assets/plants/plants.png");}
export function retainPlants(scene){const manifest=scene.cache.json.get("plants.manifest");if(!manifest?.frames||!scene.textures.exists("plants.source"))throw Error("Plant PNGs failed to load");
  scene.registry.set("plantPack",{manifest,image:scene.textures.get("plants.source").getSourceImage()});scene.textures.remove("plants.source");}
export function applyPlantFrames(scene,sources){const pack=scene.registry.get("plantPack");
  if(!pack)throw Error("Missing approved plant pack");
  for(const [id,f] of Object.entries(pack.manifest.frames))sources.set(`plants.${id}`,sprite(f.width,f.height,...f.anchor,p=>p.g.drawImage(pack.image,f.x,f.y,f.width,f.height,0,0,f.width,f.height)));
}
