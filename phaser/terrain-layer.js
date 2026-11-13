import { createForestGround } from "./art/ground-art.js";
import { createFortressFloorSampler } from "./fortress-floor.js";
import { worksChunkAffected } from "../game/world-works-layout.js";
import {compositionChunkAffected} from '../game/forest-composition.js';
export const TERRAIN_TEXTURE_LIMIT = 24; // 1.5 MiB RGBA at 128², bounded reuse across camera edges.
export class TerrainLayer {
  constructor(scene, model) {
    this.scene = scene;
    this.model=model;this.worksRevision=model.worksRevision?.()||0;
    this.layoutRegions=new Set(model.forestLayouts?.keys());
    const fortressFloor = createFortressFloorSampler(
      scene.registry.get("fortressPack"),
      model.locations,
    );
    const sawmillFloor = createFortressFloorSampler(
      scene.registry.get("sawmillPack"),
      model.locations,
      (r) => (r.name === "Машинный зал" ? "hall" : "room"),
    );
    this.source = createForestGround({
      ...model,
      materials: scene.registry.get("biomePack")?.materials,
      center: { x: 1600, y: 1600 },
      clearings: model.landmarks,
      fortressFloor: (x, y, hash) =>
        sawmillFloor?.(x, y, hash) || fortressFloor?.(x, y, hash),
    });
    this.images = new Map();
  }
  update(view) {
    const added=this.layoutRegions.size!==(this.model.forestLayouts?.size||0)?[...(this.model.forestLayouts?.keys()||[])].filter(id=>!this.layoutRegions.has(id)):[];
    if(added.length){
      const regions=this.model.regions.all.filter(r=>added.includes(r.id));
      const affected=(x,y)=>regions.some(r=>compositionChunkAffected(r,x,y));
      this.source.invalidate(affected);
      for(const [key,image] of this.images){const [,x,y]=key.split('/');if(affected(+x,+y)){image.destroy();this.scene.textures.remove(key);this.images.delete(key);}}
      for(const id of added)this.layoutRegions.add(id);
    }
    const revision=this.model.worksRevision?.()||0;
    if(revision!==this.worksRevision){
      this.worksRevision=revision;this.source.invalidate(worksChunkAffected);
      for(const [key,image] of this.images){const [,x,y]=key.split("/").map((v,i)=>i?Number(v):v);if(worksChunkAffected(x,y)){image.destroy();this.scene.textures.remove(key);this.images.delete(key);}}
    }
    const views = Array.isArray(view) ? view : [view];
    const wanted = new Set();
    for (const view of views) {
    for (
      let y = Math.floor(view.y / 256);
      y <= Math.floor((view.y + view.height) / 256);
      y++
    )
      for (
        let x = Math.floor(view.x / 256);
        x <= Math.floor((view.x + view.width) / 256);
        x++
      ) {
        const key = `terrain/${x}/${y}`;
        wanted.add(key);
        if (this.images.has(key)) {
          const image = this.images.get(key);
          image.setVisible(true);
          this.images.delete(key);
          this.images.set(key, image);
          continue;
        }
        const texture = this.scene.textures.addCanvas(
          key,
          this.source.getChunk(x, y),
        );
        texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
        this.images.set(
          key,
          this.scene.add
            .image(x * 256, y * 256, key)
            .setOrigin(0)
            .setScale(2)
            .setDepth(-10000),
        );
      }
    }
    for (const [key, image] of this.images) image.setVisible(wanted.has(key));
    // Preserve nearby GPU textures for return trips; evict only old hidden chunks.
    for (const [key, image] of this.images) {
      if (this.images.size <= (views.length > 1 ? 40 : TERRAIN_TEXTURE_LIMIT)) break;
      if (wanted.has(key)) continue;
      image.destroy();
      this.scene.textures.remove(key);
      this.images.delete(key);
    }
  }

  destroy() {
    for (const [key, image] of this.images) {
      image.destroy();
      this.scene.textures.remove(key);
    }
    this.images.clear();
  }
}
