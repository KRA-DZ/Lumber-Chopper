import { regionAt } from "./regions.js";
import { minionHuntNight } from "./minions.js";

export function createLocalParty(emit) {
  const actors = [];
  let fallback, target;
  const current = () => target || actors[0] || fallback;
  const facade = key => new Proxy({}, {
    get: (_, prop) => current()?.[key][prop],
    set(_, prop, value) { current()[key][prop] = value; return true; },
  });
  const party = {
    actors, player: facade("player"), state: facade("state"),
    bind(state, player) { fallback = { state, player }; },
    focus(actor) { target = actor; },
    select(enemy) {
      let candidates = actors.filter(a => a.state.health > 0 && !a.player.room);
      if (!candidates.length) return;
      if (enemy.kind === "resident" && (enemy.tier === "boss" || !minionHuntNight(actors[0].state))) {
        const home = candidates.filter(a => regionAt(a.player.x, a.player.y)?.id === enemy.regionId);
        if (home.length) candidates = home;
      }
      const unsafe = candidates.filter(a => !actors[0].survival?.isSafe(a.player));
      if (unsafe.length) candidates = unsafe;
      const locked = (enemy.attack || enemy.phase === "windup" || enemy.phase === "strike") &&
        candidates.find(a => a.player.id === enemy.targetPlayerId);
      target = locked || candidates.reduce((a, b) =>
        Math.hypot(a.player.x - enemy.x, a.player.y - enemy.y) <
        Math.hypot(b.player.x - enemy.x, b.player.y - enemy.y) ? a : b);
      enemy.targetPlayerId = target.player.id;
    },
    positions() { return actors.filter(a => a.state.health > 0 && !a.player.room).map(a => a.player); },
    tick(dt) { for (const a of actors) a.player.hitCooldown = Math.max(0, (a.player.hitCooldown || 0) - dt); },
    hurt(amount, source) {
      const a = current();
      if (!a || a.player.room || a.state.health <= 0 || a.player.hitCooldown > 0 || a.state.gameOver) return;
      a.state.health = Math.max(0, a.state.health - amount);
      a.player.hitCooldown = 1.4;
      emit("player-hurt", { actor: a.player.id, health: a.state.health, damage: amount, source });
      if (!a.state.health) {
        a.clearKeys(); a.exploration.cancelAll(); a.player.moving = false;
        emit("player-down", { actor: a.player.id });
        if (actors.every(p => p.state.health <= 0)) actors[0].defeat("Оба игрока повержены. Попробуйте снова и держитесь вместе.");
      }
    },
    dawn() { for (const a of actors) if (a.state.health > 0) { a.state.health = a.state.maxHealth; a.player.hitCooldown = 0; } },
    reward(coins) { actors.forEach((a, i) => { a.state.coins += Math.floor(coins / actors.length) + (i < coins % actors.length ? 1 : 0); }); },
    sale(coins) { for (const a of actors) a.state.coins += coins; },
    blast(point, radius, amount) {
      for (const a of actors) if (a.state.health > 0 && Math.hypot(a.player.x - point.x, a.player.y - point.y) < radius) {
        target = a; party.hurt(amount, "minion");
      }
    },
  };
  return party;
}
