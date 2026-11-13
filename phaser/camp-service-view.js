import {hasCampBuilding} from '../game/camp-projects.js';
// Labels remain live text. Future translations replace this dictionary, never the PNG artwork.
export const SERVICE_LABELS={equipment:'Снаряжение',workers:'Работники',camp:'Улучшения лагеря'};
const SERVICES=[{id:'equipment',x:1525,y:1653},{id:'workers',x:1710,y:1780},{id:'camp',x:1540,y:1435,building:'workbench'}];
export class CampServiceView{
  constructor(scene){this.scene=scene;this.entries=SERVICES.map(p=>{
    const pad=scene.add.graphics().setDepth(-790),sign=scene.add.graphics().setDepth(p.y-85),label=scene.text(SERVICE_LABELS[p.id],p.x,p.y-86,14,'#ffe7ad',p.y-84).setInteractive({useHandCursor:true}).setData('campService',p.id);
    const zone=scene.add.zone(p.x,p.y,76,60).setInteractive().setDepth(p.y+5).setData('campService',p.id);
    return {...p,pad,sign,label,zone};
  });}
  visible(e){return !e.building||hasCampBuilding(this.scene.core.state,e.building);}
  targets(){return this.entries.filter(e=>this.visible(e)).map(e=>({p:e,range:85,act:()=>this.open(e.id)}));}
  open(id){const s=this.scene;if(id==='equipment')s.shop.open();else if(id==='workers')s.workerUi.open();else s.campDesk.open('upgrades');}
  render(){const s=this.scene;for(const e of this.entries){const visible=this.visible(e)&&s.nearView(e,s.camera.worldView,300);for(const o of [e.pad,e.sign,e.label,e.zone])o.setVisible(visible);e.zone.input.enabled=visible;e.label.input.enabled=visible;
    if(!visible)continue;
    const near=(s.core.actors||[s.core]).some(a=>!a.player.room&&Math.hypot(a.player.x-e.x,a.player.y-e.y)<90);
    e.pad.clear().fillStyle(near?0xb79b54:0x477063,.45).fillRoundedRect(e.x-34,e.y-23,68,46,8).lineStyle(2,near?0xf4d18e:0x87b29a,.9).strokeRoundedRect(e.x-34,e.y-23,68,46,8);
    const width=e.label.width+20;e.sign.clear().fillStyle(0x604832).fillRect(e.x-3,e.y-72,6,46).fillRoundedRect(e.x-width/2,e.y-102,width,32,4).lineStyle(2,0xb49a64).strokeRoundedRect(e.x-width/2,e.y-102,width,32,4);
  }}
  destroy(){for(const e of this.entries)for(const o of [e.pad,e.sign,e.label,e.zone])o.destroy();}
}
