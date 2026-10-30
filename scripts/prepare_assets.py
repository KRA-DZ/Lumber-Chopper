#!/usr/bin/env python3
"""White sheet -> tightly cropped RGBA sprites + foot anchors + optional Git publish.
Requires Pillow only. Names follow reading order; grid mode retains detached ropes/pegs.
"""

from __future__ import annotations
import argparse
from dataclasses import dataclass
import hashlib
import json
from pathlib import Path
import re
import subprocess
import tempfile
from PIL import Image, ImageChops, ImageFilter

NAMES = ("tent", "shop", "merchant", "spruce", "birch", "campfire")
MAX_PIXELS = 16_000_000


@dataclass
class Component:
    box: tuple[int, int, int, int]
    area: int
    runs: list[tuple[int, int, int]]


def components(mask: Image.Image) -> list[Component]:
    """8-connected run-length components; avoids a Python object for every pixel."""
    width, height = mask.size
    pixels = mask.convert("L").tobytes()
    parents: list[int] = []
    runs = []
    previous = []

    def root(n):
        while parents[n] != n:
            parents[n] = parents[parents[n]]
            n = parents[n]
        return n

    for y in range(height):
        current = []
        x = 0
        start_previous = 0
        while x < width:
            if not pixels[y * width + x]:
                x += 1
                continue
            left = x
            while x < width and pixels[y * width + x]:
                x += 1
            right = x  # exclusive
            label = len(parents)
            parents.append(label)
            while start_previous < len(previous) and previous[start_previous][1] < left:
                start_previous += 1
            previous_index = start_previous
            while (
                previous_index < len(previous) and previous[previous_index][0] <= right
            ):
                old_label = previous[previous_index][2]
                a, b = root(label), root(old_label)
                if a != b:
                    parents[max(a, b)] = min(a, b)
                previous_index += 1
            current.append((left, right, label))
            runs.append((y, left, right, label))
        previous = current
    groups = {}
    for y, left, right, label in runs:
        key = root(label)
        if key not in groups:
            groups[key] = Component((left, y, right, y + 1), 0, [])
        c = groups[key]
        c.box = (
            min(c.box[0], left),
            min(c.box[1], y),
            max(c.box[2], right),
            max(c.box[3], y + 1),
        )
        c.area += right - left
        c.runs.append((y, left, right))
    return list(groups.values())


def remove_background(image: Image.Image, tolerance=12, mode="edge") -> Image.Image:
    rgba = image.convert("RGBA")
    # Trust a supplied alpha channel. White clothing/bark is object color, not a key.
    if rgba.getchannel("A").getextrema()[0] < 255:
        return rgba
    rgb = rgba.convert("RGB")
    channels = [
        c.point(lambda value: 255 if value >= 255 - tolerance else 0)
        for c in rgb.split()
    ]
    white = ImageChops.darker(ImageChops.darker(channels[0], channels[1]), channels[2])
    if mode == "all":
        background = white
    else:
        # Only white regions reachable from the sheet edge. Enclosed highlights
        # (notably white birch bark) stay intact. Never blindly erase all bright pixels.
        background = Image.new("L", image.size)
        out = background.load()
        for c in components(white):
            x0, y0, x1, y1 = c.box
            if x0 != 0 and y0 != 0 and x1 != image.width and y1 != image.height:
                continue
            for y, left, right in c.runs:
                for x in range(left, right):
                    out[x, y] = 255
    alpha = ImageChops.darker(rgba.getchannel("A"), ImageChops.invert(background))
    rgba.putalpha(alpha)
    return rgba


def clean_mask(alpha, min_area):
    mask = Image.new("L", alpha.size)
    pixels = mask.load()
    for c in components(alpha.point(lambda a: 255 if a else 0)):
        if c.area < min_area:
            continue
        for y, left, right in c.runs:
            for x in range(left, right):
                pixels[x, y] = 255
    return mask


def unmatte_white(image, radius=2):
    """Recover colored boundary pixels contaminated by an old opaque white matte.

    Only a narrow silhouette band is considered. A pixel must match a mixture
    of white and a nearby darker interior color; pale interiors are left intact.
    Native transparent sources should bypass this legacy repair entirely.
    """
    image = image.convert("RGBA")
    alpha = image.getchannel("A")
    interior = alpha.filter(ImageFilter.MinFilter(radius * 2 + 1))
    band = ImageChops.subtract(alpha, interior)
    src, solid, edge = image.load(), interior.load(), band.load()
    result = image.copy()
    dest = result.load()
    for y in range(image.height):
        for x in range(image.width):
            r, g, b, a = src[x, y]
            if not edge[x, y] or min(r, g, b) < 160 or max(r, g, b) - min(r, g, b) > 75:
                continue
            candidates = []
            for dy in range(-radius - 1, radius + 2):
                for dx in range(-radius - 1, radius + 2):
                    xx, yy = x + dx, y + dy
                    if (
                        0 <= xx < image.width
                        and 0 <= yy < image.height
                        and solid[xx, yy] >= 240
                    ):
                        candidates.append((dx * dx + dy * dy, src[xx, yy][:3]))
            for _, color in sorted(candidates, key=lambda c: c[0]):
                if sum((r, g, b)) - sum(color) < 105:
                    continue
                direction = [255 - c for c in color]
                norm = sum(c * c for c in direction)
                coverage = sum(
                    (255 - c) * d for c, d in zip((r, g, b), direction)
                ) / max(1, norm)
                error = max(
                    abs(c - (255 - coverage * d)) for c, d in zip((r, g, b), direction)
                )
                if 0 < coverage < 0.9 and error <= 18:
                    dest[x, y] = (*color, round(a * coverage))
                    break
    # Zero hidden RGB too: future exports/filtering must not resurrect a white border.
    data = bytearray(result.tobytes())
    for i in range(0, len(data), 4):
        if data[i + 3] == 0:
            data[i : i + 3] = b"\0\0\0"
    return Image.frombytes("RGBA", result.size, bytes(data))


def foot_anchor(alpha):
    """Use the lower silhouette, not the image centre (important for curved birches)."""
    width, height = alpha.size
    data = alpha.tobytes()
    bottom = max(y for y in range(height) if any(data[y * width : (y + 1) * width]))
    xs = [
        x
        for y in range(max(0, bottom - max(2, height * 15 // 100)), bottom + 1)
        for x in range(width)
        if data[y * width + x] > 64
    ]
    if not xs:
        raise ValueError("No sufficiently opaque pixels for a foot anchor.")
    xs.sort()
    return {
        "x": round((xs[len(xs) // 2] + 0.5) / width, 6),
        "y": round((bottom + 0.5) / height, 6),
    }


def prepare(
    source,
    output,
    names=NAMES,
    columns=3,
    layout="grid",
    tolerance=12,
    background="edge",
    min_area=8,
    padding=2,
    defringe=0,
):
    with Image.open(source) as raw:
        if raw.width * raw.height > MAX_PIXELS:
            raise ValueError("Sheet is too large; limit is 16 million pixels.")
        native_alpha = raw.convert("RGBA").getchannel("A").getextrema()[0] < 255
        image = remove_background(raw, tolerance, background)
    for _ in range(0 if native_alpha else defringe):
        alpha = image.getchannel("A")
        near = ImageChops.invert(alpha).filter(ImageFilter.MaxFilter(3))
        pixels = image.load()
        edge = near.load()
        for y in range(image.height):
            for x in range(image.width):
                red, green, blue, a = pixels[x, y]
                if (
                    a
                    and edge[x, y]
                    and min(red, green, blue) >= 220
                    and max(red, green, blue) - min(red, green, blue) <= 20
                ):
                    pixels[x, y] = (red, green, blue, 0)
    if defringe and not native_alpha:
        image = unmatte_white(image, radius=2)
    mask = clean_mask(image.getchannel("A"), min_area)
    image.putalpha(ImageChops.darker(image.getchannel("A"), mask))
    rows = (len(names) + columns - 1) // columns
    boxes = []
    if layout == "grid":
        # Classify complete contours by their cell centre, rather than cutting at
        # cell borders: generators often place a treetop a few pixels across a row.
        grouped = [[] for _ in names]
        for c in components(mask):
            cx = (c.box[0] + c.box[2]) / 2
            cy = (c.box[1] + c.box[3]) / 2
            col = min(columns - 1, int(cx * columns / image.width))
            row = min(rows - 1, int(cy * rows / image.height))
            index = row * columns + col
            if index >= len(names):
                raise ValueError("Unexpected object in an unused grid cell.")
            grouped[index].append(c)
        for name, group in zip(names, grouped):
            if not group:
                raise ValueError(f"{name}: no object found in its grid position.")
            box = (
                min(c.box[0] for c in group),
                min(c.box[1] for c in group),
                max(c.box[2] for c in group),
                max(c.box[3] for c in group),
            )
            if (
                box[0] < 2
                or box[1] < 2
                or box[2] > image.width - 2
                or box[3] > image.height - 2
            ):
                raise ValueError(
                    f"{name}: object touches the sheet edge; its silhouette may be clipped."
                )
            boxes.append(box)
        for i, a in enumerate(boxes):
            for b in boxes[i + 1 :]:
                if min(a[2], b[2]) > max(a[0], b[0]) and min(a[3], b[3]) > max(
                    a[1], b[1]
                ):
                    raise ValueError(
                        "Object bounds overlap; use a more spacious sheet or strict components mode."
                    )
    else:
        found = components(mask)
        if len(found) != len(names):
            raise ValueError(
                f"Expected {len(names)} contours, found {len(found)}. Detached parts need grid mode; touching objects need a new sheet."
            )
        # Group into reading-order rows, not an unreliable global top-Y sort.
        ordered = sorted(found, key=lambda c: (c.box[1] + c.box[3]) / 2)
        for offset in range(0, len(names), columns):
            boxes.extend(
                c.box
                for c in sorted(
                    ordered[offset : offset + columns], key=lambda c: c.box[0]
                )
            )
    manifest = {
        "version": 1,
        "source": {
            "file": Path(source).name,
            "sha256": hashlib.sha256(Path(source).read_bytes()).hexdigest(),
            "size": list(image.size),
        },
        "processing": {
            "layout": layout,
            "columns": columns,
            "background": "alpha" if native_alpha else background,
            "tolerance": tolerance,
            "minArea": min_area,
            "padding": padding,
            "defringe": defringe,
            "whiteMatteRepair": bool(defringe and not native_alpha),
        },
        "assets": {},
    }
    output = Path(output)
    output.parent.mkdir(parents=True, exist_ok=True)
    files = []
    with tempfile.TemporaryDirectory(
        prefix=".asset-prep-", dir=output.parent
    ) as temporary:
        temp = Path(temporary)
        for name, box in zip(names, boxes):
            crop = image.crop(box)
            canvas = Image.new(
                "RGBA", (crop.width + padding * 2, crop.height + padding * 2)
            )
            canvas.paste(crop, (padding, padding))
            # Transparent pixels carry no white RGB fringe when later filtered/exported.
            data = bytearray(canvas.tobytes())
            for i in range(0, len(data), 4):
                if not data[i + 3]:
                    data[i : i + 3] = b"\0\0\0"
            canvas = Image.frombytes("RGBA", canvas.size, bytes(data))
            canvas.save(temp / f"{name}.png", optimize=True)
            manifest["assets"][name] = {
                "file": f"{name}.png",
                "width": canvas.width,
                "height": canvas.height,
                "anchor": foot_anchor(canvas.getchannel("A")),
                "sourceBox": list(box),
            }
            files.append(f"{name}.png")
        (temp / "manifest.json").write_text(
            json.dumps(manifest, indent=2) + "\n", encoding="utf-8"
        )
        files.append("manifest.json")
        output.mkdir(parents=True, exist_ok=True)
        for file in files:
            (temp / file).replace(output / file)
    return [output / file for file in files]


def git(repo, *args):
    result = subprocess.run(
        ["git", "-C", str(repo), *args], capture_output=True, text=True
    )
    if result.returncode:
        # Remote URLs may embed credentials: don't echo git stderr into CI logs.
        raise ValueError(
            f"Git operation failed: {args[0]}. Check the repository and credentials using Git directly."
        )
    return result.stdout.strip()


def publish(repo, files, push=False, message="Update generated camp PNG assets"):
    repo = Path(repo).resolve()
    if Path(git(repo, "rev-parse", "--show-toplevel")).resolve() != repo:
        raise ValueError("--repo must be the Git repository root.")
    relative = []
    allowed = (repo / "src/assets").resolve()
    for file in files:
        path = Path(file).resolve()
        if not path.is_relative_to(allowed):
            raise ValueError("Publishing is limited to src/assets/.")
        relative.append(path.relative_to(repo).as_posix())
    git(repo, "add", "--", *relative)
    changed = git(repo, "diff", "--cached", "--name-only", "--", *relative)
    if not changed:
        return None
    branch = git(repo, "symbolic-ref", "--short", "HEAD")
    remote = remote_branch = None
    if push:
        remote = git(repo, "config", f"branch.{branch}.remote")
        remote_branch = git(repo, "config", f"branch.{branch}.merge")
        git(repo, "fetch", "--no-tags", remote, remote_branch)
        if git(repo, "rev-parse", "HEAD") != git(repo, "rev-parse", "FETCH_HEAD"):
            raise ValueError(
                "Local HEAD differs from upstream. Synchronize existing commits first; the asset script will not push unrelated history."
            )
    # --only preserves unrelated staged files without putting them in this commit.
    git(repo, "commit", "--only", "-m", message, "--", *relative)
    commit = git(repo, "rev-parse", "HEAD")
    if push:
        git(repo, "push", remote, f"HEAD:{remote_branch}")
    return commit


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    parser.add_argument(
        "--repo", type=Path, default=Path(__file__).resolve().parents[1]
    )
    parser.add_argument("--output", type=Path)
    parser.add_argument("--names", default=",".join(NAMES))
    parser.add_argument("--columns", type=int, default=3)
    parser.add_argument("--layout", choices=["grid", "components"], default="grid")
    parser.add_argument("--background", choices=["edge", "all"], default="edge")
    parser.add_argument("--tolerance", type=int, default=12)
    parser.add_argument("--min-area", type=int, default=8)
    parser.add_argument("--padding", type=int, default=2)
    parser.add_argument(
        "--defringe",
        type=int,
        choices=[0, 1, 2],
        default=0,
        help="Remove up to two rings of near-white matte at transparent edges.",
    )
    parser.add_argument("--commit", action="store_true")
    parser.add_argument(
        "--publish",
        action="store_true",
        help="Commit only generated files and push to the current tracked branch (no force).",
    )
    args = parser.parse_args()
    names = tuple(args.names.split(","))
    if len(set(names)) != len(names) or not all(
        re.fullmatch("[a-z][a-z0-9_-]*", n) for n in names
    ):
        parser.error(
            "Names must be unique safe file stems: lowercase letters, numbers, underscores and hyphens."
        )
    if (
        not 1 <= args.columns <= len(names)
        or not 0 <= args.tolerance <= 50
        or args.min_area < 1
        or not 0 <= args.padding <= 32
    ):
        parser.error("Invalid columns, tolerance, min-area or padding.")
    try:
        output = args.output or args.repo / "src/assets"
        files = prepare(
            args.source,
            output,
            names,
            args.columns,
            args.layout,
            args.tolerance,
            args.background,
            args.min_area,
            args.padding,
            args.defringe,
        )
        print(f"Prepared {len(names)} transparent PNGs and manifest: {output}")
        if args.commit or args.publish:
            commit = publish(args.repo, files, args.publish)
            print(
                f"Asset commit: {commit}"
                if commit
                else "Assets unchanged; no commit or push needed."
            )
    except (ValueError, OSError, Image.DecompressionBombError) as error:
        parser.exit(1, f"{error}\n")


if __name__ == "__main__":
    main()
