import { MILL, MILL_STAGES, MILL_SITES } from "./sawmill-production-config.js";
import { NIGHT_START } from "./cycle.js";
import { MATERIAL_NAMES } from "./camp-industry-config.js";
import { createSawmillFreight } from "./sawmill-freight.js";
import { regionAt } from "./regions.js";

export function createSawmillProduction({state,player,regions,nav,forestry,getWorkers,hear=()=>{},emit=()=>{}}){
  const data=state.sawmill,bank=state.campIndustry.materials;
  const sites=[...MILL_SITES,{id:"freight-cart",kind:"sawmill-service",name:"Грузовая тележка",requiresCart:true,
    get x(){return data.cart.x;},get y(){return data.cart.y;},get regionId(){return regionAt(data.cart.x,data.cart.y)?.id||"0:0";},
    get hideFromNearby(){return data.cart.owner!==null;},description:"Прицепите тележку или оставьте её на месте. Груз сохраняется; свободную тележку можно подобрать второму игроку."}];
  const living=()=>!state.gameOver&&state.health>0&&!player.room&&!player.menuOpen;
  const nearSite=id=>{const s=sites.find(s=>s.id===id);return !!s&&(!s.requiresCart||data.cart.built)&&living()&&regions.isOpen(s)&&Math.hypot(player.x-s.x,player.y-s.y)<125&&nav.hasLineOfSight(player,s);};
  const freight=createSawmillFreight({state,player,forestry,nav,nearSite,living});
  const atMill=()=>nearSite("sawmill-loading")||nearSite("sawmill-production");
  const shift=()=>data.stage===3&&(state.worldTime<NIGHT_START||data.nightWork);
  const crew=()=>getWorkers()?.crew||[];
  function operator(){return crew().find(w=>w.role==="operator"&&!w.pendingRole&&!state.workforce.recalled&&w.dangerUntil<=w.clock&&
    w.job==="mill"&&Math.hypot(w.x-MILL.operator.x,w.y-MILL.operator.y)<65&&nav.hasLineOfSight(w,MILL.operator));}
  function status(){
    if(data.stage<3)return "Сначала завершите три этапа ремонта";
    if(!data.enabled)return "Станок остановлен вручную";
    if(!shift())return "Ночная смена отключена";
    if(!operator())return "Оператор не на месте, отозван или отступает от опасности";
    if(data.output>MILL.outputLimit-MILL.boards)return "Склад досок заполнен: заберите продукцию";
    if(!data.job&&data.input.length<MILL.logs)return "Нужно восемь брёвен на партию";
    return "";
  }
  function pay(cost,paid){
    let moved=0;for(const [key,total] of Object.entries(cost)){
      const n=Math.min(total-(paid[key]||0),key==="logs"?state.wood:bank[key]);
      if(key==="logs")for(let i=0;i<n;i++)forestry.takeCargo();else bank[key]-=n;
      paid[key]=(paid[key]||0)+n;moved+=n;
    }return moved>0;
  }
  const paidAll=(cost,paid)=>Object.entries(cost).every(([key,n])=>paid[key]===n);
  function restoreReason(){
    if(!nearSite("sawmill-restoration"))return "Подойдите к доске восстановления во дворе";
    const s=MILL_STAGES[data.stage];if(!s)return "Лесопилка восстановлена";
    if(s.debris&&state.exploration.debrisHP[s.debris]!==0)return "Сначала расчистите указанный завал: "+(data.stage===0?"упавшие балки":"тяжёлый завал");
    if(s.passage&&!state.exploration.openedPassages.includes(s.passage))return "Изучите памятку и откройте нишу старым ручным приводом";
    if(s.discovery&&!state.exploration.discoveries.includes(s.discovery))return "Сначала заберите бирку седьмой смены из ниши";
    return "";
  }
  function restore(){
    if(restoreReason())return false;const s=MILL_STAGES[data.stage],paid=data.paid[data.stage]||(data.paid[data.stage]={});
    if(!pay(s.cost,paid))return false;
    if(paidAll(s.cost,paid)){data.stage++;emit("mill-restored",{stage:data.stage,name:s.name});}return true;
  }
  function buildCart(){
    if(!nearSite("camp-freight")||data.stage<1||data.cart.built)return false;
    if(!pay(MILL.cartCost,data.cartPaid))return false;
    if(paidAll(MILL.cartCost,data.cartPaid)){data.cart.built=true;emit("mill-cart-built",{});}return true;
  }
  function assign(id){if(!atMill()||data.stage<3)return false;return getWorkers()?.assign(id,"operator")||false;}
  function perform(id,action){
    if(!nearSite(id))return false;
    const commands={"mill:restore":restore,"mill:cart-build":buildCart,"mill:attach":freight.attach,"mill:detach":freight.detach,
      "mill:load-cart":freight.load,"mill:unload":freight.unload,"mill:deposit":freight.deposit,"mill:collect":freight.collect,"mill:take-input":freight.takeInput};
    if(commands[action])return commands[action]();
    if(action.startsWith("mill:operator:"))return assign(Number(action.slice(14)));
    if(!atMill()||data.stage<3)return false;
    if(action==="mill:toggle"){data.enabled=!data.enabled;if(!data.enabled)data.noise=0;return true;}
    if(action==="mill:night"){data.nightWork=!data.nightWork;if(!data.nightWork)data.noise=0;return true;}
    return false;
  }
  function update(dt){
    if(state.gameOver||!Number.isFinite(dt)||dt<=0)return;
    data.noise=Math.max(0,data.noise-dt);data.pulse=Math.max(0,data.pulse-dt);
    if(status())return;
    if(!data.job)data.job={remaining:MILL.seconds,logs:data.input.splice(0,MILL.logs)};
    if(state.worldTime>=NIGHT_START&&data.pulse<=0){data.noise=MILL.noiseMemory;data.pulse=MILL.noiseInterval;hear(MILL.operator,MILL.noiseRadius);emit("mill-noise",{point:MILL.operator});}
    data.job.remaining=Math.max(0,data.job.remaining-dt);
    if(data.job.remaining<=1e-8){data.output+=MILL.boards;data.job=null;data.batches++;emit("mill-batch-ready",{boards:MILL.boards});}
  }
  const progress=(cost,paid)=>Object.entries(cost).map(([k,n])=>`${paid[k]||0}/${n} ${MATERIAL_NAMES[k]}`).join(" · ");
  function offers(id){
    const rows=[],add=(action,name,description,reason="")=>rows.push({action,name,description,reason,enabled:!reason});
    const summary=`Сырьё ${data.input.length}/${MILL.inputLimit} · доски ${data.output}/${MILL.outputLimit} · ${data.job?`партия: ${Math.ceil(data.job.remaining)} с`:(status()||"Готов к работе")}.`;
    if(id==="sawmill-restoration"){
      const s=MILL_STAGES[data.stage];add("mill:restore",s?`Восстановить: ${s.name}`:"Все три этапа завершены",s?`${s.description} ${progress(s.cost,data.paid[data.stage]||{})}`:summary,restoreReason());
    }else if(id==="camp-freight"){
      add("mill:cart-build","Восстановить грузовую тележку",`${progress(MILL.cartCost,data.cartPaid)}. Общая на двоих: 24 единицы, скорость тягача −20%.`,data.cart.built?"Уже готова":data.stage<1?"Сначала восстановите площадку лесопилки":"");
      add("mill:load-cart","Загрузить брёвна общего склада",`Запас лагеря ${state.logStore.length}. В тележке ${data.cart.logs.length} бр., ${data.cart.boards} досок.`,!freight.accessible()?"Тележка должна быть рядом и свободна либо прикреплена к вам":!state.logStore.length||freight.free()<=0?"Нет брёвен или места":"");
      add("mill:unload","Разгрузить в общий запас","Доски из рук и тележки идут в банк; оставшиеся брёвна тележки — в общий склад. Переполнение сохраняет остаток груза.");
    }else if(id!=="freight-cart"){
      add("mill:deposit","Сдать брёвна в сырьё",summary,data.stage<1?"Нужен первый этап ремонта":"");
      add("mill:collect","Забрать готовые доски",summary,data.output<1?"Готовой партии пока нет":"");
      add("mill:take-input","Забрать необработанные брёвна","Выдаются в руки с исходной стоимостью; уже начатая партия не отменяется.",data.input.length?"":"Склад сырья пуст");
      add("mill:toggle",data.enabled?"Остановить станок":"Запустить станок",summary,data.stage<3?"Завершите ремонт":"");
      add("mill:night",data.nightWork?"Запретить ночную смену":"Разрешить ночную смену",`По умолчанию станок останавливается с ночью. Работающий станок слышен ближайшим монстрам за ${MILL.noiseRadius}; при опасности оператор отступает.`,data.stage<3?"Завершите ремонт":"");
      for(const w of crew())add(`mill:operator:${w.id}`,`Оператор: ${w.name}`,"Занимает прежнее место помощника. Сначала вернёт старый груз и дойдёт до станка.",data.stage<3?"Завершите ремонт":w.role==="operator"||w.pendingRole==="operator"?"Уже назначен":crew().some(n=>n.id!==w.id&&(n.role==="operator"||n.pendingRole==="operator"))?"На станок нужен только один оператор":"");
    }
    if(data.cart.built){add("mill:attach","Прицепить тележку",`Груз: ${data.cart.logs.length} бр., ${data.cart.boards} досок.`,!freight.accessible()||data.cart.owner!==null?"Подойдите к свободной тележке":"");add("mill:detach","Оставить тележку на месте","Груз сохраняется. В доме тележка не помещается.",freight.towing()?"":"Тележка не прикреплена к вам");}
    return rows;
  }
  const noisePoint=Object.freeze({...MILL.operator,radius:MILL.noiseRadius});
  return {sites,nearSite,restore,buildCart,assign,offers,perform,update,status,operator,shift,freight,speedMultiplier:()=>freight.towing()?MILL.cartSpeed:1,
    noise:()=>data.noise>0&&state.worldTime>=NIGHT_START?noisePoint:null};
}
