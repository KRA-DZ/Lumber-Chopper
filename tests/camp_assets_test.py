"""Approved refuge PNGs: source provenance, clean alpha, aligned building states."""

from pathlib import Path
import hashlib
import json
import unittest
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]


class CampAssets(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.folder = ROOT / "src/assets/camp"
        cls.meta = json.loads((cls.folder / "manifest.json").read_text())
        cls.image = Image.open(cls.folder / "camp.png").convert("RGBA")

    def test_originals_and_complete_pack(self):
        self.assertEqual(self.meta["approvedVariant"], 4)
        self.assertEqual(len(self.meta["frames"]), 27)
        self.assertLessEqual(max(self.image.size), 1024)
        for source in self.meta["sources"]:
            file = ROOT / "art/source" / source["file"]
            self.assertEqual(
                hashlib.sha256(file.read_bytes()).hexdigest(), source["sha256"]
            )
            with Image.open(file) as original:
                self.assertEqual(original.mode, "RGBA")
                self.assertEqual(original.getchannel("A").getextrema()[0], 0)

    def test_states_stand_on_same_feet_and_have_real_different_images(self):
        for keys in [
            (f"tent.{s}" for s in ("early", "late", "ready", "damaged")),
            (f"hut.{s}" for s in ("early", "late", "ready", "damaged")),
            iter(("fire.cold", "fire.0", "fire.1", "fire.2")),
        ]:
            sizes, hashes = set(), set()
            for key in keys:
                f = self.meta["frames"][key]
                sizes.add((f["width"], f["height"], *f["anchor"]))
                tile = self.image.crop(
                    (f["x"], f["y"], f["x"] + f["width"], f["y"] + f["height"])
                )
                hashes.add(hashlib.sha256(tile.tobytes()).hexdigest())
            self.assertEqual(len(sizes), 1)
            self.assertEqual(len(hashes), 4)

    def test_no_overlap_or_hidden_matte(self):
        boxes = []
        for key, f in self.meta["frames"].items():
            box = (f["x"], f["y"], f["x"] + f["width"], f["y"] + f["height"])
            self.assertTrue(0 <= box[0] < box[2] <= self.image.width, key)
            self.assertTrue(0 <= box[1] < box[3] <= self.image.height, key)
            for old in boxes:
                self.assertFalse(
                    min(box[2], old[2]) > max(box[0], old[0])
                    and min(box[3], old[3]) > max(box[1], old[1]),
                    key,
                )
            boxes.append(box)
            tile = self.image.crop(box)
            self.assertEqual(tile.getpixel((0, 0)), (0, 0, 0, 0))
            self.assertIsNotNone(tile.getbbox())
        data = self.image.tobytes()
        for i in range(0, len(data), 4):
            self.assertIn(data[i + 3], (0, 255))
            if not data[i + 3]:
                self.assertEqual(data[i : i + 3], b"\0\0\0")


if __name__ == "__main__":
    unittest.main()
