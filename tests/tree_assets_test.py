"""Approved native-alpha tree pack: provenance, growth states and atlas bounds."""

from pathlib import Path
import hashlib
import json
import unittest
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]


class Trees(unittest.TestCase):
    def test_provenance_and_native_transparency(self):
        manifest = json.loads((ROOT / "src/assets/trees/manifest.json").read_text())
        self.assertEqual(manifest["approvedVariant"], 1)
        self.assertFalse(manifest["processing"]["backgroundRemoval"])
        for source in manifest["sources"]:
            path = ROOT / "art/source" / source["file"]
            self.assertEqual(
                hashlib.sha256(path.read_bytes()).hexdigest(), source["sha256"]
            )
            with Image.open(path) as image:
                self.assertEqual(image.mode, "RGBA")
                self.assertEqual(image.getchannel("A").getextrema()[0], 0)
                self.assertEqual(image.size, tuple(source["size"]))

    def test_complete_growth_set_and_clean_bounded_frames(self):
        directory = ROOT / "src/assets/trees"
        manifest = json.loads((directory / "manifest.json").read_text())
        image = Image.open(directory / "trees.png").convert("RGBA")
        self.assertLessEqual(max(image.size), 1024)
        expected = {
            f"{kind}.{stage}"
            for kind in ("oak", "spruce", "birch", "dead")
            for stage in ("mature", "stump", "sprout", "young")
        } | {"ancient"}
        self.assertEqual(set(manifest["frames"]), expected)
        boxes = []
        for key, frame in manifest["frames"].items():
            x, y, w, h = (frame[n] for n in ("x", "y", "width", "height"))
            self.assertLessEqual(x + w, image.width)
            self.assertLessEqual(y + h, image.height)
            ax, ay = frame["anchor"]
            self.assertTrue(0 < ax < w and 0 < ay < h)
            tile = image.crop((x, y, x + w, y + h))
            self.assertEqual(tile.getchannel("A").crop((0, 0, w, 2)).getbbox(), None)
            self.assertEqual(
                tile.getchannel("A").crop((0, h - 2, w, h)).getbbox(), None
            )
            self.assertEqual(set(tile.getchannel("A").tobytes()), {0, 255})
            box = (x, y, x + w, y + h)
            for old in boxes:
                self.assertFalse(
                    min(box[2], old[2]) > max(box[0], old[0])
                    and min(box[3], old[3]) > max(box[1], old[1])
                )
            boxes.append(box)
        self.assertTrue(
            all(a or (r, g, b) == (0, 0, 0) for r, g, b, a in image.getdata())
        )
        for kind in ("oak", "spruce", "birch", "dead"):
            heights = [
                manifest["frames"][f"{kind}.{stage}"]["height"]
                for stage in ("sprout", "young", "mature")
            ]
            self.assertEqual(heights, sorted(set(heights)))
        f = manifest["frames"]["birch.mature"]
        birch = image.crop((f["x"], f["y"], f["x"] + f["width"], f["y"] + f["height"]))
        self.assertGreater(
            sum(1 for r, g, b, a in birch.getdata() if a == 255 and min(r, g, b) > 190),
            50,
        )


if __name__ == "__main__":
    unittest.main()
