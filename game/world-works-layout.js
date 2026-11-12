import {LOOKOUT} from "./forest-tasks-layout.js";
import { REGION_SIZE } from "./world-grid.js";
// Preserve each hand-authored layout at its regional offset as square sizes change.
const extra = REGION_SIZE - 1920;
const move = (p, id) => ({...p, x:p.x+(id==="-1:0"?-extra:0), y:p.y+(id==="0:-1"?-extra:0)});
// Fixed small layouts, shared by terrain, collisions and project UI. Existing regional unlock costs still apply.
export const WORKS_PROJECTS=Object.freeze([
  LOOKOUT,
  {id:"old-dam",kind:"infrastructure",name:"Лебёдка старой плотины",regionId:"-1:0",x:-152,y:1360,
    cost:{logs:8,boards:4,blocks:4},description:"Восстановите привод, затем опустите воду. Откроются брод и затопленная гидростанция; озеро для рыбалки останется."},
  {id:"river-bridge",kind:"infrastructure",name:"Западный речной мост",regionId:"-1:0",x:-144,y:760,
    cost:{logs:16,boards:8,blocks:4},deck:{x:-480,y:704,width:320,height:112},description:"Прямой переход через северную часть реки при любом уровне воды. Без него придётся обходить реку или пользоваться далёким бродом."},
  {id:"north-boardwalk",kind:"infrastructure",name:"Северный настил",regionId:"0:-1",x:1810,y:535,
    cost:{logs:12,boards:6,blocks:3},deck:{x:1544,y:260,width:112,height:272},description:"Короткая дорога через заболоченную низину ко входу крепости. Обход по берегу остаётся доступен."},
  {id:"sluice-gate",kind:"infrastructure",name:"Ворота гидростанции",regionId:"-1:0",x:-508,y:996,
    cost:{logs:8,boards:4,blocks:2},requiresLow:true,description:"После осушения восстановите и закрепите ворота. Откроются архивный зал и сундук, к которым можно возвращаться."},
].map(p=>({...move(p,p.regionId),...(p.deck?{deck:move(p.deck,p.regionId)}:{})})));
export const WORKS_SITES=Object.freeze([
  ...WORKS_PROJECTS,
  {id:"waterworks-archive",kind:"inspect",name:"Запись смотрителя плотины",regionId:"-1:0",x:-820,y:936,requiredWorks:"sluice-gate",requiresLow:true,
    description:"«Ворот на востоке не поднимай при полной воде. Старый брод лежит южнее моста. Если на обмелевших камнях появятся свежие следы — возвращайся к огню. Мы здесь больше не дежурим». Запись остаётся доступна для повторного чтения."},
  {id:"chest:-1:0:2",kind:"chest",name:"Сундук гидростанции",regionId:"-1:0",x:-808,y:1072,requiredWorks:"sluice-gate",requiresLow:true,description:"Старая печать сохранилась под водой. Нужен один ключ из лавки; содержимое выдаётся один раз."},
].map(p=>WORKS_PROJECTS.includes(p)?p:move(p,p.regionId)));
export const WORKS_BASIN=Object.freeze(move({x:-1000,y:800,width:568,height:400},"-1:0"));
const river=move({x:-432,y:656,width:224,height:784},"-1:0"),bog=move({x:1056,y:300,width:1088,height:192},"0:-1");
const lowChannels=[{x:-352,y:656,width:64,height:576},{x:-352,y:1328,width:64,height:112}].map(r=>move(r,"-1:0"));
export const WORKS_TERRAIN_BOUNDS=Object.freeze([river,WORKS_BASIN,bog,...WORKS_PROJECTS.filter(p=>p.deck).map(p=>p.deck)]);
export const worksChunkAffected=(cx,cy)=>WORKS_TERRAIN_BOUNDS.some(r=>cx*256<r.x+r.width+16&&(cx+1)*256>r.x-16&&cy*256<r.y+r.height+16&&(cy+1)*256>r.y-16);
const wall=(id,x0,y0,x1,y1,project=null)=>({id,regionId:"-1:0",a:move({x:x0,y:y0},"-1:0"),b:move({x:x1,y:y1},"-1:0"),r:12,project});
export const WORKS_WALLS=Object.freeze([
  wall("waterworks-west",-960,832,-960,1168),wall("waterworks-north",-960,832,-560,832),
  wall("waterworks-south",-960,1168,-560,1168),wall("waterworks-east-north",-560,832,-560,940),
  wall("waterworks-east-south",-560,1052,-560,1168),wall("waterworks-gate",-560,940,-560,1052,"sluice-gate"),
]);
export const initialWorldWorks=()=>({level:"high",built:{},paid:{},revision:0});
export const inRect=(r,x,y,pad=0)=>x>=r.x-pad&&x<=r.x+r.width+pad&&y>=r.y-pad&&y<=r.y+r.height+pad;
export function worksSurfaces(state){
  const d=state.worldWorks,low=d.level==="low";
  return [
    {...river,kind:"shore"},{...WORKS_BASIN,kind:"shore"},{...bog,kind:"water"},
    ...(low?lowChannels.map(r=>({...r,kind:"water"})):[{...river,kind:"water"},{...WORKS_BASIN,kind:"water"}]),
    ...WORKS_PROJECTS.filter(p=>p.deck&&d.built[p.id]).map(p=>({...p.deck,kind:"deck"})),
  ];
}
export function worksWater(state,x,y,r=0){
  const low=state.worldWorks.level==="low";
  return inRect(bog,x,y,r)||(!low&&(inRect(river,x,y,r)||inRect(WORKS_BASIN,x,y,r)))||
    (low&&lowChannels.some(c=>inRect(c,x,y,r)));
}
export function worksCollision(state,x,y,r=10){
  if(!worksWater(state,x,y,r))return false;
  return !WORKS_PROJECTS.some(p=>p.deck&&state.worldWorks.built[p.id]&&inRect(p.deck,x,y,-r));
}
export function worksReserved(x,y,pad=0){
  return [river,WORKS_BASIN,bog,...WORKS_PROJECTS.map(p=>({x:p.x-90,y:p.y-90,width:180,height:180})),
    move({x:-520,y:1216,width:400,height:144},"-1:0"),move({x:1496,y:200,width:208,height:384},"0:-1")].some(r=>inRect(r,x,y,pad));
}
