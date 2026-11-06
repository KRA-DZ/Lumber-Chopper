import { hasCampBuilding } from "./camp-projects.js";
import { RECIPES, CAMP_UPGRADES, materialLimit, campStorageLimit } from "./camp-industry-config.js";

export function createCampIndustry({state,player,forestry,defenses,emit=()=>{}}) {
  const data=state.campIndustry, bank=data.materials;
  const canUse=()=>!state.gameOver&&state.health>0&&!player.menuOpen&&
    (!!player.room||Math.hypot(player.x-1600,player.y-1600)<430);
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
    }else if(kind==="stone"){
      count=Math.max(0,Math.min(state.stone,materialLimit(state)-bank.stone));
      state.stone-=count;bank.stone+=count;
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
  function upgradeReason(id) {
    const offer=CAMP_UPGRADES[id],level=data.upgrades[id];
    if(!offer)return "Неизвестное улучшение";
    if(!canUse())return "Нужно находиться в лагере";
    const built=hasCampBuilding(state,offer.building)||(id==="towers"&&hasCampBuilding(state,"tower-east"));
    if(!built)return "Сначала постройте нужный объект";
    if(!hasCampBuilding(state,"workbench"))return "Нужен верстак";
    if(id==="fence"&&!defenses)return "Оборона недоступна";
    if(level>=offer.costs.length)return "Максимальный уровень";
    if(!canPay(offer.costs[level]))return "Не хватает материалов в общем запасе";
    return "";
  }
  function upgrade(id) {
    if(upgradeReason(id))return false;
    pay(CAMP_UPGRADES[id].costs[data.upgrades[id]]);
    if(id==="fence")defenses.reinforce();else data.upgrades[id]++;
    emit("camp-upgraded",{id,level:data.upgrades[id]});return true;
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
  return {data,canUse,canPay,deposit,recipeReason,enqueue,upgradeReason,upgrade,update};
}
