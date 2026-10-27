import { random } from "./pixel-art.js";
export const MYSTERY_CLUES = Object.freeze([
  {
    id: "note",
    x: 1290,
    y: 1380,
    name: "Обрывок записки",
    text: "«Если после заката лес вдруг замолчит, держись света. У старых ворот я видел следы. Назад они не вели…» Подпись смыта дождём.",
  },
  {
    id: "tracks",
    x: 660,
    y: 1460,
    name: "Странные следы",
    text: "Три глубокие борозды на мягкой земле. Следующая пара отпечатков слишком далеко. Возле каменных ворот следы обрываются.",
  },
  {
    id: "mark",
    x: 630,
    y: 1365,
    name: "Знак на камне",
    text: "На камне вырезан незамкнутый круг. Ночью в его трещинах проступает слабое свечение. Торговец отворачивается, когда ты спрашиваешь о нём.",
  },
]);
export const nightSight = (level = 0) => 140 + level * 24;
export function createMystery() {
  const eyes = [],
    read = new Set(),
    rnd = random(0x9911);
  let timer = 2,
    clock = 0;
  function lit(x, y, lights) {
    return lights.some((l) => Math.hypot(x - l.x, y - l.y) < l.r * 0.9);
  }
  function update(
    dt,
    { darkness, player, view, lights, center, radius, accessible = () => true },
  ) {
    if (dt <= 0) return;
    clock += dt;
    if (darkness < 0.45) {
      eyes.length = 0;
      timer = 2;
      return;
    }
    for (let i = eyes.length - 1; i >= 0; i--) {
      const e = eyes[i];
      e.age += dt;
      if (
        e.age >= e.life ||
        lit(e.x, e.y, lights) ||
        e.x < view.x ||
        e.x > view.x + view.width ||
        e.y < view.y ||
        e.y > view.y + view.height
      )
        eyes.splice(i, 1);
    }
    timer -= dt;
    if (timer > 0 || eyes.length >= 3) return;
    timer = 2.8 + rnd() * 2.5;
    for (let attempt = 0; attempt < 16; attempt++) {
      const a = rnd() * Math.PI * 2,
        reach = Math.min(view.width * 0.47, 190 + rnd() * 150),
        x = player.x + Math.cos(a) * reach,
        y = player.y - 30 + Math.sin(a) * reach * 0.8;
      if (
        x < view.x + 22 ||
        x > view.x + view.width - 22 ||
        y < view.y + 22 ||
        y > view.y + view.height - 22 ||
        Math.hypot(x - center.x, y - center.y) > radius - 25 ||
        lit(x, y, lights) ||
        !accessible({ x, y })
      )
        continue;
      eyes.push({ x, y, age: 0, life: 2.2 + rnd() * 2.4, phase: rnd() * 6 });
      break;
    }
  }
  function drawEyes(ctx, view, darkness, lights) {
    if (darkness < 0.45) return;
    for (const e of eyes) {
      if (lit(e.x, e.y, lights)) continue;
      const alpha =
        Math.min(1, e.age * 2, (e.life - e.age) * 2) *
        (0.5 + Math.sin(clock * 1.7 + e.phase) * 0.18);
      if (Math.sin(clock * 4 + e.phase) > 0.98) continue;
      const x = Math.round((e.x - view.x) / 2) * 2,
        y = Math.round((e.y - view.y) / 2) * 2;
      ctx.globalAlpha = alpha * 0.22;
      ctx.fillStyle = "#bba66d";
      ctx.fillRect(x - 10, y - 2, 8, 6);
      ctx.fillRect(x + 4, y - 2, 8, 6);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = "#e9c981";
      ctx.fillRect(x - 8, y, 4, 2);
      ctx.fillRect(x + 6, y, 4, 2);
    }
    ctx.globalAlpha = 1;
  }
  function drawWorld(
    ctx,
    { art, sprites, view, time, darkness, player, accessible },
  ) {
    for (const c of MYSTERY_CLUES) {
      if (
        !accessible(c) ||
        c.x < view.x - 40 ||
        c.x > view.x + view.width + 40 ||
        c.y < view.y ||
        c.y > view.y + view.height + 70
      )
        continue;
      art.draw(
        ctx,
        sprites[
          c.id === "tracks"
            ? "strangeTracks"
            : c.id === "note"
              ? "note"
              : "rune"
        ],
        c.x,
        c.y,
      );
      if (c.id === "mark" && darkness > 0.35) {
        ctx.globalAlpha = darkness * (0.25 + Math.sin(time * 1.1) * 0.12);
        ctx.fillStyle = "#adc2b5";
        ctx.fillRect(c.x - 2, c.y - 24, 4, 6);
        ctx.globalAlpha = 1;
      }
      if (Math.hypot(player.x - c.x, player.y - c.y) < 110) {
        ctx.font = "12px monospace";
        ctx.textAlign = "center";
        ctx.fillStyle = "#f1d994";
        ctx.fillText(`${c.name} · E / нажать`, c.x, c.y + 28);
      }
    }
    // Редкий дальний огонёк: короткая сцена, не источник ресурсов и не противник.
    const phase = time % 85;
    if (darkness > 0.45 && phase > 52 && phase < 63) {
      const x = 2210 + Math.sin(time * 0.4) * 12,
        y = 1500 + Math.sin(time * 0.7) * 8;
      if (
        accessible({ x, y }) &&
        Math.hypot(x - player.x, y - player.y) > 120 &&
        x > view.x &&
        x < view.x + view.width &&
        y > view.y &&
        y < view.y + view.height
      ) {
        ctx.globalAlpha = Math.min(1, phase - 52, 63 - phase) * 0.7;
        ctx.fillStyle = "#98cbb7";
        ctx.fillRect(x - 4, y - 4, 8, 8);
        ctx.fillStyle = "#e8e6ad";
        ctx.fillRect(x - 2, y - 2, 4, 4);
        ctx.globalAlpha = 1;
      }
    }
  }
  return { eyes, read, update, drawEyes, drawWorld };
}
