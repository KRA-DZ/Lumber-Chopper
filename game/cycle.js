import { DAY_SECONDS } from "./config.js";
export const NIGHT_START = DAY_SECONDS / 2; // 18:00; рассвет — 06:00 на границе суток.
export function createCycleManager(state, emit = () => {}) {
  let observedNight = state.worldTime >= NIGHT_START;
  return {
    get dayNumber() {
      return state.calendarDay;
    },
    get isNight() {
      return state.worldTime >= NIGHT_START;
    },
    update(dt) {
      if (!Number.isFinite(dt) || dt <= 0) return;
      while (dt > 1e-9) {
        const night = state.worldTime >= NIGHT_START;
        if (night) observedNight = true;
        const boundary = night ? DAY_SECONDS : NIGHT_START;
        const step = Math.min(dt, boundary - state.worldTime);
        state.worldTime += step;
        dt -= step;
        if (state.worldTime < boundary - 1e-9) break;
        if (night) {
          state.worldTime = 0;
          state.calendarDay++;
          if (observedNight) state.nightsSurvived++;
          observedNight = false;
          emit("day-started", {
            day: state.calendarDay + 1,
            nightsSurvived: state.nightsSurvived,
          });
        } else {
          state.worldTime = NIGHT_START;
          observedNight = true;
          emit("night-started", { night: state.calendarDay + 1 });
        }
      }
    },
  };
}
