import { pixelHash, CAMP } from "./pixel-art.js";
const SIZE = 128,
  WORLD_CHUNK = SIZE * 2,
  MAX_CHUNKS = 28;
export function createTerrain({
  center,
  pondOutline,
  streamOutline,
  trails,
  ancientTree,
}) {
  const cache = new Map();
  function bake(cx, cy) {
    const bitmap = document.createElement("canvas");
    bitmap.width = bitmap.height = SIZE;
    const mask = document.createElement("canvas");
    mask.width = mask.height = SIZE;
    const g = mask.getContext("2d", { willReadFrequently: true });
    g.setTransform(0.5, 0, 0, 0.5, -cx * SIZE, -cy * SIZE);
    const oval = (x, y, rx, ry) => {
      g.beginPath();
      g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
      g.fill();
    };
    g.fillStyle = "#ff0000";
    oval(center.x, center.y, 305, 265);
    oval(CAMP.merchant.x, CAMP.merchant.y + 12, 116, 92);
    oval(ancientTree.x, ancientTree.y, 190, 150);
    g.strokeStyle = "#ff0000";
    g.lineCap = g.lineJoin = "round";
    g.lineWidth = 64;
    for (const path of trails) {
      g.beginPath();
      path.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)));
      g.stroke();
    }
    for (const outline of [pondOutline, streamOutline]) {
      g.beginPath();
      outline.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)));
      g.closePath();
      g.strokeStyle = "#00ff00";
      g.lineWidth = 16;
      g.stroke();
      g.fillStyle = "#0000ff";
      g.fill();
    }
    const source = g.getImageData(0, 0, SIZE, SIZE).data,
      out = bitmap.getContext("2d"),
      image = out.createImageData(SIZE, SIZE),
      data = image.data;
    const ox = cx * SIZE,
      oy = cy * SIZE;
    for (let y = 0; y < SIZE; y++)
      for (let x = 0; x < SIZE; x++) {
        const i = (y * SIZE + x) * 4,
          wx = ox + x,
          wy = oy + y,
          n = pixelHash(wx, wy),
          dust = n % 101;
        let r, gr, b;
        const marked = source[i + 3] > 120;
        if (
          marked &&
          source[i + 2] > source[i] &&
          source[i + 2] > source[i + 1]
        ) {
          const shade = (n >>> 12) % 4;
          [r, gr, b] = [
            [48, 115, 140],
            [51, 124, 146],
            [55, 132, 152],
            [61, 142, 158],
          ][shade];
          if (wy % 13 === 0 && wx % 23 < 7) {
            r = 91;
            gr = 164;
            b = 173;
          }
        } else if (marked && source[i + 1] > source[i]) {
          [r, gr, b] =
            dust < 10
              ? [158, 133, 74]
              : dust > 87
                ? [206, 181, 110]
                : [185, 159, 91];
        } else if (marked) {
          [r, gr, b] =
            dust < 7
              ? [185, 141, 73]
              : dust > 91
                ? [226, 192, 119]
                : [215, 178, 99];
          if ((n >>> 16) % 80 === 0) {
            r = 166;
            gr = 130;
            b = 67;
          }
        } else {
          const cell = pixelHash(Math.floor(wx / 6), Math.floor(wy / 6)),
            px = (wx + ((cell >>> 4) % 4)) % 6,
            py = (wy + ((cell >>> 8) % 3)) % 6;
          [r, gr, b] =
            dust < 12 ? [65, 148, 59] : [73 + (n % 3), 158 + (n % 4), 61];
          if (
            cell % 5 !== 0 &&
            ((py === 4 && (px === 1 || px === 4)) || (py === 3 && px === 2))
          )
            [r, gr, b] = [43, 121, 51];
          if (
            cell % 4 !== 0 &&
            ((py === 2 && px === 2) || (py === 3 && px === 4))
          )
            [r, gr, b] = [112, 186, 72];
          if (cell % 13 === 0 && py === 4 && px === 3)
            [r, gr, b] = [157, 202, 90];
        }
        data[i] = r;
        data[i + 1] = gr;
        data[i + 2] = b;
        data[i + 3] = 255;
      }
    out.putImageData(image, 0, 0);
    return bitmap;
  }
  function draw(ctx, camera, view) {
    const x0 = Math.floor(camera.x / WORLD_CHUNK),
      x1 = Math.floor((camera.x + view.width) / WORLD_CHUNK),
      y0 = Math.floor(camera.y / WORLD_CHUNK),
      y1 = Math.floor((camera.y + view.height) / WORLD_CHUNK);
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const key = x + "," + y;
        let chunk = cache.get(key);
        if (!chunk) {
          chunk = bake(x, y);
          cache.set(key, chunk);
        } else {
          cache.delete(key);
          cache.set(key, chunk);
        }
        ctx.drawImage(
          chunk,
          x * WORLD_CHUNK,
          y * WORLD_CHUNK,
          WORLD_CHUNK,
          WORLD_CHUNK,
        );
      }
    while (cache.size > MAX_CHUNKS) {
      const first = cache.keys().next().value;
      cache.delete(first);
    }
  }
  return {
    draw,
    get cachedChunks() {
      return cache.size;
    },
    maxChunks: MAX_CHUNKS,
  };
}
