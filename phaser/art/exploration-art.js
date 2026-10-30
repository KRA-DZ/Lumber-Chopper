import { sprite } from "../../pixel-art.js";
export function createExplorationArt() {
  return {
    chestOpen: sprite(46, 44, 23, 39, (p) => {
      p.border(2, 18, 42, 22, "#354533", "#9b7143");
      p.border(3, 1, 40, 19, "#354533", "#c8a162");
      p.border(6, 4, 34, 12, "#725535", "#524736");
      p.rect(6, 19, 34, 8, "#252e28");
      for (const x of [9, 33]) {
        p.rect(x, 2, 4, 15, "#c5ba8a");
        p.rect(x, 28, 4, 10, "#c5ba8a");
      }
      p.rect(20, 29, 7, 8, "#c5ba8a");
      p.rect(7, 28, 32, 2, "#d1a667");
    }),
    rod: sprite(8, 42, 4, 40, (p) => {
      p.line(3, 40, 5, 1, "#433e2b", 3);
      p.line(4, 37, 5, 2, "#c0a36b");
      p.rect(1, 30, 5, 6, "#7d8f80");
    }),
    fish: sprite(24, 14, 12, 7, (p) => {
      p.poly(
        [
          [2, 7],
          [7, 2],
          [18, 2],
          [22, 7],
          [17, 12],
          [7, 12],
        ],
        "#2c5659",
      );
      p.rect(7, 4, 12, 5, "#a5c9af");
      p.rect(16, 4, 2, 2, "#243d40");
      p.poly(
        [
          [4, 7],
          [0, 2],
          [0, 12],
        ],
        "#c6ad6e",
      );
      p.line(8, 10, 15, 10, "#6f9d9a");
    }),
  };
}
