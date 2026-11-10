import { pixelHash } from "../pixel-art.js";

// Shared HP mutation for players and workers; only the final successful hit produces a yield.
export function strikeBoulder(state,rock,power){
  const hp=state.boulderHP[rock.id]??rock.maxHP;
  if(hp<=0||!Number.isFinite(power)||power<=0)return null;
  state.boulderHP[rock.id]=Math.max(0,hp-power);
  return {damage:Math.min(hp,power),depleted:state.boulderHP[rock.id]===0};
}

export function makeBoulders(region, reserved) {
  if (region.id === "0:0") return [];
  const list = [];
  for (let i = 0; i < 32 && list.length < 8; i++) {
    const x = region.x + 140 + pixelHash(i + region.gx * 43, region.gy + 11) % 1640,
      y = region.y + 140 + pixelHash(region.gx + 19, i + region.gy * 31) % 1640;
    if (reserved(x, y, region) || list.some(p => Math.hypot(p.x-x,p.y-y) < 150)) continue;
    list.push({ id: `stone:${region.id}:${i}`, x, y, regionId: region.id, maxHP: 12, yield: 8, radius: 26 });
  }
  return list;
}
export function createMining({ state, player, world, nav, canAct, emit = () => {} }) {
  let day = state.calendarDay;
  const capacity = () => 40 + state.carryLevel * 10;
  function update() {
    if (day !== state.calendarDay) { state.boulderHP = {}; day = state.calendarDay; nav.rebuildObstacles(); }
  }
  function hit(id, mode = "active") {
    const rock = world.boulders?.find(r => r.id === id), timer = mode === "auto" ? "autoTimer" : "clickTimer";
    const d = rock ? Math.max(1,Math.hypot(player.x-rock.x,player.y-rock.y)) : 1,
      surface = rock && { x: rock.x+(player.x-rock.x)/d*(rock.radius+16), y:rock.y+(player.y-rock.y)/d*(rock.radius+16) };
    if (!canAct() || !["auto", "active"].includes(mode) || !rock || !world.regions.isOpen(rock) ||
      d > 90 || !nav.hasLineOfSight(player, surface) ||
      player[timer] > 0 || state.stone > capacity() - rock.yield) return false;
    const hp = state.boulderHP[id] ?? rock.maxHP;
    if (hp <= 0) return false;
    player[timer] = mode === "auto" ? state.autoInterval : state.clickInterval;
    const hit=strikeBoulder(state,rock,state.axePower);
    player.swing = .32;
    emit("mining-hit", { rock, damage: state.axePower });
    if (hit.depleted) { state.stone += rock.yield; state.campMilestones.mined=true; nav.rebuildObstacles(); emit("stone-collected", { rock, count: rock.yield }); }
    return true;
  }
  return { capacity, hit, update };
}
