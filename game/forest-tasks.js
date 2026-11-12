import {FOREST_CAMP,LOOKOUT,CAMP_GUARDS} from "./forest-tasks-layout.js";
import {materialLimit} from "./camp-industry-config.js";
export function createForestTasks({state,player,regions,nav,onIncome,emit=()=>{}}){
  const d=state.forestTasks,bank=state.campIndustry.materials;
  const near=p=>!state.gameOver&&state.health>0&&!player.room&&!player.menuOpen&&regions.isOpen(p)&&Math.hypot(player.x-p.x,player.y-p.y)<125&&nav.hasLineOfSight(player,p);
  const guards=()=>CAMP_GUARDS.map(g=>({...g,hp:d.guardHP[g.id]??g.maxHP})).filter(g=>g.hp>0);
  function record(type,e){
    if(type!=="enemy-hit"||!CAMP_GUARDS.some(g=>g.id===e.enemy?.id))return;
    d.guardHP[e.enemy.id]=Math.max(0,e.enemy.hp);
  }
  function reveal(){
    if(!near(LOOKOUT)||!state.worldWorks.built[LOOKOUT.id]||d.surveyed.length)return false;
    const r=regions.all.find(r=>r.id===LOOKOUT.regionId);
    d.surveyed=regions.all.filter(n=>Math.abs(n.gx-r.gx)+Math.abs(n.gy-r.gy)<=1).map(n=>n.id);
    emit("forest-surveyed",{regions:d.surveyed});return true;
  }
  function claimReason(){
    if(!near(FOREST_CAMP))return "Подойдите к сундуку в открытом регионе";
    if(d.claimed)return "Припасы уже забраны";
    if(guards().length)return `Осталось стражей: ${guards().length}/3`;
    if(bank.boards+FOREST_CAMP.reward.boards>materialLimit(state)||bank.coal+FOREST_CAMP.reward.coal>materialLimit(state))return "Освободите место в общем запасе досок и угля";
    return "";
  }
  function claim(){if(claimReason())return false;d.claimed=true;bank.boards+=FOREST_CAMP.reward.boards;bank.coal+=FOREST_CAMP.reward.coal;onIncome(FOREST_CAMP.reward.coins);emit("forest-cache-claimed",{});return true;}
  const summary=()=>d.claimed?"Лагерь зачищен · припасы забраны":guards().length?`Стражи ${3-guards().length}/3 побеждены`:"Лагерь зачищен · заберите припасы";
  function survey(id){if(!d.surveyed.includes(id))return null;const r=regions.all.find(r=>r.id===id);
    return r.id===FOREST_CAMP.regionId?"Лагерь врагов и древний дуб":r.id===LOOKOUT.regionId?"Дозорная вышка и загадочный торговец":({sawmill:"Заброшенная лесопилка",wagon:"Старый обоз",pond:"Рыболовное озеро",camp:"Стартовый лагерь",ruins:"Руины с находками",arch:"Каменные врата"}[r.activity]||"Лесная точка интереса");}
  function offers(id){return id===FOREST_CAMP.id?[{action:"forest:claim",name:"Забрать припасы",description:`${summary()}. Награда: 60 монет, 4 доски и 2 угля. Ключ не требуется.`,reason:claimReason(),enabled:!claimReason()}]:id===LOOKOUT.id?[{action:"forest:survey",name:"Осмотреть лес с вышки",description:"Отмечает ориентиры на карте M. Закрытые территории остаются закрытыми.",enabled:!!state.worldWorks.built[id]&&!d.surveyed.length,reason:!state.worldWorks.built[id]?"Сначала восстановите вышку":d.surveyed.length?"Места уже отмечены":""}]:[];}
  return {sites:[FOREST_CAMP],guards,record,reveal,claim,summary,survey,offers,
    encampment:{site:FOREST_CAMP,guards},perform:(id,action)=>id===FOREST_CAMP.id&&action==="forest:claim"?claim():id===LOOKOUT.id&&action==="forest:survey"?reveal():false};
}
