// Border endpoints stay fixed so independently opened squares always connect.
export function regionTrails(r) {
  const left = { x: r.x, y: r.cy }, right = { x: r.x + r.width, y: r.cy },
    top = { x: r.cx, y: r.y }, bottom = { x: r.cx, y: r.y + r.height };
  if (!["forest", "swamp"].includes(r.biome)) return [[left, right], [top, bottom]];
  const bend = r.biome === "swamp" ? 110 : 65,
    horizontal = [left, { x: r.x + 240, y: r.cy }, { x: r.x + 560, y: r.cy + bend },
      { x: r.cx - 300, y: r.cy }, { x: r.cx + 300, y: r.cy },
      { x: right.x - 560, y: r.cy - bend }, { x: right.x - 240, y: r.cy }, right],
    vertical = [top, { x: r.cx, y: r.y + 240 }, { x: r.cx + bend, y: r.y + 560 },
      { x: r.cx, y: r.cy - 300 }, { x: r.cx, y: r.cy + 300 },
      { x: r.cx - bend, y: bottom.y - 560 }, { x: r.cx, y: bottom.y - 240 }, bottom];
  // Keep the ancient trunk and merchant foundation away from the main walking line.
  if (r.id === "1:0") {
    horizontal.splice(3, 2, { x: r.cx - 260, y: r.cy + 130 }, { x: r.cx + 260, y: r.cy + 130 });
    vertical.splice(3, 2, { x: r.cx - 160, y: r.cy - 180 },
      { x: r.cx - 160, y: r.cy + 130 }, { x: r.cx, y: r.cy + 300 });
  }
  if (r.id === "0:1") vertical.splice(3, 1,
    { x: r.cx - 130, y: r.cy - 300 }, { x: r.cx - 130, y: r.cy - 80 });
  return [horizontal, vertical];
}
