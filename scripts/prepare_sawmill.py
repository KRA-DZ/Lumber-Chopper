#!/usr/bin/env python3
"""Approved workshop #1: native-alpha sheets -> bounded sprites and periodic floors."""

from pathlib import Path
import json
import math
from PIL import Image
from prepare_camp import extract

ROOT = Path(__file__).resolve().parents[1]
WALLS = tuple(f"wall.{axis}.{i}" for axis in ("h", "v") for i in range(4)) + (
    "corner.nw",
    "corner.ne",
    "corner.sw",
    "corner.se",
    "end.n",
    "end.e",
    "end.s",
    "end.w",
)
PROPS = (
    "bench",
    "drive.closed",
    "drive.open",
    "load",
    "niche.closed",
    "niche.open",
    "niche.empty",
    "tag",
    "crate",
    "note",
    "ledger",
    "tracks",
    "woodRack",
    "tools",
    "sign",
    "cloth",
)
ROOFS = ("roof.store", "roof.hall", "debris.light", "debris.heavy")


def periodic_tile(raw):
    # Discard the generated panel's outer anti-aliasing; a material is opaque.
    tile = (
        raw.crop((4, 4, raw.width - 4, raw.height - 4))
        .convert("RGB")
        .resize((64, 64), Image.Resampling.NEAREST)
    )
    pixels = tile.load()
    for axis in (0, 1):
        for n in range(4):
            weight = (4 - n) / 8
            for i in range(64):
                axy, bxy = ((n, i), (63 - n, i)) if axis == 0 else ((i, n), (i, 63 - n))
                a, b = pixels[axy], pixels[bxy]
                pixels[axy] = tuple(
                    round(a[c] * (1 - weight) + b[c] * weight) for c in range(3)
                )
                pixels[bxy] = tuple(
                    round(b[c] * (1 - weight) + a[c] * weight) for c in range(3)
                )
    return tile.convert("RGBA")


def main():
    images, sources, specs = {}, [], {}
    for name, columns, keys in (
        ("sawmill-walls-sheet", 4, WALLS),
        ("sawmill-props-sheet", 4, PROPS),
        ("sawmill-roofs-debris-sheet", 2, ROOFS),
    ):
        sprites, info = extract(name, columns, keys)
        images.update(sprites)
        sources.append(info)

    def group(keys, spec):
        for key in keys:
            specs[key] = (spec, keys)

    group([f"wall.h.{i}" for i in range(4)], (40, 48, 20, 40, 36, 40, 44))
    group([f"wall.v.{i}" for i in range(4)], (32, 72, 16, 48, 24, 64, 68))
    group(
        [f"corner.{d}" for d in ("nw", "ne", "sw", "se")], (44, 60, 22, 46, 40, 52, 56)
    )
    group([f"end.{d}" for d in ("n", "e", "s", "w")], (32, 52, 16, 44, 26, 44, 48))
    group(["drive.closed", "drive.open"], (88, 100, 44, 84, 72, 64, 94))
    group(["niche.closed", "niche.open", "niche.empty"], (72, 88, 36, 76, 56, 60, 82))
    group(["roof.store", "roof.hall"], (200, 136, 100, 116, 192, 124, 128))
    for key, spec in {
        "bench": (112, 92, 56, 78, 90, 62, 86),
        "load": (88, 72, 44, 60, 80, 60, 68),
        "tag": (32, 32, 16, 28, 28, 28, 30),
        "crate": (68, 64, 34, 54, 60, 54, 60),
        "note": (32, 36, 16, 28, 28, 28, 32),
        "ledger": (40, 36, 20, 28, 36, 28, 32),
        "tracks": (64, 64, 32, 32, 56, 56, 60),
        "woodRack": (96, 80, 48, 68, 88, 68, 76),
        "tools": (64, 80, 32, 68, 56, 68, 76),
        "sign": (80, 84, 40, 72, 72, 72, 80),
        "cloth": (64, 72, 32, 60, 56, 60, 68),
        "debris.light": (88, 128, 44, 64, 44, 112, 120),
        "debris.heavy": (88, 128, 44, 64, 76, 112, 120),
    }.items():
        group([key], spec)
    frames = {}
    for key, raw in images.items():
        (w, h, ax, ay, maxw, maxh, bottom), peers = specs[key]
        factor = min(
            maxw / max(images[k].width for k in peers),
            maxh / max(images[k].height for k in peers),
        )
        small = raw.resize(
            (max(1, round(raw.width * factor)), max(1, round(raw.height * factor))),
            Image.Resampling.NEAREST,
        )
        frame = Image.new("RGBA", (w, h))
        x, y = ax - small.width // 2, bottom - small.height
        if min(x, y) < 2 or x + small.width > w - 2 or y + small.height > h - 2:
            raise ValueError(f"Sawmill sprite clipped: {key}")
        frame.alpha_composite(small, (x, y))
        frames[key] = (frame, ax, ay)
    x = y = 2
    row = 0
    positions = {}
    for key, (frame, ax, ay) in sorted(frames.items(), key=lambda p: -p[1][0].height):
        if x + frame.width + 2 > 512:
            x = 2
            y += row + 2
            row = 0
        positions[key] = {
            "x": x,
            "y": y,
            "width": frame.width,
            "height": frame.height,
            "anchor": [ax, ay],
        }
        x += frame.width + 2
        row = max(row, frame.height)
    height = 2 ** math.ceil(math.log2(y + row + 2))
    if height > 512:
        raise ValueError("Sawmill pack exceeds 512²")
    atlas = Image.new("RGBA", (512, height))
    for key, (frame, _, _) in frames.items():
        atlas.alpha_composite(frame, (positions[key]["x"], positions[key]["y"]))
    floors, info = extract("sawmill-floors-sheet", 3, ("courtyard", "room", "hall"))
    sources.append(info)
    floor_atlas = Image.new("RGBA", (192, 64))
    floor_meta = {}
    for i, (key, raw) in enumerate(floors.items()):
        floor_atlas.paste(periodic_tile(raw), (i * 64, 0))
        floor_meta[key] = {"x": i * 64, "y": 0, "width": 64, "height": 64}
    out = ROOT / "src/assets/sawmill"
    out.mkdir(parents=True, exist_ok=True)
    atlas.save(out / "sawmill.png", optimize=True)
    floor_atlas.save(out / "floors.png", optimize=True)
    frames["tag"][0].save(out / "tag-icon.png", optimize=True)
    (out / "manifest.json").write_text(
        json.dumps(
            {
                "version": 1,
                "approvedVariant": 1,
                "regionId": "1:1",
                "atlas": "sawmill.png",
                "size": [512, height],
                "frames": positions,
                "floors": floor_meta,
                "sources": sources,
                "processing": {
                    "alphaThreshold": 128,
                    "backgroundRemoval": False,
                    "filter": "nearest",
                    "floorEdgeBand": 4,
                },
            },
            indent=2,
        )
        + "\n"
    )
    print(
        f"Prepared {len(frames)} sawmill frames in 512x{height}, 3 periodic 64² floors, tag icon"
    )


if __name__ == "__main__":
    main()
