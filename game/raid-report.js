import { RAID_INTERVAL } from "./config.js";
import { DEFENSE } from "./defenses.js";

// A single in-memory report. Records events until dawn, including local enemies after the wave.
export function createRaidReports(state, defenses) {
  let active = null;
  return {
    begin(night) {
      active =
        night % RAID_INTERVAL === 0
          ? {
              night,
              campDamage: 0,
              defenseDamage: 0,
              minions: 0,
              bosses: 0,
              destroyed: new Set(),
              defeated: new Set(),
            }
          : null;
    },
    record(type, event) {
      if (!active) return;
      if (type === "camp-hurt") active.campDamage += event.damage;
      if (
        type === "defense-changed" &&
        event.action === "damage" &&
        event.section.kind !== "trap"
      ) {
        active.defenseDamage += event.previousHP - event.section.hp;
        if (!event.section.hp) active.destroyed.add(event.section.id);
      }
      if (type === "enemy-defeated" && !active.defeated.has(event.id)) {
        active.defeated.add(event.id);
        if (event.kind === "minion") active.minions++;
        if (event.kind === "boss") active.bosses++;
      }
    },
    finish(wave, survived) {
      if (!active) return null;
      const damaged = (defenses()?.all() || [])
        .filter(
          (s) =>
            s.kind !== "trap" &&
            s.hp < s.maxHP &&
            (s.kind === "fence" || Object.hasOwn(state.defenseHP, s.id)),
        )
        .map((s) => ({
          id: s.id,
          name: s.name,
          hp: s.hp,
          maxHP: s.maxHP,
          logs:
            !s.hp && s.kind !== "fence"
              ? s.cost - s.wood
              : Math.ceil((s.maxHP - s.hp) / DEFENSE.repairPerLog),
        }));
      const report = {
        night: active.night,
        survived,
        status: wave?.status || "withdrawn",
        spawned: wave?.spawned || 0,
        killed: wave?.killed || 0,
        escaped: wave?.escaped || 0,
        reward: wave?.reward || 0,
        minions: active.minions,
        bosses: active.bosses,
        campDamage: active.campDamage,
        defenseDamage: active.defenseDamage,
        brokenSections: active.destroyed.size,
        campHealth: state.campHealth,
        maxCampHealth: state.maxCampHealth,
        damaged,
        repairLogs: damaged.reduce(
          (n, s) => n + s.logs,
          Math.ceil(
            (state.maxCampHealth - state.campHealth) / DEFENSE.repairPerLog,
          ),
        ),
      };
      active = null;
      state.lastRaidReport = report;
      return report;
    },
  };
}
