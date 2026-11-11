import { CENTER } from "./config.js";
import { CAMP } from "./camp-layout.js";
import { CAMP_SERVICE } from "./camp-services.js";
import { INDUSTRY_PROJECTS } from "./camp-industry-config.js";

export const RECORD_BOARD={x:2048,y:1856};
export const DECORATIONS=Object.freeze([
  {id:"flowers",name:"Лесные цветы",key:"camp.flowers",price:12,goal:null},
  {id:"crate",name:"Деревянный ящик",key:"camp.crate",price:18,goal:null},
  {id:"mat",name:"Коврик путешественника",key:"camp.mat",price:25,goal:"first-night"},
  {id:"dishes",name:"Походная посуда",key:"camp.dishes",price:35,goal:"two-nights"},
  {id:"explorer",name:"Ящик исследователя",key:"camp.crate",price:30,goal:"explorer",tint:0xa5c9c1},
  {id:"hunter",name:"Цветы охотника",key:"camp.flowers",price:40,goal:"hunter",tint:0xe9a6ad},
  {id:"sawmill",name:"Поленница мастера",key:"sawmill.woodRack",price:45,goal:"sawmill"},
  {id:"raid",name:"Знак защитника",key:"camp.gateSign",price:50,goal:"raid",tint:0xe9cf82},
  {id:"seal",name:"Памятный знак леса",key:"story.campSeal",price:60,goal:"seven-nights"},
]);
export function createCampCustom({state,player,nav,canAct}){
  const d=state.campCustom;
  const snap=p=>({x:Math.round(p.x/32)*32,y:Math.round(p.y/32)*32});
  function reason(id,p,moving=null){
    const item=DECORATIONS.find(i=>i.id===id);if(!item)return "Неизвестное украшение";
    if(!canAct())return "Герой сейчас недоступен";
    if(item.goal&&!d.unlocks.includes(item.goal))return "Сначала выполните цель на доске рекордов";
    if(!Number.isFinite(p?.x)||!Number.isFinite(p?.y))return "Выберите место";
    p=snap(p);
    if(Math.hypot(p.x-CENTER.x,p.y-CENTER.y)>1050)return "Украшайте лагерь и поляну вокруг него";
    if(Math.hypot(p.x-player.x,p.y-player.y)>400||!nav.hasLineOfSight(player,p))return "Подойдите ближе к выбранному месту";
    if(!nav.isWalkable(p.x,p.y))return "Здесь препятствие";
    const reserved=[{...CENTER,r:100},{...CAMP.hut,r:140},{...CAMP.tent,r:110},{...CAMP.merchant,r:120},{...CAMP.stall,r:120},
      {x:1420,y:1690,r:100},{x:1780,y:1690,r:100},...Object.values(CAMP_SERVICE).filter(p=>Number.isFinite(p?.x)).map(p=>({...p,r:95})),
      ...INDUSTRY_PROJECTS.map(i=>({...i.site,r:100})),{x:1450,y:1790,r:100},{x:1710,y:1780,r:90},{...RECORD_BOARD,r:85}];
    if(reserved.some(q=>Math.hypot(q.x-p.x,q.y-p.y)<q.r)||Math.abs(p.x-CENTER.x)<64||Math.abs(p.y-CENTER.y)<64)return "Оставьте свободными постройки и четыре выхода";
    if(d.objects.some(o=>o.uid!==moving&&Math.hypot(o.x-p.x,o.y-p.y)<64))return "Слишком близко к другому украшению";
    if(moving){if(!d.objects.some(o=>o.uid===moving&&o.id===id))return "Украшение уже убрано";}
    else{
      if(d.objects.length>=32)return "На поляне уже 32 украшения";
      if(!(d.stock[id]>0)&&state.coins<Math.ceil(item.price*(state.priceMultiplier||1)))return "Не хватает монет";
    }
    return "";
  }
  function place(id,p,moving=null){
    if(reason(id,p,moving))return false;p=snap(p);
    if(moving)Object.assign(d.objects.find(o=>o.uid===moving),p);
    else{const item=DECORATIONS.find(i=>i.id===id);if(d.stock[id]>0)d.stock[id]--;else state.coins-=Math.ceil(item.price*(state.priceMultiplier||1));
      d.objects.push({id,uid:++d.sequence,...p});}
    d.revision++;return true;
  }
  function remove(uid){
    if(!canAct())return false;const o=d.objects.find(o=>o.uid===uid);
    if(!o||Math.hypot(o.x-player.x,o.y-player.y)>400||!nav.hasLineOfSight(player,o))return false;
    d.objects.splice(d.objects.indexOf(o),1);d.stock[o.id]=(d.stock[o.id]||0)+1;d.revision++;return true;
  }
  function supply(id){
    if(!canAct()||Math.hypot(player.x-RECORD_BOARD.x,player.y-RECORD_BOARD.y)>150)return false;
    const cost=Math.ceil((id==="heal"?15:25)*(state.priceMultiplier||1));
    if(!["heal","coal"].includes(id)||state.coins<cost)return false;
    if(id==="heal"){if(state.health>=state.maxHealth)return false;state.health=Math.min(state.maxHealth,state.health+35);}
    else{if(state.campIndustry.materials.coal>=200)return false;state.campIndustry.materials.coal++;}
    state.coins-=cost;return true;
  }
  return {reason,place,remove,supply,snap};
}
