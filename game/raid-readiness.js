import { dayOverview } from "./first-days.js";
import { DAY_SECONDS } from "./config.js";
import { NIGHT_START } from "./cycle.js";
import { hasCampBuilding } from "./camp-projects.js";
import { raidPlan } from "./raid-plans.js";

// Read-only advice, never a gate or a guarantee of surviving the raid.
export function raidReadiness(c) {
  const s=c.state,time=dayOverview(s),sections=c.defenses?.all()||[],
    fence=sections.filter(d=>["fence","gate"].includes(d.kind)),towers=sections.filter(d=>d.kind==="tower"),
    fuelNeeded=time.raidTonight?DAY_SECONDS-s.worldTime:DAY_SECONDS-NIGHT_START,
    broken=fence.filter(d=>d.hp<=0).length,damaged=fence.filter(d=>d.hp<d.maxHP).length,
    fuelOK=hasCampBuilding(s,"fire")&&s.campFuel>=fuelNeeded,
    fenceOK=hasCampBuilding(s,"fence")&&fence.length>0&&!damaged,
    campOK=s.campHealth===s.maxCampHealth,
    bank=s.campIndustry.materials;
  let coal=bank.coal;
  const armed=towers.filter(d=>{if(d.hp<=0)return false;if(s.campIndustry.towerAmmo[d.id]>0)return true;if(coal>0){coal--;return true;}return false;}).length;
  return {time,plan:raidPlan(time.nextRaid),fuelNeeded,ready:[fuelOK,fenceOK,campOK].filter(Boolean).length,
    checks:[
      {id:"fuel",ready:fuelOK,text:`Огонь: ${Math.ceil(s.campFuel)}/${Math.ceil(fuelNeeded)} с ${time.raidTonight?"до рассвета":"на одну ночь"}. ${hasCampBuilding(s,"fire")?"Добавляйте дрова или уголь заранее.":"Сначала постройте костёр."}`},
      {id:"fence",ready:fenceOK,text:hasCampBuilding(s,"fence")?`Ограда: повреждено ${damaged}/${fence.length}, проломов ${broken}. Полная прочность ${fence.reduce((n,d)=>n+d.hp,0)}/${fence.reduce((n,d)=>n+d.maxHP,0)} HP.`:"Ограда не построена. Костёр не останавливает налётчиков."},
      {id:"camp",ready:campOK,text:`База: ${s.campHealth}/${s.maxCampHealth} HP. Голубая платформа ремонтирует за брёвна.`},
    ],
    extra:`Башни: вооружено ${armed}/${towers.length} · заряжено ${towers.filter(d=>d.hp>0).reduce((n,d)=>n+(s.campIndustry.towerAmmo[d.id]||0),0)} выстр. · общий уголь ${bank.coal} · ремнаборы ${bank.kits}. Топоры: ${(c.actors||[c]).map((a,i)=>`${i+1}: ур. ${a.state.axeLevel+1}`).join(", ")}.`,
    advice:"Это ориентир, а не гарантия защиты. Налётчики ломают ограду; свет защищает только от Смотрителя. Метатели достают через забор.",
  };
}
