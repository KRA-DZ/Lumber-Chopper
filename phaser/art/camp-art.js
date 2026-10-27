import { sprite } from "../../pixel-art.js";
export function createCampArt() {
  const out = {},
    ink = "#3e4433",
    wood = "#a77c49",
    light = "#dbb77a";
  for (const kind of ["sale", "build", "gate"]) {
    out[`${kind}Sign`] = sprite(66, 48, 33, 44, (p) => {
      p.border(29, 20, 7, 26, ink, wood);
      p.rect(30, 23, 2, 20, light);
      p.poly(
        [
          [4, 6],
          [58, 6],
          [64, 19],
          [58, 32],
          [4, 32],
        ],
        ink,
      );
      p.poly(
        [
          [6, 8],
          [56, 8],
          [61, 19],
          [56, 29],
          [6, 29],
        ],
        wood,
      );
      p.rect(8, 9, 46, 2, light);
      p.rect(7, 27, 48, 1, "#745b39");
      if (kind === "sale") {
        p.oval(17, 18, 7, 7, "#725a36");
        p.oval(17, 17, 5, 5, "#e2c36b");
        p.rect(16, 13, 2, 8, "#b28e45");
      } else if (kind === "build") {
        p.line(16, 24, 24, 13, "#493e30", 3);
        p.line(17, 24, 25, 13, light);
        p.border(17, 10, 13, 6, ink, "#a6b0a0");
      } else {
        p.rect(13, 17, 15, 4, "#d0d6aa");
        p.poly(
          [
            [24, 12],
            [31, 19],
            [24, 26],
          ],
          "#e5d89c",
        );
      }
      for (const x of [9, 55]) p.rect(x, 13, 2, 2, "#493e30");
    });
    out[`${kind}Pad`] = sprite(64, 38, 32, 19, (p) => {
      p.poly(
        [
          [6, 2],
          [57, 2],
          [63, 8],
          [63, 30],
          [57, 36],
          [6, 36],
          [0, 30],
          [0, 8],
        ],
        ink,
      );
      p.poly(
        [
          [7, 4],
          [55, 4],
          [60, 9],
          [60, 29],
          [55, 33],
          [7, 33],
          [3, 28],
          [3, 9],
        ],
        kind === "build" ? "#6f9d90" : "#bca069",
      );
      for (let y = 7; y < 32; y += 6) {
        p.rect(5, y, 54, 1, "#645e4077");
        p.rect(6, y + 1, 51, 1, "#e4ce8b55");
      }
      for (const x of [7, 55])
        for (const y of [9, 27]) p.rect(x, y, 2, 2, "#594f39");
    });
  }
  out.mat = sprite(44, 18, 22, 10, (p) => {
    p.border(1, 2, 42, 13, ink, "#a86e4a");
    p.border(4, 4, 36, 9, "#d4b47b", "#8f6b49");
    for (let x = 6; x < 39; x += 4) p.rect(x, 6, 2, 5, "#c49460");
  });
  out.dishes = sprite(38, 28, 19, 22, (p) => {
    p.oval(19, 23, 17, 3, "#344d3444");
    p.oval(11, 18, 8, 4, ink);
    p.oval(11, 17, 6, 3, "#cfbc8b");
    p.oval(11, 16, 4, 2, "#825f3e");
    p.border(25, 12, 6, 8, ink, "#ccd0ae");
    p.border(30, 14, 4, 5, ink, "#a0a88d");
    p.border(17, 6, 8, 12, ink, "#7b9181");
    p.rect(18, 4, 6, 3, light);
    p.rect(16, 5, 10, 2, ink);
  });
  out.crate = sprite(36, 30, 18, 26, (p) => {
    p.border(2, 7, 31, 20, ink, wood);
    for (let x = 6; x < 31; x += 7) p.rect(x, 9, 1, 16, "#745b39");
    for (const y of [9, 21]) {
      p.rect(3, y, 29, 4, "#d0a56a");
      p.rect(4, y, 27, 1, light);
    }
    p.poly(
      [
        [2, 6],
        [9, 1],
        [33, 2],
        [33, 8],
      ],
      "#c3975c",
    );
    p.rect(7, 2, 23, 1, light);
  });
  out.flowers = sprite(28, 35, 14, 31, (p) => {
    p.poly(
      [
        [3, 20],
        [25, 20],
        [22, 32],
        [6, 32],
      ],
      ink,
    );
    p.poly(
      [
        [5, 22],
        [23, 22],
        [20, 30],
        [8, 30],
      ],
      "#b48251",
    );
    for (const [x, y, c] of [
      [8, 8, "#d1a768"],
      [18, 5, "#bb7880"],
      [13, 13, "#d4cb91"],
    ]) {
      p.line(x, 27, x, y, "#537146", 2);
      p.rect(x - 3, y - 2, 7, 5, c);
      p.rect(x - 1, y - 1, 3, 3, "#ecd693");
    }
  });
  out.chest = sprite(46, 36, 23, 31, (p) => {
    p.border(2, 10, 42, 22, ink, wood);
    p.poly(
      [
        [3, 10],
        [8, 3],
        [37, 3],
        [43, 10],
      ],
      ink,
    );
    p.poly(
      [
        [6, 9],
        [10, 5],
        [35, 5],
        [40, 9],
      ],
      "#d3aa69",
    );
    for (const x of [9, 33]) p.border(x, 5, 4, 26, ink, "#b8aa74");
    p.border(20, 16, 7, 10, ink, "#bdc3a1");
    p.rect(22, 18, 3, 3, "#485647");
    p.rect(1, 31, 10, 2, "#6d8650");
  });
  return out;
}
