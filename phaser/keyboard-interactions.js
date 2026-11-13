import {upgradeCell} from './upgrade-cell.js';
import {menuStep,MENU_DIRECTIONS,ownerKey,visibleMenuActions} from './menu-navigation.js';
import {RECORD_BOARD} from "../game/camp-custom.js";
import { SHOP_IDS, upgradeOffer } from "../economy.js";
import { CAMP } from "../game/camp-layout.js";
import { CAMP_SERVICE, ROOM } from "../game/camp-services.js";
import { CENTER } from "../game/config.js";
import { hasCampBuilding } from "../game/camp-projects.js";
import { INDUSTRY_PROJECTS } from "../game/camp-industry-config.js";

// Native keyboard navigation runs before Phaser. Co-op shops lock only their owner.
export class KeyboardInteractions {
  constructor(scene) {
    this.scene = scene; this.shops = new Map(); this.modal = null; this.selection = 0;
    this.onKey = e => this.handle(e);
    document.addEventListener("keydown", this.onKey, true);
  }
  consume(e) { e.preventDefault(); e.stopImmediatePropagation(); }
  openShop(i = this.scene.core.activeActor || 0, site = null) {
    const a = this.scene.core.actors?.[i];
    if (!a || a.state.health <= 0 || this.scene.core.paused) return;
    a.clearKeys(); a.player.menuOpen = true;
    if (this.shops.has(i)) return;
    const panel = document.createElement("aside"); panel.className = "personal-shop"; panel.dataset.playerShop = i;
    panel.setAttribute("aria-label", `Лавка игрока ${i + 1}`);
    const title = document.createElement("h3"), info = document.createElement("p"), rows = [];
    title.textContent = `${site ? site.name : "Лавка"} · игрок ${i + 1}`; panel.append(title, info);
    const list=document.createElement("div"),detail=document.createElement("p");list.className="upgrade-grid";panel.append(list,detail);
    const entry = { panel, info, list, detail, rows, index: 0, actor: a, site,
      buy: id => site ? a.exploration.perform(site.id,id) : a.purchaseUpgrade(id) }; this.shops.set(i, entry);
    if(site)panel.dataset.merchant=site.id;
    const help = document.createElement("p");
    help.textContent = i ? "Стрелки · Enter купить · Backspace назад" : "WASD · E купить · Q назад";
    const close = document.createElement("button"); entry.close=close;close.dataset.menuBack="";close.textContent = "Назад"; close.onclick = () => this.closeShop(i);
    panel.append(help, close); document.querySelector("#game-frame").append(panel); this.refresh();
  }
  closeShop(i) {
    const entry = this.shops.get(i); if (!entry) return;
    entry.actor.player.menuOpen = false; entry.actor.clearKeys(); if(entry.site)entry.actor.exploration.close();entry.panel.remove(); this.shops.delete(i);
  }
  refresh() {
    for (const [i, e] of this.shops) {
      if (e.actor.state.health <= 0 || e.actor.state.gameOver) { this.closeShop(i); continue; }
      const s = e.actor.state;
      const key=[s.coins,s.health,s.carryLevel,s.axeLevel,s.bootsLevel,s.pickupLevel,s.lanternLevel,e.index,
        ...Object.values(s.exploration.items),s.exploration.rod,s.story.phase].join(":");
      if (key === e.key) continue; e.key = key;
      e.info.textContent = `${s.coins} монет · HP ${s.health}/${s.maxHealth}`;
      const offers=e.site ? e.actor.exploration.offers(e.site.id).map(o=>({id:o.action,text:o.name,description:o.description,enabled:o.enabled}))
        : SHOP_IDS.map(id=>{const o=upgradeOffer(s,id);return{id,text:`${o.name} · ${o.maxed?"максимум":o.price+" монет"}`,description:o.description,enabled:o.canBuy};});
      const ids=offers.map(o=>o.id);
      if(ids.join(":")!==e.ids?.join(":")){
        e.ids=ids;e.rows=[];e.list.replaceChildren();
        ids.forEach((id,j)=>{const b=document.createElement("button");b.dataset.personalBuy=id;
          b.onclick=()=>{e.index=j;e.buy(id);this.refresh();};e.list.append(b);e.rows.push(b);});
      }
      e.index=Math.min(e.index,offers.length);e.close.dataset.selected=String(e.index===offers.length);
      offers.forEach((o,j)=>{const b=e.rows[j];if(e.site)b.textContent=o.text;else upgradeCell(b,upgradeOffer(s,o.id));
        b.dataset.selected=String(j===e.index);b.setAttribute("aria-disabled",String(!o.enabled));});
      e.detail.textContent=offers[e.index]?.description||"Вернуться в игру";
    }
  }
  handle(e) {
    const dialog = document.querySelector("dialog[open]");
    if (dialog && dialog.id !== "heroDialog") {
      if (![...MENU_DIRECTIONS,"KeyE","Enter","KeyQ","Backspace"].includes(e.code)) return;
      this.consume(e);
      if(dialog.dataset.owner&&!ownerKey(e.code,dialog.dataset.owner))return;
      if(e.repeat&&!MENU_DIRECTIONS.includes(e.code))return;
      if (this.modal !== dialog) { this.modal = dialog; this.selection = 0; }
      const list=visibleMenuActions(dialog);if(!list.length)return;
      const current=list[this.selection],grid=current?.closest('.inventory-grid,[data-items]'),columns=grid?getComputedStyle(grid).gridTemplateColumns.split(' ').length:1;
      this.selection=menuStep(Math.min(this.selection,list.length-1),e.code,list.length,columns);
      if (["KeyQ","Backspace"].includes(e.code)) { dialog.close(); return; }
      const button = list[this.selection];
      const description=dialog.querySelector("[data-upgrade-detail]");if(description&&button.dataset.buy)description.textContent=button.title;
      for (const b of list) (b.closest(".shop-item") || b.closest(".build-option") || b.closest(".camp-card") || b).dataset.selected = String(b === button);
      if (["KeyE","Enter"].includes(e.code)) {
        if (!button.disabled) button.click();
        else if (dialog.id === "shopDialog") dialog.querySelector("[data-message]").textContent = "Пока недоступно: проверьте стоимость и уровень улучшения.";
      } else {
        const target = button.disabled ? button.closest(".shop-item")||button : button;
        target.tabIndex = -1; target.focus({ preventScroll: true }); target.scrollIntoView({block:"nearest"});
      }
      return;
    }
    this.modal = null;
    const i = ["ArrowUp","ArrowDown","ArrowLeft","ArrowRight","Enter","Backspace"].includes(e.code) ? 1 : 0, entry = this.shops.get(i);
    if (e.code === "Escape" && this.shops.size) {
      this.consume(e); for (const index of [...this.shops.keys()]) this.closeShop(index); return;
    }
    if (!entry || !["KeyW","KeyS","KeyA","KeyD","KeyE","KeyQ","ArrowUp","ArrowDown","ArrowLeft","ArrowRight","Enter","Backspace"].includes(e.code)) return;
    this.consume(e); if (this.scene.core.paused || e.repeat && !MENU_DIRECTIONS.includes(e.code)) return;
    if (["KeyQ","Backspace"].includes(e.code)) { this.closeShop(i); return; }
    entry.index=menuStep(entry.index,e.code,entry.ids.length+1,entry.site?1:2);
    if (["KeyE","Enter"].includes(e.code)) {
      if(entry.index===entry.ids.length){this.closeShop(i);return;}
      entry.buy(entry.ids[entry.index]);
    }
    this.refresh();
  }
  destroy() { document.removeEventListener("keydown", this.onKey, true); for (const i of [...this.shops.keys()]) this.closeShop(i); }
}

export function interactNearby(scene) {
  const c = scene.core, p = c.player, near = target => Math.hypot(p.x - target.x, p.y - target.y);
  if (p.room) {
    if (Math.hypot(p.room.x - ROOM.chest.x, p.room.y - ROOM.chest.y) < 90) c.camp.store(c.state.wood ? "deposit" : "withdraw");
    else c.camp.exit();
    return;
  }
  const choices = [
    ...(scene.serviceView?.targets()||[]),
    ...c.world.berryBushes.filter(b=>c.berries.ready(b)&&c.regions.isOpen(b)).map(b=>({p:b,range:100,act:()=>c.berries.harvest(b.id)})),
    {p:RECORD_BOARD,range:120,act:()=>scene.customView?.open()},
    { p: { x: CAMP.stall.x, y: CAMP.stall.y + 45 }, range: 155, act: () => scene.shop.open() },
    { p: CAMP_SERVICE.store, range: 110, act: () => { const n = c.camp.store(c.state.wood ? "deposit" : "withdraw"); c.showNotice(n ? `Склад: ${c.state.logStore.length} брёвен` : "Склад пуст или заполнен."); } },
    { p: {x:1710,y:1780}, range:100, act:()=>scene.workerUi.open() },
    ...(hasCampBuilding(c.state,"tent") ? [{ p: CAMP.tent, range:100, act:()=>c.showNotice("Палатка позволяет нанимать помощников. Для отдельной комнаты выберите хижину на платформе стройки.") }] : []),
    { p: c.sale, range:90, act:()=>scene.campDesk.open("orders") },
    ...INDUSTRY_PROJECTS.filter(p=>hasCampBuilding(c.state,p.id)).map(p=>({p:p.site,range:110,act:()=>{
      if(p.kind==="lamp"&&c.preparation.refuelLamp(p.id))c.showNotice("Фонарь заправлен углём.");
      else scene.campDesk.open(p.kind==="tower"||p.kind==="lamp"?"defense":"production");
    }})),
    { p: c.build, range:c.build.radius, act:()=>c.builder.requestChoice(true) },
    ...(hasCampBuilding(c.state,"house") ? [{ p: CAMP_SERVICE.door, range: 110, act: () => c.camp.enter() }] : []),
    ...c.exploration.sites.filter(site => !site.hideFromNearby&&c.exploration.near(site)).map(site => ({ p: site, range: 150, act: () => {
      if (site.kind === "kitchen" && c.state.wood && c.camp.stoke()) c.showNotice(`Огонь: ${Math.ceil(c.state.campFuel)} с. Можно добавлять топливо в любое время суток.`);
      else c.exploration.request(site.id);
    } })),
    ...c.world.clues.filter(site => c.accessible(site)).map(site => ({ p: site, range: 120, act: () => scene.openClue(site) })),
    ...(c.defenses?.all().filter(d => d.kind === "gate") || []).map(d => ({ p: d, range: 110, act: () => c.defenses.toggleGate(d.id) })),
    ...c.regions.frontiers().map(g => ({ p: g, range: 130, act: () => { c.setDestination(g.x,g.y); c.showNotice(g.region.unlockMode==='camp'?'Роща откроется после постройки костра и забора. Брёвна платить не нужно.':`Нужно: ${g.region.cost} брёвен, ${g.region.stoneCost} камня; лагерь ${g.region.campRequired}.`); } })),
  ];
  const choice = choices.filter(x => near(x.p) < x.range).sort((a,b) => near(a.p)-near(b.p))[0];
  if (choice) { choice.act(); return; }
  const debris = c.clearing?.all.find(d => c.clearing.near(d));
  if (debris) { if (c.orderClearing(debris.id)) c.tryClear(debris.id); }
  else if (near(CENTER) < 180) c.showNotice("Постройте костёр на голубой площадке и поддерживайте его брёвнами.");
}
