#!/usr/bin/env python3
"""Offline preparation of the approved generated enemy and terrain source sheets."""

from pathlib import Path
import hashlib
import json
from PIL import Image
from prepare_assets import prepare

ROOT = Path(__file__).resolve().parents[1]
FAMILIES = ("doll", "cosmic", "wood", "drowned", "spider", "masked")
MATERIALS = ("forest", "field", "swamp", "shore", "web", "ruins", "dirt", "water")


def periodic(tile):
    """Blend only opposite eight-pixel edge bands; preserve the generated interior."""
    size = tile.width
    for axis in (0, 1):
        source = tile.copy()
        for y in range(size):
            for x in range(size):
                n = x if axis == 0 else y
                weight = max(0, (8 - min(n, size - 1 - n)) / 8) * 0.5
                other = (size - 1 - x, y) if axis == 0 else (x, size - 1 - y)
                a, b = source.getpixel((x, y)), source.getpixel(other)
                tile.putpixel(
                    (x, y),
                    tuple(round(v * (1 - weight) + w * weight) for v, w in zip(a, b)),
                )
    return tile


def main():
    # Use the contour grouping of the existing approved white-background pipeline.
    output = ROOT / "src/assets/enemies"
    output.mkdir(parents=True, exist_ok=True)
    prepare(
        ROOT / "art/source/biome-enemies-sheet.png",
        output,
        names=tuple(
            f"{family}-{pose}"
            for pose in ("idle", "walk", "attack")
            for family in FAMILIES
        ),
        columns=6,
        background="all",
        defringe=1,
    )
    watcher_output = ROOT / "src/assets/watcher"
    watcher_names = ("idle", "walk", "notice", "windup", "strike", "repelled")
    prepare(
        ROOT / "art/source/watcher-masked-sheet.png",
        watcher_output,
        names=watcher_names,
        background="all",
        defringe=1,
    )
    watcher_images = [
        Image.open(watcher_output / f"{n}.png").convert("RGBA") for n in watcher_names
    ]
    scale = min(
        100 / max(im.height for im in watcher_images),
        108 / max(im.width for im in watcher_images),
    )
    for name, im in zip(watcher_names, watcher_images):
        im = im.resize(
            (max(1, round(im.width * scale)), max(1, round(im.height * scale))),
            Image.Resampling.NEAREST,
        )
        frame = Image.new("RGBA", (112, 112))
        frame.alpha_composite(im, ((112 - im.width) // 2, 106 - im.height))
        frame.save(watcher_output / f"{name}.png", optimize=True)
    watcher_manifest = json.loads((watcher_output / "manifest.json").read_text())
    for meta in watcher_manifest["assets"].values():
        meta["width"] = 112
        meta["height"] = 112
        meta["anchor"] = {"x": 0.5, "y": 106 / 112}
    (watcher_output / "manifest.json").write_text(
        json.dumps(watcher_manifest, indent=2) + "\n"
    )
    # Normalize all poses per family with one scale and fixed feet.
    manifest = json.loads((output / "manifest.json").read_text())
    for family in FAMILIES:
        images = [
            Image.open(output / f"{family}-{pose}.png").convert("RGBA")
            for pose in ("idle", "walk", "attack")
        ]
        factor = min(
            54 / max(im.height for im in images), 60 / max(im.width for im in images)
        )
        for pose, im in zip(("idle", "walk", "attack"), images):
            resized = im.resize(
                (max(1, round(im.width * factor)), max(1, round(im.height * factor))),
                Image.Resampling.NEAREST,
            )
            frame = Image.new("RGBA", (64, 64))
            frame.alpha_composite(
                resized, ((64 - resized.width) // 2, 60 - resized.height)
            )
            frame.save(output / f"{family}-{pose}.png", optimize=True)
    prepare(
        ROOT / "art/source/biome-props-sheet.png",
        ROOT / "src/assets/biome-props",
        names=("field", "swamp", "forest", "shore", "web", "ruins"),
        background="all",
        defringe=1,
    )
    for name in ("field", "swamp", "forest", "shore", "web", "ruins"):
        file = ROOT / "src/assets/biome-props" / f"{name}.png"
        image = Image.open(file).convert("RGBA")
        scale = 64 / max(image.size)
        image.resize(
            (max(1, round(image.width * scale)), max(1, round(image.height * scale))),
            Image.Resampling.NEAREST,
        ).save(file, optimize=True)
    props_output = ROOT / "src/assets/biome-props"
    props_manifest = json.loads((props_output / "manifest.json").read_text())
    for name, meta in props_manifest["assets"].items():
        im = Image.open(props_output / f"{name}.png")
        meta["width"], meta["height"] = im.size
        meta["anchor"] = {"x": 0.5, "y": (im.height - 2) / im.height}
    (props_output / "manifest.json").write_text(
        json.dumps(props_manifest, indent=2) + "\n"
    )
    source = ROOT / "art/source/biome-terrain-sheet.png"
    sheet = Image.open(source).convert("RGB")
    output = ROOT / "src/assets/biomes"
    output.mkdir(parents=True, exist_ok=True)
    for index, name in enumerate(MATERIALS):
        cx, cy = index % 4, index // 4
        box = (
            round(cx * sheet.width / 4),
            round(cy * sheet.height / 2),
            round((cx + 1) * sheet.width / 4),
            round((cy + 1) * sheet.height / 2),
        )
        tile = periodic(sheet.crop(box).resize((64, 64), Image.Resampling.NEAREST))
        tile.save(output / f"{name}.png", optimize=True)
    (output / "manifest.json").write_text(
        json.dumps(
            {
                "version": 1,
                "source": source.name,
                "sha256": hashlib.sha256(source.read_bytes()).hexdigest(),
                "size": 64,
                "materials": list(MATERIALS),
                "edgeBlend": 8,
            },
            indent=2,
        )
        + "\n"
    )
    for meta in manifest["assets"].values():
        meta["width"] = 64
        meta["height"] = 64
        meta["anchor"] = {"x": 0.5, "y": 60 / 64}
    manifest["preparedFrames"] = {
        "width": 64,
        "height": 64,
        "anchor": [32, 60],
        "families": list(FAMILIES),
        "poses": ["idle", "walk", "attack"],
    }
    (ROOT / "src/assets/enemies/manifest.json").write_text(
        json.dumps(manifest, indent=2) + "\n"
    )


if __name__ == "__main__":
    main()
