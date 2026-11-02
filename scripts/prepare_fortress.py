#!/usr/bin/env python3
"""Approved burnt-fortress sheets -> aligned native-alpha sprites and periodic floors."""

from pathlib import Path
import json
import math
from PIL import Image, ImageOps
from prepare_camp import extract

ROOT = Path(__file__).resolve().parents[1]


def main():
    wall_names = tuple(f"wall.{axis}.{i}" for axis in ("h", "v") for i in range(4)) + (
        "corner.nw",
        "corner.ne",
        "corner.ne.alt",
        "corner.sw",
        "end.n",
        "end.e",
        "end.s",
        "end.w",
    )
    passage_names = (
        "gate.closed",
        "gate.open",
        "secret.closed",
        "secret.open",
        "winch",
        "latch",
        "chest.closed",
        "chest.open",
    )
    prop_names = (
        "keepsake",
        "token",
        "note",
        "diary",
        "tracks",
        "barricade",
        "coldFire",
        "supplies",
    )
    images, sources = {}, []
    for name, columns, keys in (
        ("fortress-walls-sheet", 4, wall_names),
        ("fortress-passages-sheet", 4, passage_names),
        ("fortress-findings-sheet", 4, prop_names),
    ):
        sprites, info = extract(name, columns, keys)
        images.update(sprites)
        sources.append(info)
    # The generator repeated NE. A horizontal modular mirror supplies SE without rotating wall height.
    images["corner.se"] = ImageOps.mirror(images["corner.sw"])
    del images["corner.ne.alt"]
    specs = {}

    def group(keys, spec):
        for key in keys:
            specs[key] = (spec, keys)

    group([f"wall.h.{i}" for i in range(4)], (40, 48, 20, 40, 36, 40, 44))
    group([f"wall.v.{i}" for i in range(4)], (32, 72, 16, 48, 24, 64, 68))
    group(
        [f"corner.{d}" for d in ("ne", "se", "sw", "nw")], (40, 56, 20, 44, 36, 48, 52)
    )
    group([f"end.{d}" for d in ("n", "e", "s", "w")], (32, 48, 16, 40, 24, 40, 44))
    group(["gate.closed", "gate.open"], (48, 112, 24, 76, 40, 100, 108))
    group(["secret.closed", "secret.open"], (112, 60, 40, 48, 72, 52, 56))
    group(["chest.closed", "chest.open"], (46, 42, 23, 34, 36, 30, 38))
    for key, spec in {
        "winch": (32, 48, 16, 40, 28, 40, 44),
        "latch": (48, 24, 24, 18, 44, 16, 20),
        "keepsake": (36, 34, 18, 28, 30, 26, 30),
        "token": (32, 32, 16, 28, 28, 28, 30),
        "note": (28, 32, 14, 24, 24, 26, 28),
        "diary": (36, 30, 18, 22, 32, 24, 26),
        "tracks": (32, 40, 16, 32, 28, 32, 36),
        "barricade": (64, 52, 32, 44, 56, 44, 48),
        "coldFire": (64, 44, 32, 34, 56, 36, 40),
        "supplies": (52, 48, 26, 40, 46, 40, 44),
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
        x = ax - small.width // 2
        y = bottom - small.height
        if min(x, y) < 2 or x + small.width > w - 2 or y + small.height > h - 2:
            raise ValueError(f"Fortress frame clipped: {key}")
        frame.alpha_composite(small, (x, y))
        frames[key] = (frame, ax, ay)
    # Mirror the prepared module, so NEAREST rounding cannot change the joining edge.
    sw, ax, ay = frames["corner.sw"]
    frames["corner.se"] = (ImageOps.mirror(sw), ax, ay)
    # Match open silhouettes to the shared physical passages. Park the secret
    # panel beside its doorway; the floor below comes from terrain, not the sprite.
    secret, ax, ay = frames["secret.open"]
    parked = secret.crop((40, 38, 68, 56))
    secret.paste((0, 0, 0, 0), (8, 37, 72, 60))
    secret.alpha_composite(parked, (80, 38))
    gate, ax, ay = frames["gate.open"]
    gate.paste((0, 0, 0, 0), (0, ay - 26, gate.width, ay + 26))
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
        raise ValueError("Fortress pack exceeds 512²")
    atlas = Image.new("RGBA", (512, height))
    for key, (frame, _, _) in frames.items():
        atlas.alpha_composite(frame, (positions[key]["x"], positions[key]["y"]))
    raw_floors, info = extract(
        "fortress-floors-sheet", 3, ("courtyard", "room", "archive")
    )
    sources.append(info)
    floor_atlas = Image.new("RGBA", (192, 64))
    floor_meta = {}
    for i, (key, raw) in enumerate(raw_floors.items()):
        # Trim panel-edge antialiasing; material interiors are fully opaque.
        tile = (
            raw.crop((4, 4, raw.width - 4, raw.height - 4))
            .convert("RGB")
            .resize((64, 64), Image.Resampling.NEAREST)
        )
        pixels = tile.load()
        # Pair opposite edge bands. End pixels match exactly; no blur in the game loop.
        for n in range(4):
            weight = (4 - n) / 8
            for y in range(64):
                a, b = pixels[n, y], pixels[63 - n, y]
                pixels[n, y] = tuple(
                    round(a[c] * (1 - weight) + b[c] * weight) for c in range(3)
                )
                pixels[63 - n, y] = tuple(
                    round(b[c] * (1 - weight) + a[c] * weight) for c in range(3)
                )
        for n in range(4):
            weight = (4 - n) / 8
            for x in range(64):
                a, b = pixels[x, n], pixels[x, 63 - n]
                pixels[x, n] = tuple(
                    round(a[c] * (1 - weight) + b[c] * weight) for c in range(3)
                )
                pixels[x, 63 - n] = tuple(
                    round(b[c] * (1 - weight) + a[c] * weight) for c in range(3)
                )
        floor_atlas.paste(tile.convert("RGBA"), (i * 64, 0))
        floor_meta[key] = {"x": i * 64, "y": 0, "width": 64, "height": 64}
    out = ROOT / "src/assets/fortress"
    out.mkdir(parents=True, exist_ok=True)
    atlas.save(out / "fortress.png", optimize=True)
    floor_atlas.save(out / "floors.png", optimize=True)
    frames["token"][0].save(out / "token-icon.png", optimize=True)
    (out / "manifest.json").write_text(
        json.dumps(
            {
                "version": 1,
                "approvedVariant": 4,
                "regionId": "0:-1",
                "atlas": "fortress.png",
                "size": [512, height],
                "frames": positions,
                "floors": floor_meta,
                "sources": sources,
                "processing": {
                    "alphaThreshold": 128,
                    "backgroundRemoval": False,
                    "filter": "nearest",
                    "cornerSE": "horizontal mirror of corner.sw",
                    "floorEdgeBand": 4,
                    "openPassages": "clear walkable bases; secret panel parked outside doorway",
                },
            },
            indent=2,
        )
        + "\n"
    )
    print(
        f"Prepared {len(frames)} fortress frames in 512x{height}, 3 periodic 64² floors, token icon"
    )


if __name__ == "__main__":
    main()
