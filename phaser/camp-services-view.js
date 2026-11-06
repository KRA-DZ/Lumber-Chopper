import { CAMP_SERVICE, ROOM } from "../game/camp-services.js";
import { LAYERS } from "./layers.js";

export class CampServicesView {
  constructor(scene) {
    this.scene = scene; this.rocks = new Map();
    this.store = scene.addImage("fortress.chest.closed", CAMP_SERVICE.store.x, CAMP_SERVICE.store.y).setInteractive().setData("campStore", true);
    this.label = scene.text("", CAMP_SERVICE.store.x, CAMP_SERVICE.store.y + 38, 11, "#edddb2", LAYERS.hints);
    scene.hut.setInteractive({ pixelPerfect: true }).setData("campHouse", true);
    scene.tent.setInteractive({ pixelPerfect: true }).setData("campTent", true);
    this.fireLabel = scene.text("", 1600, 1672, 11, "#f3d79f", LAYERS.hints);
  }
  render() {
    const s = this.scene, c = s.core, wanted = new Set();
    for (const rock of c.world.boulders || []) {
      if (!s.nearView(rock, s.camera.worldView, 180)) continue;
      wanted.add(rock.id);
      if (!this.rocks.has(rock.id)) this.rocks.set(rock.id, {
        rock, image: s.addImage("details.rock.0", rock.x, rock.y).setScale(5).setInteractive({pixelPerfect:true}).setData("boulder",rock.id),
        label: s.text("",rock.x,rock.y+38,11,"#dddcc3",LAYERS.hints),
      });
    }
    for (const [id, entry] of this.rocks) {
      if (!wanted.has(id)) { entry.image.destroy(); entry.label.destroy(); this.rocks.delete(id); continue; }
      const hp = c.state.boulderHP[id] ?? entry.rock.maxHP;
      entry.image.setVisible(hp > 0);
      entry.label.setText(`Камень · ${hp}/${entry.rock.maxHP} · +8`);
      s.worldHints.offer(entry.label, entry.rock, { eligible: hp > 0, range: 180, priority: 60 });
    }
    this.label.setText(`Склад · ${c.state.logStore.length}/400 · E/Enter ${c.state.wood ? "сложить" : "взять"}`);
    this.fireLabel.setText(c.state.campLevel ? `${c.camp.lit() ? "Огонь" : "ПОГАС"} · ${Math.ceil(c.state.campFuel)} с · E/Enter` : "Сначала постройте костёр!");
    s.worldHints.offer(this.label,CAMP_SERVICE.store,{range:200,priority:70});
    s.worldHints.offer(this.fireLabel,{x:1600,y:1648},{range:210,priority:75});
  }
  destroy() { for(const e of this.rocks.values()){e.image.destroy();e.label.destroy();} this.rocks.clear(); }
}

// A separate walkable interior per viewport; the outdoor simulation keeps running.
export class HouseView {
  constructor(scene) {
    this.scene = scene; this.entries = [];
    const key = "camp-room-floor", pack = scene.registry.get("sawmillPack"), name = pack.floors.room ? "room" : Object.keys(pack.floors)[0], f = pack.manifest.floors[name];
    const tile = document.createElement("canvas"); tile.width=f.width;tile.height=f.height;
    tile.getContext("2d").putImageData(new ImageData(new Uint8ClampedArray(pack.floors[name]),f.width,f.height),0,0);
    const texture=scene.textures.createCanvas(key,ROOM.width,ROOM.height), ctx=texture.getContext();
    ctx.fillStyle="#1b211d";ctx.fillRect(0,0,ROOM.width,ROOM.height);ctx.imageSmoothingEnabled=false;
    ctx.fillStyle=ctx.createPattern(tile,"repeat");ctx.fillRect(24,82,432,246);
    ctx.fillStyle="#634b35";ctx.fillRect(24,50,432,32);ctx.fillStyle="#a17b4b";ctx.fillRect(24,78,432,4);texture.refresh();
    texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
    const actors=scene.core.actors || [scene.core];
    actors.forEach((a,i)=>{
      const bg=scene.add.graphics(), room=scene.add.container(0,0), root=scene.add.container(0,0,[bg,room]).setScrollFactor(0).setDepth(LAYERS.eyes+1).setVisible(false);
      const floor=scene.add.image(0,0,key).setOrigin(0);room.add(floor);
      const add=(frame,x,y)=>{const image=scene.addImage(frame,x,y);room.add(image);return image;};
      add("fortress.chest.closed",ROOM.chest.x,ROOM.chest.y);add("camp.crate",365,125);add("camp.mat",ROOM.exit.x,ROOM.exit.y);
      add("world.supplies",365,225);
      const avatars=actors.map((_,j)=>add(`${j?"coop2.":""}characters.player.down.0`,240,240));
      const title=scene.add.text(ROOM.width/2,20,"Дом лагеря",{fontFamily:"monospace",fontSize:"14px",color:"#f0d39c"}).setOrigin(.5,0),
        hint=scene.add.text(ROOM.width/2,ROOM.height-22,"",{fontFamily:"monospace",fontSize:"10px",color:"#f0d39c"}).setOrigin(.5,0);room.add([title,hint]);
      if(scene.coopCamera) (i?scene.camera:scene.coopCamera.second).ignore(root);
      this.entries.push({root,bg,room,avatars,hint});
    });
  }
  render() {
    const s=this.scene,actors=s.core.actors||[s.core];
    this.entries.forEach((e,i)=>{
      const a=actors[i], camera=i?s.coopCamera.second:s.camera, inside=!!a.player.room;
      e.root.setVisible(inside);if(!inside)return;
      e.bg.clear().fillStyle(0x121914).fillRect(0,0,camera.width,camera.height);
      const scale=Math.min(camera.width/ROOM.width,camera.height/ROOM.height);
      e.room.setScale(scale).setPosition((camera.width-ROOM.width*scale)/2,(camera.height-ROOM.height*scale)/2);
      actors.forEach((actor,j)=>{
        const p=actor.player, avatar=e.avatars[j];avatar.setVisible(!!p.room);if(!p.room)return;
        const dir=p.direction==="up"?"up":["left","right"].includes(p.direction)?"side":"down",
          key=`${j?"coop2.":""}characters.player.${dir}.${p.room.moving?Math.floor(s.core.elapsed*10)%4:0}`;
        s.assets.setFrame(avatar,key);avatar.setPosition(p.room.x,p.room.y).setFlipX(p.direction==="left");
      });
      e.hint.setText(`Склад ${a.state.logStore.length}/400 · E/Enter у сундука: ${a.state.wood?"сложить":"взять"} · у двери: выйти`);
    });
  }
  pointer(pointer,i) {
    const s=this.scene,c=s.core.actors?.[i]||s.core,p=c.player.room,camera=i?s.coopCamera.second:s.camera;
    if(!p)return;
    const scale=Math.min(camera.width/ROOM.width,camera.height/ROOM.height),
      target={x:(pointer.x-camera.x-(camera.width-ROOM.width*scale)/2)/scale,y:(pointer.y-camera.y-(camera.height-ROOM.height*scale)/2)/scale};
    if(Math.hypot(target.x-ROOM.exit.x,target.y-ROOM.exit.y)<45 && c.camp.exit()) return;
    if(Math.hypot(target.x-ROOM.chest.x,target.y-ROOM.chest.y)<55 && Math.hypot(p.x-ROOM.chest.x,p.y-ROOM.chest.y)<90){c.camp.store(c.state.wood?"deposit":"withdraw");return;}
    p.target={x:Math.max(30,Math.min(ROOM.width-30,target.x)),y:Math.max(100,Math.min(ROOM.height-28,target.y))};
  }
  destroy(){for(const e of this.entries)e.root.destroy(true);this.scene.textures.remove("camp-room-floor");}
}
