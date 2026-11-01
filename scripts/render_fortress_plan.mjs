import { writeFile } from "node:fs/promises";
import { FORTRESS as f } from "../game/locations.js";

// Documentation only: derive the route diagram from the playable layout data.
const esc = (s) => s.replaceAll("&", "&amp;").replaceAll("<", "&lt;");
const b = f.bounds;
const parts = [
  '<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="1250" viewBox="0 0 1280 1250">',
  "<title>Забытая крепость — план игрового прототипа</title>",
  "<desc>Вход снизу. Западные комнаты с записками, восточные коридоры к архиву. Пунктиром отмечен короткий путь, открываемый из архива.</desc>",
  '<rect width="1280" height="1250" fill="#172922"/>',
  '<g font-family="sans-serif" fill="#e8ddaf">',
  '<text x="64" y="45" font-size="27">Забытая крепость · игровой прототип</text>',
  '<text x="64" y="78" font-size="18">1152 × 960 · северный регион · широкие проходы · временные текстуры</text>',
  `<g transform="translate(${64 - b.x},${120 - b.y})">`,
  `<rect x="${b.x}" y="${b.y}" width="${b.width}" height="${b.height}" fill="#304438"/>`,
];
for (const room of f.rooms)
  parts.push(
    `<rect x="${room.x}" y="${room.y}" width="${room.width}" height="${room.height}" fill="#465948"/>`,
    `<text x="${room.x + room.width / 2}" y="${room.y + 35}" font-size="22" text-anchor="middle">${esc(room.name)}</text>`,
  );
for (const wall of f.walls)
  parts.push(
    `<path d="M${wall.a.x},${wall.a.y}L${wall.b.x},${wall.b.y}" fill="none" stroke="${wall.passage ? "#e8b95b" : "#a2ad87"}" stroke-width="24" stroke-linecap="round" ${wall.passage ? 'stroke-dasharray="18 12"' : ""}/>`,
  );
const markers = [...f.clues, ...f.chests, ...f.sites];
markers.forEach((p, i) => {
  parts.push(
    `<circle cx="${p.x}" cy="${p.y}" r="20" fill="${i < f.clues.length ? "#c2b16b" : "#a97541"}" stroke="#172922" stroke-width="3"/>`,
    `<text x="${p.x}" y="${p.y + 6}" text-anchor="middle" fill="#101d17" font-size="19" font-weight="bold">${i + 1}</text>`,
  );
});
parts.push(
  `<text x="${f.entrance.x}" y="${b.y + b.height - 28}" font-size="22" text-anchor="middle">↑ Вход</text>`,
  "</g>",
);
markers.forEach((p, i) =>
  parts.push(
    `<text x="${64 + (i % 3) * 400}" y="${1120 + Math.floor(i / 3) * 33}" font-size="17">${i + 1}. ${esc(p.name)}</text>`,
  ),
);
parts.push(
  '<text x="64" y="1230" font-size="16">Пунктир: решётка. Сундук архива требует складскую ведомость и ключ южного торговца.</text>',
  "</g></svg>",
);
await writeFile(
  new URL("../docs/fortress-layout.svg", import.meta.url),
  parts.join("\n") + "\n",
);
console.log("Wrote docs/fortress-layout.svg from game/locations.js");
