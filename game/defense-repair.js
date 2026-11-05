export const DEFENSE_REPAIR = Object.freeze({
  range: 78,
  holdSeconds: 0.6, // One cargo log per completed hold; releasing loses only unfinished progress.
});

// Temporary input state, separate from automatic construction orders and saved economy.
export function createDefenseRepair({ canAct, get, near, hasCargo, deposit }) {
  let target = null,
    held = false,
    progress = 0;
  function cancel() {
    target = null;
    held = false;
    progress = 0;
  }
  return {
    start(id) {
      const section = get(id);
      if (
        !canAct() ||
        !section ||
        section.hp >= section.maxHP ||
        !near(section)
      )
        return false;
      if (target !== id || !held) progress = 0;
      target = id;
      held = true;
      return true;
    },
    release() {
      held = false;
      progress = 0;
    },
    cancel,
    update(dt) {
      if (!Number.isFinite(dt) || dt <= 0 || !target) return;
      const section = get(target);
      if (
        !canAct() ||
        !section ||
        !near(section) ||
        section.hp >= section.maxHP
      ) {
        cancel();
        return;
      }
      if (!held || !hasCargo()) {
        progress = 0;
        return;
      }
      progress = Math.min(DEFENSE_REPAIR.holdSeconds, progress + dt);
      if (progress + 1e-9 >= DEFENSE_REPAIR.holdSeconds && deposit(target)) {
        progress = 0;
        if (get(target)?.hp >= section.maxHP) cancel();
      }
    },
    get target() {
      return target;
    },
    get snapshot() {
      return target
        ? { id: target, held, progress: progress / DEFENSE_REPAIR.holdSeconds }
        : null;
    },
  };
}
