import {CAMP_HUB} from '../game/camp-layout.js';
import {CAMP_PROJECTS,projectLockReason} from '../game/camp-projects.js';
import {campIcon,materialChips,MATERIAL_FRAMES} from './camp-icons.js';
import {CARGO_MATERIALS,cargoAmount} from '../game/material-cargo.js';
import {visibleMenuActions} from './menu-navigation.js';
import { RECIPES, CAMP_UPGRADES, INDUSTRY_PROJECTS, MATERIAL_NAMES, materialCostText } from "../game/camp-industry-config.js";
import { BUYER_ORDERS } from "../game/buyer-orders.js";
import { hasCampBuilding } from "../game/camp-projects.js";
import { countdown } from "../game/first-days.js";
import { appendRaidReadiness } from "./camp-progress-ui.js";

export function createCampDesk(scene){
  const dialog=document.querySelector("#campDesk"),content=dialog.querySelector("[data-camp-content]"),message=dialog.querySelector("[data-camp-message]"),
    button=document.querySelector("#industryButton"),closeButton=dialog.querySelector("[data-camp-close]");
  let owner=null,section="workshop";
  const quantities={};
  function row(key,title,detail,action,reason="",options={}){
    const card=document.createElement('article'),heading=document.createElement('h3'),p=document.createElement('p'),b=document.createElement('button');
    card.className='camp-card camp-product';heading.textContent=title;p.textContent=detail;
    if(options.icon)card.append(campIcon(scene,options.icon,72));
    card.append(heading,p);
    if(options.cost)card.append(materialChips(scene,options.cost,options.paid));
    b.textContent=options.cta||'Выбрать';b.type='button';b.dataset.campAction=key;b.setAttribute('aria-disabled',String(!!reason));
    b.onclick=()=>{const result=action();render(key);message.textContent=result?(options.message||'Готово.'):reason||'Проверьте материалы и расстояние.';scene.renderModel();};
    card.append(b);
    if(reason){const hint=document.createElement('small');hint.textContent=reason;hint.className='camp-muted';card.append(hint);}
    content.append(card);return card;
  }
  function render(selected=""){
    const c=owner,s=c.state,industry=c.industry,bank=s.campIndustry.materials;
    content.replaceChildren();
    dialog.dataset.single='false';
    dialog.querySelector('h2').textContent=section==='storage'?'Склад лагеря':section==='orders'?'Заказы покупателей':'Мастерская';
    const stock=document.createElement('div');stock.dataset.campStock='';stock.className='camp-stock-strip';
    const stockTitle=document.createElement('small');stockTitle.textContent='На складе';stock.append(stockTitle);
    const stockAmounts={logs:s.logStore.length,...bank};
    stock.append(materialChips(scene,stockAmounts));content.append(stock);
    if(['workshop','production','upgrades'].includes(section)){
      const tabs=document.createElement('nav');tabs.className='camp-tabs';
      for(const [id,name] of [['workshop','Постройки'],['upgrades','Улучшения'],['production','Материалы']]){
        const b=document.createElement('button');b.type='button';b.textContent=name;b.dataset.campAction=`tab:${id}`;b.setAttribute('aria-pressed',String(section===id));b.onclick=()=>{section=id;render();};tabs.append(b);
      }content.append(tabs);
    }
    if(section==='workshop'){
      const busy=c.workshop.busy(),icons={fire:'unlitFire',tent:'tent',fence:'fence',house:'house',workbench:'sawmill.bench',kiln:'unlitFire',tower:'house',lamp:'survival.startLantern'};
      for(const p of CAMP_PROJECTS.filter(p=>!hasCampBuilding(s,p.id))){
        const selected=s.buildProject===p.id,reason=projectLockReason(s,p)||(busy&&!selected?'Сначала завершите текущий заказ':'');
        const cost={logs:p.cost,...p.materials},paid=selected?{logs:s.buildWood,...s.buildMaterials}:undefined;
        row(`build:${p.id}`,p.name,p.description.split('.')[0]+'.',()=>c.workshop.chooseBuild(p.id),reason,
          {icon:icons[p.id]||icons[p.kind]||'camp.crate',cost,paid,cta:selected?'Продолжить заказ':'Заказать',message:'Мастер принимает материалы у своего стола.'});
      }
      for(const d of (c.defenses?.all()||[]).filter(d=>['trap','barricade'].includes(d.kind)&&!d.hp)){
        row(`defense:${d.id}`,d.name,d.kind==='trap'?'Ранит и замедляет врага.':'Преграждает путь врагам.',()=>c.workshop.chooseDefense(d.id),busy?'Сначала завершите текущий заказ':'',
          {icon:d.kind==='trap'?'camp.defense.trap.ready':'camp.defense.barricade.ready',cost:{logs:d.cost},paid:{logs:d.wood},cta:s.workshopDefense===d.id?'Ожидает брёвна':'Заказать'});
      }
    }else if(section==='storage'){
      for(const id of CARGO_MATERIALS){
        const stored=c.storage.stored(id),carried=cargoAmount(s,id),qty=quantities[id]||1;
        const card=row(`take:${id}`,MATERIAL_NAMES[id],`На складе: ${stored} · В руках: ${carried}`,()=>c.storage.transfer(id,qty),stored<=0?'На складе пусто':c.storage.free(id)<=0?'Руки заняты':'',
          {icon:MATERIAL_FRAMES[id],cta:`Взять ${qty}`});
        const controls=document.createElement('div');controls.className='quantity-picker';
        for(const [label,fn] of [['−',()=>Math.max(1,qty-1)],[String(qty),()=>qty],['+',()=>Math.min(999,qty+1)],['Макс.',()=>Math.max(1,Math.min(stored,c.storage.free(id)))]]){
          const b=document.createElement('button');b.type='button';b.textContent=label;b.setAttribute('aria-label',`${MATERIAL_NAMES[id]}: ${label}`);b.onclick=()=>{quantities[id]=fn();render();};controls.append(b);
        }
        card.insertBefore(controls,card.querySelector('button'));
        const deposit=document.createElement('button');deposit.textContent=`Сложить ${Math.min(qty,carried)}`;deposit.disabled=!carried;deposit.dataset.campAction=`put:${id}`;
        deposit.onclick=()=>{c.storage.transfer(id,qty,'deposit');render();scene.renderModel();};card.append(deposit);
      }
    }else if(section==="production"){
      const queue=document.createElement("p");queue.dataset.productionQueue="";
      queue.textContent=s.campIndustry.queue.length?"Очередь: "+s.campIndustry.queue.map(j=>`${RECIPES.find(r=>r.id===j.recipe).name}: ${j.remaining>0?Math.ceil(j.remaining)+" с":"ждёт места"}`).join(" → "):"Очередь пуста (до трёх работ).";
      content.append(queue);
      for(const r of RECIPES)row(`recipe:${r.id}`,`Сделать: ${r.name}`,`${({boards:'Для построек и улучшений.',blocks:'Для прочных построек и ограды.',coal:'Топливо для костра, фонарей и башен.',kits:'Восстанавливает повреждённые постройки.'})[r.id]} Готовность: ${r.seconds} с.`,()=>industry.enqueue(r.id),industry.recipeReason(r.id),{icon:MATERIAL_FRAMES[r.id],cost:r.input,cta:'Изготовить'});
    }else if(section==="upgrades"){
      for(const [id,o] of Object.entries(CAMP_UPGRADES).filter(([id,o])=>hasCampBuilding(s,o.building)||id==='towers'&&hasCampBuilding(s,'tower-east'))){
        const level=s.campIndustry.upgrades[id],cost=o.costs[level];
        const paid=s.campIndustry.upgradePaid[id]||{},selected=s.campIndustry.upgradeSelected[id];
        const effects={fire:`Запас огня +300 с. Защитный свет шире.`,fence:`Прочность ограды: ${level===0?'60 → 100':'100 → 160'} HP.`,house:`Склад +200 мест. Помощники: ${2+level} → ${3+level}. Отдых лечит.`,towers:`Башни стреляют быстрее и наносят больше урона.`};
        row(`upgrade:${id}`,`${o.name} · ${level}/2`,level>=2?'Все улучшения этой постройки выполнены.':effects[id],()=>c.workshop.chooseUpgrade(id),industry.upgradeReason(id,true),
          {icon:({fire:'unlitFire',fence:'fence',house:'house',towers:'house'})[id],cost,paid: selected?Object.fromEntries(Object.keys(cost||{}).map(k=>[k,paid[k]||0])):undefined,cta:level>=2?'Максимум':selected?'Ожидает материалы':'Начать улучшение',message:'Принесите материалы к столу мастера.'});
        const hint=document.createElement('p');hint.className='camp-muted';hint.textContent='Материалы принимаются из рук у мастера.';content.append(hint);
      }
    }else if(section==="orders"){
      const current=c.orders.current,active=c.orders.data.active;
      if(current){
        row("order:deliver",`Сдать заказ: ${current.name}`,`${current.amount} ${MATERIAL_NAMES[current.resource]}, награда ${current.reward} монет. ${current.resource==="logs"?`Передано: ${active.logs.length}/${current.amount}.`:"Материалы берутся из общего запаса целиком."} До ночи ${countdown(c.orders.secondsLeft)}. Брёвна на золотой платформе идут в заказ первыми.`,()=>c.orders.deliver(true));
        row("order:cancel","Отменить заказ","Переданные брёвна можно забрать здесь обратно, без потери стоимости.",()=>c.orders.cancel());
      }else for(const o of BUYER_ORDERS){
        const reason=c.orders.data.refund.length?"Сначала заберите возврат":c.orders.data.completedDay===s.calendarDay?"Заказ сегодня уже выполнен":c.orders.secondsLeft<=0?"Вернитесь утром":!c.orders.near()?"Подойдите к площадке продажи":o.resource!=="logs"&&!hasCampBuilding(s,"workbench")?"Нужен верстак":"";
        row(`order:accept:${o.id}`,o.name,`${o.amount} ${MATERIAL_NAMES[o.resource]} → ${o.reward} монет. Срок — до ночи. Один заказ в день, обычные продажи сохраняются.`,()=>c.orders.accept(o.id),reason);
      }
      if(c.orders.data.refund.length)row("order:refund",`Забрать возврат · ${c.orders.data.refund.length} брёвен`,"Выдаётся в руки до личной вместимости. Новый заказ доступен после возврата.",()=>c.orders.takeRefund());
    }else{
      appendRaidReadiness(content,c);
      row("fuel:coal","Уголь в костёр · +180 с",`Запас ${Math.ceil(s.campFuel)}/${c.camp.maxFuel()} с. Нужно подойти к костру.`,()=>c.camp.stoke(true,"coal"));
      row("kit:camp","Ремнабор для лагеря",`Один набор → до 60 HP. Лагерь: ${s.campHealth}/${s.maxCampHealth}. Подойдите к костру.`,()=>c.preparation.repair("camp"));
      for(const d of c.defenses?.all()||[])if(d.hp<d.maxHP&&d.kind!=="trap"&&Math.hypot(d.x-c.player.x,d.y-c.player.y)<110)
        row(`kit:${d.id}`,`Ремнабор: ${d.name}`,`${d.hp}/${d.maxHP} HP. Один набор восстанавливает до 60 HP, включая пролом.`,()=>c.preparation.repair(d.id));
      for(const p of INDUSTRY_PROJECTS.filter(p=>p.kind==="tower"&&hasCampBuilding(s,p.id))){
        const d=c.defenses?.get(p.id);const text=document.createElement("p");text.textContent=`${p.name}: ${d?.hp||0}/120 HP · выстрелов заряжено ${s.campIndustry.towerAmmo[p.id]||0}. Уголь загружается автоматически ночью; Смотритель неуязвим.`;content.append(text);
      }
      for(const p of INDUSTRY_PROJECTS.filter(p=>p.kind==="lamp"&&hasCampBuilding(s,p.id)))
        row(`lamp:${p.id}`,`Заправить: ${p.name}`,`${Math.ceil(s.campIndustry.lampFuel[p.id]||0)}/540 с. Один уголь → 180 с света; подойдите к фонарю. Защиту от Смотрителя даёт только костёр.`,()=>c.preparation.refuelLamp(p.id));
    }
    const all=[...dialog.querySelectorAll("[data-camp-action]")],target=all.find(b=>b.dataset.campAction===selected)||all.find(b=>!b.dataset.campAction.startsWith("tab:"));
    if(target){scene.keyboardUi.modal=dialog;scene.keyboardUi.selection=visibleMenuActions(dialog).indexOf(target);(target.closest(".camp-card")||target).dataset.selected="true";target.focus({preventScroll:true});}
  }
  function open(tab="workshop",siteId=null){
    if(scene.core.paused||document.querySelector("dialog[open]"))return false;
    owner=scene.core.actors?.[scene.core.activeActor]||scene.core;
    if(!owner.industry.canUse()){scene.core.showNotice("Подойдите к лагерю, чтобы открыть мастерскую.");return false;}
    if(tab==='overview')tab='workshop';
    if(tab==='storage'&&!owner.storage.near()){owner.showNotice('Подойдите к складу лагеря.');return false;}
    if(['workshop','production','upgrades'].includes(tab)&&!owner.workshop.near()){owner.setDestination(CAMP_HUB.counter.x,CAMP_HUB.counter.y);owner.showNotice('Мастер ждёт у мастерской.');return false;}
    section=tab;message.textContent="";if(scene.core.coop)dialog.dataset.owner=String(owner.player.id);else delete dialog.dataset.owner;scene.pause("camp-desk",true);dialog.showModal();render();return true;
  }
  const show=()=>open(),dismiss=()=>dialog.close(),closed=()=>scene.pause("camp-desk",false);
  button.addEventListener("click",show);closeButton.addEventListener("click",dismiss);dialog.addEventListener("close",closed);
  return {open,destroy(){button.removeEventListener("click",show);closeButton.removeEventListener("click",dismiss);dialog.removeEventListener("close",closed);dialog.close();content.replaceChildren();}};
}
