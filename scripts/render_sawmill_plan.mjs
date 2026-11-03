import { writeFile } from "node:fs/promises";
import { SAWMILL as l } from "../game/sawmill.js";

// Documentation derived from collision data, not another playable map copy.
const b = l.bounds;
const parts = [
  '<svg xmlns="http://www.w3.org/2000/svg" width="1408" height="1456" viewBox="0 0 1408 1456">',
  "<title>Заброшенная лесопилка — план проходов</title>",
  "<desc>Склад на западе, двор в середине, машинный зал на востоке. Южные обходы открыты сразу. Два завала перекрывают короткие проходы.</desc>",
  '<rect width="1408" height="1456" fill="#192b25"/>',
  '<g font-family="sans-serif" fill="#ecd9af">',
  '<text x="64" y="48" font-size="28">Заброшенная лесопилка · прототип маршрутов</text>',
  '<text x="64" y="82" font-size="19">1280 × 1024 · юго-восточный регион · стартовый топор подходит для обоих завалов</text>',
  `<g transform="translate(${64 - b.x},${120 - b.y})">`,
  `<rect x="${b.x}" y="${b.y}" width="${b.width}" height="${b.height}" fill="#403f30"/>`,
];
for (const r of l.rooms)
  parts.push(
    `<rect x="${r.x}" y="${r.y}" width="${r.width}" height="${r.height}" fill="#56503a"/>`,
    `<text x="${r.x + r.width / 2}" y="${r.y + 42}" font-size="23" text-anchor="middle">${r.name}</text>`,
  );
for (const w of l.walls)
  parts.push(
    `<path d="M${w.a.x},${w.a.y}L${w.b.x},${w.b.y}" stroke="#a48659" stroke-width="24" stroke-linecap="round"/>`,
  );
for (const [i, d] of l.debris.entries())
  parts.push(
    `<path d="M${d.a.x},${d.a.y}L${d.b.x},${d.b.y}" stroke="#e7ad62" stroke-width="28" stroke-linecap="round" stroke-dasharray="14 10"/>`,
    `<circle cx="${d.x}" cy="${d.y}" r="23" fill="#e7ad62"/>`,
    `<text x="${d.x}" y="${d.y + 8}" text-anchor="middle" fill="#192b25" font-size="24">${i + 1}</text>`,
  );
const findings = [...l.clues, ...l.sites];
findings.forEach((p, i) =>
  parts.push(
    `<circle cx="${p.x}" cy="${p.y}" r="20" fill="${i < l.clues.length ? "#afc7a1" : "#d8c080"}" stroke="#192b25" stroke-width="3"/>`,
    `<text x="${p.x}" y="${p.y + 7}" text-anchor="middle" fill="#192b25" font-size="21">${i + 3}</text>`,
  ),
);
const cx = l.entrance.x,
  cy = l.entrance.y - 608;
parts.push(
  `<path d="M${cx - 100},${cy - 176}L${cx - 100},${cy + 304}L${cx - 416},${cy + 304}L${cx - 416},${cy - 176} M${cx + 140},${cy - 176}L${cx + 140},${cy + 336}L${cx + 304},${cy + 336}L${cx + 304},${cy - 176}" stroke="#97bba4" stroke-width="8" stroke-dasharray="12 10" fill="none"/>`,
  `<text x="${cx}" y="${cy + 480}" font-size="24" text-anchor="middle">↑ Вход</text>`,
  "</g>",
  '<text x="64" y="1194" font-size="21">1. Упавшие балки: 6 HP → 3 бревна.     2. Тяжёлый завал: 24 HP → 6 брёвен.</text>',
  '<text x="64" y="1234" font-size="20">Зелёный пунктир: доступные обходы. Оранжевый: расчищаемые короткие пути.</text>',
  '<text x="64" y="1274" font-size="18">Награды одноразовые. Полный рюкзак не мешает расчистке — остаток древесины ждёт на земле.</text>',
);
findings.forEach((p, i) =>
  parts.push(
    `<text x="${64 + (i % 2) * 650}" y="${1320 + Math.floor(i / 2) * 30}" font-size="18">${i + 3}. ${p.name}</text>`,
  ),
);
parts.push("</g></svg>");
await writeFile(
  new URL("../docs/sawmill-layout.svg", import.meta.url),
  parts.join("\n") + "\n",
);
console.log("Wrote docs/sawmill-layout.svg from game/sawmill.js");
