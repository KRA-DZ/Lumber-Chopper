#!/usr/bin/env python3
"""Approved knotted logs and worn axes -> small native-alpha pack and shop icons."""

from pathlib import Path
import json
import math
from PIL import Image, ImageOps
from prepare_camp import extract
from prepare_assets import foot_anchor

ROOT = Path(__file__).resolve().parents[1]


def fit(image, width, height):
    factor = min(width / image.width, height / image.height)
    return image.resize(
        (max(1, round(image.width * factor)), max(1, round(image.height * factor))),
        Image.Resampling.NEAREST,
    )


def main():
    wood, source_wood = extract("items-logs-sheet", 3, ("log", "pile", "bundle"))
    axes, source_axes = extract(
        "items-axes-sheet", 3, tuple(f"axe.{i}" for i in range(6))
    )
    frames = {}
    for key, image in wood.items():
        w, h, ax, ay = (42, 22, 21, 17) if key == "log" else (44, 36, 22, 32)
        im = fit(image, w - 2, h - 2)
        frame = Image.new("RGBA", (w, h))
        frame.alpha_composite(im, ((w - im.width) // 2, (h - im.height) // 2))
        frames[key] = (frame, ax, ay)
    factor = min(
        25 / max(im.height for im in axes.values()),
        26 / max(im.width for im in axes.values()),
    )
    for key, raw in axes.items():
        im = raw.resize(
            (max(1, round(raw.width * factor)), max(1, round(raw.height * factor))),
            Image.Resampling.NEAREST,
        )
        # Idle blade points away from the right hand; the hand grips above the pommel.
        im = ImageOps.mirror(im)
        foot = foot_anchor(im.getchannel("A"))
        grip_x, grip_y = round(foot["x"] * im.width), im.height - 3
        x, y = 12 - grip_x, 28 - grip_y
        if x < 1 or x + im.width >= 36 or y < 1 or y + im.height >= 34:
            raise ValueError(f"Idle axe grip outside frame: {key}")
        frame = Image.new("RGBA", (36, 34))
        frame.alpha_composite(im, (x, y))
        frames[key] = (frame, 12, 28)
    x = y = 2
    row = 0
    positions = {}
    for key, (frame, ax, ay) in sorted(frames.items(), key=lambda v: -v[1][0].height):
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
        raise ValueError("Item atlas exceeds 256x256 budget")
    atlas = Image.new("RGBA", (256, height))
    for key, (image, _, _) in frames.items():
        atlas.alpha_composite(image, (positions[key]["x"], positions[key]["y"]))
    output = ROOT / "src/assets/items"
    icons = output / "icons"
    icons.mkdir(parents=True, exist_ok=True)
    atlas.save(output / "items.png", optimize=True)
    for key, image in {
        "wood-pile": wood["pile"],
        "wood-bundle": wood["bundle"],
        **{k.replace(".", "-"): v for k, v in axes.items()},
    }.items():
        im = fit(image, 28, 28)
        icon = Image.new("RGBA", (32, 32))
        icon.alpha_composite(im, ((32 - im.width) // 2, (32 - im.height) // 2))
        icon.save(icons / f"{key}.png", optimize=True)
    (output / "manifest.json").write_text(
        json.dumps(
            {
                "version": 1,
                "approvedVariant": 3,
                "atlas": "items.png",
                "size": list(atlas.size),
                "sources": [source_wood, source_axes],
                "frames": positions,
                "processing": {
                    "backgroundRemoval": False,
                    "alphaThreshold": 128,
                    "filter": "nearest",
                },
                "icons": ["wood-pile", "wood-bundle", *[f"axe-{i}" for i in range(6)]],
            },
            indent=2,
        )
        + "\n"
    )
    print(
        f"Prepared {len(frames)} item frames in 256x{height} and eight shop PNG icons"
    )


if __name__ == "__main__":
    main()
