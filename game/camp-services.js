import { CENTER } from "./config.js";
import { CAMP } from "./camp-layout.js";
import { hasCampBuilding } from "./camp-projects.js";
import { campFuelLimit, campStorageLimit, industryLevel } from "./camp-industry-config.js";

export const CAMP_SERVICE = Object.freeze({
  store: { x: 1480, y: 1740 }, door: { x: CAMP.hut.x, y: CAMP.hut.y + 28 },
  fuelPerLog: 60, maxFuel: 600, storeLimit: 400,
  fuelPad: {x:1696,y:1616,radius:32}, fuelPadSeconds:0.8, // Стоя на площадке: одно бревно за 0,8 с, только если помещаются все 60 с топлива.
});
export const ROOM = Object.freeze({ width: 480, height: 352, exit: { x: 240, y: 316 }, chest: { x: 100, y: 130 } });

// Shared fuel/storage; personal location and indoor movement. No renderer owns resources.
export function createCampServices({ state, player, forestry, canAct, nav, emit = () => {} }) {
  let fuelPadTimer=0;
  const near = p => Math.hypot(player.x - p.x, player.y - p.y) < 110 && nav.hasLineOfSight(player, p);
  const living = () => state.health > 0 && !state.gameOver;
  const lit = () => hasCampBuilding(state,"fire") && state.campFuel > 0;
  const atFuelPad=()=>Math.hypot(player.x-CAMP_SERVICE.fuelPad.x,player.y-CAMP_SERVICE.fuelPad.y)<=CAMP_SERVICE.fuelPad.radius&&nav.hasLineOfSight(player,{x:CENTER.x,y:CENTER.y+48});
  function stoke(quoted = false, material = "wood") {
    const seconds=material==="coal"?180:CAMP_SERVICE.fuelPerLog;
    if (!['wood','coal'].includes(material) || !(quoted ? living() : canAct()) || !(near({x:CENTER.x,y:CENTER.y+48})||atFuelPad()) || !hasCampBuilding(state,"fire") ||
      (material==="wood"?!state.wood:!(state.campIndustry?.materials.coal>0)) || state.campFuel > campFuelLimit(state)-seconds) return false;
    if(material==="wood")forestry.takeCargo();else state.campIndustry.materials.coal--;
    state.campFuel += seconds;
    state.campMilestones.lit=true;
    emit("camp-stoked", {}); return true;
  }
  function updateFuelPad(dt){
    if(!Number.isFinite(dt)||dt<=0)return;
    if(!canAct()||!atFuelPad()||!hasCampBuilding(state,"fire")||!state.wood||state.campFuel>campFuelLimit(state)-CAMP_SERVICE.fuelPerLog){fuelPadTimer=0;return;}
    fuelPadTimer+=dt;
    if(fuelPadTimer>=CAMP_SERVICE.fuelPadSeconds){fuelPadTimer=0;stoke();}
  }
  function store(action = "deposit") {
    const atChest = player.room && Math.hypot(player.room.x - ROOM.chest.x, player.room.y - ROOM.chest.y) < 90;
    if (!living() || (player.room ? !atChest : !canAct() || !near(CAMP_SERVICE.store))) return 0;
    let n = 0;
    if (action === "deposit") {
      while (state.wood && state.logStore.length < campStorageLimit(state)) { state.logStore.push(forestry.takeCargo()); n++; }
    } else if (action === "withdraw") {
      while (state.logStore.length && state.wood < state.maxWood) {
        if (!forestry.addCargo(state.logStore.at(-1))) break;
        state.logStore.pop(); n++;
      }
    }
    if (n) emit("storage-changed", { count: n, action });
    return n;
  }
  function enter() {
    if(state.sawmill?.cart.owner===(player.id??0))return false;
    if (!canAct() || !hasCampBuilding(state,"house") || !near(CAMP_SERVICE.door)) return false;
    player.path = []; player.room = { x: ROOM.exit.x, y: ROOM.exit.y - 32 };
    emit("house-entered", {}); return true;
  }
  function exit() {
    if (!living() || !player.room || Math.hypot(player.room.x - ROOM.exit.x, player.room.y - ROOM.exit.y) > 70) return false;
    player.room = null; Object.assign(player, nav.nearestGround(CAMP_SERVICE.door.x, CAMP_SERVICE.door.y + 32), { path: [] });
    emit("house-left", {}); return true;
  }
  function moveRoom(dt, keys) {
    if (!player.room || !living()) return;
    let dx = Number(keys.has("KeyD") || keys.has("ArrowRight")) - Number(keys.has("KeyA") || keys.has("ArrowLeft")),
      dy = Number(keys.has("KeyS") || keys.has("ArrowDown")) - Number(keys.has("KeyW") || keys.has("ArrowUp"));
    const p = player.room;
    let len = Math.hypot(dx,dy), speed = state.runSpeed * dt;
    if (len) p.target = null;
    else if (p.target) { dx=p.target.x-p.x;dy=p.target.y-p.y;len=Math.hypot(dx,dy);speed=Math.min(speed,len);if(len<2){p.target=null;len=0;} }
    player.moving = len > 0; p.moving = len > 0;
    p.restStill=len?0:Math.min(3,(p.restStill||0)+dt);
    if(p.restStill>=3&&industryLevel(state,"house")>0){
      p.restTimer=(p.restTimer||0)+dt;
      while(p.restTimer>=1){p.restTimer--;state.health=Math.min(state.maxHealth,state.health+industryLevel(state,"house")*2);}
    }else p.restTimer=0;
    if (!len) return;
    p.x = Math.max(30, Math.min(ROOM.width - 30, p.x + dx / len * speed));
    p.y = Math.max(100, Math.min(ROOM.height - 28, p.y + dy / len * speed));
    player.direction = Math.abs(dx) > Math.abs(dy) ? dx < 0 ? "left" : "right" : dy < 0 ? "up" : "down";
  }
  function update(dt) {
    const before = lit(); state.campFuel = Math.max(0, state.campFuel - dt);
    if (before && !lit()) emit("camp-extinguished", {});
    if (before && state.campFuel <= 30 && state.campFuel + dt > 30) emit("camp-low-fuel", {});
  }
  return { near, lit, stoke, store, enter, exit, moveRoom, update, atFuelPad, updateFuelPad,
    get fuelPadProgress(){return fuelPadTimer/CAMP_SERVICE.fuelPadSeconds;},
    maxFuel:()=>campFuelLimit(state),storageLimit:()=>campStorageLimit(state) };
}
