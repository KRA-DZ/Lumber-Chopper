"""Offline generated-people atlas and approved identity contracts."""

import hashlib
import json
from pathlib import Path
import unittest
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]


class PeopleAssets(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.directory = ROOT / "src/assets/people"
        cls.m = json.loads((cls.directory / "manifest.json").read_text())
        cls.im = Image.open(cls.directory / "people.png").convert("RGBA")

    def test_sources_match_and_atlas_is_bounded(self):
        self.assertEqual(self.im.size, tuple(self.m["size"]))
        self.assertLessEqual(self.im.width, 1024)
        self.assertLessEqual(self.im.height, 2048)
        for source in self.m["sources"]:
            raw = ROOT / "art/source" / source["file"]
            self.assertEqual(
                hashlib.sha256(raw.read_bytes()).hexdigest(), source["sha256"]
            )

    def test_every_named_frame_fits_and_has_same_foot_for_its_action(self):
        occupied = set()
        for key, f in self.m["frames"].items():
            x, y, w, h = f["x"], f["y"], f["width"], f["height"]
            self.assertTrue(
                0 <= x < x + w <= self.im.width and 0 <= y < y + h <= self.im.height,
                key,
            )
            ax, ay = f["anchor"]
            self.assertEqual(ax, w // 2)
            self.assertEqual(ay, h - 2 if h == 46 else 60)
            crop = self.im.crop((x, y, x + w, y + h))
            self.assertIsNotNone(crop.getbbox(), key)
            self.assertEqual(crop.getpixel((0, 0))[3], 0, key)
            cells = {(xx, yy) for xx in range(x, x + w) for yy in range(y, y + h)}
            self.assertFalse(occupied.intersection(cells), key)
            occupied.update(cells)

    def test_both_heroes_have_complete_walk_carry_and_six_axe_tiers(self):
        for role in ("hero2", "hero3"):
            for direction in ("down", "up", "side"):
                for action in ("walk", "carry"):
                    for i in range(4):
                        self.assertIn(
                            f"{role}-{action}-{direction}-{i}", self.m["frames"]
                        )
                for pose in range(3):
                    keys = [
                        f"{role}-strike-{direction}-{pose}-tier{tier}"
                        for tier in range(6)
                    ]
                    hashes = []
                    for key in keys:
                        f = self.m["frames"][key]
                        hashes.append(
                            hashlib.sha256(
                                self.im.crop(
                                    (
                                        f["x"],
                                        f["y"],
                                        f["x"] + f["width"],
                                        f["y"] + f["height"],
                                    )
                                ).tobytes()
                            ).hexdigest()
                        )
                    self.assertEqual(len(set(hashes)), 6)
        self.assertTrue(all(n > 0 for n in self.m["metalPixels"].values()))

    def test_only_the_approved_npc_designs_are_present_and_portraits_are_transparent(
        self,
    ):
        roles = {key.split("-")[0] for key in self.m["frames"]}
        self.assertEqual(
            roles,
            {
                "hero2",
                "hero3",
                "worker3",
                "worker4",
                "buyer1",
                "buyer2",
                "buyer3",
                "buyer4",
                "merchant",
            },
        )
        for hero in ("hero2", "hero3"):
            with Image.open(self.directory / f"{hero}-portrait.png") as im:
                self.assertEqual(im.mode, "RGBA")
                self.assertEqual(im.getpixel((0, 0))[3], 0)

    def test_side_walks_are_grounded_and_old_white_matte_is_not_hidden_in_alpha(self):
        self.assertEqual(self.m["version"], 2)
        for role in self.m["sideFrames"]:
            tops = []
            for i in range(4):
                f = self.m["frames"][f"{role}-walk-side-{i}"]
                crop = self.im.crop(
                    (f["x"], f["y"], f["x"] + f["width"], f["y"] + f["height"])
                )
                box = crop.getbbox()
                tops.append(box[1])
                self.assertEqual(box[3], 44)
            self.assertLessEqual(max(tops) - min(tops), 1, role)
        data = self.im.tobytes()
        for i in range(0, len(data), 4):
            self.assertIn(data[i + 3], (0, 255))
            if not data[i + 3]:
                self.assertEqual(data[i : i + 3], b"\0\0\0")
        f = self.m["frames"]["merchant-idle"]
        crop = self.im.crop((f["x"], f["y"], f["x"] + f["width"], f["y"] + f["height"]))
        self.assertGreater(
            sum(
                1
                for r, g, b, a in zip(*[iter(crop.tobytes())] * 4)
                if a and min(r, g, b) > 150
            ),
            60,
        )


if __name__ == "__main__":
    unittest.main()
