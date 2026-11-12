import {REGION_SIZE,WORLD_CENTER as C} from "./world-grid.js";
const east={id:"1:0",cx:C.x+REGION_SIZE,cy:C.y},south={id:"0:1",cx:C.x,cy:C.y+REGION_SIZE};
export const FOREST_CAMP=Object.freeze({id:"forest-camp-cache",kind:"encounter",name:"Сундук лесного лагеря",regionId:east.id,
  x:east.cx-480,y:east.cy+640,radius:240,reward:{coins:60,boards:4,coal:2},description:"Лагерь охраняют два бойца и метатель. Зачистите его и заберите припасы один раз за забег."});
export const LOOKOUT=Object.freeze({id:"lookout-tower",kind:"infrastructure",name:"Заброшенная дозорная вышка",regionId:south.id,
  x:south.cx+576,y:south.cy-640,cost:{logs:16,boards:6,blocks:4},description:"Восстановление отмечает места интереса в этом и четырёх соседних регионах. Территории по-прежнему нужно открывать за ресурсы."});
export const CAMP_GUARDS=Object.freeze([[-95,-30,10],[90,-30,10],[0,-140,8]].map(([dx,dy,hp],i)=>({id:`forest-guard:${i}`,x:FOREST_CAMP.x+dx,y:FOREST_CAMP.y+dy,maxHP:hp,role:i===2?"ranged":"melee"})));
export const forestTaskReserved=(x,y,pad=0)=>Math.hypot(x-FOREST_CAMP.x,y-FOREST_CAMP.y)<FOREST_CAMP.radius+pad||Math.hypot(x-LOOKOUT.x,y-LOOKOUT.y)<140+pad;
