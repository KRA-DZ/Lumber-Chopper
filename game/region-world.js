import {FOREST_CAMP,LOOKOUT,forestTaskReserved} from "./forest-tasks-layout.js";
import { CENTER } from "./config.js";
import {STREAM_OUTLINE,STREAM_CROSSINGS,streamWater,streamCollision,streamReserved} from "./camp-stream.js";
import { CAMP, random, pixelHash } from "../pixel-art.js";
import { REGIONS, REGION_BOUNDS, REGION_SIZE, regionAt } from "./regions.js";
import { FORTRESS, insideLocation } from "./locations.js";
import { SAWMILL } from "./sawmill.js";
import { regionTrails } from "./region-trails.js";
import { biomeDressing } from "./biome-dressing.js";
import { makeBoulders } from "./mining.js";
import {composeForest,activityBranches} from './forest-composition.js';
import { initialWorldWorks, worksWater, worksCollision, worksReserved, worksSurfaces, WORKS_WALLS } from "./world-works-layout.js";

export function createRegionWorld(regions, state = {worldWorks:initialWorldWorks()}) {
  const trees = [], boulders = [], berryBushes = [],
    bins = new Map(),
    decorBins = new Map(),
    biomeDetails = new Map(),
    landmarks = [],
    trails = [],
    trailBins = new Map(),
    forestLayouts = new Map();
  const ancientTree = {
    x: CENTER.x + REGION_SIZE,
    y: CENTER.y,
    radius: 65,
    workerOnly: true,
    infinite: true,
    regionId: "1:0",
  };
  const merchant = { x: 1670, y: CENTER.y + REGION_SIZE - 90, regionId: "0:1" };
  const pond = { x: CENTER.x - REGION_SIZE, y: CENTER.y, rx: 235, ry: 165 };
  const pondOutline = Array.from({ length: 40 }, (_, i) => {
    const a = (i / 40) * Math.PI * 2,
      f = 1 + 0.06 * Math.sin(a * 5);
    return {
      x: pond.x + Math.cos(a) * pond.rx * f,
      y: pond.y + Math.sin(a) * pond.ry * f,
    };
  });
  const streamOutline = STREAM_OUTLINE;
  for (const r of REGIONS) {
    const type =
      r.activity === "ruins"
        ? "ruins"
        : r.activity === "arch"
          ? "arch"
          : r.activity === "wagon"
            ? "wagon"
            : r.activity === "camp-site"
              ? "camp"
              : r.activity === "forest"
                ? "log"
                : null;
    if (type)
      landmarks.push({
        id: `site:${r.id}`,
        name: r.name,
        type,
        x: r.cx,
        y: r.cy,
        clearing: 230,
        regionId: r.id,
      });
    if (r.activity === "ruins")
      for (const [i, dx, dy] of [
        [0, -120, 105],
        [1, 155, 60],
      ])
        landmarks.push({
          id: `chest:${r.id}:${i}`,
          name: "Сундук крепости",
          type: "chest",
          x: r.cx + dx,
          y: r.cy + dy,
          clearing: 90,
          regionId: r.id,
        });
    const paths = regionTrails(r);
    trailBins.set(r.id, paths);
    trails.push(...paths);
  }
  landmarks.push({...FOREST_CAMP,type:"task-clearing",clearing:300},{...LOOKOUT,type:"task-clearing",clearing:160});
  const locations = [FORTRESS, SAWMILL];
  // Relocate existing IDs: rewards, story evidence and journal routes stay valid.
  for (const chest of FORTRESS.chests)
    Object.assign(
      landmarks.find((p) => p.id === chest.id),
      chest,
    );
  const clues = [
    {
      id: "note",
      x: 1290,
      y: 1380,
      name: "Записка у лагеря",
      text: "«Карта не заканчивается у деревьев. Ищи указатели на краю поляны: за каждой границей — другой лес. Дуб на востоке помнит тех, кто пришёл раньше нас.»",
    },
    {
      id: "ruins-note",
      x: 1420,
      y: -130,
      name: "Дневник смотрителя",
      text: "«Сундуки крепости закрыты не замками. Мы убрали печати, но к утру они появились снова. Тот, кто торгует на юге, знает цену ключу.»",
    },
    {
      id: "pond-note",
      x: -160,
      y: 1800,
      name: "Письмо рыбака",
      text: "«На закате вода становится зеркалом. Только отражение на другом берегу продолжает двигаться. Удочки оставили в сарае — однажды мы вернёмся.»",
    },
    {
      id: "oak-note",
      x: 3380,
      y: 1780,
      name: "Зарубки у дуба",
      text: "«Одному этот ствол не одолеть. Наши работники брали древесину неделями, но наутро следы топоров исчезали. Корни уходят под весь лес.»",
    },
    {
      id: "merchant-note",
      x: 1490,
      y: 3590,
      name: "Обрывок договора",
      text: "«Он не просит назвать имя. Он его уже знает. Никогда не бери товар, которого нет на прилавке. На обратной стороне — след ладони и незамкнутый круг.»",
    },
    {
      id: "tracks",
      x: 3420,
      y: -240,
      name: "Следы у ворот",
      text: "«Отпечатки идут только в одну сторону. Между шагами слишком большое расстояние. За воротами кто-то считал наши костры.»",
    },
    {
      id: "mark",
      x: 3595,
      y: -320,
      name: "Знак на камне",
      text: "«Пять рядов, пять столбцов. В середине — огонь. Не все границы были поставлены людьми.»",
    },
  ];
  const diary = clues.find((c) => c.id === "ruins-note");
  Object.assign(
    diary,
    FORTRESS.clues.find((c) => c.id === diary.id),
  );
  clues.push(...FORTRESS.clues.filter((c) => c.id !== diary.id));
  clues.push(...SAWMILL.clues);
  function inWater(x, y) {
    const dx = (x - pond.x) / pond.rx,
      dy = (y - pond.y) / pond.ry;
    return dx * dx + dy * dy < 1 || streamWater(x,y) || worksWater(state,x,y);
  }
  function waterCollision(x, y, r = 10) {
    return (
      ((x - pond.x) / (pond.rx + r)) ** 2 +
        ((y - pond.y) / (pond.ry + r)) ** 2 <
      1 || streamCollision(x,y,r) || worksCollision(state,x,y,r)
    );
  }
  function segmentDistance(p, a, b) {
    const dx = b.x - a.x,
      dy = b.y - a.y,
      t = Math.max(
        0,
        Math.min(
          1,
          ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1),
        ),
      );
    return Math.hypot(p.x - a.x - dx * t, p.y - a.y - dy * t);
  }
  function nearTrail(p, width = 50) {
    const r = regionAt(p.x, p.y);
    return !!r && trailBins.get(r.id).some(path =>
      path.some((end, i) => i > 0 && segmentDistance(p, path[i - 1], end) < width));
  }
  function reserved(x, y, r) {
    return (
      worksReserved(x,y,75) || streamReserved(x,y,75) || forestTaskReserved(x,y,75) ||
      (r.id==="0:0"&&(Math.hypot(x-1184,y-2048)<100||Math.abs(x-1184)<125&&y>1988&&y<2348)) ||
      locations.some(
        (l) => l.regionId === r.id && insideLocation(l, x, y, 72),
      ) ||
      nearTrail({ x, y }, 90) ||
      waterCollision(x, y, 75) ||
      (r.activity === "pond" &&
        Math.hypot(x - (pond.x + 225), y - (pond.y + 175)) < 250) ||
      (r.id === "0:0" && Math.hypot(x - CENTER.x, y - CENTER.y) < 520) ||
      Math.hypot(x - ancientTree.x, y - ancientTree.y) < 290 ||
      Math.hypot(x - merchant.x, y - merchant.y) < 220 ||
      landmarks.some(
        (p) => p.regionId === r.id && Math.hypot(x - p.x, y - p.y) < p.clearing,
      ) ||
      clues.some((p) => Math.hypot(x - p.x, y - p.y) < 95) ||
      (r.id === "0:0" && x > 1240 && x < 1535 && y > 1710 && y < 2220)
    );
  }
  function generate(region) {
    if (bins.has(region.id)) return;
    const rnd = random(pixelHash(region.gx, region.gy)),
      list = [],
      decor = [];
    const types = ["oak", "birch", "spruce", "dead"],
      hp = { oak: 4, birch: 3, spruce: 5, dead: 2 },
      values = { oak: 10, birch: 12, spruce: 15, dead: 8 };
    const details = biomeDressing(region, trailBins.get(region.id), (x, y) => !reserved(x, y, region));
    // Jittered cells preserve generous routes without rendering a huge prebuilt map.
    for (let gy = 0; gy < 12; gy++)
      for (let gx = 0; gx < 12; gx++) {
        const x = region.x + 80 + gx * ((REGION_SIZE - 160) / 12) + (rnd() - 0.5) * 75,
          y = region.y + 80 + gy * ((REGION_SIZE - 160) / 12) + (rnd() - 0.5) * 75;
        if (
          reserved(x, y, region) || (pixelHash(gx + region.gx * 12, gy + region.gy * 12) % 2 === 0) ||
          details.some((p, i) => Math.hypot(p.x - x, p.y - y) < (i < 3 ? 150 : 64)) ||
          (region.biome === "field" && rnd() < 0.55)
        )
          continue;
        const index = (region.gy + 2) * 5 + region.gx + 2,
          legacyIndex = index * 200 + gy * 12 + gx,
          type = types[Math.floor(rnd() * 4)],
          size = legacyIndex % 3;
        const t = {
          id: `${region.id}/${gx}:${gy}`,
          regionId: region.id,
          legacyIndex,
          x,
          y,
          type,
          size,
          radius: 25,
          value: values[type],
          hp: hp[type] + (size === 2 ? 2 : 0),
          maxHp: hp[type] + (size === 2 ? 2 : 0),
          cutDay: null,
          shake: 0,
        };
        list.push(t);
        trees.push(t);
      }
    for (let i = 0; i < 85; i++) {
      const x = region.x + 40 + rnd() * (REGION_SIZE - 80),
        y = region.y + 40 + rnd() * (REGION_SIZE - 80);
      if (
        locations.some(
          (l) => l.regionId === region.id && insideLocation(l, x, y, 32),
        ) ||
        waterCollision(x, y, 20) ||
        worksReserved(x,y,20) || streamReserved(x,y,20) || forestTaskReserved(x,y,20) ||
        nearTrail({ x, y }, 45) ||
        (region.id === "0:0" && Math.hypot(x - 1600, y - 1600) < 310)
      )
        continue;
      decor.push({
        type: ["fern", "mushroom", "rock", "flowers"][Math.floor(rnd() * 4)],
        variant: Math.floor(rnd() * 2),
        x,
        y,
      });
    }
    if(["forest","swamp","shore","field"].includes(region.biome)){
      const candidates=[...(region.id==="0:0"?[{x:1184,y:2048}]:[]),...details,...decor],picked=[];
      for(const p of candidates){
        if(picked.length>=5)break;
        if(forestTaskReserved(p.x,p.y,75)||waterCollision(p.x,p.y,45)||locations.some(l=>insideLocation(l,p.x,p.y,80))||clues.some(c=>Math.hypot(c.x-p.x,c.y-p.y)<100)||
          Math.hypot(p.x-1600,p.y-1600)<540||Math.hypot(p.x-ancientTree.x,p.y-ancientTree.y)<260||Math.hypot(p.x-merchant.x,p.y-merchant.y)<180||nearTrail(p,60)||(region.id==="-1:0"&&Math.hypot(p.x-pond.x-265,p.y-pond.y-175)<150)||list.some(t=>Math.hypot(t.x-p.x,t.y-p.y)<80||Math.abs(t.x-p.x)<105&&t.y>p.y-30&&t.y<p.y+260)||picked.some(b=>Math.hypot(b.x-p.x,b.y-p.y)<220))continue;
        const i=picked.length,b={id:`berry:${region.id}:${i}`,x:p.x,y:p.y,variant:i%3,regionId:region.id,decorative:i>=3,flowering:i===3};picked.push(b);berryBushes.push(b);
      }
    }
    bins.set(region.id, list);
    decorBins.set(region.id, decor);
    biomeDetails.set(region.id, details);
    boulders.push(...makeBoulders(region, (x,y,r) => reserved(x,y,r) || berryBushes.some(b=>Math.hypot(b.x-x,b.y-y)<90) || list.some(t => Math.hypot(t.x-x,t.y-y) < 150)));
    // Keep original RNG/resource identities, berries and stone; compose only afterwards.
    const bushes=berryBushes.filter(p=>p.regionId===region.id),rocks=boulders.filter(p=>p.regionId===region.id);
    const targets=[...bushes.filter(p=>!p.decorative),...locations.filter(p=>p.regionId===region.id).map(p=>p.entrance),
      ...[FOREST_CAMP,LOOKOUT].filter(p=>p.regionId===region.id),...clues.filter(p=>regionAt(p.x,p.y)?.id===region.id)];
    const branchSafe=(x,y)=>!waterCollision(x,y,28)&&!worksReserved(x,y,35)&&
      !locations.some(l=>insideLocation(l,x,y,40))&&rocks.every(p=>Math.hypot(p.x-x,p.y-y)>85);
    const branches=activityBranches(trailBins.get(region.id),targets,branchSafe);
    trailBins.get(region.id).push(...branches);trails.push(...branches);
    const focus=[ancientTree,merchant,...bushes,...landmarks.filter(p=>p.regionId===region.id),...clues,
      ...locations.filter(p=>p.regionId===region.id).map(p=>p.entrance)];
    const canPlant=(x,y)=>!reserved(x,y,region)&&!waterCollision(x,y,130)&&
      rocks.every(p=>Math.hypot(p.x-x,p.y-y)>150)&&details.every(p=>Math.hypot(p.x-x,p.y-y)>80)&&
      focus.every(p=>Math.hypot(p.x-x,p.y-y)>100&&!(Math.abs(p.x-x)<145&&y>p.y-30&&y<p.y+340));
    forestLayouts.set(region.id,composeForest(region,list,canPlant));
    // Keep small passable decor off the new paths and open clearings.
    const layout=forestLayouts.get(region.id);
    for(let i=decor.length-1;i>=0;i--){const p=decor[i];if(nearTrail(p,60)||layout.clearings.some(c=>Math.hypot(c.x-p.x,c.y-p.y)<c.radius)||list.some(t=>Math.hypot(t.x-p.x,t.y-p.y)<45))decor.splice(i,1);}
    for(let i=details.length-1;i>=0;i--)if(nearTrail(details[i],90)||layout.clearings.some(c=>Math.hypot(c.x-details[i].x,c.y-details[i].y)<c.radius))details.splice(i,1);
  }
  function treesNear(view) {
    const result = [];
    for (const r of REGIONS)
      if (
        bins.has(r.id) &&
        r.x < view.x + view.width &&
        r.x + r.width > view.x &&
        r.y < view.y + view.height &&
        r.y + r.height > view.y
      )
        result.push(...bins.get(r.id));
    return result;
  }
  generate(REGIONS.find((r) => r.id === "0:0"));
  return {
    regional: true,
    bounds: REGION_BOUNDS,
    regions,
    trees,
    boulders,
    berryBushes,
    riverPlants:[{x:1050,y:2010},{x:650,y:2048},{x:480,y:1910},{x:80,y:1968},{x:-260,y:1920},{x:-600,y:1810}].map(p=>({...p,regionId:regionAt(p.x,p.y)?.id})),
    landmarks,
    locations,
    trails,
    ancientTree,
    merchant,
    pond,
    pondOutline,
    streamOutline,
    streamCrossings:STREAM_CROSSINGS,
    taskObstacles:[{x:LOOKOUT.x-36,y:LOOKOUT.y-70,r:14},{x:LOOKOUT.x+36,y:LOOKOUT.y-70,r:14}],
    bridge: null,
    clues,
    inWater,
    waterCollision,
    worksSurfaces:()=>worksSurfaces(state),
    worksRevision:()=>state.worldWorks.revision,
    worksWalls:()=>WORKS_WALLS.filter(w=>regions.isOpen(w.a)&&(!w.project||!state.worldWorks.built[w.project])),
    nearTrail,
    segmentDistance,
    generate,
    treesNear,
    decorBins,
    biomeDetails,
    forestLayouts,
    biomeAt: (x, y) => regionAt(x, y)?.biome || "forest",
    campItems: [
      { type: "tools", x: 1640, y: 1645, min: 0 },
      { type: "bench", x: 1510, y: 1672, min: 1 },
      { type: "firewood", x: 1815, y: 1470, min: 1 },
      { type: "supplies", x: 1360, y: 1505, min: 2 },
      { type: "clothes", x: 1690, y: 1340, min: 3 },
    ],
  };
}
