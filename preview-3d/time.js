export const DAY_SECONDS = 1200; // Сутки — 20 минут. Начало шкалы соответствует 06:00.
export const normalizedTime = (value) =>
  Number.isFinite(value)
    ? ((value % DAY_SECONDS) + DAY_SECONDS) % DAY_SECONDS
    : 240;
export const shopOpen = (time) =>
  time / DAY_SECONDS >= 0.06 && time / DAY_SECONDS < 0.5;
export const nightAmount = (time) =>
  Math.max(
    0,
    Math.min(1, (0.25 - Math.sin((time / DAY_SECONDS) * Math.PI * 2)) / 1.25),
  );
export function clockText(time) {
  const minutes = Math.floor(((time / DAY_SECONDS) * 1440 + 360) % 1440);
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}
