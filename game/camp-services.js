import { CENTER } from "./config.js";
import { CAMP } from "./camp-layout.js";

export const CAMP_SERVICE = Object.freeze({
  store: { x: 1480, y: 1740 }, door: { x: CAMP.hut.x, y: CAMP.hut.y + 28 },
  fuelPerLog: 60, startingFuel: 240, maxFuel: 600, storeLimit: 400,
});
export const ROOM = Object.freeze({ width: 480, height: 352, exit: { x: 240, y: 316 }, chest: { x: 100, y: 130 } });

// Shared fuel/storage; personal location and indoor movement. No renderer owns resources.
export function createCampServices({ state, player, forestry, canAct, nav, emit = () => {} }) {
  const near = p => Math.hypot(player.x - p.x, player.y - p.y) < 110 && nav.hasLineOfSight(player, p);
  const living = () => state.health > 0 && !state.gameOver;
  const lit = () => state.campLevel > 0 && state.campFuel > 0;
  function stoke(quoted = false) {
    if (!(quoted ? living() : canAct()) || !near({x:CENTER.x,y:CENTER.y+48}) || state.campLevel < 1 || !state.wood || state.campFuel > CAMP_SERVICE.maxFuel - CAMP_SERVICE.fuelPerLog) return false;
    forestry.takeCargo(); state.campFuel += CAMP_SERVICE.fuelPerLog;
    emit("camp-stoked", {}); return true;
  }
  function store(action = "deposit") {
    const atChest = player.room && Math.hypot(player.room.x - ROOM.chest.x, player.room.y - ROOM.chest.y) < 90;
    if (!living() || (player.room ? !atChest : !canAct() || !near(CAMP_SERVICE.store))) return 0;
    let n = 0;
    if (action === "deposit") {
      while (state.wood && state.logStore.length < CAMP_SERVICE.storeLimit) { state.logStore.push(forestry.takeCargo()); n++; }
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
    if (!canAct() || state.campLevel !== 4 || !near(CAMP_SERVICE.door)) return false;
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
  return { near, lit, stoke, store, enter, exit, moveRoom, update };
}
