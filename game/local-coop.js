import { createSimulation } from "./simulation.js";
import { createLocalParty } from "./local-party.js";

export function createLocalCoop(options = {}) {
  const emit = options.emit || (() => {}), party = createLocalParty(emit), actors = party.actors;
  for (let i = 0; i < 2; i++) {
    const choice=options.heroChoices?.[i];
    const appearance = choice?.appearance || (i ? options.appearance === "woodcutter" ? "traveler" : "woodcutter" : options.appearance);
    const colors=choice?.colors || (i?null:options.colors);
    const core = createSimulation({ ...options, appearance, colors, regional: true, party, shared: actors[0] || null,
      emit: (type, event) => emit(type, { actor: i, ...event }) });
    core.player.id = i; core.player.x += i ? 34 : -34;
    core.state.priceMultiplier = 1.75;
    actors.push(core);
  }
  let focus = 0, versions = actors.map(a => a.nav.version);
  const viewState = new Proxy(actors[0].state, {
    get: (_, key) => actors[focus].state[key],
    set(_, key, value) { actors[focus].state[key] = value; return true; },
  });
  const assist = new Set(), progress = [0, 0];
  function syncNavigation() {
    if (!actors.some((a, i) => a.nav.version !== versions[i])) return;
    for (const a of actors) {
      a.refreshWorld();
      if (!a.nav.isWalkable(a.player.x, a.player.y)) Object.assign(a.player, a.nav.nearestGround(a.player.x, a.player.y));
    }
    versions = actors.map(a => a.nav.version);
  }
  function helpTarget(i) {
    const other = actors[1 - i], a = actors[i];
    return a.state.health > 0 && other.state.health <= 0 &&
      Math.hypot(a.player.x - other.player.x, a.player.y - other.player.y) < 100 &&
      a.nav.clearSegment(a.player, other.player) ? other : null;
  }
  const session = {
    coop: true, actors, party,
    get state() { return viewState; },
    get activeActor() { return focus; },
    focus(i) { if (i === 0 || i === 1) focus = i; },
    withActor(i, action) { const old = focus; focus = i; try { return action(actors[i]); } finally { focus = old; } },
    get paused() { return actors[0].paused; },
    set paused(value) { for (const a of actors) a.paused = value; if (value) { assist.clear(); progress.fill(0); } },
    get elapsed() { return actors[0].elapsed; },
    get dayNumber() { return actors[0].dayNumber; },
    get cycle() { return actors[0].cycle; },
    get world() { return actors[0].world; },
    get notice() { return actors[focus].notice || actors[1 - focus].notice; },
    helpTarget,
    assist(i, held) { if (held) assist.add(i); else { assist.delete(i); progress[i] = 0; } },
    helpProgress(i) { return progress[i] / 3; },
    clearKeys() { for (const a of actors) a.clearKeys(); assist.clear(); progress.fill(0); },
    update(dt) {
      if (!Number.isFinite(dt) || dt <= 0 || session.paused || actors[0].state.gameOver) return;
      while (dt > 1e-9 && !session.paused && !actors[0].state.gameOver) {
        const step = Math.min(.05, dt);
        party.tick(step);
        party.focus(actors[0]); actors[0].update(step); syncNavigation();
        actors[1].stepActor(step); syncNavigation();
        if (actors[focus].state.health <= 0 && actors[1 - focus].state.health > 0) focus = 1 - focus;
        for (let i = 0; i < 2; i++) {
          const target = helpTarget(i), a = actors[i];
          progress[i] = assist.has(i) && target && !a.player.moving && !(a.player.hitCooldown > 0) ? progress[i] + step : 0;
          if (progress[i] >= 3 - 1e-9) {
            target.state.health = Math.ceil(target.state.maxHealth * .35);
            target.player.hitCooldown = 2;
            assist.delete(i); progress[i] = 0;
            emit("player-revived", { actor: target.player.id });
          }
        }
        dt -= step;
      }
    },
  };
  return new Proxy(session, {
    get(own, key) {
      const owner = key in own ? own : actors[focus], value = owner[key];
      return typeof value === "function" ? value.bind(owner) : value;
    },
    set(own, key, value) { (key in own ? own : actors[focus])[key] = value; return true; },
  });
}
