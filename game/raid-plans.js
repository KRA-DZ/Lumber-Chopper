import { RAID_INTERVAL } from "./config.js";

// The first raid keeps its three-role introduction. Later raids rotate; the director owns the count/cap.
const PLANS = Object.freeze([
  {id:"scouts",name:"Разведка",roles:["attacker","thief","breaker"],
    hint:"Защитите ограду и следите за вором. Метатели местных стай тоже могут прийти к лагерю."},
  {id:"runners",name:"Быстрый отряд",roles:["attacker","attacker","thief","thrower"],fast:true,
    hint:"Бегуны быстрее обычных налётчиков. Закройте проломы и не уходите далеко от лагеря."},
  {id:"breakers",name:"Разрушители",roles:["breaker","attacker","breaker","thrower","thief"],
    hint:"Громилы быстро ломают укрепления. Подготовьте ремнаборы и брёвна для ремонта."},
  {id:"throwers",name:"Обстрел",roles:["thrower","attacker","thrower","breaker","thief","thrower"],
    hint:"Метатели бросают через ограду. Выходите из отмеченных кругов: забор не укрывает от снарядов."},
]);
export function raidPlan(night) {
  const raid=Math.max(1,Math.floor(night/RAID_INTERVAL));
  return PLANS[raid===1?0:1+(raid-2)%3];
}
export function raidRoster(night,count) {
  const plan=raidPlan(night);
  return Array.from({length:count},(_,i)=>({role:plan.roles[i%plan.roles.length],
    fast:!!plan.fast&&plan.roles[i%plan.roles.length]==="attacker"}));
}
