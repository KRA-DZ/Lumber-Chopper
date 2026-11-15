import {hasCampBuilding} from '../game/camp-projects.js';
import {CAMP,CAMP_HUB} from '../game/camp-layout.js';
import {CAMP_SERVICE} from '../game/camp-services.js';
// Labels remain live text. Future translations replace this dictionary, never the PNG artwork.
export const SERVICE_LABELS={equipment:'Снаряжение',workers:'Работники',camp:'Улучшения лагеря'};
const SERVICES=[{id:'equipment',name:'Войти в лавку',...CAMP_SERVICE.shopDoor},{id:'house',name:'Войти в дом',building:'house',...CAMP_SERVICE.door},{id:'workshop',name:'Мастер · заказы лагеря',...CAMP_HUB.counter},{id:'workers',name:'Бригадир · помощники',x:CAMP.tent.x,y:CAMP.tent.y+65}];
export class CampServiceView{
  constructor(scene){this.scene=scene;this.entries=SERVICES.map(p=>{
    const label=scene.text(SERVICE_LABELS[p.id]||p.name,p.x,p.y-86,14,'#ffe7ad',p.y-84).setInteractive({useHandCursor:true}).setData('campService',p.id);
    const zone=scene.add.zone(p.x,p.y,76,60).setInteractive().setDepth(p.y+5).setData('campService',p.id);
    return {...p,label,zone};
  });}
  visible(e){const s=this.scene.core.state;return e.id==='workers'?hasCampBuilding(s,'tent')&&!hasCampBuilding(s,'house'):!e.building||hasCampBuilding(s,e.building);}
  targets(){return this.entries.filter(e=>this.visible(e)).map(e=>({p:e,range:85,act:()=>this.open(e.id)}));}
  open(id){const s=this.scene;
    if(id==='equipment')return s.core.camp.enter('shop')||s.core.setDestination(CAMP_SERVICE.shopDoor.x,CAMP_SERVICE.shopDoor.y);
    if(id==='house')return s.core.camp.enter()||s.core.setDestination(CAMP_SERVICE.door.x,CAMP_SERVICE.door.y);
    if(id==='workers')return s.workerUi.open();
    return s.campDesk.open('workshop');
  }
  render(){const s=this.scene;for(const e of this.entries){const visible=this.visible(e)&&s.nearView(e,s.camera.worldView,300);for(const o of [e.label,e.zone])o.setVisible(visible);e.zone.input.enabled=visible;e.label.input.enabled=visible;
    if(!visible)continue;
    e.label.setText(`${e.name} · E/Enter`);
    s.worldHints.offer(e.label,e,{eligible:visible,range:100,priority:75});
  }}
  destroy(){for(const e of this.entries)for(const o of [e.label,e.zone])o.destroy();}
}
