import { CAMP } from "./game/camp-layout.js";
import { CAMP_PROJECTS, constructionStage, hasCampBuilding, selectedCampProject } from "./game/camp-projects.js";
export const STAGE_COSTS = Object.freeze(CAMP_PROJECTS.map(p => p.cost));
export function stageRatio(state) {
  return Math.max(
    0,
    Math.min(1, state.buildWood / (STAGE_COSTS[constructionStage(state)] || 1)),
  );
}
export function fencePlan(center = { x: 1600, y: 1600 }) {
  const perimeter = Array.from({ length: 32 }, (_, id) => {
    const side=Math.floor((id+4)/8)%4,t=((id+4)%8)/8;
    const points=[[1,-1+2*t],[1-2*t,1],[-1,1-2*t],[-1+2*t,-1]];
    const [x,y]=points[side];
    return { id, x:center.x+x*CAMP.fenceRX, y:center.y+y*CAMP.fenceRY };
  });
  const middles = new Set([0, 8, 16, 24]), posts = perimeter.filter(p => !middles.has(p.id)),
    ids = new Set(posts.map(p => p.id));
  const segments = perimeter.flatMap(p => {
    const q = perimeter[(p.id + 1) % perimeter.length];
    return ids.has(p.id) && ids.has(q.id) ? [[p,q]] : [];
  });
  const gates = [0,8,16,24].map((id,i)=>({
    id: `gate-${i}`, name: ["Восточная калитка","Южная калитка","Западная калитка","Северная калитка"][i],
    a: perimeter[(id+perimeter.length-1)%perimeter.length], b: perimeter[(id+1)%perimeter.length],
  }));
  return { posts, segments, gates };
}
export function partialFence(state, plan) {
  if (hasCampBuilding(state,"fence")) return plan;
  if (constructionStage(state) !== 2) return { posts: [], segments: [] };
  const n = Math.min(
      plan.posts.length,
      Math.ceil(stageRatio(state) * plan.posts.length),
    ),
    posts = plan.posts.slice(0, n),
    ids = new Set(posts.map((p) => p.id));
  return {
    posts,
    segments: plan.segments.filter(([a, b]) => ids.has(a.id) && ids.has(b.id)),
  };
}
export function constructionCollisionKey(state, plan) {
  return `${JSON.stringify(state.campBuildings)}:${state.campLevel}:${state.buildProject}:${partialFence(state,plan).posts.length}:${Number(state.buildWood > 0)}`;
}
export function constructionTarget(state, center, plan = fencePlan(center)) {
  const project=selectedCampProject(state);
  if(project?.site)return {x:project.site.x,y:project.site.y-35};
  const r = stageRatio(state);
  if (constructionStage(state) === 0) return { x: center.x, y: center.y - 12 };
  if (constructionStage(state) === 1)
    return { x: CAMP.tent.x, y: CAMP.tent.y - 26 - r * 72 };
  if (constructionStage(state) === 2) {
    const p =
      plan.posts[
        Math.min(plan.posts.length - 1, Math.floor(r * plan.posts.length))
      ];
    return { x: p.x, y: p.y - 20 };
  }
  return { x: CAMP.hut.x, y: CAMP.hut.y - 25 - r * 170 };
}

export function createConstruction(art, center) {
  const plan = fencePlan(center);
  let level = -1,
    ratio = 0;
  function update(state, dt) {
    const next = stageRatio(state);
    if (level !== constructionStage(state) || dt === 0) {
      level = constructionStage(state);
      ratio = next;
    } else ratio += (next - ratio) * (1 - Math.exp(-dt * 10));
  }
  function crop(ctx, s, x, y, sx, sy, w, h) {
    if (w < 1 || h < 1) return;
    ctx.imageSmoothingEnabled = false;
    sx = Math.floor(sx);
    sy = Math.floor(sy);
    w = Math.floor(w);
    h = Math.floor(h);
    ctx.drawImage(
      s.bitmap,
      sx,
      sy,
      w,
      h,
      Math.round(x / 2) * 2 + (sx - s.ax) * 2,
      Math.round(y / 2) * 2 + (sy - s.ay) * 2,
      w * 2,
      h * 2,
    );
  }
  function target(state) {
    return constructionTarget(state, center, plan);
  }
  function drawFire(ctx, state) {
    if (constructionStage(state) === 0 && state.buildWood > 0) {
      const s = art.sprites.unlitFire;
      crop(
        ctx,
        s,
        center.x,
        center.y,
        0,
        0,
        s.width * Math.min(1, ratio * 1.2),
        s.height,
      );
    }
  }
  function drawTent(ctx, state) {
    if (constructionStage(state) !== 1 || state.buildWood <= 0) return;
    art.draw(ctx, art.sprites.tentFrame, CAMP.tent.x, CAMP.tent.y);
    const s = art.sprites.tent;
    const width = Math.max(0, (ratio - 0.25) / 0.75) * s.width;
    crop(ctx, s, CAMP.tent.x, CAMP.tent.y, 0, 0, width, s.height);
  }
  function drawHouse(ctx, state) {
    if (constructionStage(state) !== 3 || state.buildWood <= 0) return;
    const s = art.sprites.house,
      x = CAMP.hut.x,
      y = CAMP.hut.y;
    crop(ctx, art.sprites.houseFrame, x, y, 0, 110, 128, 18);
    if (ratio > 0.15) {
      const h = Math.floor(Math.min(1, (ratio - 0.15) / 0.35) * 40);
      crop(ctx, art.sprites.houseFrame, x, y, 0, 110 - h, 128, h);
    }
    if (ratio > 0.5) crop(ctx, art.sprites.houseFrame, x, y, 0, 0, 128, 74);
    crop(ctx, s, x, y, 10, 110, Math.min(108, (ratio / 0.18) * 108), 18);
    const wall = Math.min(1, Math.max(0, (ratio - 0.15) / 0.5)),
      height = Math.floor(wall * 46);
    crop(ctx, s, x, y, 10, 116 - height, 108, height);
    const roof = Math.min(1, Math.max(0, (ratio - 0.62) / 0.38)),
      rh = Math.floor(roof * 74);
    crop(ctx, s, x, y, 0, 74 - rh, 128, rh);
  }
  function previewEntities(state) {
    const list = [];
    if (state.buildWood <= 0) return list;
    if (constructionStage(state) === 0)
      list.push({ y: center.y + 8, draw: (ctx) => drawFire(ctx, state) });
    if (constructionStage(state) === 1)
      list.push({ y: CAMP.tent.y, draw: (ctx) => drawTent(ctx, state) });
    if (constructionStage(state) === 3)
      list.push({ y: CAMP.hut.y, draw: (ctx) => drawHouse(ctx, state) });
    return list;
  }
  return {
    plan,
    update,
    target,
    previewEntities,
    get ratio() {
      return ratio;
    },
  };
}
