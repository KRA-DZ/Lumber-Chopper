#!/usr/bin/env python3
"""Approved refuge PNG states -> bounded atlas, fixed feet, native alpha (offline)."""

from pathlib import Path
import hashlib
import json
import math
from PIL import Image
from prepare_assets import components, clean_mask

ROOT = Path(__file__).resolve().parents[1]
STATES = ("early", "late", "ready", "damaged")
SHEETS = (
    ("camp-tent-states-sheet", 2, tuple(f"tent.{s}" for s in STATES)),
    ("camp-hut-states-sheet", 2, tuple(f"hut.{s}" for s in STATES)),
    ("camp-fire-states-sheet", 2, ("fire.cold", "fire.0", "fire.1", "fire.2")),
    (
        "camp-economy-assets-sheet",
        3,
        ("stall", "depot", "cart", "salePad", "buildPad", "sign"),
    ),
    (
        "camp-fence-assets-sheet",
        3,
        (
            "rail.ready",
            "rail.damaged",
            "rail.broken",
            "post.ready",
            "barricade.ready",
            "trap.ready",
            "post.broken",
            "barricade.broken",
            "trap.broken",
        ),
    ),
)


def extract(name, columns, names):
    path = ROOT / "art/source" / f"{name}.png"
    with Image.open(path) as raw:
        if raw.mode != "RGBA" or raw.getchannel("A").getextrema()[0] != 0:
            raise ValueError(f"{name}: genuine alpha required")
        image = raw.copy()
    mask = clean_mask(image.getchannel("A").point(lambda a: 255 if a >= 128 else 0), 8)
    rows = math.ceil(len(names) / columns)
    groups = [[] for _ in names]
    for part in components(mask):
        x0, y0, x1, y1 = part.box
        col = min(columns - 1, int((x0 + x1) / 2 / image.width * columns))
        row = min(rows - 1, int((y0 + y1) / 2 / image.height * rows))
        groups[row * columns + col].append(part)
    out, boxes = {}, {}
    for key, parts in zip(names, groups):
        if not parts:
            raise ValueError(f"Missing camp sprite {key}")
        box = (
            min(p.box[0] for p in parts),
            min(p.box[1] for p in parts),
            max(p.box[2] for p in parts),
            max(p.box[3] for p in parts),
        )
        if min(box[:2]) < 2 or box[2] >= image.width - 2 or box[3] >= image.height - 2:
            raise ValueError(f"Clipped camp sprite {key}: {box}")
        alpha = Image.new("L", image.size)
        for part in parts:
            for yy, left, right in part.runs:
                alpha.paste(255, (left, yy, right, yy + 1))
        isolated = image.copy()
        isolated.putalpha(alpha)
        out[key] = isolated.crop(box)
        boxes[key] = list(box)
    return out, {
        "file": path.name,
        "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
        "size": list(image.size),
        "columns": columns,
        "rows": rows,
        "boxes": boxes,
        "nativeAlpha": True,
    }


def main():
    images, sources = {}, []
    for name, columns, names in SHEETS:
        sprites, info = extract(name, columns, names)
        images.update(sprites)
        sources.append(info)
    frames = {}
    groups = [
        ([f"tent.{s}" for s in STATES], (128, 120, 64, 112), (112, 104)),
        ([f"hut.{s}" for s in STATES], (136, 148, 68, 140), (124, 132)),
        (["fire.cold", "fire.0", "fire.1", "fire.2"], (64, 80, 32, 74), (56, 68)),
        (["stall"], (128, 116, 64, 108), (112, 100)),
        (["depot"], (72, 68, 36, 62), (64, 54)),
        (["cart"], (80, 64, 40, 58), (72, 50)),
        (["salePad", "buildPad"], (72, 46, 36, 23), (64, 38)),
        (["sign"], (66, 48, 33, 44), (62, 40)),
        (["rail.ready", "rail.damaged", "rail.broken"], (64, 32, 32, 30), (60, 26)),
        (["post.ready"], (20, 32, 10, 30), (16, 28)),
        (["post.broken"], (20, 32, 10, 30), (16, 12)),
        (["barricade.ready"], (56, 44, 28, 40), (48, 34)),
        (["barricade.broken"], (56, 44, 28, 40), (48, 16)),
        (["trap.ready", "trap.broken"], (36, 28, 18, 24), (28, 20)),
    ]
    for keys, (w, h, ax, ay), (maxw, maxh) in groups:
        factor = min(
            maxw / max(images[k].width for k in keys),
            maxh / max(images[k].height for k in keys),
        )
        for key in keys:
            raw = images[key]
            im = raw.resize(
                (max(1, round(raw.width * factor)), max(1, round(raw.height * factor))),
                Image.Resampling.NEAREST,
            )
            frame = Image.new("RGBA", (w, h))
            # Ground pads are centered on their trigger; other objects stand on their feet.
            xx = ax - im.width // 2
            yy = ay - im.height // 2 if key.endswith("Pad") else ay - im.height
            if xx < 2 or yy < 2 or xx + im.width > w - 2:
                raise ValueError(f"Sprite outside fixed frame: {key}")
            frame.alpha_composite(im, (xx, yy))
            frames[key] = (frame, ax, ay)
    x = y = 2
    row = 0
    positions = {}
    for key, (image, ax, ay) in sorted(
        frames.items(), key=lambda pair: -pair[1][0].height
    ):
        if x + image.width + 2 > 1024:
            x = 2
            y += row + 2
            row = 0
        positions[key] = {
            "x": x,
            "y": y,
            "width": image.width,
            "height": image.height,
            "anchor": [ax, ay],
        }
        x += image.width + 2
        row = max(row, image.height)
    height = 2 ** math.ceil(math.log2(y + row + 2))
    if height > 1024:
        raise ValueError("Camp atlas exceeds 1024x1024")
    atlas = Image.new("RGBA", (1024, height))
    for key, (image, _, _) in frames.items():
        atlas.alpha_composite(image, (positions[key]["x"], positions[key]["y"]))
    output = ROOT / "src/assets/camp"
    output.mkdir(parents=True, exist_ok=True)
    atlas.save(output / "camp.png", optimize=True)
    (output / "manifest.json").write_text(
        json.dumps(
            {
                "version": 1,
                "approvedVariant": 4,
                "atlas": "camp.png",
                "size": list(atlas.size),
                "sources": sources,
                "frames": positions,
                "processing": {
                    "backgroundRemoval": False,
                    "alphaThreshold": 128,
                    "filter": "nearest",
                },
            },
            indent=2,
        )
        + "\n"
    )
    print(f"Prepared {len(frames)} camp sprites in 1024x{height}")


if __name__ == "__main__":
    main()
