import {dockInset} from './viewport.js';
import { CAMP_SERVICE, ROOM } from "../game/camp-services.js";
import { LAYERS } from "./layers.js";
import { hasCampBuilding } from "../game/camp-projects.js";
import {drawInteractionPad} from './interaction-pad.js';

export class CampServicesView {
  constructor(scene) {
    this.scene = scene; this.rocks = new Map();
    this.store = scene.addImage("interior.warehouse", CAMP_SERVICE.store.x, CAMP_SERVICE.store.y).setScale(1.4).setInteractive().setData("campStore", true);
    this.storeProps=[];
    this.label = scene.text("", CAMP_SERVICE.store.x, CAMP_SERVICE.store.y + 38, 11, "#edddb2", LAYERS.hints);
    scene.hut.setInteractive({ pixelPerfect: true }).setData("campHouse", true);
    scene.tent.setInteractive({ pixelPerfect: true }).setData("campTent", true);
    this.fireLabel = scene.text("", 1600, 1672, 11, "#f3d79f", LAYERS.hints);
    const pad=CAMP_SERVICE.fuelPad;
    this.fuelPad=scene.add.graphics().setDepth(pad.y-1);
    this.fuelZone=scene.add.zone(pad.x,pad.y,64,48).setInteractive().setData("fuelPad",true);
    this.fuelLabel=scene.text("",pad.x,pad.y+38,11,"#f3d79f",LAYERS.hints);
    const storage=CAMP_SERVICE.storagePad;
    this.storagePad=scene.add.graphics().setDepth(storage.y-1);
    this.storageZone=scene.add.zone(storage.x,storage.y,72,48).setInteractive().setData('storagePad',true);
    this.storageLabel=scene.text('Склад · сдача ресурсов',storage.x,storage.y+34,12,'#ffe3a0',LAYERS.hints);
  }
  render() {
    const s = this.scene, c = s.core, wanted = new Set();
    const storage=CAMP_SERVICE.storagePad,unloading=(c.actors||[c]).some(a=>a.storage.atPad());
    drawInteractionPad(s,this.storagePad.clear(),storage,72,48,unloading);
    this.storageLabel.setText(unloading?'Сдача ресурсов на склад':'Склад · сдача ресурсов');
    s.worldHints.offer(this.storageLabel,storage,{range:280,priority:90});
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
    this.label.setText(`Склад · E/Enter\nВыбрать ресурс и количество`);
    this.fireLabel.setText(hasCampBuilding(c.state,"fire") ? `${c.camp.lit() ? "Огонь" : "ПОТУХШИЙ КОСТЁР"} · ${Math.ceil(c.state.campFuel)} с · E/Enter +1 бревно` : "Сначала постройте костёр!");
    s.worldHints.offer(this.label,CAMP_SERVICE.store,{range:200,priority:70});
    const pad=CAMP_SERVICE.fuelPad,built=hasCampBuilding(c.state,"fire"),active=(c.actors||[c]).some(a=>a.camp.atFuelPad()&&a.state.health>0&&!a.player.room);
    s.worldHints.offer(this.fireLabel,{x:1600,y:1648},{eligible:!active,range:210,priority:75});
    this.fuelZone.setVisible(built);this.fuelZone.input.enabled=built;
    this.fuelPad.clear();if(built){drawInteractionPad(s,this.fuelPad,pad,64,40,active);
      this.fuelPad.lineStyle(3,0xe1bf70).lineBetween(pad.x-9,pad.y,pad.x+9,pad.y).lineBetween(pad.x,pad.y-8,pad.x,pad.y+8);}
    this.fuelLabel.setText(c.state.campFuel>c.camp.maxFuel()-CAMP_SERVICE.fuelPerLog?"Запас почти полон":active&&!((c.actors||[c]).some(a=>a.camp.atFuelPad()&&a.state.wood>0))?"Нужны брёвна в руках":"Поддерживать огонь\n1 бревно → +60 с");
    s.worldHints.offer(this.fuelLabel,pad,{eligible:built,range:180,priority:70});
  }
  destroy() { for(const image of this.storeProps)image.destroy();this.storagePad.destroy();this.storageZone.destroy();this.storageLabel.destroy();this.fuelPad.destroy();this.fuelZone.destroy();this.fuelLabel.destroy();for(const e of this.rocks.values()){e.image.destroy();e.label.destroy();} this.rocks.clear(); }
}

// Generated room shells and furniture use the shared pixel atlas.
export class HouseView {
  constructor(scene){
    this.scene=scene;this.entries=[];
    const actors=scene.core.actors||[scene.core];
    actors.forEach((a,i)=>{
      const bg=scene.add.graphics(),room=scene.add.container(0,0),root=scene.add.container(0,0,[bg,room]).setScrollFactor(0).setDepth(LAYERS.eyes+1).setVisible(false);
      const shell=scene.addImage('interior.house',0,0).setOrigin(0);room.add(shell);
      const house=[],shop=[],add=(frame,x,y,group,scale=2)=>{const image=scene.addImage(frame,x,y).setScale(scale);room.add(image);group?.push(image);return image;};
      add('camp.mat',ROOM.exit.x,ROOM.exit.y,null,2);
      add('interior.chest',ROOM.chest.x,ROOM.chest.y,house);
      add('interior.bed',ROOM.bed.x,ROOM.bed.y+36,house);
      add('person.worker3-walk-down-0',ROOM.manager.x,ROOM.manager.y,house);
      add('interior.bench',ROOM.manager.x,ROOM.manager.y+42,house);
      add('interior.cupboard',95,330,house);
      add('person.buyer1-walk-down-0',ROOM.seller.x,ROOM.seller.y,shop);
      add('interior.counter',ROOM.seller.x,ROOM.seller.y+45,shop);
      add('interior.cupboard',105,170,shop);add('world.supplies',525,180,shop,2.4);
      add('camp.crate',515,300,shop,1.8);add('world.tools',105,300,shop,2);
      const avatars=actors.map((_,j)=>add(`${j?'coop2.':''}characters.player.down.0`,320,320));
      const healthBars=scene.add.graphics(),health=actors.map(()=>scene.add.text(0,0,'',{fontFamily:'Arial',fontSize:'12px',color:'#f5e5bb'}).setOrigin(.5,1));room.add([healthBars,...health]);
      const title=scene.add.text(ROOM.width/2,20,'',{fontFamily:'Arial',fontSize:'20px',color:'#f0d39c'}).setOrigin(.5,0),
        hint=scene.add.text(ROOM.width/2,ROOM.height-17,'',{fontFamily:'Arial',fontSize:'13px',color:'#f0d39c',backgroundColor:'#162b23',padding:{x:8,y:4}}).setOrigin(.5,1);room.add([title,hint]);
      if(scene.coopCamera)(i?scene.camera:scene.coopCamera.second).ignore(root);
      this.entries.push({root,bg,room,shell,house,shop,avatars,healthBars,health,title,hint});
    });
  }
  layout(camera){
    const available=Math.min(camera.height,this.scene.scale.height-dockInset(this.scene)-12-camera.y);
    const scale=Math.min((camera.width-24)/ROOM.width,(available-175)/ROOM.height);
    return {scale,x:(camera.width-ROOM.width*scale)/2,y:165};
  }
  render(){
    const s=this.scene,actors=s.core.actors||[s.core];
    this.entries.forEach((e,i)=>{
      const a=actors[i],camera=i?s.coopCamera.second:s.camera,inside=!!a.player.room&&(i===0||!!s.coopCamera?.split);
      e.root.setVisible(inside);if(!inside)return;
      const kind=a.player.room.id||'house',layout=this.layout(camera);e.bg.clear().fillStyle(0x101c18).fillRect(0,0,camera.width,camera.height);
      e.room.setScale(layout.scale).setPosition(layout.x,layout.y);e.house.forEach(o=>o.setVisible(kind==='house'));e.shop.forEach(o=>o.setVisible(kind==='shop'));
      s.assets.setFrame(e.shell,`interior.${kind}`).setOrigin(0);
      e.title.setText(kind==='shop'?'Лавка лагеря':'Дом лагеря');e.healthBars.clear();
      actors.forEach((actor,j)=>{
        const p=actor.player,r=p.room,visible=!!r&&(r.id||'house')===kind;e.avatars[j].setVisible(visible);e.health[j].setVisible(visible);if(!visible)return;
        const dir=p.direction==='up'?'up':['left','right'].includes(p.direction)?'side':'down';
        s.assets.setFrame(e.avatars[j],`${j?'coop2.':''}characters.player.${dir}.${r.moving?Math.floor(s.core.elapsed*10)%4:0}`);
        e.avatars[j].setPosition(r.x,r.y).setFlipX(p.direction==='left');
        const y=r.y-e.avatars[j].displayHeight*e.avatars[j].originY-12;
        e.healthBars.fillStyle(0x172c23).fillRect(r.x-24,y-1,48,6).fillStyle(0x8ac08c).fillRect(r.x-23,y,46*actor.state.health/actor.state.maxHealth,4);
        e.health[j].setText(`${actor.state.health}/${actor.state.maxHealth} HP`).setPosition(r.x,y-3);
      });
      const r=a.player.room,exit=Math.hypot(r.x-ROOM.exit.x,r.y-ROOM.exit.y)<70;
      e.hint.setText(a.camp.atSeller()?'E / Enter — поговорить с продавцом':a.camp.atManager()?'E / Enter — помощники':a.camp.atChest()?'E / Enter — склад':exit?'E / Enter — выйти':kind==='shop'?'Подойдите к продавцу':'Склад слева · бригадир справа');
      if(a.player.room.interactTarget){
        const pending=a.player.room.interactTarget,ready=pending==='seller'?a.camp.atSeller():pending==='manager'?a.camp.atManager():a.camp.atChest();
        if(ready&&!a.player.menuOpen&&!s.core.paused){delete a.player.room.interactTarget;s.core.withActor?s.core.withActor(i,()=>this.interact(a)):this.interact(a);}
      }
    });
  }
  interact(c=this.scene.core){
    const s=this.scene;
    if(c.camp.atSeller())return s.shop.open();
    if(c.camp.atManager())return s.workerUi.open();
    if(c.camp.atChest())return s.campDesk.open('storage');
    return c.camp.exit();
  }
  pointer(pointer,i){
    const s=this.scene,c=s.core.actors?.[i]||s.core,p=c.player.room,camera=i&&s.coopCamera?.split?s.coopCamera.second:s.camera;
    if(!p)return;const l=this.layout(camera),target={x:(pointer.x-camera.x-l.x)/l.scale,y:(pointer.y-camera.y-l.y)/l.scale};
    const site=(p.id||'house')==='shop'?ROOM.seller:Math.hypot(target.x-ROOM.chest.x,target.y-ROOM.chest.y)<65?ROOM.chest:ROOM.manager;
    if(Math.hypot(target.x-site.x,target.y-site.y)<65&&Math.hypot(p.x-site.x,p.y-site.y)<90){this.interact(c);return;}
    if(Math.hypot(target.x-ROOM.exit.x,target.y-ROOM.exit.y)<40&&c.camp.exit())return;
    if(Math.hypot(target.x-site.x,target.y-site.y)<65){p.target={x:site.x,y:site.y+75};p.interactTarget=site===ROOM.seller?'seller':site===ROOM.chest?'chest':'manager';}
    else {delete p.interactTarget;p.target={x:Math.max(30,Math.min(ROOM.width-30,target.x)),y:Math.max(100,Math.min(ROOM.height-28,target.y))};}
  }
  destroy(){for(const e of this.entries)e.root.destroy(true);}
}
