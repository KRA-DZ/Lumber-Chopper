import { pixelHash } from "./pixel-art.js";

export const WEATHER_LIMITS = Object.freeze({
  rain: 80,
  tracks: 36,
  drips: 16,
});
const clamp = (v) => Math.max(0, Math.min(1, v));
const pixelRect = (ctx, x, y, w, h) =>
  ctx.fillRect(
    Math.round(x / 2) * 2,
    Math.round(y / 2) * 2,
    Math.max(2, Math.round(w / 2) * 2),
    Math.max(2, Math.round(h / 2) * 2),
  );
// Один короткий дождь раз в двое игровых суток. Время задаёт мир, не часы браузера.
export function weatherAt(time, cycle, day = 0) {
  const phase = time / cycle,
    start = cycle * 0.34,
    end = cycle * 0.47;
  const rainyDay = day % 2 === 0;
  const rain = rainyDay
    ? clamp(Math.min((time - start) / 8, (end - time) / 8))
    : 0;
  const wet =
    rain > 0 ? 1 : rainyDay && time >= end ? clamp(1 - (time - end) / 55) : 0;
  const mist = clamp(1 - Math.abs(phase - 0.055) / 0.09);
  return {
    rain,
    wet,
    mist,
    name:
      rain > 0.1
        ? "Дождь"
        : wet > 0.1
          ? "После дождя"
          : mist > 0.1
            ? "Утренний туман"
            : "Ясно",
  };
}
export function createWeather({
  art,
  sprites,
  pond,
  springs,
  inWater,
  nearTrail,
  center,
}) {
  const tracks = [],
    drips = [];
  const drops = Array.from({ length: WEATHER_LIMITS.rain }, (_, i) => ({
    x: pixelHash(i, 31) % 4096,
    y: pixelHash(i, 29) % 4096,
    speed: 210 + (i % 5) * 24,
  }));
  let profile = weatherAt(120, 600),
    quality = "full",
    clock = 0,
    dripTimer = 0,
    lastStep = null,
    foot = 0;
  function setQuality(value) {
    quality = value === "light" ? "light" : "full";
    tracks.splice(
      0,
      Math.max(
        0,
        tracks.length - (quality === "light" ? 16 : WEATHER_LIMITS.tracks),
      ),
    );
    drips.splice(
      0,
      Math.max(
        0,
        drips.length - (quality === "light" ? 5 : WEATHER_LIMITS.drips),
      ),
    );
  }
  function surfaceAt(x, y) {
    for (const [dx, dy] of [
      [0, 0],
      [18, 0],
      [-18, 0],
      [0, 18],
      [0, -18],
      [13, 13],
      [-13, -13],
    ])
      if (inWater(x + dx, y + dy)) return "water";
    return nearTrail({ x, y }, 32) ||
      Math.hypot(x - center.x, y - center.y) < 300
      ? "dust"
      : "grass";
  }
  function update(dt, state, cycle, day, trees, player) {
    profile = weatherAt(state.worldTime, cycle, day);
    if (dt <= 0) return;
    clock += dt;
    if (player.moving) {
      if (
        !lastStep ||
        Math.hypot(player.x - lastStep.x, player.y - lastStep.y) >= 22
      ) {
        const kind = surfaceAt(player.x, player.y),
          limit = quality === "light" ? 16 : WEATHER_LIMITS.tracks;
        if (tracks.length >= limit) tracks.shift();
        foot = 1 - foot;
        tracks.push({
          x: player.x + (foot ? 5 : -5),
          y: player.y + 4,
          age: 0,
          kind,
          life: kind === "grass" ? 3.5 : kind === "water" ? 1.1 : 0.75,
        });
        lastStep = { x: player.x, y: player.y };
      }
    } else lastStep = null;
    for (let i = tracks.length - 1; i >= 0; i--) {
      tracks[i].age += dt;
      if (tracks[i].age >= tracks[i].life) tracks.splice(i, 1);
    }
    for (let i = drips.length - 1; i >= 0; i--) {
      drips[i].age += dt;
      if (drips[i].age >= 1.05) drips.splice(i, 1);
    }
    dripTimer -= dt;
    if (profile.wet > 0.05 && profile.rain < 0.15 && dripTimer <= 0) {
      dripTimer = quality === "light" ? 1.4 : 0.45;
      const limit = quality === "light" ? 5 : WEATHER_LIMITS.drips;
      if (drips.length < limit) {
        const live = trees.filter(
          (t) =>
            t.hp > 0 &&
            t.type !== "dead" &&
            Math.hypot(t.x - player.x, t.y - player.y) < 420,
        );
        if (live.length) {
          const t = live[Math.floor(clock * 7) % live.length];
          drips.push({
            x: t.x + Math.sin(clock * 6) * 42,
            y: t.y - 120,
            age: 0,
          });
        }
      }
    }
  }
  function drawGround(ctx, view) {
    for (const t of tracks) {
      if (
        t.x < view.x - 30 ||
        t.x > view.x + view.width + 30 ||
        t.y < view.y - 30 ||
        t.y > view.y + view.height + 30
      )
        continue;
      const a = t.age / t.life,
        x = Math.round(t.x / 2) * 2,
        y = Math.round(t.y / 2) * 2;
      ctx.globalAlpha = (1 - a) * 0.65;
      if (t.kind === "water")
        art.draw(
          ctx,
          art.sprites.ripples[Math.min(3, Math.floor(a * 4))],
          x,
          y,
        );
      else if (t.kind === "grass") {
        ctx.fillStyle = "#3c7d39";
        pixelRect(ctx, x - 5, y - 1, 12, 2);
        pixelRect(ctx, x - 3, y + 1, 8, 2);
        ctx.fillStyle = "#88ac50";
        pixelRect(ctx, x - 5, y - 3, 5, 2);
        pixelRect(ctx, x + 2, y, 5, 2);
      } else {
        ctx.fillStyle = profile.wet > 0.2 ? "#977344" : "#dfc38b";
        pixelRect(ctx, x - 3 - a * 8, y - a * 5, 6 + a * 10, 2);
        pixelRect(ctx, x + 3 + a * 4, y - 3 - a * 5, 4, 2);
      }
    }
    ctx.globalAlpha = 1;
  }
  function draw(ctx, view) {
    // Локальные полосы тумана: один маленький растр, без полноэкранного blur.
    if (profile.mist > 0.01)
      for (const water of [pond, ...springs]) {
        if (
          water.x < view.x - 350 ||
          water.x > view.x + view.width + 350 ||
          water.y < view.y - 120 ||
          water.y > view.y + view.height + 120
        )
          continue;
        const count = quality === "light" ? 1 : 3;
        for (let i = 0; i < count; i++) {
          ctx.globalAlpha = profile.mist * (quality === "light" ? 0.12 : 0.1);
          art.draw(
            ctx,
            sprites.fog,
            water.x + Math.sin(clock * 0.07 + i) * 46,
            water.y - 14 + i * 18,
            3,
          );
        }
      }
    ctx.globalAlpha = 1;
    if (profile.rain > 0.01) {
      ctx.fillStyle = `rgba(41,65,79,${profile.rain * 0.09})`;
      pixelRect(ctx, view.x, view.y, view.width, view.height);
      const count = quality === "light" ? 28 : WEATHER_LIMITS.rain;
      ctx.globalAlpha = profile.rain * 0.5;
      ctx.fillStyle = "#bbd3ce";
      for (let i = 0; i < count; i++) {
        const d = drops[i],
          x = Math.floor(((d.x + clock * 34) % view.width) / 2) * 2 + view.x,
          y =
            Math.floor(((d.y + clock * d.speed) % view.height) / 2) * 2 +
            view.y;
        pixelRect(ctx, x, y, 2, 6);
        pixelRect(ctx, x - 2, y + 6, 2, 4);
        if (i < 8 && Math.floor(clock * 8 + i) % 4 === 0) {
          pixelRect(ctx, x - 6, view.y + (d.y % view.height), 4, 2);
          pixelRect(ctx, x + 4, view.y + (d.y % view.height), 4, 2);
        }
      }
    }
    ctx.globalAlpha = 1;
    for (const d of drips) {
      if (
        d.x < view.x ||
        d.x > view.x + view.width ||
        d.y < view.y - 150 ||
        d.y > view.y + view.height
      )
        continue;
      const y = d.y + Math.min(1, d.age / 0.8) ** 2 * 120;
      if (d.age < 0.8) {
        ctx.fillStyle = "#b0d4c5";
        pixelRect(ctx, Math.round(d.x / 2) * 2, Math.round(y / 2) * 2, 2, 6);
      } else
        art.draw(
          ctx,
          art.sprites.ripples[Math.min(3, Math.floor((d.age - 0.8) * 16))],
          d.x,
          y,
        );
    }
  }
  return {
    update,
    drawGround,
    draw,
    surfaceAt,
    setQuality,
    tracks,
    drips,
    get profile() {
      return profile;
    },
    get quality() {
      return quality;
    },
    get rainCount() {
      return quality === "light" ? 28 : drops.length;
    },
  };
}
