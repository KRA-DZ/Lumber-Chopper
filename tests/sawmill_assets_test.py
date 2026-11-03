"""Only workshop sprites: provenance, hard alpha, state alignment and repeated floors."""

from pathlib import Path
import hashlib
import json
import unittest
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
FOLDER = ROOT / "src/assets/sawmill"


class SawmillAssets(unittest.TestCase):
    def setUp(self):
        self.meta = json.loads((FOLDER / "manifest.json").read_text())
        self.atlas = Image.open(FOLDER / "sawmill.png").convert("RGBA")

    def crop(self, key):
        f = self.meta["frames"][key]
        return self.atlas.crop(
            (f["x"], f["y"], f["x"] + f["width"], f["y"] + f["height"])
        )

    def test_source_and_frame_integrity(self):
        self.assertEqual(self.meta["approvedVariant"], 1)
        self.assertEqual(len(self.meta["frames"]), 36)
        self.assertLessEqual(max(self.atlas.size), 512)
        for source in self.meta["sources"]:
            p = ROOT / "art/source" / source["file"]
            self.assertEqual(
                hashlib.sha256(p.read_bytes()).hexdigest(), source["sha256"]
            )
            self.assertTrue(source["nativeAlpha"])
        boxes = []
        for key, f in self.meta["frames"].items():
            box = (f["x"], f["y"], f["x"] + f["width"], f["y"] + f["height"])
            self.assertTrue(0 <= box[0] < box[2] <= self.atlas.width, key)
            self.assertTrue(0 <= box[1] < box[3] <= self.atlas.height, key)
            for old in boxes:
                self.assertFalse(
                    min(box[2], old[2]) > max(box[0], old[0])
                    and min(box[3], old[3]) > max(box[1], old[1]),
                    key,
                )
            boxes.append(box)
            self.assertIsNotNone(self.crop(key).getbbox(), key)
        data = self.atlas.tobytes()
        for i in range(0, len(data), 4):
            self.assertIn(data[i + 3], (0, 255))
            if data[i + 3] == 0:
                self.assertEqual(data[i : i + 3], b"\0\0\0")

    def test_fixed_state_bases_and_brass_icon(self):
        for group in [
            ("drive.closed", "drive.open"),
            ("niche.closed", "niche.open", "niche.empty"),
            ("roof.store", "roof.hall"),
        ]:
            before = self.meta["frames"][group[0]]
            for key in group[1:]:
                frame = self.meta["frames"][key]
                self.assertEqual(
                    (frame["width"], frame["height"], frame["anchor"]),
                    (before["width"], before["height"], before["anchor"]),
                )
                self.assertNotEqual(
                    self.crop(key).tobytes(), self.crop(group[0]).tobytes()
                )
        icon = Image.open(FOLDER / "tag-icon.png").convert("RGBA")
        self.assertEqual(icon.size, (32, 32))
        self.assertEqual(icon.tobytes(), self.crop("tag").tobytes())

    def test_floor_edges_repeat_without_transparency_or_identical_materials(self):
        floors = Image.open(FOLDER / "floors.png").convert("RGBA")
        self.assertEqual(floors.size, (192, 64))
        self.assertEqual(floors.getchannel("A").getextrema(), (255, 255))
        hashes = set()
        for name, f in self.meta["floors"].items():
            tile = floors.crop((f["x"], 0, f["x"] + 64, 64))
            hashes.add(hashlib.sha256(tile.tobytes()).hexdigest())
            self.assertEqual(
                tile.crop((0, 0, 1, 64)).tobytes(),
                tile.crop((63, 0, 64, 64)).tobytes(),
                name,
            )
            self.assertEqual(
                tile.crop((0, 0, 64, 1)).tobytes(),
                tile.crop((0, 63, 64, 64)).tobytes(),
                name,
            )
        self.assertEqual(len(hashes), 3)


if __name__ == "__main__":
    unittest.main()
