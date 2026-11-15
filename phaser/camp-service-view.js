import {hasCampBuilding} from '../game/camp-projects.js';
import {CAMP_STATIONS} from '../game/camp-layout.js';
import {CAMP_UPGRADES} from '../game/camp-industry-config.js';
import {drawInteractionPad,onPad} from './interaction-pad.js';
// Labels remain live text. Future translations replace this dictionary, never the PNG artwork.
export const SERVICE_LABELS={equipment:'Снаряжение',workers:'Работники',camp:'Улучшения лагеря'};
const SERVICES=[{id:'equipment',x:1525,y:1653},{id:'workers',x:1710,y:1780},...CAMP_STATIONS];
export class CampServiceView{
  constructor(scene){this.scene=scene;this.entries=SERVICES.map(p=>{
    const pad=scene.add.graphics().setDepth(-790),label=scene.text(SERVICE_LABELS[p.id]||p.name,p.x,p.y-86,14,'#ffe7ad',p.y-84).setInteractive({useHandCursor:true}).setData('campService',p.id);
    const zone=scene.add.zone(p.x,p.y,76,60).setInteractive().setDepth(p.y+5).setData('campService',p.id);
    return {...p,pad,label,zone};
  });}
  visible(e){return !e.building||hasCampBuilding(this.scene.core.state,e.building);}
  targets(){return this.entries.filter(e=>this.visible(e)).map(e=>({p:e,range:85,act:()=>this.open(e.id)}));}
  open(id){const s=this.scene;if(id==='equipment')s.shop.open();else if(id==='workers')s.workerUi.open();else {const site=CAMP_STATIONS.find(p=>p.id===id);s.campDesk.open(site?.upgrade?'upgrades':'production',id);}}
  render(){const s=this.scene;for(const e of this.entries){const visible=this.visible(e)&&s.nearView(e,s.camera.worldView,300);for(const o of [e.pad,e.label,e.zone])o.setVisible(visible);e.zone.input.enabled=visible;e.label.input.enabled=visible;
    if(!visible)continue;
    const actors=s.core.actors||[s.core],near=actors.some(a=>!a.player.room&&Math.hypot(a.player.x-e.x,a.player.y-e.y)<90);
    e.glow=drawInteractionPad(s,e.pad.clear(),e,68,46,onPad(e,actors,68,46));
    if(e.upgrade){
      const data=s.core.state.campIndustry,selected=data.upgradeSelected[e.upgrade],cost=CAMP_UPGRADES[e.upgrade].costs[data.upgrades[e.upgrade]],paid=data.upgradePaid[e.upgrade]||{};
      const total=Object.values(cost||{}).reduce((a,b)=>a+b,0),done=Object.values(paid).reduce((a,b)=>a+b,0);
      e.label.setText(`${e.name}${selected?` · ${done}/${total}`:near?' · E/Enter':''}`);
      if(selected)e.pad.fillStyle(0x273e36).fillRect(e.x-28,e.y+28,56,6).fillStyle(0xe5c37e).fillRect(e.x-28,e.y+28,56*done/Math.max(1,total),6);
    }
    e.label.setText(`${e.name||SERVICE_LABELS[e.id]}${e.upgrade?e.label.text.slice(e.name.length):' · E/Enter'}`);
    s.worldHints.offer(e.label,e,{eligible:visible,range:100,priority:75});
  }}
  destroy(){for(const e of this.entries)for(const o of [e.pad,e.label,e.zone])o.destroy();}
}
