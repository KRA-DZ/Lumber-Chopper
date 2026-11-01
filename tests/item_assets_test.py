"""Small PNG pack contracts, original provenance and unchanged cargo-slot geometry."""

from pathlib import Path
import hashlib
import json
import unittest
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]


class ItemAssets(unittest.TestCase):
    def test_provenance_and_transparent_frames(self):
        directory = ROOT / "src/assets/items"
        meta = json.loads((directory / "manifest.json").read_text())
        image = Image.open(directory / "items.png").convert("RGBA")
        self.assertEqual(meta["approvedVariant"], 3)
        self.assertLessEqual(max(image.size), 256)
        self.assertEqual(
            set(meta["frames"]),
            {"log", "pile", "bundle", *[f"axe.{i}" for i in range(6)]},
        )
        for source in meta["sources"]:
            file = ROOT / "art/source" / source["file"]
            self.assertEqual(
                hashlib.sha256(file.read_bytes()).hexdigest(), source["sha256"]
            )
        boxes = []
        for key, f in meta["frames"].items():
            box = (f["x"], f["y"], f["x"] + f["width"], f["y"] + f["height"])
            self.assertTrue(0 <= box[0] < box[2] <= image.width)
            self.assertTrue(0 <= box[1] < box[3] <= image.height)
            for old in boxes:
                self.assertFalse(
                    min(box[2], old[2]) > max(box[0], old[0])
                    and min(box[3], old[3]) > max(box[1], old[1])
                )
            boxes.append(box)
            crop = image.crop(box)
            self.assertIsNotNone(crop.getbbox(), key)
            self.assertEqual(crop.getpixel((0, 0)), (0, 0, 0, 0), key)
        log = meta["frames"]["log"]
        self.assertEqual(
            (log["width"], log["height"], log["anchor"]), (42, 22, [21, 17])
        )
        data = image.tobytes()
        for i in range(0, len(data), 4):
            self.assertIn(data[i + 3], (0, 255))
            if not data[i + 3]:
                self.assertEqual(data[i : i + 3], b"\0\0\0")

    def test_six_distinct_tiers_and_shop_icons(self):
        directory = ROOT / "src/assets/items"
        hashes = set()
        for i in range(6):
            with Image.open(directory / "icons" / f"axe-{i}.png") as image:
                self.assertEqual(image.mode, "RGBA")
                self.assertEqual(image.size, (32, 32))
                hashes.add(hashlib.sha256(image.tobytes()).hexdigest())
        self.assertEqual(len(hashes), 6)
        for name in ("wood-pile", "wood-bundle"):
            with Image.open(directory / "icons" / f"{name}.png") as image:
                self.assertEqual(image.size, (32, 32))
                self.assertEqual(image.getpixel((0, 0))[3], 0)


if __name__ == "__main__":
    unittest.main()
