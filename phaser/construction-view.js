import { CAMP } from "../pixel-art.js";
import { CENTER, STAGES } from "../game/config.js";

// Rebuilt only when wood is deposited, never per frame. Pixel coordinates match
// the new building sheets; the original Canvas renderer keeps its own previews.
export function bakeConstruction(ctx, art, state) {
  const stage = state.campLevel,
    ratio = state.buildWood / STAGES[stage].cost;
  const site = stage === 0 ? CENTER : stage === 1 ? CAMP.tent : CAMP.hut;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, 192, 192);
  ctx.imageSmoothingEnabled = false;
  const draw = (s, top = 0, bottom = s.height) => {
    const h = Math.max(0, Math.min(s.height, bottom) - top);
    if (h)
      ctx.drawImage(
        s.bitmap,
        0,
        top,
        s.width,
        h,
        96 - s.ax,
        176 - s.ay + top,
        s.width,
        h,
      );
  };
  if (stage === 0) {
    const s = art.sprites.unlitFire;
    ctx.save();
    ctx.beginPath();
    ctx.rect(96 - s.ax, 176 - s.ay, s.width * ratio, s.height);
    ctx.clip();
    draw(s);
    ctx.restore();
  } else if (stage === 1) {
    draw(art.sprites.tentFrame);
    const s = art.sprites.tent;
    draw(s, Math.round(s.height * (1 - ratio)));
  } else {
    draw(art.sprites.houseFrame);
    const s = art.sprites.house,
      { wallTop, roofBottom } = art.buildSpec;
    draw(
      s,
      Math.round(s.height - (s.height - wallTop) * Math.min(1, ratio / 0.62)),
    );
    if (ratio > 0.62)
      draw(s, Math.round(roofBottom * (1 - (ratio - 0.62) / 0.38)), roofBottom);
  }
  return site;
}
