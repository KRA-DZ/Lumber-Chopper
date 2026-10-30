#!/usr/bin/env python3
"""Approved generated character sheets -> one packed PNG, anchors and portraits (offline)."""

from pathlib import Path
import hashlib
import json
import math
from PIL import Image, ImageChops
from prepare_assets import components, remove_background, clean_mask, unmatte_white

ROOT = Path(__file__).resolve().parents[1]
DIRS = ("down", "up", "side")
ROLES = ("hero2", "hero3", "worker3", "worker4", "buyer1", "buyer2", "buyer3", "buyer4")
TIERS = ("#b4c9bf", "#70b983", "#70a9d2", "#b38bd5", "#dcaf50", "#d66c63")


def sheet(name, roles, action, rows, columns=6):
    source = ROOT / "art/source" / f"{name}-sheet.png"
    with Image.open(source) as raw:
        image = raw.convert("RGBA")
        original_size = list(raw.size)
    # The supplied worker walk sheet has three occupied rows and trailing white space.
    mask = clean_mask(remove_background(image, mode="all").getchannel("A"), 16)
    bottom = mask.getbbox()[3]
    crop_height = (
        min(image.height, bottom + 10) if name == "workers-walk" else image.height
    )
    image = image.crop((0, 0, image.width, crop_height))
    names = []
    for row in range(rows):
        if action == "gesture":
            names.extend(
                f'{role}-gesture-{("carry" if role.startswith(("hero","worker")) else "greet") if row==0 else "cheer" if row==1 else "rest"}'
                for role in roles
            )
        elif action == "merchant":
            names.extend(
                (
                    "merchant-idle",
                    "merchant-adjust",
                    "merchant-read",
                    "merchant-look",
                    "merchant-greet",
                    "merchant-peek",
                )[row * 3 : row * 3 + 3]
            )
        else:
            names.extend(
                f"{role}-{action}-{direction}-{row}"
                for role in roles
                for direction in DIRS
            )
    rgba = remove_background(image, mode="all")
    if image.getchannel("A").getextrema()[0] == 255:
        rgba = unmatte_white(rgba)
    found = components(clean_mask(rgba.getchannel("A"), 12))
    grid_rows = 4 if name == "buyers-a-walk" else rows
    groups = [[] for _ in names]
    for part in found:
        x0, y0, x1, y1 = part.box
        col = min(columns - 1, int((x0 + x1) / 2 / image.width * columns))
        row = min(grid_rows - 1, int((y0 + y1) / 2 / image.height * grid_rows))
        index = row * columns + col
        # The fourth buyer-A pose is clipped by its source edge; keep three complete poses.
        if index < len(groups):
            groups[index].append(part)
    sprites = {}
    for key, parts in zip(names, groups):
        if not parts:
            raise ValueError(f"Missing isolated figure: {name}/{key}")
        x0 = min(p.box[0] for p in parts)
        y0 = min(p.box[1] for p in parts)
        x1 = max(p.box[2] for p in parts)
        y1 = max(p.box[3] for p in parts)
        if min(x0, y0) <= 0 or x1 >= image.width or y1 >= image.height:
            raise ValueError(f"Clipped pose: {name}/{key}")
        alpha = Image.new("L", image.size)
        for part in parts:
            for yy, left, right in part.runs:
                alpha.paste(255, (left, yy, right, yy + 1))
        isolated = rgba.copy()
        isolated.putalpha(ImageChops.darker(alpha, rgba.getchannel("A")))
        crop = isolated.crop((x0, y0, x1, y1))
        padded = Image.new("RGBA", (crop.width + 4, crop.height + 4))
        padded.alpha_composite(crop, (2, 2))
        sprites[key] = padded
    return sprites, {
        "file": source.name,
        "sha256": hashlib.sha256(source.read_bytes()).hexdigest(),
        "size": original_size,
        "crop": [0, 0, image.width, crop_height],
        "gridRows": grid_rows,
        "rows": rows,
        "columns": columns,
    }


def normalize(images, action):
    width, height, ax, ay = (
        (64, 64, 32, 60)
        if action == "strike"
        else (64, 46, 32, 44) if action == "gesture" else (40, 46, 20, 44)
    )
    maximum = 54 if action == "strike" else 42
    factor = min(
        maximum / max(im.height for im in images.values()),
        (width - 2) / max(im.width for im in images.values()),
    )
    result = {}
    for name, im in images.items():
        im = im.resize(
            (max(1, round(im.width * factor)), max(1, round(im.height * factor))),
            Image.Resampling.NEAREST,
        )
        frame = Image.new("RGBA", (width, height))
        frame.alpha_composite(im, (ax - im.width // 2, ay - im.height))
        result[name] = (frame, ax, ay)
    return result


def main():
    frames = {}
    sources = []
    specs = [
        ("heroes-walk", ROLES[:2], "walk", 4, 6),
        ("workers-walk", ROLES[2:4], "walk", 3, 6),
        ("buyers-a-walk", ROLES[4:6], "walk", 3, 6),
        ("buyers-b-walk", ROLES[6:], "walk", 4, 6),
        ("heroes-carry", ROLES[:2], "carry", 4, 6),
        ("workers-carry", ROLES[2:4], "carry", 3, 6),
        ("heroes-strike", ROLES[:2], "strike", 3, 6),
        ("workers-strike", ROLES[2:4], "strike", 3, 6),
        ("people-gestures", ROLES, "gesture", 3, 8),
        ("merchant-ivory", ("merchant",), "merchant", 2, 3),
    ]
    portraits = {}
    for name, roles, action, rows, columns in specs:
        images, source = sheet(name, roles, action, rows, columns)
        sources.append(source)
        if name == "heroes-walk":
            portraits = {role: images[f"{role}-walk-down-1"] for role in roles}
        # A single scale per identity and action keeps poses from independently growing/shrinking.
        for role in roles:
            subset = {
                key: im for key, im in images.items() if key.startswith(role + "-")
            }
            frames.update(normalize(subset, action))
    metal_counts = {}
    for role in ROLES[:2]:
        for key, (frame, ax, ay) in list(frames.items()):
            if not key.startswith(role + "-strike-"):
                continue
            blade = [
                i
                for i, p in enumerate(zip(*[iter(frame.tobytes())] * 4))
                if p[3] and p[2] > p[0] + 8 and p[2] > p[1] + 4
            ]
            metal_counts[key] = len(blade)
            for tier, color in enumerate(TIERS):
                out = frame.copy()
                pixels = out.load()
                rgb = tuple(bytes.fromhex(color[1:]))
                for i in blade:
                    x, y = i % frame.width, i // frame.width
                    r, g, b, a = frame.getpixel((x, y))
                    shade = min(1.3, max(0.45, (r + g + b) / (3 * 150)))
                    pixels[x, y] = tuple(min(255, round(c * shade)) for c in rgb) + (a,)
                frames[f"{key}-tier{tier}"] = (out, ax, ay)
            del frames[key]
    # Shelf-pack once during preparation, not at game time.
    width = 1024
    x = y = 2
    row_height = 0
    positions = {}
    for key, (frame, ax, ay) in sorted(
        frames.items(), key=lambda item: (-item[1][0].height, item[0])
    ):
        if x + frame.width + 2 > width:
            x = 2
            y += row_height + 2
            row_height = 0
        positions[key] = {
            "x": x,
            "y": y,
            "width": frame.width,
            "height": frame.height,
            "anchor": [ax, ay],
        }
        x += frame.width + 2
        row_height = max(row_height, frame.height)
    height = 2 ** math.ceil(math.log2(y + row_height + 2))
    if height > 2048:
        raise ValueError("People atlas exceeds 1024x2048 budget")
    atlas = Image.new("RGBA", (width, height))
    for key, (frame, _, _) in frames.items():
        atlas.alpha_composite(frame, (positions[key]["x"], positions[key]["y"]))
    output = ROOT / "src/assets/people"
    output.mkdir(parents=True, exist_ok=True)
    atlas.save(output / "people.png", optimize=True)
    for role, portrait in portraits.items():
        portrait.save(output / f"{role}-portrait.png", optimize=True)
    manifest = {
        "version": 1,
        "sources": sources,
        "atlas": "people.png",
        "size": [width, height],
        "frames": positions,
        "walkFrames": {
            "hero2": 4,
            "hero3": 4,
            "worker3": 3,
            "worker4": 3,
            "buyer1": 3,
            "buyer2": 3,
            "buyer3": 4,
            "buyer4": 4,
        },
        "carryFrames": {"hero2": 4, "hero3": 4, "worker3": 3, "worker4": 3},
        "axeColors": list(TIERS),
        "metalPixels": metal_counts,
    }
    (output / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    print(f"Prepared {len(frames)} PNG frames in {width}x{height} and two portraits.")


if __name__ == "__main__":
    main()
