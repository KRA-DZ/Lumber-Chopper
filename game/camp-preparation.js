import { hasCampBuilding } from "./camp-projects.js";
import { INDUSTRY_PROJECTS, industryLevel } from "./camp-industry-config.js";
import { NIGHT_START } from "./cycle.js";

export function createCampPreparation({state,player,defenses,nav,getSurvival,canUse,emit=()=>{}}){
  const data=state.campIndustry,bank=data.materials;
  const towers=INDUSTRY_PROJECTS.filter(p=>p.kind==="tower"),lamps=INDUSTRY_PROJECTS.filter(p=>p.kind==="lamp");
  function repair(id){
    if(!canUse()||bank.kits<1)return false;
    if(id==="camp"){
      if(Math.hypot(player.x-1600,player.y-1600)>150||state.campHealth>=state.maxCampHealth)return false;
      state.campHealth=Math.min(state.maxCampHealth,state.campHealth+60);
    }else{
      const section=defenses?.get(id);
      if(!section||section.kind==="trap"||section.hp>=section.maxHP||player.room||Math.hypot(player.x-section.x,player.y-section.y)>100)return false;
      if(!defenses.restore(id,60))return false;
    }
    bank.kits--;emit("kit-used",{id});return true;
  }
  function refuelLamp(id){
    const lamp=lamps.find(p=>p.id===id);
    if(!lamp||!hasCampBuilding(state,id)||!canUse()||player.room||Math.hypot(player.x-lamp.site.x,player.y-lamp.site.y)>120||bank.coal<1||(data.lampFuel[id]||0)>360)return false;
    bank.coal--;data.lampFuel[id]=(data.lampFuel[id]||0)+180;emit("lamp-refuelled",{id});return true;
  }
  function update(dt){
    if(state.gameOver||!Number.isFinite(dt)||dt<=0)return;
    for(const lamp of lamps)data.lampFuel[lamp.id]=Math.max(0,(data.lampFuel[lamp.id]||0)-dt);
    if(state.worldTime<NIGHT_START)return;
    const survival=getSurvival();if(!survival)return;
    for(const tower of towers){
      const id=tower.id,section=defenses?.get(id);
      data.towerCooldown[id]=Math.max(0,(data.towerCooldown[id]||0)-dt);
      if(!hasCampBuilding(state,id)||!section?.hp||data.towerCooldown[id]>0)continue;
      const origin={x:tower.site.x,y:tower.site.y-65},level=industryLevel(state,"towers");
      const targets=[...survival.raiders,...survival.residents].filter(e=>e.hp>0&&!e.invulnerable&&(e.warning||0)<=0&&
        Math.hypot(e.x-origin.x,e.y-origin.y)<320&&nav.hasLineOfSight(origin,e));
      targets.sort((a,b)=>Math.hypot(a.x-origin.x,a.y-origin.y)-Math.hypot(b.x-origin.x,b.y-origin.y));
      const enemy=targets[0];if(!enemy)continue;
      if(!(data.towerAmmo[id]>0)){if(bank.coal<1)continue;bank.coal--;data.towerAmmo[id]=8;}
      if(!survival.hit(enemy.id,1+level,false))continue;
      data.towerAmmo[id]--;data.towerCooldown[id]=[1.8,1.4,1.1][level];
      emit("tower-shot",{from:origin,to:{x:enemy.x,y:enemy.y-25},id:enemy.id});
    }
  }
  function lights(){return lamps.filter(p=>hasCampBuilding(state,p.id)&&data.lampFuel[p.id]>0)
    .map(p=>({...p.site,r:160,kind:"camp-lamp"}));}
  return {repair,refuelLamp,update,lights};
}
