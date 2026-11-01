#!/usr/bin/env python3
"""Chosen mossy decor -> small native-alpha frames, fixed bases and a shared atlas."""

from pathlib import Path
import json
import math
from PIL import Image
from prepare_camp import extract

ROOT = Path(__file__).resolve().parents[1]


def main():
    camp_names = (
        "crate",
        "barrel",
        "sack",
        "mat",
        "lantern",
        "kettle",
        "mug",
        "flowerpot",
    )
    forest_names = tuple(
        f"{kind}.{variant}"
        for variant in range(2)
        for kind in ("rock", "fern", "mushroom", "flowers")
    )
    camp, source_camp = extract("decor-camp-sheet", 4, camp_names)
    forest, source_forest = extract("decor-forest-sheet", 4, forest_names)
    images = {**camp, **forest}
    specs = {
        "crate": (36, 30, 18, 26, 32, 24),
        "barrel": (28, 34, 14, 30, 24, 28),
        "sack": (26, 30, 13, 26, 22, 24),
        "mat": (44, 18, 22, 10, 40, 14),
        "lantern": (26, 34, 13, 30, 22, 26),
        "kettle": (28, 26, 14, 22, 24, 20),
        "mug": (16, 18, 8, 14, 12, 12),
        "flowerpot": (28, 35, 14, 31, 24, 27),
    }
    for kind, maxw, maxh in (
        ("rock", 26, 20),
        ("fern", 26, 18),
        ("mushroom", 24, 14),
        ("flowers", 24, 16),
    ):
        for variant in range(2):
            specs[f"{kind}.{variant}"] = (32, 32, 16, 27, maxw, maxh)
    frames = {}
    for key, raw in images.items():
        w, h, ax, ay, maxw, maxh = specs[key]
        peers = (
            [images[f"{key.split('.')[0]}.{v}"] for v in range(2)]
            if "." in key
            else [raw]
        )
        scale = min(
            maxw / max(im.width for im in peers), maxh / max(im.height for im in peers)
        )
        resized = raw.resize(
            (max(1, round(raw.width * scale)), max(1, round(raw.height * scale))),
            Image.Resampling.NEAREST,
        )
        frame = Image.new("RGBA", (w, h))
        x = ax - resized.width // 2
        y = (h - resized.height) // 2 if key == "mat" else ay - resized.height
        if x < 2 or y < 2 or x + resized.width > w - 2 or y + resized.height > h - 2:
            raise ValueError(f"Decor exceeds its frame: {key}")
        frame.alpha_composite(resized, (x, y))
        frames[key] = (frame, ax, ay)
    x = y = 2
    row = 0
    positions = {}
    for key, (frame, ax, ay) in sorted(frames.items(), key=lambda p: -p[1][0].height):
        if x + frame.width + 2 > 256:
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
    if height > 256:
        raise ValueError("Decor pack exceeds 256x256")
    atlas = Image.new("RGBA", (256, height))
    for key, (frame, _, _) in frames.items():
        atlas.alpha_composite(frame, (positions[key]["x"], positions[key]["y"]))
    output = ROOT / "src/assets/decor"
    output.mkdir(parents=True, exist_ok=True)
    atlas.save(output / "decor.png", optimize=True)
    (output / "manifest.json").write_text(
        json.dumps(
            {
                "version": 1,
                "approvedVariant": 3,
                "atlas": "decor.png",
                "size": list(atlas.size),
                "sources": [source_camp, source_forest],
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
    print(f"Prepared {len(frames)} decor sprites in 256x{height}")


if __name__ == "__main__":
    main()
