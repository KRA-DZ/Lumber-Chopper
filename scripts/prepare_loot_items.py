#!/usr/bin/env python3
"""Approved row 3 + matching perch -> binary-alpha sprites; no white-key removal."""
from pathlib import Path
import json
from PIL import Image, ImageOps
from prepare_camp import extract
from prepare_items import fit
from prepare_assets import foot_anchor

ROOT = Path(__file__).resolve().parents[1]
SOURCE_NAMES = ("coins", "resin", "key", "salve", "relic", "rod", "bobber")
NAMES = (*SOURCE_NAMES, "fish")
SIZES = {"coins": (28, 24), "resin": (28, 28), "key": (24, 32),
         "salve": (26, 28), "relic": (28, 32), "rod": (56, 68), "bobber": (14, 24), "fish": (28, 18)}


def main():
    sprites, source = extract("loot-items-selected-3-sheet", 4, SOURCE_NAMES)
    fish, fish_source = extract("loot-perch-style-3", 1, ("fish",))
    sprites.update(fish)
    frames, metadata = {}, {}
    atlas = Image.new("RGBA", (128, 128))
    x = y = 2
    row_height = 0
    out = ROOT / "src/assets/loot-items"
    (out / "icons").mkdir(parents=True, exist_ok=True)
    for name in sorted(NAMES, key=lambda key: -SIZES[key][1]):
        w, h = SIZES[name]
        raw = ImageOps.mirror(sprites[name]) if name == "rod" else sprites[name]
        image = fit(raw, w - 4, h - 4)
        frame = Image.new("RGBA", (w, h))
        frame.alpha_composite(image, ((w - image.width) // 2, (h - image.height) // 2))
        # Native source alpha is made binary by extract(); transparent RGB remains zero.
        if x + w + 2 > atlas.width:
            x = 2
            y += row_height + 2
            row_height = 0
        if y + h + 2 > atlas.height:
            raise ValueError("Loot items exceed the 128x128 source budget")
        foot = foot_anchor(frame.getchannel("A"))
        anchor = [round(foot["x"] * w), round(foot["y"] * h)] if name == "rod" else [w // 2, h - 2]
        metadata[name] = {"x": x, "y": y, "width": w, "height": h, "anchor": anchor}
        if name == "rod":
            box = frame.getchannel("A").getbbox()
            top = [(px, py) for py in range(box[1], box[1] + 3) for px in range(w) if frame.getpixel((px, py))[3]]
            metadata[name]["tip"] = [round(sum(p[0] for p in top) / len(top)), box[1]]
        atlas.alpha_composite(frame, (x, y))
        frames[name] = frame
        x += w + 2
        row_height = max(row_height, h)
        icon = Image.new("RGBA", (32, 32))
        icon_image = fit(sprites[name], 28, 28)
        icon.alpha_composite(icon_image, ((32 - icon_image.width) // 2, (32 - icon_image.height) // 2))
        icon.save(out / "icons" / f"{name}.png", optimize=True)
    atlas.save(out / "items.png", optimize=True)
    (out / "manifest.json").write_text(json.dumps({
        "version": 1, "approvedVariant": 3, "atlas": "items.png", "size": list(atlas.size),
        "sources": [source, fish_source], "frames": metadata,
        "processing": {"nativeAlpha": True, "alphaThreshold": 128, "filter": "nearest", "whiteColorRemoval": False},
    }, indent=2) + "\n")
    print(f"Prepared {len(frames)} approved loot sprites in 128x128 and {len(frames)} 32x32 icons")


if __name__ == "__main__":
    main()
