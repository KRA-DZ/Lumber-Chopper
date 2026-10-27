// Shared by the sprite painter and the view: tool grip and hands stay aligned.
export const HERO_WALK_FRAMES = 8;
export const STRIKE_MS = 180; // Visual only; economy and damage cadence are unchanged.
export const STRIKE_HANDS = Object.freeze({
  side: [
    [24, 20],
    [22, 15],
    [29, 27],
    [30, 30],
    [28, 32],
    [26, 30],
  ],
  down: [
    [22, 20],
    [20, 15],
    [25, 28],
    [26, 31],
    [25, 32],
    [24, 30],
  ],
  up: [
    [25, 22],
    [23, 17],
    [20, 18],
    [19, 20],
    [22, 24],
    [25, 27],
  ],
});
export const AXE_TIPS = Object.freeze({
  side: [
    [4, -23],
    [-10, -25],
    [22, -5],
    [20, 8],
    [12, 6],
    [6, -14],
  ],
  down: [
    [-12, -22],
    [-16, -27],
    [8, 14],
    [14, 9],
    [12, 4],
    [6, -12],
  ],
  up: [
    [14, -12],
    [9, -24],
    [-5, -31],
    [0, -24],
    [3, -18],
    [6, -12],
  ],
});
export const heroDirection = (direction) =>
  direction === "up"
    ? "up"
    : direction === "left" || direction === "right"
      ? "side"
      : "down";
