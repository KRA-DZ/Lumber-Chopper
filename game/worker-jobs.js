import { hasCampBuilding } from "./camp-projects.js";
import { industryLevel, materialLimit } from "./camp-industry-config.js";
import { strikeBoulder } from "./mining.js";
import { MILL } from "./sawmill-production-config.js";

export const WORKER_ROLES=Object.freeze({
  lumberjack:{name:"Дровосек",description:"Рубит бесконечный древний дуб. Брёвна идут покупателям или в общий склад по выбранному назначению."},
  miner:{name:"Каменщик",description:"Добывает настоящие валуны открытых регионов и несёт камень в общий запас. Отступает от врагов."},
  repairer:{name:"Ремонтник",description:"Чинит ограду, калитки и башни за брёвна общего склада, оставляя резерв. Не сражается и не разжигает костёр."},
  operator:{name:"Оператор",assignmentOnly:true,description:"Одно из прежних мест команды. После возврата груза идёт на восстановленную лесопилку и обслуживает станок; ночью — только с разрешением."},
});
export const WORKER_JOBS=Object.freeze({stoneCapacity:8,stonePerLevel:4,mineSeconds:1.2,repairSeconds:2,repairReserveMax:40,scanSeconds:2});
export const workerSlots=state=>2+(hasCampBuilding(state,"house")?industryLevel(state,"house"):0);
export const workerRole=w=>w.role||"lumberjack";

// Specialist decisions share the main worker path budget. Scans occur only when a target needs replacement.
export function createWorkerJobs({state,world,regions,nav,defenses,data,emit,mill}){
  const bank=state.campIndustry.materials;
  const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  const stoneCapacity=()=>WORKER_JOBS.stoneCapacity+data.level*WORKER_JOBS.stonePerLevel;
  const rockFor=w=>world.boulders?.find(r=>r.id===w.workTarget);
  const sectionFor=w=>defenses?.get(w.workTarget);
  const safe=(p,danger)=>!danger.some(e=>distance(p,e)<320);
  const usable=(w,p)=>!(w.skipped||[]).some(s=>s.id===p.id&&s.until>w.clock);
  const repairable=d=>d&&d.hp<d.maxHP&&(d.kind==="tower"||["fence","gate"].includes(d.kind)&&hasCampBuilding(state,"fence"));
  function select(w,danger){
    if(workerRole(w)==="operator")return {kind:"mill",reason:mill?.status()||"Обслуживает лесопилку"};
    if(workerRole(w)==="miner"){
      if(w.stoneCargo&&(w.stoneCargo+8>stoneCapacity()||w.job==="depot"))return {kind:"depot",reason:"Несёт камень"};
      if(bank.stone>=materialLimit(state))return {kind:w.stoneCargo?"depot":"rest",reason:"Общий запас камня заполнен"};
      let target=rockFor(w);
      if(!target||!regions.isOpen(target)||(state.boulderHP[target.id]??target.maxHP)<=0||!safe(target,danger)||!usable(w,target)){
        w.workTarget=null;
        if(w.workScan<=0){
          const rocks=(world.boulders||[]).filter(r=>regions.isOpen(r)&&(state.boulderHP[r.id]??r.maxHP)>0);
          target=rocks.filter(r=>safe(r,danger)&&usable(w,r)).sort((a,b)=>distance(w,a)-distance(w,b))[0];
          w.workTarget=target?.id||null;w.workScan=WORKER_JOBS.scanSeconds;
          w.idleReason=rocks.length?"Рядом враги или нет прохода":"Нет доступного камня";
        }else target=null;
      }
      if(!target)return {kind:w.stoneCargo?"depot":"rest",reason:w.idleReason||"Нет доступного камня"};
      return {kind:`rock:${target.id}`,reason:"Добывает камень"};
    }
    if(state.logStore.length<=data.repairReserve)return {kind:"rest",reason:`Резерв дров: ${data.repairReserve} · лишних брёвен нет`};
    let target=sectionFor(w);
    if(!repairable(target)||!safe(target,danger)||!usable(w,target)){
      w.workTarget=null;
      if(w.workScan<=0){
        const damaged=(defenses?.all()||[]).filter(repairable);
        target=damaged.filter(d=>safe(d,danger)&&usable(w,d)).sort((a,b)=>Number(b.hp===0)-Number(a.hp===0)||distance(w,a)-distance(w,b))[0];
        w.workTarget=target?.id||null;w.workScan=WORKER_JOBS.scanSeconds;
        w.idleReason=damaged.length?"Рядом враги или нет прохода":"Всё отремонтировано";
      }else target=null;
    }
    return target?{kind:`repair:${target.id}`,reason:"Чинит укрепление"}:{kind:"rest",reason:w.idleReason||"Всё отремонтировано"};
  }
  function goal(w,kind){
    if(kind==="mill")return nav.nearestGround(MILL.operator.x,MILL.operator.y);
    const target=kind.startsWith("rock:")?rockFor(w):sectionFor(w);
    if(!target)return null;
    const angle=Math.atan2(w.y-target.y,w.x-target.x),radius=kind.startsWith("rock:")?target.radius+35:45;
    for(let i=0;i<8;i++){
      const a=angle+i*Math.PI/4,p=nav.nearestGround(target.x+Math.cos(a)*radius,target.y+Math.sin(a)*radius);
      if(distance(p,target)>=30&&distance(p,target)<78)return p;
    }
    return null;
  }
  function blocked(w){
    if(w.workTarget){w.skipped=(w.skipped||[]).filter(s=>s.until>w.clock).slice(-7);w.skipped.push({id:w.workTarget,until:w.clock+8});}
    w.workTarget=null;w.workScan=0;w.workTimer=0;
  }
  function work(w,kind,dt){
    if(kind==="mill"){w.phase=mill?.status()?"waiting":"operating";w.direction="up";return;}
    if(kind.startsWith("rock:")){
      const rock=rockFor(w);
      if(!rock||!regions.isOpen(rock)||distance(w,rock)>90){w.phase="blocked";w.reason="Нет прохода к валуну";blocked(w);return;}
      const d=Math.max(1,distance(w,rock)),surface={x:rock.x+(w.x-rock.x)/d*(rock.radius+16),y:rock.y+(w.y-rock.y)/d*(rock.radius+16)};
      if(!nav.hasLineOfSight(w,surface)){w.phase="blocked";w.reason="Нет прохода к валуну";blocked(w);return;}
      w.phase="mining";w.direction="up";w.workTimer=(w.workTimer||0)+dt;
      if(w.workTimer<WORKER_JOBS.mineSeconds-data.level*.15)return;
      w.workTimer=0;
      if(w.stoneCargo+rock.yield>stoneCapacity())return;
      const hit=strikeBoulder(state,rock,1+data.level);if(!hit)return;
      w.swing=.3;emit("worker-mining-hit",{worker:w,rock,damage:hit.damage});
      if(hit.depleted){w.stoneCargo+=rock.yield;nav.rebuildObstacles();emit("worker-mined",{worker:w,rock,count:rock.yield});w.workTarget=null;w.workScan=0;}
    }else{
      const section=sectionFor(w);
      if(!repairable(section)||distance(w,section)>78){w.phase="waiting";w.workTarget=null;w.workScan=0;w.workTimer=0;return;}
      w.phase="repairing";w.workTimer=(w.workTimer||0)+dt;
      if(w.workTimer<WORKER_JOBS.repairSeconds-data.level*.2)return;
      w.workTimer=0;
      if(state.logStore.length<=data.repairReserve)return;
      if(defenses.deposit(section.id)){state.logStore.pop();data.repaired++;emit("worker-repaired",{worker:w,section});}
    }
  }
  function unload(w){
    if(w.unloadTimer>0||bank.stone>=materialLimit(state))return false;
    if(!w.stoneCargo)return false;
    w.stoneCargo--;bank.stone++;data.stoneDelivered++;w.unloadTimer=.35;emit("worker-stone-delivered",{worker:w});return true;
  }
  return {select,goal,work,blocked,unload,stoneCapacity};
}
