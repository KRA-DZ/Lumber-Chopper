"""Prepared PNG contracts: seamless tile edges, fixed frames and metadata."""

import json
from pathlib import Path
import unittest
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]


class Assets(unittest.TestCase):
    def test_tiles_match_opposite_edges(self):
        for file in (ROOT / "src/assets/biomes").glob("*.png"):
            im = Image.open(file).convert("RGB")
            self.assertEqual(im.size, (64, 64))
            self.assertEqual(
                im.crop((0, 0, 1, 64)).tobytes(), im.crop((63, 0, 64, 64)).tobytes()
            )
            self.assertEqual(
                im.crop((0, 0, 64, 1)).tobytes(), im.crop((0, 63, 64, 64)).tobytes()
            )

    def test_actors_have_matching_frames_and_transparency(self):
        for folder, size in [("enemies", (64, 64)), ("watcher", (112, 112))]:
            directory = ROOT / "src/assets" / folder
            manifest = json.loads((directory / "manifest.json").read_text())
            for name, meta in manifest["assets"].items():
                im = Image.open(directory / f"{name}.png")
                self.assertEqual(im.size, size)
                self.assertEqual((meta["width"], meta["height"]), size)
                self.assertEqual(im.mode, "RGBA")
                self.assertEqual(im.getpixel((0, 0))[3], 0)
                self.assertIsNotNone(im.getbbox())

    def test_props_metadata_matches_exports(self):
        directory = ROOT / "src/assets/biome-props"
        for name, meta in json.loads((directory / "manifest.json").read_text())[
            "assets"
        ].items():
            with Image.open(directory / f"{name}.png") as im:
                self.assertEqual(im.size, (meta["width"], meta["height"]))


if __name__ == "__main__":
    unittest.main()
