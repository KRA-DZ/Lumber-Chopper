import {visibleMenuActions} from './menu-navigation.js';
import { RECIPES, CAMP_UPGRADES, INDUSTRY_PROJECTS, MATERIAL_NAMES, materialCostText, materialLimit } from "../game/camp-industry-config.js";
import { BUYER_ORDERS } from "../game/buyer-orders.js";
import { hasCampBuilding } from "../game/camp-projects.js";
import { countdown } from "../game/first-days.js";
import { appendRaidReadiness } from "./camp-progress-ui.js";

export function createCampDesk(scene){
  const dialog=document.querySelector("#campDesk"),content=dialog.querySelector("[data-camp-content]"),message=dialog.querySelector("[data-camp-message]"),
    button=document.querySelector("#industryButton"),closeButton=dialog.querySelector("[data-camp-close]");
  let owner=null,section="production";
  function row(key,title,detail,action,reason=""){
    const card=document.createElement("article"),heading=document.createElement("h3"),p=document.createElement("p"),b=document.createElement("button");
    card.className="camp-card";heading.textContent=title;p.textContent=detail+(reason?` ${reason}.`:"");
    b.textContent=title;b.type="button";b.dataset.campAction=key;b.setAttribute("aria-disabled",String(!!reason));
    b.onclick=()=>{const result=action();render(key);message.textContent=result?"Готово.":reason||"Сейчас недоступно: проверьте материалы и расстояние.";scene.renderModel();};
    const details=document.createElement("details"),summary=document.createElement("summary");summary.textContent=reason?"Требования и описание":"Подробнее";details.append(summary,p);card.append(b,details);content.append(card);
  }
  function render(selected=""){
    const c=owner,s=c.state,industry=c.industry,bank=s.campIndustry.materials;
    content.replaceChildren();
    const stock=document.createElement("p");stock.dataset.campStock="";
    stock.textContent=`Склад: ${s.logStore.length}/${c.camp.storageLimit()} брёвен · `+Object.entries(bank).map(([id,n])=>`${MATERIAL_NAMES[id]}: ${n}/${materialLimit(s)}`).join(" · ");content.append(stock);
    const tabs=document.createElement("nav");tabs.className="camp-tabs";
    for(const [id,name] of [["production","Производство"],["upgrades","Улучшения"],["orders","Заказы"],["defense","Оборона"]]){
      const b=document.createElement("button");b.textContent=name;b.dataset.campAction=`tab:${id}`;b.setAttribute("aria-pressed",String(section===id));
      b.onclick=()=>{section=id;render();};tabs.append(b);
    }content.append(tabs);
    if(section==="production"){
      row("deposit:logs","Передать брёвна из рук",`Общий склад сохраняет стоимость брёвен. Сейчас в руках: ${s.wood}.`,()=>industry.deposit("logs"));
      row("deposit:stone","Передать камень",`Из личной сумки в общий запас. В руках: ${s.stone}.`,()=>industry.deposit("stone"));
      const queue=document.createElement("p");queue.dataset.productionQueue="";
      queue.textContent=s.campIndustry.queue.length?"Очередь: "+s.campIndustry.queue.map(j=>`${RECIPES.find(r=>r.id===j.recipe).name}: ${j.remaining>0?Math.ceil(j.remaining)+" с":"ждёт места"}`).join(" → "):"Очередь пуста (до трёх работ).";
      content.append(queue);
      for(const r of RECIPES)row(`recipe:${r.id}`,`Сделать: ${r.name}`,`${materialCostText(r.input)} → ${materialCostText(r.output)}. ${r.seconds} с. Ресурсы списываются при заказе; производство идёт после закрытия меню.`,()=>industry.enqueue(r.id),industry.recipeReason(r.id));
    }else if(section==="upgrades"){
      for(const [id,o] of Object.entries(CAMP_UPGRADES)){
        const level=s.campIndustry.upgrades[id],cost=o.costs[level];
        row(`upgrade:${id}`,`${o.name} · ${level}/2`,`${o.description} ${cost?"Цена: "+materialCostText(cost):"Максимальный уровень."}`,()=>industry.upgrade(id),industry.upgradeReason(id));
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
  function open(tab="production"){
    if(scene.core.paused||document.querySelector("dialog[open]"))return false;
    owner=scene.core.actors?.[scene.core.activeActor]||scene.core;
    if(!owner.industry.canUse()){scene.core.showNotice("Подойдите к лагерю, чтобы открыть мастерскую.");return false;}
    section=tab;message.textContent="";scene.pause("camp-desk",true);dialog.showModal();render();return true;
  }
  const show=()=>open(),dismiss=()=>dialog.close(),closed=()=>scene.pause("camp-desk",false);
  button.addEventListener("click",show);closeButton.addEventListener("click",dismiss);dialog.addEventListener("close",closed);
  return {open,destroy(){button.removeEventListener("click",show);closeButton.removeEventListener("click",dismiss);dialog.removeEventListener("close",closed);dialog.close();content.replaceChildren();}};
}
