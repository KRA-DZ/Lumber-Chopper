import { CENTER } from "./config.js";
import { CAMP,CAMP_HUB } from "./camp-layout.js";
import { hasCampBuilding } from "./camp-projects.js";
import { campFuelLimit, campStorageLimit, industryLevel } from "./camp-industry-config.js";

export const CAMP_SERVICE = Object.freeze({
  store: CAMP_HUB.store, door: { x: CAMP.hut.x, y: CAMP.hut.y + 28 },
  shopDoor:{x:CAMP.stall.x,y:CAMP.stall.y+45},
  fuelPerLog: 60, maxFuel: 600, storeLimit: 400,
  fuelPad: {x:1696,y:1616,radius:32}, fuelPadSeconds:0.8, // Стоя на площадке: одно бревно за 0,8 с, только если помещаются все 60 с топлива.
  storagePad: CAMP_HUB.storagePad, // Stand here to unload all material types into the shared warehouse.
});
export const ROOM = Object.freeze({width:640,height:448,exit:{x:320,y:412},chest:{x:100,y:175},
  seller:{x:320,y:150},manager:{x:500,y:170},bed:{x:180,y:230}});

// Shared fuel/storage; personal location and indoor movement. No renderer owns resources.
export function createCampServices({ state, player, forestry, canAct, nav, party=null, emit = () => {} }) {
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
    const atChest = player.room && (player.room.id||'house')==='house' && Math.hypot(player.room.x - ROOM.chest.x, player.room.y - ROOM.chest.y) < 90;
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
  const members=()=>party?.actors.length?party.actors:[{state,player,nav}];
  const roomKind=p=>p.room?.id||'house';
  const nearRoom=p=>player.room&&Math.hypot(player.room.x-p.x,player.room.y-p.y)<90;
  function enter(kind='house') {
    if(!['house','shop'].includes(kind)||!canAct()||player.room||(player.portalCooldown||0)>0||kind==='house'&&!hasCampBuilding(state,'house')||!near(kind==='shop'?CAMP_SERVICE.shopDoor:CAMP_SERVICE.door))return false;
    const group=members();
    if(group.some(a=>a.player.menuOpen||state.sawmill?.cart.owner===(a.player.id??0)))return false;
    group.forEach((a,i)=>{a.clearKeys?.();a.player.path=[];a.player.moving=false;a.player.portalCooldown=.6;
      a.player.room={id:kind,x:ROOM.exit.x+(i?28:-28),y:ROOM.exit.y-90};});
    emit('camp-room-entered',{room:kind});return true;
  }
  function exit() {
    if(!living()||!player.room||Math.hypot(player.room.x-ROOM.exit.x,player.room.y-ROOM.exit.y)>70)return false;
    const kind=roomKind(player),group=members(),door=kind==='shop'?CAMP_SERVICE.shopDoor:CAMP_SERVICE.door;
    if(group.some(a=>a.player.menuOpen))return false;
    group.filter(a=>a.player.room&&roomKind(a.player)===kind).forEach((a,i)=>{
      a.clearKeys?.();a.player.room=null;a.player.portalCooldown=.6;
      Object.assign(a.player,a.nav.nearestGround(door.x+(i?22:-22),door.y+42),{path:[],moving:false});
    });emit('camp-room-left',{room:kind});return true;
  }
  function updateEntrance(dt){
    player.portalCooldown=Math.max(0,(player.portalCooldown||0)-dt);
    if(!canAct()||player.room||player.portalCooldown>0)return;
    if(Math.hypot(player.x-CAMP_SERVICE.shopDoor.x,player.y-CAMP_SERVICE.shopDoor.y)<20)enter('shop');
    else if(hasCampBuilding(state,'house')&&Math.hypot(player.x-CAMP_SERVICE.door.x,player.y-CAMP_SERVICE.door.y)<20)enter();
  }
  function moveRoom(dt, keys) {
    if (!player.room || !living()) return;
    player.portalCooldown=Math.max(0,(player.portalCooldown||0)-dt);
    let dx = Number(keys.has("KeyD") || keys.has("ArrowRight")) - Number(keys.has("KeyA") || keys.has("ArrowLeft")),
      dy = Number(keys.has("KeyS") || keys.has("ArrowDown")) - Number(keys.has("KeyW") || keys.has("ArrowUp"));
    const p = player.room;
    let len = Math.hypot(dx,dy), speed = state.runSpeed * dt;
    if (len) p.target = null;
    else if (p.target) { dx=p.target.x-p.x;dy=p.target.y-p.y;len=Math.hypot(dx,dy);speed=Math.min(speed,len);if(len<2){p.target=null;len=0;} }
    player.moving = len > 0; p.moving = len > 0;
    p.restStill=len?0:Math.min(3,(p.restStill||0)+dt);
    if(roomKind(player)==='house'&&Math.hypot(p.x-ROOM.bed.x,p.y-ROOM.bed.y)<110&&p.restStill>=3&&industryLevel(state,"house")>0){
      p.restTimer=(p.restTimer||0)+dt;
      while(p.restTimer>=1){p.restTimer--;state.health=Math.min(state.maxHealth,state.health+industryLevel(state,"house")*2);}
    }else p.restTimer=0;
    if (!len) return;
    const boxes=roomKind(player)==='shop'?[[220,172,200,30],[65,148,80,32],[490,160,65,30]]:
      [[65,150,70,25],[420,195,155,25],[ROOM.bed.x-48,ROOM.bed.y-96,96,128],[47,310,96,25]];
    const free=(x,y)=>!boxes.some(([bx,by,w,h])=>x>bx-10&&x<bx+w+10&&y>by-8&&y<by+h+8);
    const nx=Math.max(30,Math.min(ROOM.width-30,p.x+dx/len*speed)),ny=Math.max(100,Math.min(ROOM.height-28,p.y+dy/len*speed));
    if(free(nx,p.y))p.x=nx;if(free(p.x,ny))p.y=ny;
    if(player.portalCooldown<=0&&Math.hypot(p.x-ROOM.exit.x,p.y-ROOM.exit.y)<22){exit();return;}
    player.direction = Math.abs(dx) > Math.abs(dy) ? dx < 0 ? "left" : "right" : dy < 0 ? "up" : "down";
  }
  function update(dt) {
    const before = lit(); state.campFuel = Math.max(0, state.campFuel - dt);
    if (before && !lit()) emit("camp-extinguished", {});
    if (before && state.campFuel <= 30 && state.campFuel + dt > 30) emit("camp-low-fuel", {});
  }
  return { near, lit, stoke, store, enter, exit, moveRoom, update, updateEntrance, nearRoom,
    atSeller:()=>roomKind(player)==='shop'&&nearRoom(ROOM.seller),
    atManager:()=>roomKind(player)==='house'&&nearRoom(ROOM.manager),
    atChest:()=>roomKind(player)==='house'&&nearRoom(ROOM.chest),
    atFuelPad, updateFuelPad,
    get fuelPadProgress(){return fuelPadTimer/CAMP_SERVICE.fuelPadSeconds;},
    maxFuel:()=>campFuelLimit(state),storageLimit:()=>campStorageLimit(state) };
}
