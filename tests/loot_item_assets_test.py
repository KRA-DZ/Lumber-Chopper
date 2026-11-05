"""Approved sprite provenance, alpha edges and bounded pack reproducibility."""
from pathlib import Path
import hashlib
import json
import subprocess
import sys
import unittest
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
PACK = ROOT / "src/assets/loot-items"
NAMES = {"coins", "resin", "key", "salve", "relic", "rod", "bobber"}


def pixels(image):
    return image.get_flattened_data() if hasattr(image, "get_flattened_data") else image.getdata()


class LootItems(unittest.TestCase):
    def setUp(self):
        self.manifest = json.loads((PACK / "manifest.json").read_text())

    def test_approved_source_and_frame_bounds(self):
        m = self.manifest
        self.assertEqual(m["approvedVariant"], 3)
        self.assertEqual(set(m["frames"]), NAMES)
        self.assertEqual(m["size"], [128, 128])
        source = ROOT / "art/source" / m["sources"][0]["file"]
        self.assertEqual(hashlib.sha256(source.read_bytes()).hexdigest(), m["sources"][0]["sha256"])
        for f in m["frames"].values():
            self.assertLessEqual(f["x"] + f["width"], 128)
            self.assertLessEqual(f["y"] + f["height"], 128)
            self.assertTrue(0 <= f["anchor"][0] < f["width"])
            self.assertTrue(0 <= f["anchor"][1] < f["height"])

    def test_binary_native_alpha_has_no_hidden_white_matte(self):
        for path in [PACK / "items.png", *sorted((PACK / "icons").glob("*.png"))]:
            with Image.open(path) as im:
                self.assertEqual(im.mode, "RGBA")
                self.assertEqual(set(im.getchannel("A").tobytes()), {0, 255})
                self.assertTrue(all((r, g, b) == (0, 0, 0) for r, g, b, a in pixels(im) if not a))
                if path.parent.name == "icons": self.assertEqual(im.size, (32, 32))
        with Image.open(PACK / "icons/bobber.png") as im:
            self.assertTrue(any(a == 255 and min(r, g, b) > 190 for r, g, b, a in pixels(im)))
        self.assertFalse(self.manifest["processing"]["whiteColorRemoval"])

    def test_rod_hand_and_line_tip_are_distinct_inside_the_frame(self):
        f = self.manifest["frames"]["rod"]
        tip, hand = f["tip"], f["anchor"]
        self.assertTrue(0 <= tip[0] < f["width"] and 0 <= tip[1] < f["height"])
        self.assertLess(tip[0], hand[0])
        self.assertLess(tip[1], hand[1] - 30)

    def test_preparation_is_byte_reproducible(self):
        before = {p.relative_to(PACK): hashlib.sha256(p.read_bytes()).hexdigest() for p in PACK.rglob("*") if p.is_file()}
        subprocess.run([sys.executable, str(ROOT / "scripts/prepare_loot_items.py")], cwd=ROOT, check=True, capture_output=True)
        after = {p.relative_to(PACK): hashlib.sha256(p.read_bytes()).hexdigest() for p in PACK.rglob("*") if p.is_file()}
        self.assertEqual(before, after)


if __name__ == "__main__": unittest.main()
