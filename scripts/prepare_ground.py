#!/usr/bin/env python3
"""Prepare only the approved style-4 terrain PNGs; never rebuild actors or props."""
from pathlib import Path
import hashlib
import json
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
MATERIALS = ("forest", "field", "swamp", "shore", "web", "ruins", "dirt", "water")


def periodic(tile):
    """Blend opposite eight-pixel bands offline, preserving the generated interior."""
    size = tile.width
    for axis in (0, 1):
        source = tile.copy()
        for y in range(size):
            for x in range(size):
                n = x if axis == 0 else y
                weight = max(0, (8 - min(n, size - 1 - n)) / 8) * 0.5
                other = (size - 1 - x, y) if axis == 0 else (x, size - 1 - y)
                a, b = source.getpixel((x, y)), source.getpixel(other)
                tile.putpixel((x, y), tuple(round(v * (1-weight) + w * weight) for v, w in zip(a, b)))
    return tile


def prepare_ground():
    source = ROOT / "art/source/terrain-style4-sheet.png"
    output = ROOT / "src/assets/biomes"
    output.mkdir(parents=True, exist_ok=True)
    with Image.open(source) as original:
        sheet = original.convert("RGBA")
    for index, name in enumerate(MATERIALS):
        cx, cy = index % 3, index // 3
        box = tuple(round(value) for value in (cx*sheet.width/3, cy*sheet.height/3,
                    (cx+1)*sheet.width/3, (cy+1)*sheet.height/3))
        tile = periodic(sheet.crop(box).resize((64,64), Image.Resampling.NEAREST))
        tile.save(output / f"{name}.png", optimize=True)
    (output / "manifest.json").write_text(json.dumps({
        "version": 2, "style": 4, "source": source.name,
        "sha256": hashlib.sha256(source.read_bytes()).hexdigest(),
        "size": 64, "materials": list(MATERIALS), "edgeBlend": 8,
        "sourceGrid": [3,3], "unusedCells": [8],
    }, indent=2) + "\n")


if __name__ == "__main__":
    prepare_ground()
