import {prepareGroundMaterials,sampleNaturalGround} from '../../game/ground-surfaces.js';
import { sampleMaterial } from "../../game/biome-terrain.js";
import { pixelHash, CAMP } from "../../pixel-art.js";
const SIZE = 128,
  PAD = 8,
  MASK_SIZE = SIZE + PAD * 2,
  WORLD_CHUNK = SIZE * 2,
  MAX_CHUNKS = 28;

// Six baked pixels = twelve world units. Padding keeps the same fringe at chunk seams.
export function pathGrassWeight(source, stride, x, y, hash) {
  const alpha=(y*stride+x)*4+3;
  for (let distance=1; distance<=6; distance++) {
    const dx=distance*4, dy=dx*stride;
    if (source[alpha-dx]<60 || source[alpha+dx]<60 || source[alpha-dy]<60 || source[alpha+dy]<60)
      return Math.min(.9, (7-distance)/7 * (.9+(hash%5)*.05));
  }
  return 0;
}
export function createForestGround({
  center,
  pondOutline,
  streamOutline,
  trails,
  ancientTree,
  clearings = [],
  locations = [],
  merchant = CAMP.merchant,
  biomeAt = () => "forest",
  materials = null,
  fortressFloor = null,
  worksSurfaces = () => [],
  streamCrossings = [],
  sceneryTrails = () => [],
}) {
  const cache = new Map();
  if(materials)materials=prepareGroundMaterials(materials);
  function bake(cx, cy) {
    const bitmap = document.createElement("canvas");
    bitmap.width = bitmap.height = SIZE;
    const mask = document.createElement("canvas");
    mask.width = mask.height = MASK_SIZE;
    const g = mask.getContext("2d", { willReadFrequently: true });
    g.setTransform(0.5, 0, 0, 0.5, -cx * SIZE + PAD, -cy * SIZE + PAD);
    const oval = (x, y, rx, ry) => {
      g.beginPath();
      g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
      g.fill();
    };
    g.fillStyle = "#ff0000";
    g.beginPath();g.roundRect(center.x-375,center.y-375,750,750,28);g.fill();
    oval(merchant.x, merchant.y + 12, 116, 92);
    oval(ancientTree.x, ancientTree.y, 190, 150);
    for (const site of clearings)
      oval(site.x, site.y, site.clearing * 0.7, site.clearing * 0.5);
    // Reuse the generated dirt material for the sawmill yard, baked only per chunk.
    for (const location of locations)
      if (location.clearGround) {
        const b = location.bounds;
        g.fillRect(b.x + 16, b.y + 16, b.width - 32, b.height - 32);
      }
    g.strokeStyle = "#ff0000";
    g.lineCap = g.lineJoin = "round";
    g.lineWidth = 64;
    for (const path of [...trails,...sceneryTrails()]) {
      g.lineWidth = path.width || 64;
      g.beginPath();
      g.moveTo(path[0].x,path[0].y);
      if(path.scenic||path.length<3)for(const p of path.slice(1))g.lineTo(p.x,p.y);
      else{
        for(let i=1;i<path.length-1;i++){const p=path[i],next=path[i+1];g.quadraticCurveTo(p.x,p.y,(p.x+next.x)/2,(p.y+next.y)/2);}
        const end=path.at(-1);g.lineTo(end.x,end.y);
      }
      g.stroke();
    }
    for(const area of worksSurfaces()){
      if(area.kind==="water"){g.strokeStyle="#00ff00";g.lineWidth=16;g.strokeRect(area.x,area.y,area.width,area.height);}
      g.fillStyle=area.kind==="water"?"#0000ff":area.kind==="shore"?"#00ff00":"#ff0000";
      g.fillRect(area.x,area.y,area.width,area.height);
    }
    const outlines=[pondOutline,streamOutline].filter(o=>o?.length);
    for (const outline of outlines) {
      g.beginPath();
      outline.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)));
      g.closePath();
      g.strokeStyle = "#00ff00";
      g.lineWidth = 16;
      g.stroke();
    }
    // Fill the union after both bank strokes: no green seam where the stream joins the lake.
    for(const outline of outlines){g.beginPath();outline.forEach((p,i)=>i?g.lineTo(p.x,p.y):g.moveTo(p.x,p.y));g.closePath();g.fillStyle="#0000ff";g.fill();}
    g.save();g.beginPath();for(const outline of outlines){outline.forEach((p,i)=>i?g.lineTo(p.x,p.y):g.moveTo(p.x,p.y));g.closePath();}g.clip();
    g.fillStyle="#0080ff";for(const f of streamCrossings)g.fillRect(f.x-f.width/2,f.y-f.height/2,f.width,f.height);g.restore();
    const source = g.getImageData(0, 0, MASK_SIZE, MASK_SIZE).data,
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
        const j = ((y + PAD) * MASK_SIZE + x + PAD) * 4;
        const marked = source[j + 3] > 120;
        const water =
          marked && source[j + 2] > source[j] && source[j + 2] > source[j + 1];
        const bank = marked && !water && source[j + 1] > source[j];
        const ford=water&&source[j+1]>80;
        if (materials) {
          if (marked)
            [r, gr, b] = sampleMaterial(
              materials,
              water ? "water" : bank ? "shore" : "dirt",
              wx,
              wy,
            );
          else [r, gr, b] = sampleNaturalGround(materials, wx, wy);
          if(ford){const shore=sampleMaterial(materials,"shore",wx,wy);r=r*.55+shore[0]*.45;gr=gr*.55+shore[1]*.45;b=b*.55+shore[2]*.45;}
          // Bake a low-contrast, irregular fringe using the same blended biome as the grass.
          if (marked && !water && !bank) {
            const weight = pathGrassWeight(source, MASK_SIZE, x+PAD, y+PAD, n);
            if (weight) {
              const grass = sampleNaturalGround(materials, wx, wy);
              r=r*(1-weight)+grass[0]*weight;
              gr=gr*(1-weight)+grass[1]*weight;
              b=b*(1-weight)+grass[2]*weight;
            }
          }
          const floor = fortressFloor?.(wx * 2, wy * 2, n);
          if (floor) [r, gr, b] = floor;
          data[i] = r;
          data[i + 1] = gr;
          data[i + 2] = b;
          data[i + 3] = 255;
          continue;
        }
        // Coherent patches and sparse clusters: detail without per-pixel static.
        const nx = wx / 36,
          ny = wy / 36,
          ix = Math.floor(nx),
          iy = Math.floor(ny);
        const fx = nx - ix,
          fy = ny - iy,
          sx = fx * fx * (3 - 2 * fx),
          sy = fy * fy * (3 - 2 * fy);
        const noise = (x, y) => (pixelHash(x, y) % 1000) / 1000;
        const upper = noise(ix, iy) * (1 - sx) + noise(ix + 1, iy) * sx;
        const lower = noise(ix, iy + 1) * (1 - sx) + noise(ix + 1, iy + 1) * sx;
        const patch = Math.min(
          2,
          Math.floor((upper * (1 - sy) + lower * sy) * 3),
        );
        const cell = pixelHash(Math.floor(wx / 9), Math.floor(wy / 8));
        const px = (((wx + (cell % 5)) % 9) + 9) % 9,
          py = (((wy + ((cell >>> 5) % 5)) % 8) + 8) % 8;
        if (water) {
          [r, gr, b] = [
            [52, 102, 111],
            [57, 112, 119],
            [62, 120, 124],
          ][patch];
          if (wy % 17 === 0 && (wx + Math.floor(wy / 17) * 7) % 31 < 10)
            [r, gr, b] = [119, 163, 155];
        } else if (bank) {
          [r, gr, b] =
            dust < 5
              ? [154, 138, 96]
              : dust > 97
                ? [208, 192, 143]
                : [186, 170, 119];
        } else if (marked) {
          [r, gr, b] = [
            [190, 161, 109],
            [194, 166, 115],
            [198, 171, 121],
          ][patch];
          if (dust < 3) [r, gr, b] = [165, 140, 94];
          if (dust > 97) [r, gr, b] = [217, 190, 136];
          // Wisps of grass grow into the edge of the trail.
          const grassNear = [
            [-3, 0],
            [3, 0],
            [0, -3],
            [0, 3],
          ].some(([dx, dy]) => {
            const xx = x + dx,
              yy = y + dy;
            return (
              xx >= -3 &&
              xx < SIZE + 3 &&
              yy >= -3 &&
              yy < SIZE + 3 &&
              source[((yy + PAD) * MASK_SIZE + xx + PAD) * 4 + 3] < 60
            );
          });
          if (
            grassNear &&
            cell % 3 === 0 &&
            ((px === 2 && py > 3 && py < 7) || (px === 4 && py > 4 && py < 8))
          )
            [r, gr, b] = [110, 139, 75];
        } else {
          [r, gr, b] = [
            [100, 132, 72],
            [104, 138, 75],
            [110, 143, 79],
          ][patch];
          if (
            cell % 3 !== 0 &&
            ((px === 3 && py === 4) ||
              (px === 6 && py === 6) ||
              (px === 2 && py === 5))
          )
            [r, gr, b] = [77, 111, 63];
          if (
            cell % 3 !== 0 &&
            ((px === 3 && py === 3) || (px === 5 && py === 5))
          )
            [r, gr, b] = [146, 164, 91];
          if (cell % 23 === 0 && px === 5 && py === 4)
            [r, gr, b] = [205, 194, 130];
        }
        const biome = biomeAt(wx * 2, wy * 2);
        if (!materials && !marked && biome === "mystery") {
          r = Math.round(r * 0.88);
          gr = Math.round(gr * 0.68);
          b = Math.round(b * 1.15);
        } else if (!materials && !marked && biome === "ruins") {
          r = Math.round(r * 0.9);
          gr = Math.round(gr * 0.9);
          b = Math.round(b * 1.06);
        }
        data[i] = r;
        data[i + 1] = gr;
        data[i + 2] = b;
        data[i + 3] = 255;
      }
    out.putImageData(image, 0, 0);
    return bitmap;
  }
  function getChunk(x, y) {
    const key = x + "," + y;
    let chunk = cache.get(key);
    if (!chunk) chunk = bake(x, y);
    cache.delete(key);
    cache.set(key, chunk);
    while (cache.size > MAX_CHUNKS) cache.delete(cache.keys().next().value);
    return chunk;
  }
  function draw(ctx, camera, view) {
    const x0 = Math.floor(camera.x / WORLD_CHUNK),
      x1 = Math.floor((camera.x + view.width) / WORLD_CHUNK),
      y0 = Math.floor(camera.y / WORLD_CHUNK),
      y1 = Math.floor((camera.y + view.height) / WORLD_CHUNK);
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const chunk = getChunk(x, y);
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
    getChunk,
    invalidate(affected){for(const key of cache.keys()){const [x,y]=key.split(",").map(Number);if(affected(x,y))cache.delete(key);}},
    get cachedChunks() {
      return cache.size;
    },
    maxChunks: MAX_CHUNKS,
  };
}
