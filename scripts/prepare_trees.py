#!/usr/bin/env python3
"""Native-alpha approved tree sheets -> bounded sprite atlas; no white color key."""

from pathlib import Path
import hashlib
import json
import math
from PIL import Image, ImageChops
from prepare_assets import components, clean_mask, foot_anchor

ROOT = Path(__file__).resolve().parents[1]
TYPES = ("oak", "spruce", "birch", "dead")
HEIGHTS = {"oak": 168, "spruce": 178, "birch": 168, "dead": 148}


def extract(name, columns, actions):
    path = ROOT / "art/source" / f"{name}.png"
    with Image.open(path) as raw:
        if (
            raw.mode != "RGBA"
            or raw.getchannel("A").getextrema()[0] != 0
            or raw.getchannel("A").getextrema()[1] < 240
        ):
            raise ValueError(f"{name}: expected genuine transparent RGBA source")
        image = raw.copy()
    # Components identify the silhouette, while original alpha retains clean edges.
    mask = clean_mask(image.getchannel("A").point(lambda a: 255 if a >= 128 else 0), 8)
    image.putalpha(
        mask
    )  # Hard pixel edges; no faint alpha noise outside the silhouette.
    groups = [[] for _ in range(columns * len(actions))]
    for part in components(mask):
        x0, y0, x1, y1 = part.box
        column = int((x0 + x1) / 2 * columns / image.width)
        row = int((y0 + y1) / 2 * len(actions) / image.height)
        groups[row * columns + column].append(part)
    result = {}
    boxes = {}
    for index, parts in enumerate(groups):
        key = (
            "ancient"
            if columns == 1
            else f"{TYPES[index % columns]}.{actions[index // columns]}"
        )
        if not parts:
            raise ValueError(f"Missing tree: {key}")
        box = (
            min(p.box[0] for p in parts),
            min(p.box[1] for p in parts),
            max(p.box[2] for p in parts),
            max(p.box[3] for p in parts),
        )
        if min(box[:2]) < 2 or box[2] >= image.width - 2 or box[3] >= image.height - 2:
            raise ValueError(f"Clipped tree: {key}")
        alpha = Image.new("L", image.size)
        for part in parts:
            for yy, left, right in part.runs:
                alpha.paste(255, (left, yy, right, yy + 1))
        isolated = image.copy()
        isolated.putalpha(ImageChops.darker(alpha, image.getchannel("A")))
        result[key] = isolated.crop(box)
        boxes[key] = list(box)
    return result, {
        "file": path.name,
        "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
        "size": list(image.size),
        "columns": columns,
        "rows": len(actions),
        "boxes": boxes,
        "nativeAlpha": True,
    }


def main():
    frames, sources = {}, []
    for name, columns, actions in [
        ("trees-mature-sheet", 4, ("mature",)),
        ("trees-growth-sheet", 4, ("stump", "sprout", "young")),
        ("tree-ancient-sheet", 1, ("mature",)),
    ]:
        images, info = extract(name, columns, actions)
        sources.append(info)
        for key, image in images.items():
            if key == "ancient":
                factor = min(264 / image.height, 360 / image.width)
            else:
                kind, action = key.split(".")
                factor = (
                    HEIGHTS[kind]
                    if action == "mature"
                    else 84 if action == "young" else 22
                ) / image.height
                if action == "stump":
                    factor = min(factor, 38 / image.width)
            resized = image.resize(
                (
                    max(1, round(image.width * factor)),
                    max(1, round(image.height * factor)),
                ),
                Image.Resampling.NEAREST,
            )
            frame = Image.new("RGBA", (resized.width + 4, resized.height + 4))
            frame.alpha_composite(resized, (2, 2))
            # Only completely transparent RGB is zeroed. Birch whites stay opaque.
            data = bytearray(frame.tobytes())
            for i in range(0, len(data), 4):
                if not data[i + 3]:
                    data[i : i + 3] = b"\0\0\0"
            frame = Image.frombytes("RGBA", frame.size, bytes(data))
            frames[key] = frame
    positions = {}
    x = y = 2
    row = 0
    for key, image in sorted(frames.items(), key=lambda item: -item[1].height):
        if x + image.width + 2 > 1024:
            x = 2
            y += row + 2
            row = 0
        anchor = foot_anchor(image.getchannel("A"))
        positions[key] = {
            "x": x,
            "y": y,
            "width": image.width,
            "height": image.height,
            "anchor": [
                round(anchor["x"] * image.width),
                round(anchor["y"] * image.height),
            ],
        }
        x += image.width + 2
        row = max(row, image.height)
    height = 2 ** math.ceil(math.log2(y + row + 2))
    if height > 1024:
        raise ValueError("Tree atlas exceeds 1024x1024 budget")
    atlas = Image.new("RGBA", (1024, height))
    for key, image in frames.items():
        atlas.alpha_composite(image, (positions[key]["x"], positions[key]["y"]))
    output = ROOT / "src/assets/trees"
    output.mkdir(parents=True, exist_ok=True)
    atlas.save(output / "trees.png", optimize=True)
    manifest = {
        "version": 1,
        "approvedVariant": 1,
        "atlas": "trees.png",
        "size": list(atlas.size),
        "sources": sources,
        "frames": positions,
        "processing": {
            "backgroundRemoval": False,
            "alphaThreshold": 128,
            "filter": "nearest",
            "padding": 2,
        },
    }
    (output / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    print(f"Prepared {len(frames)} native-alpha tree frames in 1024x{height}.")


if __name__ == "__main__":
    main()
