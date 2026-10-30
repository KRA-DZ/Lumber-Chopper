import { sprite } from "../../pixel-art.js";
export function createWorkerArt() {
  return {
    depot: sprite(64, 40, 32, 36, (p) => {
      p.border(2, 25, 60, 12, "#534431", "#b58b50");
      for (let i = 0; i < 6; i++) {
        const x = 6 + i * 9;
        p.rect(x, 26, 6, 7, i % 2 ? "#dbb475" : "#c59c5f");
        p.rect(x + 2, 27, 2, 4, "#725038");
      }
      p.rect(4, 6, 3, 26, "#735735");
      p.border(0, 1, 31, 17, "#443e2e", "#d6bd84");
      p.rect(6, 6, 18, 6, "#8f633c");
      p.rect(7, 7, 3, 4, "#e3bc7c");
      p.rect(26, 22, 3, 5, "#677842");
      p.rect(27, 18, 1, 6, "#677842");
    }),
  };
}
