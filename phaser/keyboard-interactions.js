import { SHOP_IDS, upgradeOffer } from "../economy.js";
import { shopProgress } from "./shop-progress.js";
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
    const list=document.createElement("div"),detail=document.createElement("p");panel.append(list,detail);
    const entry = { panel, info, list, detail, rows, index: 0, actor: a, site,
      buy: id => site ? a.exploration.perform(site.id,id) : a.purchaseUpgrade(id) }; this.shops.set(i, entry);
    if(site)panel.dataset.merchant=site.id;
    const help = document.createElement("p");
    help.textContent = i ? "↑/↓ выбор · Enter купить · Backspace закрыть. Мир продолжает жить." : "W/S выбор · E купить · Q закрыть. Мир продолжает жить.";
    const close = document.createElement("button"); close.textContent = "Закрыть"; close.onclick = () => this.closeShop(i);
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
      e.index=Math.min(e.index,offers.length-1);
      offers.forEach((o,j)=>{const b=e.rows[j];if(b.textContent!==o.text)b.textContent=o.text;
        if(!e.site)b.append(shopProgress(upgradeOffer(s,o.id)));
        b.dataset.selected=String(j===e.index);b.setAttribute("aria-disabled",String(!o.enabled));});
      e.detail.textContent=offers[e.index]?.description||"";
    }
  }
  handle(e) {
    const dialog = document.querySelector("dialog[open]");
    if (dialog && dialog.id !== "heroDialog") {
      if (!["KeyW","KeyS","ArrowUp","ArrowDown","KeyE","Enter","KeyQ"].includes(e.code)) return;
      this.consume(e); if (e.repeat && !["KeyW","KeyS","ArrowUp","ArrowDown"].includes(e.code)) return;
      if (this.modal !== dialog) { this.modal = dialog; this.selection = 0; }
      const actions = [...dialog.querySelectorAll(dialog.id === "shopDialog" ? "[data-buy]" : "button:not([disabled])")].filter(b => b.offsetParent !== null),
        primary = actions.filter(b => !b.matches("[data-close],[data-activity-close],[data-journal-close],[data-menu-close],[data-build-close],[data-camp-close],[data-worker-close]"));
      const list = primary.length ? primary : actions; if (!list.length) return;
      if (["KeyS","ArrowDown"].includes(e.code)) this.selection++;
      if (["KeyW","ArrowUp"].includes(e.code)) this.selection--;
      this.selection = (this.selection + list.length) % list.length;
      if (e.code === "KeyQ") { dialog.close(); return; }
      const button = list[this.selection];
      for (const b of list) (b.closest(".shop-item") || b.closest(".build-option") || b.closest(".camp-card") || b).dataset.selected = String(b === button);
      if (["KeyE","Enter"].includes(e.code)) {
        if (!button.disabled) button.click();
        else if (dialog.id === "shopDialog") dialog.querySelector("[data-message]").textContent = "Пока недоступно: проверьте стоимость и уровень улучшения.";
      } else {
        const target = button.disabled ? button.closest(".shop-item") : button;
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
    this.consume(e); if (this.scene.core.paused || e.repeat && !["KeyW","KeyS","ArrowUp","ArrowDown"].includes(e.code)) return;
    if (["KeyQ","Backspace"].includes(e.code)) { this.closeShop(i); return; }
    if (["KeyW","ArrowUp"].includes(e.code)) entry.index = (entry.index + entry.ids.length - 1) % entry.ids.length;
    if (["KeyS","ArrowDown"].includes(e.code)) entry.index = (entry.index + 1) % entry.ids.length;
    if (["KeyE","Enter"].includes(e.code)) entry.buy(entry.ids[entry.index]);
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
    ...c.regions.frontiers().map(g => ({ p: g, range: 130, act: () => { c.setDestination(g.x,g.y); c.showNotice(`Нужно: ${g.region.cost} брёвен, ${g.region.stoneCost} камня; лагерь ${g.region.campRequired}.`); } })),
  ];
  const choice = choices.filter(x => near(x.p) < x.range).sort((a,b) => near(a.p)-near(b.p))[0];
  if (choice) { choice.act(); return; }
  const debris = c.clearing?.all.find(d => c.clearing.near(d));
  if (debris) { if (c.orderClearing(debris.id)) c.tryClear(debris.id); }
  else if (near(CENTER) < 180) c.showNotice("Постройте костёр на голубой площадке и поддерживайте его брёвнами.");
}
