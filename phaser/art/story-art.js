import { sprite } from "../../pixel-art.js";
// A small, purely decorative contract plaque beside the fire; no new collision or light source.
export function createStoryArt() {
  return {
    campSeal: sprite(23, 38, 11, 35, (p) => {
      p.rect(9, 8, 5, 28, "#3b4331");
      p.rect(10, 9, 2, 26, "#a28350");
      p.border(2, 2, 19, 24, "#4c4532", "#d2bf8a");
      p.rect(4, 4, 15, 19, "#e6d3a0");
      p.rect(8, 8, 7, 2, "#7c6350");
      p.rect(6, 10, 2, 7, "#7c6350");
      p.rect(15, 10, 2, 7, "#7c6350");
      p.rect(8, 17, 7, 2, "#7c6350");
      p.rect(9, 21, 5, 2, "#806853");
      p.rect(7, 35, 10, 2, "#4c4532");
    }),
  };
}
