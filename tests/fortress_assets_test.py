"""Chosen fortress: provenance, clean silhouettes, fixed bases and periodic floors."""

from pathlib import Path
import hashlib
import json
import unittest
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]
FOLDER = ROOT / "src/assets/fortress"


class FortressAssets(unittest.TestCase):
    def setUp(self):
        self.meta = json.loads((FOLDER / "manifest.json").read_text())
        self.atlas = Image.open(FOLDER / "fortress.png").convert("RGBA")

    def crop(self, key):
        f = self.meta["frames"][key]
        return self.atlas.crop(
            (f["x"], f["y"], f["x"] + f["width"], f["y"] + f["height"])
        )

    def test_source_integrity_and_bounded_clean_frames(self):
        self.assertEqual(self.meta["approvedVariant"], 4)
        self.assertEqual(len(self.meta["frames"]), 32)
        self.assertEqual(self.atlas.size, (512, 256))
        for source in self.meta["sources"]:
            raw = ROOT / "art/source" / source["file"]
            self.assertEqual(
                hashlib.sha256(raw.read_bytes()).hexdigest(), source["sha256"]
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
            self.assertEqual(self.crop(key).getpixel((0, 0)), (0, 0, 0, 0), key)
        data = self.atlas.tobytes()
        for i in range(0, len(data), 4):
            self.assertIn(data[i + 3], (0, 255))
            if not data[i + 3]:
                self.assertEqual(data[i : i + 3], b"\0\0\0")

    def test_passage_and_chest_pairs_share_bases_and_really_change(self):
        for key in ["gate", "secret", "chest"]:
            a, b = [self.meta["frames"][f"{key}.{s}"] for s in ["closed", "open"]]
            self.assertEqual(
                (a["width"], a["height"], a["anchor"]),
                (b["width"], b["height"], b["anchor"]),
            )
            self.assertNotEqual(
                self.crop(key + ".closed").tobytes(), self.crop(key + ".open").tobytes()
            )
        token = Image.open(FOLDER / "token-icon.png").convert("RGBA")
        self.assertEqual(token.size, (32, 32))
        self.assertEqual(token.tobytes(), self.crop("token").tobytes())
        for name in ["secret.open", "gate.open"]:
            frame = self.crop(name)
            ax, ay = self.meta["frames"][name]["anchor"]
            self.assertIsNone(
                frame.crop((ax - 8, ay - 8, ax + 8, ay + 8)).getbbox(), name
            )

    def test_floor_tiles_are_opaque_distinct_and_periodic(self):
        image = Image.open(FOLDER / "floors.png").convert("RGBA")
        self.assertEqual(image.size, (192, 64))
        self.assertEqual(image.getchannel("A").getextrema(), (255, 255))
        hashes = set()
        for name, f in self.meta["floors"].items():
            tile = image.crop((f["x"], 0, f["x"] + 64, 64))
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

    def test_corner_derivation_preserves_upright_shape(self):
        sw = self.crop("corner.sw")
        se = self.crop("corner.se")
        self.assertEqual(
            ImageOps.mirror(sw.crop(sw.getbbox())).tobytes(),
            se.crop(se.getbbox()).tobytes(),
        )


if __name__ == "__main__":
    unittest.main()
