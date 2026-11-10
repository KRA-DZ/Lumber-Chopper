import { WORKS_PROJECTS, WORKS_SITES, worksCollision } from "./world-works-layout.js";
import { MATERIAL_NAMES } from "./camp-industry-config.js";

export function createWorldWorks({state,player,regions,nav,forestry,bodies=()=>[player],emit=()=>{}}){
  const data=state.worldWorks;
  const near=p=>!state.gameOver&&state.health>0&&!player.room&&!player.menuOpen&&regions.isOpen(p)&&
    Math.hypot(player.x-p.x,player.y-p.y)<125&&nav.hasLineOfSight(player,p);
  const project=id=>WORKS_PROJECTS.find(p=>p.id===id);
  function reason(id){
    const p=project(id);if(!p)return "Неизвестный объект";
    if(!near(p))return "Подойдите к объекту в открытом регионе";
    if(data.built[id])return "Уже восстановлено";
    if(p.requiresLow&&data.level!=="low")return "Сначала опустите воду на плотине";
    const paid=data.paid[id]||{},bank=state.campIndustry.materials;
    if(!Object.entries(p.cost).some(([key,n])=>(paid[key]||0)<n&&(key==="logs"?state.wood>0:bank[key]>0)))return "Принесите брёвна или подготовьте общие материалы";
    return "";
  }
  function contribute(id){
    if(reason(id))return false;
    const p=project(id),paid=data.paid[id]||(data.paid[id]={});
    for(const [key,total] of Object.entries(p.cost)){
      const count=Math.min(total-(paid[key]||0),key==="logs"?state.wood:state.campIndustry.materials[key]);
      if(key==="logs"){for(let i=0;i<count;i++)forestry.takeCargo();}else state.campIndustry.materials[key]-=count;
      paid[key]=(paid[key]||0)+count;
    }
    if(Object.entries(p.cost).every(([key,n])=>paid[key]===n)){
      data.built[id]=true;data.revision++;nav.rebuildObstacles();emit("world-work-completed",{project:p});
    }
    return true;
  }
  function canFlood(){
    const high={worldWorks:{...data,level:"high"}};
    return !bodies().some(p=>!p.room&&worksCollision(high,p.x,p.y,p.radius||10)&&!worksCollision(state,p.x,p.y,p.radius||10));
  }
  function levelReason(level){
    if(!near(project("old-dam")))return "Подойдите к плотине";
    if(!data.built["old-dam"])return "Сначала восстановите привод плотины";
    if(!["high","low"].includes(level))return "Неизвестное положение";
    if(data.level===level)return "Вода уже на этом уровне";
    if(level==="high"&&!canFlood())return "В зоне затопления кто-то находится. Сначала освободите русло";
    return "";
  }
  function setLevel(level){
    if(levelReason(level))return false;
    data.level=level;data.revision++;nav.rebuildObstacles();emit("water-level-changed",{level});return true;
  }
  function progress(id){
    const p=project(id),paid=data.paid[id]||{};
    return Object.entries(p.cost).map(([key,n])=>`${paid[key]||0}/${n} ${MATERIAL_NAMES[key]}`).join(" · ");
  }
  function offers(id){
    if(!project(id))return [];
    const rows=[{action:"works:contribute",name:"Внести доступные материалы",description:`${progress(id)}. Брёвна — из рук, доски и блоки — из общего запаса. Взносы сохраняются до новой игры.`,reason:reason(id)}];
    if(id==="old-dam")for(const [level,name] of [["low","Опустить воду"],["high","Поднять воду"]])rows.push({action:`works:${level}`,name,description:"Два фиксированных положения. Подъём запрещён, пока в зоне затопления находятся игроки или существа; мосты не затапливаются.",reason:levelReason(level)});
    return rows.map(r=>({...r,enabled:!r.reason}));
  }
  return {sites:WORKS_SITES,near,contribute,setLevel,levelReason,reason,progress,offers,canFlood,
    perform(id,action){return action==="works:contribute"?contribute(id):id==="old-dam"&&["works:low","works:high"].includes(action)?setLevel(action.slice(6)):false;}};
}
