import { createPixelArt, sprite, random, pixelHash } from "../../pixel-art.js";

// Оригинальный набор Forest Ledger: единый native-пиксель = 2 мировые единицы.
// Кластеры листвы, свет слева сверху, тёплое дерево и холодные глубокие тени.
const ink = "#273d35",
  wood = ["#403c2b", "#675037", "#937044", "#b88d52", "#dec18a"];
const leaves = {
  oak: ["#263f35", "#35553b", "#496b40", "#668648", "#88a353", "#b1bd72"],
  birch: ["#304a3a", "#4b663e", "#6d8546", "#93a555", "#bbc676", "#dbe0a0"],
  spruce: ["#243b38", "#315248", "#426e58", "#5a8966", "#82a77c", "#b2c59b"],
};
function crown(p, cx, cy, rx, ry, pal, seed) {
  const rnd = random(seed);
  for (let y = -ry - 2; y <= ry + 2; y++)
    for (let x = -rx - 2; x <= rx + 2; x++) {
      const a = Math.atan2(y / ry, x / rx),
        edge =
          1 + 0.075 * Math.sin(a * 7 + seed) + 0.045 * Math.cos(a * 11 - seed),
        d = (x / rx) ** 2 + (y / ry) ** 2;
      if (d > edge) continue;
      const lit = (-x / rx) * 0.27 - (y / ry) * 0.5,
        cell =
          pixelHash(Math.floor((cx + x) / 5), Math.floor((cy + y) / 4) + seed) %
          7;
      let shade =
        d > edge - 0.09
          ? 0
          : Math.max(
              1,
              Math.min(4, Math.floor(2.6 + lit * 1.4 + (cell - 3) * 0.12)),
            );
      if (y > ry * 0.55 && x > 0) shade = Math.max(0, shade - 1);
      p.rect(cx + x, cy + y, 1, 1, pal[shade]);
    }
  for (let i = 0; i < (rx * ry) / 10; i++) {
    const a = rnd() * Math.PI * 2,
      r = Math.sqrt(rnd()) * 0.88,
      x = Math.round(cx + Math.cos(a) * r * rx),
      y = Math.round(cy + Math.sin(a) * r * ry);
    const shade = Math.max(
      2,
      Math.min(
        5,
        Math.floor(3.7 - ((x - cx) / rx) * 0.5 - ((y - cy) / ry) * 0.7),
      ),
    );
    p.rect(x - 2, y + 1, 4, 2, pal[shade - 2]);
    p.rect(x - 2, y, 3, 1, pal[shade]);
    if (i % 3 === 0) p.rect(x - 1, y - 1, 2, 1, pal[Math.min(5, shade + 1)]);
  }
}
function tree(type, variant) {
  const w = type === "oak" ? 124 : type === "dead" ? 90 : 108,
    h = type === "spruce" ? 178 : type === "dead" ? 148 : 168,
    ax = w / 2,
    ay = h - 10;
  const s = sprite(w, h, ax, ay, (p) => {
    const birch = type === "birch",
      rnd = random(31 + variant * 73 + type.length * 17);
    p.oval(ax, ay + 2, 22, 5, "#304e343e");
    p.poly(
      [
        [ax - 14, ay],
        [ax - 7, ay - 13],
        [ax - 5, ay - 82],
        [ax + 3, ay - 103],
        [ax + 6, ay - 14],
        [ax + 15, ay],
      ],
      wood[0],
    );
    p.poly(
      [
        [ax - 10, ay - 1],
        [ax - 4, ay - 13],
        [ax - 3, ay - 81],
        [ax + 2, ay - 94],
        [ax + 3, ay - 12],
        [ax + 10, ay - 1],
      ],
      birch ? "#cbcbb0" : wood[2],
    );
    p.line(ax - 2, ay - 9, ax - 1, ay - 86, birch ? "#ede6cb" : wood[4], 2);
    p.line(ax + 3, ay - 12, ax + 3, ay - 77, birch ? "#8f9e8e" : wood[1]);
    for (const side of [-1, 1]) {
      p.line(ax, ay - 48, ax + side * 21, ay - 80, wood[0], 5);
      p.line(
        ax,
        ay - 49,
        ax + side * 20,
        ay - 81,
        birch ? "#c4c6ab" : wood[2],
        3,
      );
      p.line(
        ax + side * 20,
        ay - 80,
        ax + side * 28,
        ay - 100,
        birch ? "#e4dfc2" : wood[2],
        2,
      );
    }
    for (let i = 0; i < 12; i++) {
      const yy = ay - 10 - i * 6;
      if (birch) {
        p.rect(ax - 5 + (i % 3) * 2, yy, 5 + (i % 2) * 2, 1, "#48534b");
        p.rect(ax + 1, yy - 2, 3, 1, "#9eaa98");
      } else {
        p.line(ax + 3, yy, ax + 2, yy + 4, wood[1]);
        if (i % 3 === 0) p.rect(ax - 3, yy + 2, 2, 2, "#d4ab6d");
      }
    }
    if (type === "dead") {
      for (const side of [-1, 1]) {
        p.line(ax, ay - 46, ax + side * 24, ay - 77, wood[0], 5);
        p.line(ax + side * 24, ay - 77, ax + side * 28, ay - 112, wood[0], 4);
        p.line(ax, ay - 47, ax + side * 24, ay - 78, "#a7956d", 3);
        p.line(ax + side * 24, ay - 78, ax + side * 28, ay - 112, "#c1b38b", 2);
        p.line(ax + side * 17, ay - 69, ax + side * 37, ay - 83, "#a7956d", 2);
        p.line(ax + side * 35, ay - 83, ax + side * 37, ay - 96, "#c1b38b");
      }
      p.line(ax + 1, ay - 94, ax - 3, ay - 130, wood[0], 4);
      p.line(ax + 1, ay - 94, ax - 3, ay - 129, "#bdac83", 2);
      p.oval(ax + 1, ay - 32, 3, 5, "#303b31");
      p.rect(ax - 6, ay - 8, 8, 3, "#6a8551");
      return;
    }
    const pal = leaves[type];
    if (type === "spruce") {
      for (let layer = 0; layer < 5; layer++) {
        const yy = ay - 20 - layer * 23,
          rx = 45 - layer * 7;
        p.poly(
          [
            [ax, yy - 48],
            [ax - rx, yy - 2],
            [ax - rx + 7, yy],
            [ax - rx + 3, yy + 5],
            [ax - 13, yy + 9],
            [ax - 3, yy + 12],
            [ax + 14, yy + 8],
            [ax + rx - 2, yy + 4],
            [ax + rx - 7, yy],
            [ax + rx, yy - 2],
          ],
          pal[0],
        );
        p.poly(
          [
            [ax - 1, yy - 43],
            [ax - rx + 7, yy - 3],
            [ax - 10, yy + 5],
            [ax + rx - 7, yy + 1],
          ],
          pal[2],
        );
        p.poly(
          [
            [ax - 2, yy - 39],
            [ax - rx + 12, yy - 4],
            [ax - 8, yy + 1],
            [ax + 8, yy - 3],
          ],
          pal[3],
        );
        for (let i = 0; i < 65; i++) {
          const y = yy - 4 - rnd() * 35,
            x = ax + (rnd() - 0.5) * rx * 1.7;
          if (Math.abs(x - ax) > (y - (yy - 45)) * 0.85) continue;
          p.line(x, y, x - 3, y + 3, x < ax ? pal[4] : pal[2]);
          if (i % 4 === 0) p.rect(x - 1, y, 2, 1, pal[5]);
        }
      }
    } else {
      const narrow = birch ? 0.78 : 1,
        seed = variant * 97;
      for (const [dx, dy, rx, ry] of [
        [-26, -69, 26, 21],
        [28, -78, 28, 24],
        [-2, -97, 37, 28],
        [-22, -118, 25, 22],
        [22, -126, 24, 21],
        [-2, -80, 29, 25],
      ])
        crown(
          p,
          ax + dx * narrow,
          ay + dy,
          rx * narrow,
          ry,
          pal,
          seed + dx + dy + 211,
        );
    }
    for (let i = 0; i < 7; i++)
      p.line(
        ax - 15 + i * 5,
        ay + 3,
        ax - 18 + i * 5,
        ay - 2 - (i % 3),
        "#73934d",
      );
  });
  if (variant !== 2) return s;
  const width = Math.round(w * 1.14),
    height = Math.round(h * 1.14);
  return sprite(
    width,
    height,
    Math.round(ax * 1.14),
    Math.round(ay * 1.14),
    (p) => p.g.drawImage(s.bitmap, 0, 0, width, height),
  );
}
function person(coat, dir, frame, mood = "neutral", gesture = "none") {
  return sprite(32, 46, 16, 44, (p) => {
    const side = dir === "side",
      up = dir === "up",
      step = [0, 1, 0, -1][frame % 4],
      skin = "#d9a477",
      light = "#f1c394",
      shade = "#a67556";
    p.oval(16, 43, 11, 2, "#223b3433");
    p.rect(10, 32, 5, 10, "#344b4c");
    p.rect(18, 32, 5, 10, "#344b4c");
    p.rect(11, 33, 2, 7, "#63797a");
    p.rect(19, 33, 2, 7, "#63797a");
    p.border(8, 40 + Math.max(0, step), 8, 4, ink, "#675440");
    p.border(17, 40 - Math.min(0, step), 8, 4, ink, "#675440");
    p.rect(9, 40 + Math.max(0, step), 5, 1, "#ad9162");
    p.rect(18, 40 - Math.min(0, step), 5, 1, "#ad9162");
    p.border(8, 23, 17, 12, ink, coat);
    p.rect(9, 24, 14, 2, "#d79a66");
    p.rect(9, 28, 14, 1, "#472f293d");
    p.rect(9, 32, 14, 1, "#472f293d");
    for (const x of [11, 20]) {
      p.rect(x, 24, 2, 11, "#9c8c61");
      p.rect(x, 25, 1, 9, "#d7bf85");
    }
    p.rect(9, 34, 15, 2, "#514334");
    p.rect(15, 34, 3, 2, "#d5b273");
    p.rect(5, 24 - step, 4, 10, ink);
    p.rect(6, 25 - step, 3, 8, coat);
    p.rect(6, 33 - step, 3, 3, skin);
    p.rect(25, 24 + step, 3, 10, ink);
    p.rect(25, 25 + step, 2, 8, coat);
    p.rect(25, 33 + step, 3, 3, skin);
    if (gesture !== "none") {
      p.g.clearRect(24, 23, 6, 14);
      p.line(25, 29, 27, 16, coat, 4);
      p.rect(26, 12 + (frame % 2), 4, 5, skin);
      if (gesture === "cheer") {
        p.g.clearRect(3, 23, 6, 14);
        p.line(7, 28, 5, 16, coat, 4);
        p.rect(3, 12 + (frame % 2), 4, 5, skin);
      }
    }
    if (up) {
      p.border(10, 25, 13, 12, ink, "#75816a");
      p.rect(11, 26, 10, 3, "#a6ae88");
      p.rect(12, 32, 8, 4, "#556957");
    }
    const tired = mood === "tired" ? 1 : 0;
    p.g.save();
    p.g.translate(0, tired);
    p.border(side ? 9 : 8, 10, 16, 14, "#57442f", skin);
    p.rect(side ? 11 : 10, 12, 12, 7, light);
    p.rect(7, 16, 3, 5, shade);
    p.rect(23, 16, 3, 5, skin);
    p.rect(8, 10, 17, 4, "#654630");
    p.rect(8, 13, 3, 6, "#654630");
    p.rect(22, 12, 3, 5, "#654630");
    if (!up) {
      if (side) {
        p.rect(21, 16, 2, 3, ink);
        p.rect(22, 19, 4, 2, skin);
        p.rect(23, 18, 2, 1, light);
      } else {
        p.rect(12, 16, 2, 3, ink);
        p.rect(20, 16, 2, 3, ink);
        p.rect(12, 16, 1, 1, "#f8ebbf");
        p.rect(20, 16, 1, 1, "#f8ebbf");
        p.rect(16, 19, 2, 2, skin);
        p.rect(10, 20, 3, 1, "#cc8c70");
        p.rect(22, 20, 2, 1, "#cc8c70");
      }
      if (["blink", "tired"].includes(mood)) {
        for (const x of side ? [21] : [12, 20]) {
          p.rect(x, 16, 2, 3, light);
          p.rect(x, 18, 2, 1, ink);
        }
      }
      if (mood === "happy") {
        p.line(side ? 21 : 14, 21, side ? 24 : 19, 21, "#885943");
        p.rect(side ? 22 : 15, 22, 3, 1, "#885943");
      } else if (mood === "yawn") p.rect(side ? 22 : 16, 21, 2, 3, "#79533d");
      else p.rect(side ? 23 : 16, 22, 3, 1, "#a47655");
      if (mood === "focused") {
        p.rect(side ? 20 : 11, 15, 3, 1, "#755137");
        if (!side) p.rect(19, 15, 3, 1, "#755137");
      }
      if (mood === "tired") p.rect(25, 15, 1, 3, "#99c8bb");
    } else p.rect(10, 15, 13, 6, "#654630");
    p.border(8, 4, 17, 8, "#604c32", "#b18b4d");
    p.rect(10, 5, 12, 2, "#dcc28a");
    p.rect(8, 10, 17, 3, "#65734a");
    p.rect(4, 12, 25, 3, ink);
    p.rect(5, 12, 23, 1, "#cfb777");
    p.rect(23, 8, 3, 3, "#c56645");
    p.g.restore();
  });
}
function building(kind) {
  if (kind === "house" || kind === "houseFrame")
    return sprite(144, 162, 72, 154, (p) => {
      p.oval(72, 155, 66, 6, "#273d352e");
      p.border(17, 139, 112, 16, "#454c3d", "#89917a");
      for (let y = 142; y < 154; y += 6)
        for (let x = 20 + (y % 12 ? 0 : 8); x < 126; x += 16) {
          p.rect(x, y, 13, 4, "#a8ac8e");
          p.rect(x, y, 12, 1, "#cbc7a2");
        }
      if (kind === "houseFrame") {
        for (const x of [20, 43, 70, 98, 124]) {
          p.rect(x, 86, 3, 61, wood[1]);
          p.rect(x + 1, 87, 1, 58, wood[4]);
        }
        p.line(20, 89, 125, 89, wood[2], 3);
        p.line(3, 89, 29, 24, wood[2], 3);
        p.line(29, 24, 111, 24, wood[2], 3);
        p.line(111, 24, 140, 89, wood[2], 3);
        p.line(3, 89, 140, 89, wood[3], 3);
        for (const x of [29, 49, 69, 89, 109])
          p.line(x, 26, x + (x < 72 ? -19 : 19), 87, wood[3], 2);
        return;
      }
      p.border(17, 84, 112, 61, wood[0], wood[2]);
      p.rect(126, 88, 10, 52, "#554833");
      for (let row = 0; row < 9; row++) {
        const y = 89 + row * 6;
        p.rect(20, y, 106, 5, row % 2 ? "#a77e49" : "#b68c54");
        p.rect(20, y, 106, 1, "#d4af73");
        for (let x = 23 + (row % 2) * 7; x < 123; x += 16) {
          p.line(x, y + 3, x + 7, y + 3, "#85633e");
          if ((x + row) % 3 === 0) p.rect(x + 3, y + 2, 2, 1, "#e3c38a");
        }
        for (const x of [19, 124]) {
          p.oval(x, y + 2, 4, 3, wood[0]);
          p.oval(x, y + 1, 3, 2, wood[3]);
        }
      }
      p.poly(
        [
          [27, 22],
          [113, 22],
          [143, 91],
          [1, 91],
        ],
        ink,
      );
      p.poly(
        [
          [30, 25],
          [110, 25],
          [137, 86],
          [7, 86],
        ],
        "#456953",
      );
      for (let row = 0; row < 10; row++) {
        const y = 27 + row * 6,
          left = 29 - row * 2.2,
          right = 112 + row * 2.4;
        p.rect(left, y, right - left, 1, "#25473d");
        p.rect(left + 1, y + 1, right - left - 2, 2, "#75916a");
        for (let x = left + 2 + (row % 2) * 5; x < right - 5; x += 11) {
          p.rect(x, y + 3, 8, 2, row < 4 ? "#5c7d5c" : "#4c7054");
          p.rect(x + 8, y + 2, 1, 4, "#304e41");
          if ((row + Math.floor(x)) % 4 === 0)
            p.rect(x + 1, y + 2, 4, 1, "#a5ae7a");
        }
      }
      p.border(25, 20, 91, 4, ink, "#a3a97c");
      p.rect(0, 88, 144, 5, wood[0]);
      p.rect(3, 88, 137, 1, "#c5a367");
      p.poly(
        [
          [72, 76],
          [91, 104],
          [52, 104],
        ],
        wood[0],
      );
      p.poly(
        [
          [72, 80],
          [86, 101],
          [57, 101],
        ],
        "#6a865d",
      );
      p.line(72, 80, 57, 100, "#b1b987");
      p.border(60, 110, 25, 38, wood[0], "#86613c");
      p.border(63, 113, 19, 34, "#c49b61", "#926e43");
      for (const x of [66, 71, 77]) p.rect(x, 115, 1, 30, "#604c33");
      p.rect(77, 130, 2, 3, "#eacb7b");
      for (const x of [28, 101]) {
        p.border(x, 109, 20, 24, wood[0], "#cbb480");
        p.border(x + 2, 111, 16, 19, "#6d7156", "#b9c2a0");
        p.rect(x + 3, 112, 6, 7, "#e3dcc0");
        p.rect(x + 9, 111, 2, 20, wood[1]);
        p.rect(x + 2, 119, 16, 2, wood[1]);
        p.rect(x - 2, 132, 24, 3, "#d3b77d");
        p.border(x - 1, 136, 22, 7, wood[0], "#8e6e45");
        for (let i = 0; i < 4; i++) {
          p.rect(x + 2 + i * 5, 134 - (i % 2), 3, 3, "#5a7848");
          p.rect(
            x + 3 + i * 5,
            133 - (i % 2),
            2,
            2,
            i % 2 ? "#d4ba75" : "#b56e64",
          );
        }
      }
      p.border(111, 7, 14, 35, ink, "#88917d");
      for (let y = 10; y < 40; y += 6) {
        p.rect(112, y, 12, 1, "#bec0a0");
        p.rect(118 + (y % 12 ? 0 : 3), y + 1, 1, 5, "#5a6d61");
      }
      p.border(108, 5, 20, 5, ink, "#bdc0a0");
      p.rect(110, 6, 16, 1, "#e1d9b1");
      p.rect(56, 150, 34, 4, "#c8bc97");
      p.rect(53, 154, 40, 4, "#626e58");
      p.rect(54, 154, 38, 1, "#b9ba94");
    });
  const merchant = kind === "merchant",
    frame = kind === "tentFrame",
    abandoned = kind === "old";
  return sprite(112, 110, 56, 103, (p) => {
    p.oval(56, 102, 51, 6, "#263d3433");
    if (frame) {
      p.line(7, 101, 56, 8, wood[2], 3);
      p.line(56, 8, 105, 101, wood[2], 3);
      p.line(56, 8, 56, 101, wood[3], 3);
      p.line(7, 101, 105, 101, wood[3], 2);
      return;
    }
    const pal = merchant
      ? ["#323b4d", "#55506c", "#777086", "#aaa09d"]
      : abandoned
        ? ["#4f5e48", "#788365", "#a0a17b", "#bec19b"]
        : ["#6e573b", "#b58d50", "#d3b472", "#ead19a"];
    p.poly(
      [
        [55, 5],
        [2, 102],
        [109, 102],
      ],
      wood[0],
    );
    p.poly(
      [
        [55, 8],
        [8, 97],
        [103, 97],
      ],
      pal[1],
    );
    p.poly(
      [
        [55, 9],
        [12, 96],
        [43, 96],
      ],
      pal[2],
    );
    p.poly(
      [
        [55, 9],
        [76, 97],
        [102, 97],
      ],
      pal[0],
    );
    p.poly(
      [
        [55, 29],
        [32, 97],
        [79, 97],
      ],
      "#263c36",
    );
    p.poly(
      [
        [54, 18],
        [27, 95],
        [36, 95],
        [55, 36],
        [72, 96],
        [81, 96],
      ],
      pal[3],
    );
    for (let i = 0; i < 7; i++)
      p.line(52 - i * 5, 25 + i * 9, 45 - i * 4, 45 + i * 7, pal[3]);
    p.rect(42, 88, 26, 7, "#786f4b");
    p.rect(43, 89, 23, 2, "#a5a17a");
    p.rect(44, 94, 22, 3, "#534d37");
    for (const x of [7, 103]) {
      p.rect(x, 96, 3, 10, wood[0]);
      p.rect(x, 96, 1, 9, wood[4]);
    }
    p.line(53, 8, 1, 90, "#a79972");
    p.line(58, 9, 111, 90, "#a79972");
    p.rect(53, 4, 5, 5, wood[3]);
    if (merchant)
      for (const [x, y] of [
        [33, 57],
        [43, 39],
        [75, 66],
        [84, 85],
      ]) {
        p.rect(x, y, 1, 5, "#d5b878");
        p.rect(x - 2, y + 2, 5, 1, "#d5b878");
      }
    if (abandoned) {
      p.poly(
        [
          [31, 66],
          [37, 71],
          [29, 78],
        ],
        pal[0],
      );
      p.rect(8, 99, 13, 3, "#64844d");
    }
  });
}
function stall() {
  return sprite(112, 94, 56, 86, (p) => {
    p.oval(56, 86, 49, 6, "#253d3433");
    p.border(14, 44, 86, 41, wood[0], "#9c7546");
    for (let x = 18; x < 98; x += 10) {
      p.rect(x, 47, 2, 34, "#c39d62");
      p.rect(x + 6, 49, 1, 32, wood[1]);
    }
    p.border(24, 66, 64, 15, "#5a4932", "#cdb47b");
    p.rect(26, 68, 60, 1, "#eddaa6");
    p.rect(11, 58, 91, 5, wood[0]);
    p.rect(12, 58, 89, 2, "#e0bf83");
    for (const x of [10, 98]) {
      p.rect(x, 16, 4, 45, wood[0]);
      p.rect(x + 1, 17, 1, 42, wood[3]);
    }
    p.poly(
      [
        [12, 7],
        [98, 7],
        [111, 37],
        [0, 37],
      ],
      wood[0],
    );
    p.poly(
      [
        [15, 10],
        [95, 10],
        [105, 34],
        [6, 34],
      ],
      "#c6ad70",
    );
    for (let i = 0; i < 8; i++) {
      const x = 13 + i * 11;
      p.poly(
        [
          [x, 11],
          [x + 8, 11],
          [x + 10, 34],
          [x - 2, 34],
        ],
        i % 2 ? "#ead09a" : "#aa694b",
      );
      p.rect(x - 2, 35, 11, 5, i % 2 ? "#c5ad77" : "#8c5843");
    }
    p.rect(11, 5, 89, 3, wood[0]);
    p.rect(13, 5, 84, 1, "#c9ad71");
    for (const [x, c] of [
      [23, "#70856a"],
      [35, "#b38f5e"],
      [78, "#8d6c70"],
    ]) {
      p.border(x, 46, 8, 11, wood[0], c);
      p.rect(x + 2, 44, 4, 3, "#b4b38c");
      p.rect(x + 2, 47, 2, 3, "#eee0ac");
    }
    p.line(59, 55, 59, 42, "#c6ab67", 2);
    p.line(49, 44, 69, 44, "#d8be7e");
    p.line(51, 44, 48, 50, "#a28d5f");
    p.line(67, 44, 70, 50, "#a28d5f");
    p.oval(48, 51, 5, 2, "#c5a972");
    p.oval(70, 51, 5, 2, "#c5a972");
  });
}

function ancientOak() {
  return sprite(212, 264, 106, 250, (p) => {
    p.oval(106, 253, 73, 9, "#304e3444");
    p.poly(
      [
        [32, 249],
        [76, 224],
        [88, 130],
        [118, 126],
        [135, 225],
        [183, 250],
      ],
      wood[0],
    );
    p.poly(
      [
        [43, 247],
        [86, 220],
        [95, 124],
        [113, 127],
        [125, 223],
        [171, 248],
      ],
      wood[2],
    );
    for (const [x, top] of [
      [90, 150],
      [99, 144],
      [121, 145],
      [132, 223],
    ]) {
      p.line(x, top, x - 5, 241, wood[1], 3);
      p.line(x - 3, top, x - 9, 243, wood[3], 2);
    }
    p.oval(110, 224, 15, 23, wood[0]);
    p.oval(110, 228, 11, 17, "#273d35");
    p.oval(108, 229, 7, 14, "#1c302c");
    p.line(83, 188, 52, 132, wood[0], 12);
    p.line(83, 187, 52, 130, wood[3], 7);
    p.line(125, 179, 164, 121, wood[0], 11);
    p.line(126, 177, 164, 119, wood[2], 7);
    for (const [x, y, rx, ry, seed] of [
      [57, 135, 52, 42, 11],
      [155, 134, 53, 42, 23],
      [106, 94, 78, 48, 31],
      [58, 71, 48, 44, 51],
      [151, 71, 51, 45, 71],
      [104, 49, 57, 46, 91],
    ])
      crown(p, x, y, rx, ry, leaves.oak, seed);
    for (const [x, y] of [
      [61, 243],
      [141, 242],
      [79, 237],
    ]) {
      p.rect(x, y, 9, 4, "#6b824a");
      p.rect(x + 2, y - 2, 4, 3, "#9da267");
    }
    p.border(83, 244, 15, 6, wood[0], wood[3]);
    p.rect(86, 246, 9, 1, wood[4]);
  });
}
function forestMerchant(action, frame) {
  return sprite(36, 48, 18, 44, (p) => {
    p.oval(18, 44, 14, 3, "#273d3433");
    p.poly(
      [
        [12, 17],
        [25, 17],
        [31, 43],
        [5, 43],
      ],
      "#303b42",
    );
    p.poly(
      [
        [14, 20],
        [23, 20],
        [27, 42],
        [9, 42],
      ],
      "#5d576a",
    );
    p.line(12, 25, 9, 40, "#928394", 2);
    p.line(24, 25, 28, 42, "#454451", 2);
    p.poly(
      [
        [8, 20],
        [10, 8],
        [19, 2],
        [28, 10],
        [29, 22],
      ],
      "#303b42",
    );
    p.poly(
      [
        [10, 18],
        [12, 9],
        [19, 5],
        [26, 11],
        [26, 22],
      ],
      "#75667d",
    );
    p.poly(
      [
        [12, 15],
        [19, 10],
        [25, 15],
        [25, 23],
        [12, 23],
      ],
      "#273437",
    );
    const look = action === "look" ? frame : 0;
    p.rect(14 + look, 18, 2, 1, "#ecd58f");
    p.rect(22 + look, 18, 2, 1, "#ecd58f");
    p.border(12, 33, 15, 2, "#393a3f", "#aa8d58");
    p.border(17, 32, 4, 4, "#3f3e3b", "#d0b56e");
    if (action === "read") {
      p.poly(
        [
          [7, 26],
          [17, 28],
          [27, 26],
          [26, 36],
          [17, 38],
          [8, 35],
        ],
        "#373c3e",
      );
      p.poly(
        [
          [9, 28],
          [17, 30],
          [25, 28],
          [24, 34],
          [17, 36],
          [10, 34],
        ],
        "#cec0a0",
      );
      p.rect(17, 30, 1, 6, "#9c8867");
      p.rect(11, 30, 4, 1, "#a09276");
      p.rect(20, 31, 3, 1, "#a09276");
    } else if (["greet", "adjust"].includes(action)) {
      p.line(27, 29, 30, 19, "#75667d", 4);
      p.rect(29, 14 + frame, 4, 6, "#cfae88");
    } else {
      p.rect(8, 28, 4, 3, "#cfae88");
      p.rect(25, 28, 4, 3, "#cfae88");
    }
    if (action === "peek") p.g.clearRect(0, 30, 36, 18);
  });
}

export function createForestArt() {
  const base = createPixelArt(),
    s = base.sprites;
  for (const type of ["oak", "birch", "spruce", "dead"])
    s.trees[type] = [0, 1, 2].map((v) => tree(type, v));
  const coats = { player: "#b76447", buyerA: "#99804d", buyerB: "#598b85" },
    cache = new Map();
  const personSprite = (
    role,
    dir,
    frame,
    mood = "neutral",
    gesture = "none",
  ) => {
    const key = [role, dir, frame, mood, gesture].join(":");
    if (!cache.has(key)) {
      cache.set(key, person(coats[role], dir, frame, mood, gesture));
      if (cache.size > 96) cache.delete(cache.keys().next().value);
    }
    return cache.get(key);
  };
  for (const role of Object.keys(coats))
    for (const dir of ["down", "up", "side"])
      s.characters[role][dir] = [0, 1, 2, 3].map((f) =>
        personSprite(role, dir, f),
      );
  s.ancient = ancientOak();
  s.merchant = forestMerchant("read", 0);
  const merchantPose = (action, frame = 0) => forestMerchant(action, frame);
  s.house = building("house");
  s.houseFrame = building("houseFrame");
  s.tent = building("tent");
  s.tentFrame = building("tentFrame");
  s.merchantTent = building("merchant");
  s.oldTent = building("old");
  s.stall = stall();
  s.log = sprite(42, 22, 21, 17, (p) => {
    p.poly(
      [
        [7, 5],
        [32, 2],
        [39, 7],
        [38, 17],
        [9, 20],
        [3, 15],
      ],
      wood[0],
    );
    p.poly(
      [
        [9, 6],
        [32, 4],
        [36, 8],
        [35, 15],
        [10, 18],
        [6, 14],
      ],
      wood[2],
    );
    p.line(10, 7, 31, 5, wood[4], 2);
    p.line(11, 11, 32, 9, wood[1]);
    p.line(13, 15, 33, 13, wood[3]);
    for (const x of [15, 24, 29]) p.line(x, 7, x + 2, 15, wood[1]);
    p.oval(7, 13, 6, 7, wood[0]);
    p.oval(7, 12, 5, 6, wood[4]);
    p.oval(7, 12, 3, 4, wood[2]);
    p.oval(7, 12, 1, 2, wood[4]);
    p.oval(36, 10, 4, 6, wood[0]);
    p.oval(36, 9, 3, 5, "#bd985d");
    p.oval(36, 9, 1, 3, wood[1]);
  });
  s.stump = sprite(38, 25, 19, 20, (p) => {
    p.poly(
      [
        [6, 10],
        [28, 8],
        [34, 21],
        [25, 23],
        [7, 23],
        [2, 20],
      ],
      wood[0],
    );
    p.rect(7, 11, 23, 11, wood[2]);
    for (const x of [8, 15, 26]) {
      p.rect(x, 13, 2, 9, wood[1]);
      p.rect(x + 2, 14, 1, 7, wood[3]);
    }
    p.oval(18, 10, 14, 7, wood[0]);
    p.oval(18, 9, 12, 5, wood[4]);
    p.oval(18, 9, 8, 3, wood[2]);
    p.oval(18, 9, 6, 2, "#e2c991");
    p.oval(18, 9, 2, 1, wood[2]);
    p.rect(3, 22, 6, 2, "#6a8852");
  });
  s.fence = sprite(20, 30, 10, 27, (p) => {
    p.poly(
      [
        [6, 4],
        [10, 1],
        [14, 4],
        [14, 27],
        [5, 27],
      ],
      wood[0],
    );
    p.rect(7, 5, 6, 20, wood[2]);
    p.rect(7, 4, 2, 20, wood[4]);
    p.rect(10, 8, 1, 9, wood[1]);
    p.rect(6, 25, 9, 3, "#6c7450");
  });
  return {
    ...base,
    person: personSprite,
    merchantPose,
    style: "forest-ledger",
    metrics: { hero: 40, oak: 139, birch: 149, spruce: 157, house: 153 },
    buildSpec: { foundation: 139, wallTop: 86, roofBottom: 94 },
  };
}
