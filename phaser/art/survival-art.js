import { sprite } from "../../pixel-art.js";
// Original temporary pixel silhouettes, baked once into the shared atlas on startup.
export function createSurvivalArt() {
  const out = {};
  for (let frame = 0; frame < 2; frame++) {
    out[`watcher${frame}`] = sprite(70, 104, 35, 98, (p) => {
      const dark = "#17262c",
        edge = "#38483e",
        bark = "#6a7358",
        ivory = "#bfbd91";
      for (const sign of [-1, 1]) {
        const x = 35 + sign * 8;
        p.line(x, 33, x + sign * 13, 17, bark, 4);
        p.line(x + sign * 13, 17, x + sign * 16, 3, bark, 3);
        p.line(x + sign * 12, 19, x + sign * 25, 13, ivory, 2);
        p.line(x + sign * 17, 9, x + sign * 25, 5, bark, 2);
      }
      p.poly(
        [
          [28, 31],
          [41, 30],
          [47, 41],
          [47, 53],
          [56, 81],
          [48, 93],
          [22, 92],
          [15, 81],
          [24, 50],
        ],
        dark,
      );
      p.poly(
        [
          [30, 46],
          [41, 45],
          [47, 85],
          [36, 81],
          [25, 88],
        ],
        edge,
      );
      p.line(26, 52, 17, 72 + frame * 2, dark, 6);
      p.line(44, 52, 54, 73 - frame * 2, dark, 6);
      p.line(17, 72 + frame * 2, 13, 84, bark, 2);
      p.line(54, 73 - frame * 2, 58, 85, bark, 2);
      p.line(28, 86, 24 + frame * 2, 99, dark, 6);
      p.line(42, 86, 46 - frame * 2, 99, dark, 6);
      p.rect(28, 35, 14, 11, "#111d24");
      p.rect(28, 38, 5, 2, "#f3c575");
      p.rect(37, 38, 5, 2, "#f3c575");
      p.line(35, 46, 32, 56, ivory);
      p.line(29, 60, 26, 77, bark);
      p.rect(40, 67, 2, 12, bark);
    });
    out[`raider${frame}`] = sprite(34, 49, 17, 46, (p) => {
      p.rect(10, 38, 6, 9, "#28332e");
      p.rect(20, 38, 5, 9, "#28332e");
      p.poly(
        [
          [12, 14],
          [24, 14],
          [29, 36],
          [24, 41],
          [8, 40],
          [6, 31],
        ],
        "#423d49",
      );
      p.poly(
        [
          [13, 3],
          [23, 4],
          [29, 17],
          [25, 25],
          [7, 24],
          [5, 15],
        ],
        "#313747",
      );
      p.rect(11, 13, 12, 9, "#17262c");
      p.rect(12, 16, 3, 2, "#dfac78");
      p.rect(20, 16, 3, 2, "#dfac78");
      p.line(12, 27, 10, 37, "#74675e", 3);
      p.line(23, 27, 26, 35, "#74675e", 3);
      p.line(28, 24 + frame * 2, 28, 43, "#9b7c52", 2);
      p.rect(25, 23 + frame * 2, 8, 5, "#a4a996");
      p.rect(13, 32, 10, 2, "#95866a");
    });
  }
  out.startLantern = sprite(16, 25, 8, 23, (p) => {
    p.line(5, 6, 5, 3, "#53564a", 2);
    p.line(5, 3, 10, 3, "#53564a", 2);
    p.line(10, 3, 10, 6, "#53564a", 2);
    p.border(2, 6, 12, 16, "#384537", "#b79655");
    p.rect(4, 9, 8, 9, "#f4d38a");
    p.rect(6, 10, 4, 6, "#fff0b5");
    p.rect(2, 21, 12, 3, "#53564a");
  });
  return out;
}
