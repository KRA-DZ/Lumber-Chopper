import { hasCampBuilding } from "./camp-projects.js";
import { RECIPES, CAMP_UPGRADES, materialLimit, campStorageLimit } from "./camp-industry-config.js";
import {CAMP_STATIONS,inCamp} from './camp-layout.js';
import {cargoAmount,changeMaterialCargo} from './material-cargo.js';

export function createCampIndustry({state,player,forestry,defenses,emit=()=>{}}) {
  const data=state.campIndustry, bank=data.materials;
  data.upgradePaid??={};data.upgradeSelected??={};
  let padTimer=0;
  const canUse=()=>!state.gameOver&&state.health>0&&!player.menuOpen&&
    (!!player.room||inCamp(player,30));
  const canPay=cost=>Object.entries(cost).every(([id,n])=>id==="logs"?state.logStore.length>=n:bank[id]>=n);
  function pay(cost) {
    for(const [id,n] of Object.entries(cost)){
      if(id==="logs")state.logStore.splice(state.logStore.length-n,n);
      else bank[id]-=n;
    }
  }
  function deposit(kind) {
    if(!canUse())return 0;
    let count=0;
    if(kind==="logs"){
      while(state.wood&&state.logStore.length<campStorageLimit(state)){state.logStore.push(forestry.takeCargo());count++;}
    }else if(Object.hasOwn(bank,kind)){
      count=Math.max(0,Math.min(cargoAmount(state,kind),materialLimit(state)-bank[kind]));
      changeMaterialCargo(state,kind,-count);bank[kind]+=count;
    }
    if(count)emit("camp-supplied",{kind,count});return count;
  }
  function recipeReason(id) {
    const recipe=RECIPES.find(r=>r.id===id);
    if(!recipe)return "Неизвестный рецепт";
    if(!canUse())return "Нужно находиться в лагере";
    if(!hasCampBuilding(state,recipe.station))return recipe.station==="kiln"?"Сначала постройте угольную яму":"Сначала постройте верстак";
    if(data.queue.length>=3)return "Очередь заполнена: максимум три задания";
    if(!canPay(recipe.input))return "Не хватает материалов в общем запасе";
    return "";
  }
  function enqueue(id) {
    if(recipeReason(id))return false;
    const recipe=RECIPES.find(r=>r.id===id);pay(recipe.input);
    data.queue.push({id:data.nextJob++,recipe:id,total:recipe.seconds,remaining:recipe.seconds});
    emit("production-queued",{recipe:id});return true;
  }
  function upgradeReason(id, carried = false) {
    const offer=CAMP_UPGRADES[id],level=data.upgrades[id];
    if(!offer)return "Неизвестное улучшение";
    if(!canUse())return "Нужно находиться в лагере";
    const built=hasCampBuilding(state,offer.building)||(id==="towers"&&hasCampBuilding(state,"tower-east"));
    if(!built)return "Сначала постройте нужный объект";
    if(!hasCampBuilding(state,"workbench"))return "Нужен верстак";
    if(id==="fence"&&!defenses)return "Оборона недоступна";
    if(level>=offer.costs.length)return "Максимальный уровень";
    if(!carried&&!canPay(offer.costs[level]))return "Не хватает материалов в общем запасе";
    return "";
  }
  function upgrade(id) {
    if(upgradeReason(id))return false;
    if(data.upgradeSelected[id])return false;
    pay(CAMP_UPGRADES[id].costs[data.upgrades[id]]);
    finishUpgrade(id);return true;
  }
  function finishUpgrade(id){
    if(id==="fence")defenses.reinforce();else data.upgrades[id]++;
    delete data.upgradePaid[id];delete data.upgradeSelected[id];
    emit("camp-upgraded",{id,level:data.upgrades[id]});
  }
  function selectUpgrade(id){
    const site=CAMP_STATIONS.find(p=>p.upgrade===id&&hasCampBuilding(state,p.building)&&Math.hypot(player.x-p.x,player.y-p.y)<=110);
    if(!site||upgradeReason(id,true)||player.room||Math.hypot(player.x-site.x,player.y-site.y)>110)return false;
    if(data.upgradeSelected[id])return true;
    data.upgradeSelected[id]=true;data.upgradePaid[id]={};
    emit('camp-upgrade-selected',{id});return true;
  }
  function deliverUpgrade(dt){
    if(!Number.isFinite(dt)||dt<=0)return;
    const site=CAMP_STATIONS.find(p=>p.upgrade&&hasCampBuilding(state,p.building)&&data.upgradeSelected[p.upgrade]&&Math.hypot(player.x-p.x,player.y-p.y)<30);
    if(!site||!canUse()||player.room||upgradeReason(site.upgrade,true)){padTimer=0;return;}
    padTimer+=dt;if(padTimer<.35)return;padTimer=0;
    const id=site.upgrade,cost=CAMP_UPGRADES[id].costs[data.upgrades[id]],paid=data.upgradePaid[id];
    const material=Object.keys(cost).find(k=>(paid[k]||0)<cost[k]&&cargoAmount(state,k)>0);
    if(material){changeMaterialCargo(state,material,-1);paid[material]=(paid[material]||0)+1;emit('camp-material-delivered',{id,material});}
    if(Object.entries(cost).every(([k,n])=>(paid[k]||0)>=n))finishUpgrade(id);
  }
  function update(dt) {
    if(state.gameOver||!Number.isFinite(dt)||dt<=0)return;
    let budget=dt;
    while(data.queue.length&&budget>1e-9){
      const job=data.queue[0],recipe=RECIPES.find(r=>r.id===job.recipe),step=Math.min(budget,job.remaining);
      job.remaining=Math.max(0,job.remaining-step);budget-=step;
      if(job.remaining>1e-9)break;
      if(!Object.entries(recipe.output).every(([id,n])=>bank[id]+n<=materialLimit(state)))break;
      for(const [id,n] of Object.entries(recipe.output))bank[id]+=n;
      data.queue.shift();emit("production-ready",{recipe:recipe.id,output:recipe.output});
    }
  }
  return {data,canUse,canPay,deposit,recipeReason,enqueue,upgradeReason,upgrade,selectUpgrade,deliverUpgrade,update};
}
