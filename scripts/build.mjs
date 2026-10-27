import {
  readFile,
  writeFile,
  copyFile,
  cp,
  mkdir,
  rm,
  readdir,
} from "node:fs/promises";
import { gzipSync } from "node:zlib";
import { createHash } from "node:crypto";
const root = new URL("../", import.meta.url),
  out = new URL("dist/", root);
const engine = await readFile(new URL("vendor/phaser/phaser.min.js", root));
if (
  createHash("sha256").update(engine).digest("hex") !==
  "e92ddef111ba42e92d316979c732311757093688ea1810591cb7aa2858eba7a7"
)
  throw new Error("Phaser vendor checksum mismatch");
await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
for (const file of [
  "pixel-art.js",
  "world-art.js",
  "world.js",
  "economy.js",
  "forestry.js",
  "construction.js",
  "terrain.js",
  "shop.js",
  "weather.js",
  "environment.js",
  "mystery.js",
])
  await copyFile(new URL(file, root), new URL(file, out));
for (const dir of ["game", "phaser", "vendor"])
  await cp(new URL(dir, root), new URL(dir, out), { recursive: true });
const html = (await readFile(new URL("phaser.html", root), "utf8")).replace(
  /<a[^>]*data-legacy-link[^>]*>[^<]*<\/a\s*>/,
  " ",
);
if (html.includes("data-legacy-link"))
  throw new Error("Legacy comparison link must not enter the standalone build");
await writeFile(new URL("index.html", out), html);
let total = 0;
async function count(dir) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const path = new URL(e.name + (e.isDirectory() ? "/" : ""), dir);
    if (e.isDirectory()) await count(path);
    else total += (await readFile(path)).length;
  }
}
await count(out);
console.log(
  `Static Phaser build: dist/index.html; total ${total} bytes; Phaser ${engine.length} bytes (${gzipSync(engine).length} bytes gzip). No CDN or node_modules required at runtime.`,
);
