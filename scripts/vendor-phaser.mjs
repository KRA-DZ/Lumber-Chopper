import { readFile, copyFile, mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const root = new URL("../", import.meta.url),
  target = new URL("vendor/phaser/", root);
const pkg = JSON.parse(
  await readFile(new URL("node_modules/phaser/package.json", root), "utf8"),
);
if (pkg.version !== "3.90.0")
  throw new Error("Expected pinned Phaser 3.90.0; run npm ci");
await mkdir(target, { recursive: true });
const source = new URL("node_modules/phaser/dist/phaser.min.js", root),
  bytes = await readFile(source);
const sha = createHash("sha256").update(bytes).digest("hex");
if (sha !== "e92ddef111ba42e92d316979c732311757093688ea1810591cb7aa2858eba7a7")
  throw new Error("Unexpected Phaser distribution hash");
await copyFile(source, new URL("phaser.min.js", target));
const license = await readFile(
  new URL("node_modules/phaser/LICENSE.md", root),
  "utf8",
);
await writeFile(new URL("LICENSE.md", target), license.replace(/\r\n/g, "\n"));
console.log(
  `Vendored Phaser ${pkg.version}, ${bytes.length} bytes, sha256 ${sha}`,
);
