import { AXE_TIERS } from "./economy.js";
// Собственные спрайты: целые пиксели, ограниченная палитра, без сглаживания.
export const PIXEL_SCALE = 2;
export const METRICS = Object.freeze({
  tile: 16,
  hero: 32,
  oak: 102,
  birch: 108,
  spruce: 109,
  house: 125,
  fence: 18,
});
export const CAMP = Object.freeze({
  hut: { x: 1680, y: 1455 },
  tent: { x: 1445, y: 1495 },
  merchant: { x: 1945, y: 1465 },
  stall: { x: 1420, y: 1618 },
  fenceRX: 280,
  fenceRY: 235,
});
const leafPalettes = {
  oak: ["#193b2b", "#245735", "#35743b", "#4b9240", "#70ac4b", "#a3c465"],
  birch: ["#294c32", "#467137", "#659340", "#88af4c", "#b5cf70", "#d5df98"],
  spruce: ["#173d36", "#22584b", "#2e7156", "#43895d", "#63a26c", "#8eb77f"],
};
export function random(seed) {
  let n = seed >>> 0;
  return () => {
    n = (Math.imul(n, 1664525) + 1013904223) >>> 0;
    return n / 4294967296;
  };
}
export function pixelHash(x, y) {
  let n = Math.imul(x + 137, 374761393) ^ Math.imul(y + 51, 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return (n ^ (n >>> 16)) >>> 0;
}
function painter(canvas) {
  const g = canvas.getContext("2d");
  g.imageSmoothingEnabled = false;
  const rect = (x, y, w, h, c) => {
    g.fillStyle = c;
    g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  };
  function line(x0, y0, x1, y1, c, width = 1) {
    x0 = Math.round(x0);
    y0 = Math.round(y0);
    x1 = Math.round(x1);
    y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0),
      sx = x0 < x1 ? 1 : -1,
      dy = -Math.abs(y1 - y0),
      sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      rect(
        x0 - Math.floor(width / 2),
        y0 - Math.floor(width / 2),
        width,
        width,
        c,
      );
      if (x0 === x1 && y0 === y1) break;
      const e = err * 2;
      if (e >= dy) {
        err += dy;
        x0 += sx;
      }
      if (e <= dx) {
        err += dx;
        y0 += sy;
      }
    }
  }
  function oval(cx, cy, rx, ry, c) {
    for (let y = Math.ceil(cy - ry); y <= Math.floor(cy + ry); y++) {
      const d = (y - cy) / ry;
      if (Math.abs(d) > 1) continue;
      const span = Math.floor(rx * Math.sqrt(1 - d * d));
      rect(Math.round(cx) - span, y, span * 2 + 1, 1, c);
    }
  }
  function poly(points, c) {
    const lo = Math.ceil(Math.min(...points.map((p) => p[1]))),
      hi = Math.floor(Math.max(...points.map((p) => p[1])));
    for (let y = lo; y <= hi; y++) {
      const xs = [];
      for (let i = 0; i < points.length; i++) {
        const a = points[i],
          b = points[(i + 1) % points.length];
        if ((a[1] <= y && b[1] > y) || (b[1] <= y && a[1] > y))
          xs.push(a[0] + ((y - a[1]) * (b[0] - a[0])) / (b[1] - a[1]));
      }
      xs.sort((a, b) => a - b);
      for (let i = 0; i + 1 < xs.length; i += 2)
        rect(
          Math.ceil(xs[i]),
          y,
          Math.floor(xs[i + 1]) - Math.ceil(xs[i]) + 1,
          1,
          c,
        );
    }
  }
  const border = (x, y, w, h, c, inside) => {
    rect(x, y, w, h, c);
    rect(x + 1, y + 1, w - 2, h - 2, inside);
  };
  return { g, rect, line, oval, poly, border };
}
export function sprite(w, h, ax, ay, paint) {
  const bitmap = document.createElement("canvas");
  bitmap.width = w;
  bitmap.height = h;
  const p = painter(bitmap);
  paint(p);
  const rgba = p.g.getImageData(0, 0, w, h).data,
    mask = new Uint8Array(w * h);
  for (let i = 0; i < mask.length; i++) mask[i] = rgba[i * 4 + 3];
  return { bitmap, ax, ay, mask, width: w, height: h };
}
function foliage(p, cx, cy, rx, ry, pal, seed) {
  const rnd = random(seed);
  p.oval(cx, cy, rx, ry, pal[0]);
  p.oval(cx, cy - 2, rx - 2, ry - 2, pal[1]);
  const count = Math.floor((rx * ry) / 8);
  for (let i = 0; i < count; i++) {
    const a = rnd() * Math.PI * 2,
      r = Math.sqrt(rnd()),
      x = Math.round(cx + Math.cos(a) * r * (rx - 3)),
      y = Math.round(cy + Math.sin(a) * r * (ry - 3));
    const lit = ((cy - y) / ry) * 0.7 + ((cx - x) / rx) * 0.3;
    const shade = lit > 0.35 ? 4 : lit > -0.2 ? 3 : 2;
    p.rect(x - 2, y, 4, 2, pal[Math.max(1, shade - 1)]);
    p.rect(x - 1, y - 1, 3, 1, pal[shade]);
    if (rnd() > 0.45) p.rect(x, y - 2, 2, 1, pal[Math.min(5, shade + 1)]);
    if (rnd() > 0.7) p.rect(x + 2, y + 2, 2, 1, pal[0]);
  }
}
function treeSprite(type, variant) {
  const w = type === "birch" || type === "dead" ? 64 : 80,
    h =
      type === "spruce"
        ? 124
        : type === "birch"
          ? 116
          : type === "dead"
            ? 100
            : 108,
    ax = w / 2,
    ay = h - 6;
  return sprite(w, h, ax, ay, (p) => {
    const rnd = random(variant + type.length * 733);
    const birch = type === "birch";
    p.poly(
      [
        [ax - 10, ay],
        [ax - 5, ay - 9],
        [ax - 4, ay - 58],
        [ax + 4, ay - 60],
        [ax + 4, ay - 10],
        [ax + 12, ay],
      ],
      "#42382b",
    );
    p.poly(
      [
        [ax - 7, ay - 1],
        [ax - 3, ay - 11],
        [ax - 2, ay - 58],
        [ax + 2, ay - 58],
        [ax + 3, ay - 9],
        [ax + 8, ay - 1],
      ],
      birch ? "#e5dfbc" : "#986039",
    );
    p.rect(ax - 2, ay - 51, 2, 45, birch ? "#fff2ce" : "#c58a4a");
    for (let i = 0; i < 8; i++) {
      const y = ay - 7 - i * 6;
      if (birch) {
        p.rect(ax - 3 + (i % 2) * 3, y, 3 + (i % 3), 1, "#4b4d3b");
        p.rect(ax + 1, y + 2, 3, 1, "#929b7d");
      } else {
        p.line(ax + 2, y, ax + 3, y + 4, "#6c452e");
        if (i % 3 === 0) p.rect(ax - 1, y, 1, 3, "#e1ac5e");
      }
    }
    if (type === "dead") {
      for (const side of [-1, 1]) {
        p.line(ax, ay - 24, ax + side * 17, ay - 47, "#42382b", 5);
        p.line(ax + side * 17, ay - 47, ax + side * 20, ay - 68, "#42382b", 4);
        p.line(ax, ay - 24, ax + side * 17, ay - 47, "#9c8051", 3);
        p.line(ax + side * 17, ay - 47, ax + side * 20, ay - 68, "#b39660", 2);
        p.line(ax + side * 10, ay - 40, ax + side * 26, ay - 43, "#755d3e", 3);
      }
      p.line(ax, ay - 53, ax + 4, ay - 86, "#42382b", 5);
      p.line(ax, ay - 53, ax + 4, ay - 86, "#ae9160", 3);
      p.oval(ax, ay - 35, 2, 4, "#493f2c");
      return;
    }
    if (type === "spruce") {
      const pal = leafPalettes.spruce;
      for (let layer = 0; layer < 4; layer++) {
        const y = ay - 20 - layer * 18,
          rx = 35 - layer * 5;
        p.poly(
          [
            [ax, y - 35],
            [ax - rx, y],
            [ax - rx + 5, y + 4],
            [ax - 8, y + 8],
            [ax + rx - 5, y + 4],
            [ax + rx, y],
          ],
          pal[0],
        );
        p.poly(
          [
            [ax, y - 32],
            [ax - rx + 4, y],
            [ax - 8, y + 5],
            [ax + rx - 4, y + 1],
          ],
          pal[2],
        );
        p.poly(
          [
            [ax - 2, y - 28],
            [ax - rx + 8, y - 1],
            [ax - 7, y + 2],
            [ax + 8, y - 1],
          ],
          pal[3],
        );
        for (let i = 0; i < 25; i++) {
          const xx = ax + (rnd() - 0.5) * (rx - 4) * 1.5,
            yy = y - 2 - rnd() * 16;
          if (Math.abs(xx - ax) < (yy - (y - 35)) * 0.9) {
            p.line(xx, yy, xx - 3, yy + 3, pal[4]);
            if (i % 3 === 0) p.rect(xx - 2, yy, 1, 1, pal[5]);
          }
        }
      }
      return;
    }
    const pal = leafPalettes[type].map((hex) => {
      if (variant === 0) return hex;
      const value = parseInt(hex.slice(1), 16),
        delta = variant === 1 ? [4, 2, -3] : [-3, 0, 3];
      return (
        "#" +
        [16, 8, 0]
          .map((shift, i) =>
            Math.max(0, Math.min(255, ((value >> shift) & 255) + delta[i]))
              .toString(16)
              .padStart(2, "0"),
          )
          .join("")
      );
    });
    foliage(p, ax, ay - 49, w * 0.43, 23, pal, variant + 31);
    foliage(p, ax - 17, ay - 66, w * 0.28, 23, pal, variant + 91);
    foliage(p, ax + 16, ay - 72, w * 0.28, 24, pal, variant + 139);
    foliage(p, ax - 2, ay - (birch ? 90 : 84), w * 0.3, 18, pal, variant + 217);
    foliage(
      p,
      ax - 15,
      ay - (birch ? 91 : 85),
      w * 0.17,
      12,
      pal,
      variant + 413,
    );
  });
}
function character(coat, direction, frame, mood = "neutral", gesture = "none") {
  return sprite(24, 36, 12, 34, (p) => {
    const side = direction === "side",
      up = direction === "up",
      step = [0, 1, 0, -1][frame],
      skin = "#e8b77d",
      dark = "#44362e";
    p.rect(7, 27 + step, 4, 6, dark);
    p.rect(13, 27 - step, 4, 6, dark);
    p.rect(6, 32 + step, 5, 2, "#3a3531");
    p.rect(13, 32 - step, 6, 2, "#3a3531");
    p.border(5, 17, 14, 12, "#3e4031", coat);
    p.rect(8, 23, 8, 7, "#3d6276");
    p.rect(8, 19, 2, 9, "#638294");
    p.rect(14, 19, 2, 9, "#638294");
    p.rect(9, 20, 1, 2, "#dfc78d");
    p.rect(14, 20, 1, 2, "#dfc78d");
    p.rect(3, 18 - step, 3, 8, coat);
    p.rect(18, 18 + step, 3, 8, coat);
    p.rect(3, 24 - step, 3, 3, skin);
    p.rect(18, 24 + step, 3, 3, skin);
    if (gesture === "wave" || gesture === "cheer") {
      p.g.clearRect(18, 18 + step, 4, 11);
      p.rect(18, 14, 3, 8, coat);
      p.rect(20, 11 + (frame % 2), 3, 5, skin);
      if (gesture === "cheer") {
        p.g.clearRect(2, 17, 4, 12);
        p.rect(3, 13, 3, 9, coat);
        p.rect(1, 10 + (frame % 2), 3, 5, skin);
      }
    }
    p.g.save();
    if (mood === "tired") p.g.translate(side ? 1 : 0, 1);
    p.border(6, 7, 12, 12, dark, skin);
    p.rect(7, 9, 10, 5, "#f1ca91");
    p.rect(5, 11, 2, 4, skin);
    p.rect(17, 11, 2, 4, skin);
    if (up) {
      p.rect(6, 9, 12, 7, "#725236");
      p.rect(8, 15, 8, 3, "#6c4932");
    } else if (side) {
      p.rect(14, 11, 1, 2, "#293c35");
      p.rect(17, 13, 2, 2, "#c78d5d");
      p.rect(14, 16, 3, 1, "#955d43");
      p.rect(6, 8, 3, 8, "#725236");
    } else {
      p.rect(8, 11, 1, 2, "#293c35");
      p.rect(14, 11, 1, 2, "#293c35");
      p.rect(10, 16, 4, 1, "#975e42");
      p.rect(7, 15, 2, 1, "#de9c6c");
      p.rect(15, 15, 2, 1, "#de9c6c");
    }
    if (!up) {
      if (mood === "blink" || mood === "tired") {
        p.rect(side ? 13 : 7, 11, side ? 3 : 10, 3, "#f1ca91");
        if (side) p.rect(14, 12, 2, 1, "#293c35");
        else {
          p.rect(8, 12, 2, 1, "#293c35");
          p.rect(14, 12, 2, 1, "#293c35");
        }
      }
      if (mood === "tired") {
        p.rect(side ? 14 : 10, 16, 3, 1, "#9c6747");
        p.rect(18, 10, 1, 3, "#9ac7c0");
      }
      if (mood === "happy") {
        p.rect(side ? 14 : 10, 15, 4, 1, "#9c6747");
        p.rect(side ? 15 : 11, 16, 2, 1, "#9c6747");
      }
      if (mood === "yawn") {
        p.rect(side ? 15 : 11, 15, 2, 3, "#70503c");
      }
      if (mood === "focused") {
        p.rect(side ? 14 : 8, 10, 2, 1, "#795335");
        if (!side) p.rect(13, 10, 2, 1, "#795335");
      }
    }
    p.border(6, 2, 12, 6, "#6e5131", "#c9974e");
    p.rect(7, 3, 10, 2, "#efd184");
    p.rect(6, 7, 12, 2, "#956735");
    p.rect(3, 8, 18, 2, dark);
    p.rect(4, 8, 16, 1, "#e1bb6b");
    p.g.restore();
  });
}
function tent(purple = false, abandoned = false) {
  return sprite(96, 80, 48, 75, (p) => {
    const outline = "#4a3b30",
      shadow = purple ? "#5e4b79" : abandoned ? "#566b49" : "#ad743d",
      mid = purple ? "#9d83ad" : abandoned ? "#91a06a" : "#d5a55c",
      light = purple ? "#c5abc5" : abandoned ? "#b5bd82" : "#eed18b";
    p.poly(
      [
        [3, 72],
        [44, 7],
        [63, 13],
        [93, 72],
      ],
      outline,
    );
    p.poly(
      [
        [7, 70],
        [45, 10],
        [58, 16],
        [74, 70],
      ],
      mid,
    );
    p.poly(
      [
        [58, 16],
        [64, 16],
        [89, 70],
        [75, 70],
      ],
      shadow,
    );
    p.line(45, 12, 9, 69, light, 2);
    p.line(48, 16, 74, 69, light);
    p.poly(
      [
        [47, 21],
        [29, 70],
        [64, 70],
      ],
      outline,
    );
    p.poly(
      [
        [47, 26],
        [33, 69],
        [60, 69],
      ],
      "#283c32",
    );
    p.line(47, 22, 39, 68, shadow, 2);
    p.line(45, 9, 48, 72, "#d9bb7b");
    for (let y = 21; y < 69; y += 5)
      p.rect(14 + (69 - y) * 0.5, y, 1, 2, light);
    p.line(12, 66, 1, 76, "#bca476");
    p.line(83, 66, 95, 77, "#bca476");
    p.rect(0, 74, 3, 5, "#805b34");
    p.rect(92, 75, 3, 4, "#805b34");
    if (abandoned) {
      p.poly(
        [
          [71, 47],
          [78, 57],
          [69, 59],
        ],
        outline,
      );
      p.rect(18, 69, 7, 2, "#62824b");
    }
  });
}
function house() {
  return sprite(128, 128, 64, 124, (p) => {
    const outline = "#453d30";
    p.border(12, 61, 105, 61, outline, "#9a6238");
    p.rect(14, 111, 101, 12, "#777153");
    for (let row = 0; row < 8; row++) {
      const y = 65 + row * 6;
      p.rect(14, y, 101, 5, row % 2 ? "#ac773f" : "#ba8448");
      p.rect(14, y, 101, 1, "#d6a35c");
      for (let col = 0; col < 10; col++) {
        const x = 17 + col * 10 + (row % 2) * 3;
        p.rect(x, y + 3, 4, 1, "#8a572f");
      }
      for (const x of [12, 112]) {
        p.oval(x + 3, y + 2, 4, 2, "#5b432c");
        p.oval(x + 3, y + 1, 3, 1, "#d3a263");
      }
    }
    p.poly(
      [
        [21, 9],
        [106, 9],
        [127, 68],
        [1, 68],
      ],
      outline,
    );
    p.poly(
      [
        [23, 12],
        [104, 12],
        [123, 64],
        [5, 64],
      ],
      "#397552",
    );
    for (let row = 0; row < 9; row++) {
      const y = 13 + row * 6,
        left = 22 - row * 2,
        right = 105 + row * 2;
      p.rect(left, y, right - left, 2, "#255239");
      p.rect(left + 1, y + 2, right - left - 1, 1, "#63935c");
      for (let x = left + 3 + (row % 2) * 5; x < right - 4; x += 10) {
        p.rect(x, y + 3, 7, 1, "#4c8855");
        p.rect(x + 6, y + 4, 2, 2, "#254f37");
        p.rect(x + 1, y + 2, 2, 1, "#8aaa68");
      }
    }
    p.rect(17, 8, 95, 3, outline);
    p.rect(20, 8, 88, 1, "#82a567");
    p.rect(0, 65, 128, 6, outline);
    p.rect(3, 65, 122, 2, "#59905a");
    p.rect(4, 71, 120, 3, "#795430");
    p.poly(
      [
        [64, 49],
        [85, 77],
        [43, 77],
      ],
      outline,
    );
    p.poly(
      [
        [64, 54],
        [80, 74],
        [48, 74],
      ],
      "#41734c",
    );
    p.line(64, 52, 47, 74, "#8cab6b");
    p.border(55, 88, 19, 34, outline, "#825638");
    p.rect(58, 91, 12, 28, "#af7e44");
    for (const x of [60, 64, 68]) p.rect(x, 92, 1, 27, "#805331");
    p.rect(69, 106, 2, 2, "#e9c464");
    for (const x of [26, 89]) {
      p.border(x, 84, 16, 22, outline, "#bd9256");
      p.border(x + 2, 86, 12, 17, "#846138", "#f0cc78");
      p.rect(x + 3, 88, 4, 5, "#ffdfa0");
      p.rect(x + 7, 86, 2, 17, "#805b34");
      p.rect(x + 2, 93, 12, 2, "#805b34");
      p.rect(x - 1, 106, 18, 3, "#d8ad68");
    }
    p.border(91, 3, 12, 29, outline, "#7c7b69");
    for (let y = 6; y < 28; y += 5) {
      p.rect(92, y, 9, 1, "#aca58a");
      p.rect(96, y + 1, 1, 3, "#5c6558");
    }
    p.rect(89, 2, 16, 4, outline);
    p.rect(91, 2, 12, 1, "#c0b797");
    p.rect(51, 121, 26, 4, "#b1a47b");
    p.rect(48, 125, 32, 2, outline);
  });
}
function stall() {
  return sprite(96, 64, 48, 60, (p) => {
    p.border(12, 35, 73, 25, "#4e3b2d", "#a6733f");
    for (let x = 15; x < 84; x += 9) {
      p.rect(x, 38, 1, 19, "#72492d");
      p.rect(x + 2, 39, 2, 17, "#c38f4d");
    }
    p.rect(9, 34, 78, 4, "#e0b467");
    for (const x of [8, 84]) {
      p.rect(x, 12, 4, 24, "#5e432c");
      p.rect(x + 1, 13, 1, 22, "#c39b58");
    }
    p.poly(
      [
        [2, 22],
        [14, 5],
        [81, 5],
        [94, 22],
      ],
      "#4c3b2c",
    );
    p.poly(
      [
        [6, 20],
        [16, 8],
        [79, 8],
        [90, 20],
      ],
      "#e4c677",
    );
    for (let i = 0; i < 11; i++) {
      const x = 4 + i * 8;
      p.rect(x, 22, 8, 10, i % 2 ? "#b46e3f" : "#efd28b");
      p.rect(x + 1, 31, 6, 2, i % 2 ? "#885131" : "#c09d59");
    }
    p.rect(3, 21, 91, 2, "#74502c");
    p.border(27, 0, 43, 8, "#4c3b2c", "#88643c");
    for (let x = 31; x < 66; x += 4) p.rect(x, 3, 2, 2, "#e5c183");
    p.border(24, 42, 47, 12, "#704c30", "#d5b378");
  });
}
function logSprite() {
  return sprite(28, 10, 14, 7, (p) => {
    p.border(3, 1, 22, 8, "#513725", "#9e6536");
    p.rect(4, 2, 19, 2, "#c48a47");
    p.rect(5, 6, 18, 1, "#784a2e");
    p.oval(3, 5, 3, 4, "#6a442a");
    p.oval(24, 5, 3, 4, "#5f4029");
    p.oval(24, 4, 2, 3, "#ebc07b");
    p.rect(24, 3, 1, 3, "#ad793c");
  });
}
function detail(type, variant = 0) {
  return sprite(32, 32, 16, 27, (p) => {
    if (type === "rock") {
      p.poly(
        [
          [4, 25],
          [6, 15],
          [15, 9],
          [25, 13],
          [29, 24],
          [24, 28],
          [9, 28],
        ],
        "#465444",
      );
      p.poly(
        [
          [6, 23],
          [9, 16],
          [16, 12],
          [23, 15],
          [26, 23],
          [22, 26],
          [10, 26],
        ],
        "#8c9d80",
      );
      p.poly(
        [
          [9, 16],
          [16, 12],
          [23, 15],
          [21, 18],
          [11, 20],
        ],
        "#b4bba0",
      );
      p.line(21, 18, 24, 23, "#61765d");
    } else if (type === "fern") {
      for (let i = 0; i < 6; i++) {
        const x = 6 + i * 4,
          y = 14 + Math.abs(i - 2.5) * 2;
        p.line(16, 27, x, y, "#315f35", 2);
        for (let j = 0; j < 3; j++) {
          p.line(
            16 + ((x - 16) * (j + 1)) / 4,
            26 - ((26 - y) * (j + 1)) / 4,
            x - 3 + j,
            y + 4 + j * 2,
            "#538d3c",
          );
          p.rect(x + (j % 2), y + j * 2, 2, 1, "#8eb656");
        }
      }
    } else if (type === "mushroom") {
      for (const [x, y] of [
        [10, 22],
        [21, 25],
      ]) {
        p.rect(x, y - 4, 2, 5, "#e7d5a0");
        p.oval(x, y - 5, 5, 3, "#743c2c");
        p.oval(x, y - 6, 4, 2, variant % 2 ? "#c48b43" : "#c6603b");
        p.rect(x - 2, y - 7, 2, 1, "#f0cd91");
      }
    } else
      for (let i = 0; i < 4; i++) {
        const x = 7 + i * 6,
          y = 20 + (i % 2) * 4;
        p.line(x, 27, x - 1, y, "#3b7437");
        p.rect(x - 2, y - 1, 4, 3, variant % 2 ? "#ead984" : "#dfe8c1");
        p.rect(x - 1, y, 2, 1, variant % 2 ? "#b17e3f" : "#e1bc64");
      }
  });
}
function fire(frame, lit = true) {
  return sprite(40, 40, 20, 34, (p) => {
    p.oval(20, 31, 18, 7, "#414d39");
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2,
        x = 20 + Math.cos(a) * 16,
        y = 30 + Math.sin(a) * 6;
      p.oval(x, y, 4, 3, "#63735b");
      p.oval(x - 1, y - 1, 3, 2, "#b0b395");
    }
    p.line(10, 30, 30, 33, "#68432c", 5);
    p.line(12, 33, 28, 27, "#97623b", 4);
    if (!lit) return;
    p.poly(
      [
        [10, 29],
        [12, 18],
        [17, 22],
        [20 + frame - 1, 5],
        [25, 18],
        [27, 15],
        [32, 28],
        [25, 32],
        [16, 32],
      ],
      "#b94f2c",
    );
    p.poly(
      [
        [14, 29],
        [16, 22],
        [20, 25],
        [22, 12],
        [27, 26],
        [26, 30],
      ],
      "#ed8d36",
    );
    p.poly(
      [
        [18, 30],
        [19, 24],
        [23, 20],
        [25, 29],
      ],
      "#f8cd61",
    );
    p.rect(21, 27, 2, 3, "#fff0ad");
  });
}
function cart() {
  return sprite(52, 40, 26, 33, (p) => {
    p.line(2, 25, 49, 25, "#5e432d", 3);
    p.border(9, 10, 35, 19, "#5b412b", "#9d6d3e");
    for (let y = 12; y < 28; y += 5) {
      p.rect(10, y, 33, 1, "#ddb473");
      p.rect(10, y + 3, 33, 1, "#7c512f");
    }
    p.line(41, 25, 51, 30, "#7f5b35", 2);
    for (const x of [10, 42]) {
      p.oval(x, 30, 6, 7, "#433c2e");
      p.oval(x, 29, 4, 5, "#b18b53");
      p.line(x - 3, 29, x + 3, 29, "#694a2e");
      p.line(x, 25, x, 33, "#694a2e");
    }
  });
}
function animal(type, frame) {
  return sprite(24, 24, 12, 21, (p) => {
    if (type === "bird") {
      p.oval(12, 16, 6, 4, "#3b5c65");
      p.oval(14, 13, 3, 4, "#93b5ac");
      p.rect(16, 12, 1, 1, "#233c37");
      p.poly(
        [
          [17, 14],
          [22, 15],
          [17, 16],
        ],
        "#d6aa54",
      );
      p.line(10, 15, 4, frame ? 8 : 14, "#486d78", 3);
      p.rect(11, 20, 1, 2, "#6a5534");
    } else if (type === "rabbit") {
      p.oval(10, 17, 7, 4, "#a7a381");
      p.oval(14, 14, 4, 4, "#d4d0a9");
      p.oval(3, 15, 3, 3, "#ece2bb");
      p.rect(12, 4, 2, 8, "#dad6b2");
      p.rect(16, 5, 2, 7, "#c6c4a0");
      p.rect(13, 6, 1, 5, "#b79d84");
      p.rect(17, 13, 1, 1, "#2c4033");
      p.rect(7, 20 - frame, 4, 2, "#b9b590");
    } else {
      p.oval(5, 11, 4, 7, "#96512f");
      p.oval(11, 17, 6, 4, "#b77839");
      p.oval(16, 13, 4, 4, "#d49b50");
      p.poly(
        [
          [14, 10],
          [15, 5],
          [18, 10],
        ],
        "#874f30",
      );
      p.rect(18, 12, 1, 1, "#2d3e30");
      p.rect(10, 20 - frame, 4, 2, "#8d542e");
    }
  });
}
function ancient() {
  return sprite(184, 240, 92, 230, (p) => {
    p.poly(
      [
        [40, 231],
        [65, 212],
        [68, 115],
        [108, 110],
        [115, 206],
        [147, 232],
        [110, 230],
        [95, 237],
        [81, 228],
        [60, 234],
      ],
      "#3f3c2c",
    );
    p.poly(
      [
        [49, 229],
        [71, 208],
        [74, 114],
        [101, 114],
        [110, 209],
        [135, 229],
        [105, 225],
        [94, 231],
        [80, 223],
        [64, 228],
      ],
      "#805c35",
    );
    for (let i = 0; i < 9; i++)
      p.line(
        73 + i * 4,
        125,
        65 + i * 7,
        226,
        i % 2 ? "#a17a42" : "#5c462c",
        2,
      );
    const pal = leafPalettes.oak;
    foliage(p, 90, 124, 83, 47, pal, 889);
    foliage(p, 49, 89, 47, 45, pal, 83);
    foliage(p, 132, 83, 45, 46, pal, 123);
    foliage(p, 90, 55, 57, 48, pal, 341);
    foliage(p, 68, 27, 32, 22, pal, 411);
    p.oval(94, 193, 9, 15, "#473e2c");
    p.oval(93, 191, 6, 12, "#2c392c");
    p.oval(64, 229, 19, 4, "#567e3b");
  });
}
export function createPixelArt() {
  const sprites = {
    trees: {},
    characters: {},
    tent: tent(),
    merchantTent: tent(true),
    oldTent: tent(false, true),
    house: house(),
    stall: stall(),
    log: logSprite(),
    cart: cart(),
    ancient: ancient(),
    fire: [0, 1, 2].map((frame) => fire(frame)),
    unlitFire: fire(0, false),
    details: {},
    animals: {},
  };
  for (const type of ["oak", "birch", "spruce", "dead"])
    sprites.trees[type] = [0, 1, 2].map((v) => {
      const base = treeSprite(type, v);
      if (v !== 2) return base;
      const w = Math.round(base.width * 1.14),
        h = Math.round(base.height * 1.14);
      return sprite(
        w,
        h,
        Math.round(base.ax * 1.14),
        Math.round(base.ay * 1.14),
        (p) => p.g.drawImage(base.bitmap, 0, 0, w, h),
      );
    });
  for (const [role, coat] of [
    ["player", "#b8663c"],
    ["buyerA", "#967944"],
    ["buyerB", "#588d83"],
  ]) {
    sprites.characters[role] = {};
    for (const dir of ["down", "up", "side"])
      sprites.characters[role][dir] = [0, 1, 2, 3].map((f) =>
        character(coat, dir, f),
      );
  }
  for (const type of ["rock", "fern", "mushroom", "flowers"])
    sprites.details[type] = [0, 1].map((v) => detail(type, v));
  for (const type of ["bird", "rabbit", "squirrel"])
    sprites.animals[type] = [0, 1].map((f) => animal(type, f));
  sprites.stump = sprite(32, 20, 16, 15, (p) => {
    p.border(7, 7, 19, 9, "#5a432d", "#91643b");
    p.oval(16, 7, 10, 5, "#58442c");
    p.oval(16, 6, 9, 4, "#d5ac64");
    p.oval(16, 6, 5, 2, "#a67b3f");
    p.oval(16, 6, 3, 1, "#dfbc79");
    p.rect(9, 9, 2, 5, "#b88c49");
  });
  sprites.fence = sprite(16, 24, 8, 22, (p) => {
    p.border(5, 6, 6, 17, "#57412c", "#a37942");
    p.rect(6, 7, 2, 14, "#d9b273");
    p.rect(5, 5, 6, 2, "#efd092");
    p.rect(8, 10, 1, 4, "#896339");
    p.rect(6, 21, 5, 2, "#6c542f");
  });
  sprites.axes = AXE_TIERS.map((tier) =>
    [0, 1, 2].map((f) =>
      sprite(24, 24, 12, 19, (p) => {
        const points = [
          [9, 19, 11, 4],
          [5, 18, 18, 5],
          [3, 12, 21, 14],
        ][f];
        p.line(...points, "#553d2c", 3);
        p.line(...points, "#bd8b4d");
        const x = points[2],
          y = points[3];
        p.poly(
          [
            [x - 1, y - 3],
            [x + 7, y - 4],
            [x + 8, y + 3],
            [x + 1, y + 4],
          ],
          "#43564e",
        );
        p.poly(
          [
            [x, y - 2],
            [x + 6, y - 3],
            [x + 7, y + 2],
            [x + 2, y + 2],
          ],
          tier.color,
        );
        p.rect(x + 5, y - 2, 2, 4, tier.edge);
      }),
    ),
  );
  sprites.axe = sprites.axes[0];
  sprites.merchant = sprite(32, 40, 16, 36, (p) => {
    p.poly(
      [
        [3, 36],
        [7, 20],
        [9, 10],
        [16, 3],
        [23, 10],
        [25, 22],
        [29, 36],
      ],
      "#343b3e",
    );
    p.poly(
      [
        [6, 34],
        [10, 20],
        [11, 11],
        [16, 6],
        [21, 12],
        [22, 24],
        [26, 34],
      ],
      "#655b79",
    );
    p.line(11, 18, 9, 33, "#9b87a1");
    p.line(20, 19, 24, 32, "#4e4c66");
    p.oval(16, 15, 6, 8, "#2b3438");
    p.rect(12, 14, 2, 1, "#f5cc72");
    p.rect(18, 14, 2, 1, "#f5cc72");
    p.border(8, 25, 17, 8, "#433b32", "#9a7544");
    p.rect(15, 26, 1, 6, "#d6b781");
  });
  sprites.shadow = sprite(64, 20, 32, 10, (p) =>
    p.oval(32, 10, 30, 8, "#173a2b35"),
  );
  sprites.tentFrame = sprite(96, 80, 48, 75, (p) => {
    p.line(8, 71, 89, 71, "#9c7546", 3);
    p.line(46, 9, 46, 72, "#62472e", 3);
    p.line(47, 10, 47, 72, "#cba166");
    p.line(8, 70, 46, 9, "#b69560");
    p.line(46, 9, 89, 70, "#b69560");
    p.rect(5, 70, 5, 6, "#76512f");
    p.rect(87, 70, 5, 6, "#76512f");
    for (let x = 17; x < 82; x += 12) p.rect(x, 68, 9, 3, "#a6804a");
  });
  sprites.houseFrame = sprite(128, 128, 64, 124, (p) => {
    p.border(11, 110, 108, 14, "#62684f", "#a8a487");
    for (let x = 15; x < 116; x += 20) {
      p.rect(x, 73, 3, 44, "#795633");
      p.rect(x + 1, 74, 1, 42, "#d1a266");
    }
    p.line(12, 74, 116, 74, "#87623a", 3);
    p.line(4, 66, 64, 10, "#72502e", 3);
    p.line(64, 10, 124, 66, "#72502e", 3);
    p.line(4, 66, 124, 66, "#ba8d51", 3);
    p.line(30, 65, 64, 10, "#a78049", 2);
    p.line(64, 10, 98, 65, "#a78049", 2);
  });
  sprites.ripples = [0, 1, 2, 3].map((frame) =>
    sprite(18, 10, 9, 5, (p) => {
      p.oval(9, 5, 3 + frame * 2, 1 + frame, "#b8d8c47a");
      p.g.globalCompositeOperation = "destination-out";
      p.oval(9, 5, 2 + frame * 2, Math.max(0.5, frame), "#ffffff");
      p.g.globalCompositeOperation = "source-over";
    }),
  );
  const characterCache = new Map(),
    merchantCache = new Map(),
    coats = { player: "#b8663c", buyerA: "#967944", buyerB: "#588d83" };
  function person(role, direction, frame, mood = "neutral", gesture = "none") {
    if (mood === "neutral" && gesture === "none")
      return sprites.characters[role][direction][frame];
    const key = [role, direction, frame, mood, gesture].join(":");
    if (!characterCache.has(key)) {
      characterCache.set(
        key,
        character(coats[role], direction, frame, mood, gesture),
      );
      if (characterCache.size > 96)
        characterCache.delete(characterCache.keys().next().value);
    }
    return characterCache.get(key);
  }
  function merchantPose(action, frame = 0) {
    const key = action + ":" + (frame % 2);
    if (merchantCache.has(key)) return merchantCache.get(key);
    const s = sprite(32, 40, 16, 36, (p) => {
      p.g.drawImage(sprites.merchant.bitmap, 0, 0);
      if (action !== "read") {
        p.rect(8, 24, 17, 10, "#655b79");
        p.line(11, 24, 9, 33, "#9b87a1");
        p.line(21, 24, 24, 33, "#4e4c66");
      }
      if (action === "greet") {
        p.rect(25, 17, 4, 11, "#655b79");
        p.rect(27, 12 + (frame % 2), 3, 6, "#d9ba85");
      }
      if (action === "adjust") {
        p.rect(23, 15, 5, 8, "#655b79");
        p.rect(22, 11 + (frame % 2), 4, 4, "#d9ba85");
      }
      if (action === "look") {
        p.rect(10, 13, 13, 3, "#2b3438");
        p.rect(11 + (frame % 2) * 2, 14, 2, 1, "#f5cc72");
        p.rect(17 + (frame % 2) * 2, 14, 2, 1, "#f5cc72");
      }
      if (action === "peek") p.g.clearRect(0, 24, 32, 16);
    });
    merchantCache.set(key, s);
    return s;
  }
  function draw(ctx, s, x, y, scale = PIXEL_SCALE, flip = false) {
    ctx.imageSmoothingEnabled = false;
    const dx = Math.round(x / 2) * 2,
      dy = Math.round(y / 2) * 2;
    if (flip) {
      ctx.save();
      ctx.translate(dx, dy);
      ctx.scale(-1, 1);
      ctx.drawImage(
        s.bitmap,
        -s.ax * scale,
        -s.ay * scale,
        s.width * scale,
        s.height * scale,
      );
      ctx.restore();
    } else
      ctx.drawImage(
        s.bitmap,
        dx - s.ax * scale,
        dy - s.ay * scale,
        s.width * scale,
        s.height * scale,
      );
  }
  function contains(s, x, y, bx, by, scale = PIXEL_SCALE) {
    const px = Math.floor((x - bx) / scale + s.ax),
      py = Math.floor((y - by) / scale + s.ay);
    return (
      px >= 0 &&
      py >= 0 &&
      px < s.width &&
      py < s.height &&
      s.mask[py * s.width + px] > 64
    );
  }
  return {
    sprites,
    draw,
    contains,
    person,
    merchantPose,
    get cachedPeople() {
      return characterCache.size;
    },
  };
}
