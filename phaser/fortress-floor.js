// Called only while baking terrain chunks, never while drawing a frame.
export function createFortressFloorSampler(
  pack,
  locations = [],
  roomKey = (r) => (r.name === "Архив" ? "archive" : "room"),
) {
  if (!pack) return null;
  const layouts = locations
    .filter((l) => l.regionId === pack.manifest.regionId)
    .map((l) => ({ ...l, floors: l.rooms.filter((r) => r.name !== "Двор") }));
  return (x, y, hash) => {
    for (const l of layouts) {
      const b = l.bounds;
      const edge = Math.min(
        x - b.x,
        b.x + b.width - x,
        y - b.y,
        b.y + b.height - y,
      );
      if (edge < 0 || (edge < 24 && hash % 24 >= edge)) continue;
      let key = "courtyard";
      for (const r of l.floors) {
        const d = Math.min(
          x - r.x,
          r.x + r.width - x,
          y - r.y,
          r.y + r.height - y,
        );
        if (d >= 0 && (d >= 16 || hash % 16 < d)) key = roomKey(r);
      }
      const ix = ((Math.floor(x / 2) % 64) + 64) % 64,
        iy = ((Math.floor(y / 2) % 64) + 64) % 64;
      const data = pack.floors[key],
        i = (iy * 64 + ix) * 4;
      return [data[i], data[i + 1], data[i + 2]];
    }
    return null;
  };
}
