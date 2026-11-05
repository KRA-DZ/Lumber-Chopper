"""Mossy decor PNGs: provenance, fixed small frames, distinct variants and alpha."""

from pathlib import Path
import hashlib
import json
import unittest
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]


class DecorAssets(unittest.TestCase):
    def test_provenance_and_bounded_clean_pack(self):
        folder = ROOT / "src/assets/decor"
        meta = json.loads((folder / "manifest.json").read_text())
        image = Image.open(folder / "decor.png").convert("RGBA")
        self.assertEqual(meta["approvedVariant"], 3)
        self.assertEqual(len(meta["frames"]), 22)
        self.assertLessEqual(max(image.size), 256)
        for source in meta["sources"]:
            file = ROOT / "art/source" / source["file"]
            self.assertEqual(
                hashlib.sha256(file.read_bytes()).hexdigest(), source["sha256"]
            )
        boxes = []
        for key, f in meta["frames"].items():
            box = (f["x"], f["y"], f["x"] + f["width"], f["y"] + f["height"])
            self.assertTrue(0 <= box[0] < box[2] <= image.width, key)
            self.assertTrue(0 <= box[1] < box[3] <= image.height, key)
            for old in boxes:
                self.assertFalse(
                    min(box[2], old[2]) > max(box[0], old[0])
                    and min(box[3], old[3]) > max(box[1], old[1]),
                    key,
                )
            boxes.append(box)
            crop = image.crop(box)
            self.assertEqual(crop.getpixel((0, 0)), (0, 0, 0, 0))
            self.assertIsNotNone(crop.getbbox())
        data = image.tobytes()
        for i in range(0, len(data), 4):
            self.assertIn(data[i + 3], (0, 255))
            if not data[i + 3]:
                self.assertEqual(data[i : i + 3], b"\0\0\0")

    def test_forest_pairs_share_bases_but_have_different_shapes(self):
        folder = ROOT / "src/assets/decor"
        meta = json.loads((folder / "manifest.json").read_text())
        image = Image.open(folder / "decor.png").convert("RGBA")
        for kind in ("rock", "fern", "mushroom", "flowers"):
            hashes = set()
            for variant in range(2):
                f = meta["frames"][f"{kind}.{variant}"]
                self.assertEqual(
                    (f["width"], f["height"], f["anchor"]), (32, 32, [16, 27])
                )
                crop = image.crop(
                    (f["x"], f["y"], f["x"] + f["width"], f["y"] + f["height"])
                )
                hashes.add(hashlib.sha256(crop.tobytes()).hexdigest())
            self.assertEqual(len(hashes), 2, kind)


if __name__ == "__main__":
    unittest.main()
