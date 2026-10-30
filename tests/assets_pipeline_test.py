"""Run: python -m unittest discover -s tests -p assets_pipeline_test.py"""

import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location(
    "asset_prep", ROOT / "scripts/prepare_assets.py"
)
prep = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = prep
spec.loader.exec_module(prep)


class AssetPipelineTest(unittest.TestCase):
    def test_native_alpha_never_keys_out_white_bark_or_applies_legacy_repair(self):
        image = Image.new("RGBA", (40, 50), (255, 255, 255, 0))
        g = ImageDraw.Draw(image)
        g.rectangle((10, 5, 30, 45), fill=(255, 255, 255, 255))
        path = self.root / "transparent.png"
        image.save(path)
        prep.prepare(
            path,
            self.root / "native",
            names=("birch",),
            columns=1,
            background="all",
            defringe=2,
        )
        result = Image.open(self.root / "native/birch.png")
        self.assertEqual(result.getpixel((3, 3)), (255, 255, 255, 255))
        self.assertEqual(result.getpixel((0, 0)), (0, 0, 0, 0))
        meta = json.loads((self.root / "native/manifest.json").read_text())
        self.assertEqual(meta["processing"]["background"], "alpha")
        self.assertFalse(meta["processing"]["whiteMatteRepair"])

    def test_white_matte_recovery_preserves_pale_interiors(self):
        image = Image.new("RGBA", (21, 21))
        g = ImageDraw.Draw(image)
        g.rectangle((3, 3, 17, 17), fill=(200, 205, 195, 255))
        g.rectangle((4, 4, 16, 16), fill=(40, 55, 25, 255))
        g.rectangle((7, 7, 13, 13), fill=(245, 244, 230, 255))
        result = prep.unmatte_white(image)
        r, green, b, alpha = result.getpixel((3, 10))
        self.assertEqual((r, green, b), (40, 55, 25))
        self.assertGreater(alpha, 0)
        self.assertLess(alpha, 100)
        self.assertEqual(result.getpixel((10, 10)), (245, 244, 230, 255))
        for background in [(15, 35, 20), (0, 0, 0)]:
            composite = Image.new("RGBA", image.size, (*background, 255))
            composite.alpha_composite(result)
            self.assertLess(max(composite.getpixel((3, 10))[:3]), 65)

    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)

    def tearDown(self):
        self.temp.cleanup()

    def sheet(self):
        image = Image.new("RGB", (180, 140), "white")
        g = ImageDraw.Draw(image)
        for i in range(6):
            x = i % 3 * 60
            y = i // 3 * 70
            g.rectangle(
                (x + 15, y + 12, x + 42, y + 53),
                fill=(60 + i * 16, 90, 55),
                outline="black",
                width=2,
            )
        g.rectangle((79, 89, 95, 112), fill="white")  # enclosed white birch bark
        path = self.root / "sheet.png"
        image.save(path)
        return path

    def test_enclosed_birch_white_survives_but_exterior_white_is_transparent(self):
        files = prep.prepare(self.sheet(), self.root / "assets")
        self.assertEqual(len(files), 7)
        metadata = json.loads((self.root / "assets/manifest.json").read_text())
        birch = Image.open(self.root / "assets/birch.png").convert("RGBA")
        box = metadata["assets"]["birch"]["sourceBox"]
        self.assertEqual(
            birch.getpixel((85 - box[0] + 2, 100 - box[1] + 2)), (255, 255, 255, 255)
        )
        self.assertEqual(birch.getpixel((0, 0)), (0, 0, 0, 0))
        self.assertLess(birch.width, 60)

    def test_grid_groups_whole_cross_row_contours_and_detached_pegs(self):
        path = self.sheet()
        image = Image.open(path)
        g = ImageDraw.Draw(image)
        g.rectangle((15, 82, 42, 123), fill="white")
        g.rectangle(
            (15, 65, 42, 123), fill="darkgreen"
        )  # treetop crosses the nominal row at 70
        g.rectangle((6, 43, 8, 45), fill="brown")  # separate peg, same tent cell
        image.save(path)
        prep.prepare(path, self.root / "assets")
        m = json.loads((self.root / "assets/manifest.json").read_text())
        self.assertEqual(m["assets"]["spruce"]["sourceBox"][1], 65)
        self.assertEqual(m["assets"]["tent"]["sourceBox"][0], 6)

    def test_components_mode_rejects_wrong_count_without_partial_outputs(self):
        path = self.sheet()
        image = Image.open(path)
        ImageDraw.Draw(image).rectangle((130, 75, 170, 130), fill="white")
        image.save(path)
        with self.assertRaisesRegex(ValueError, "Expected 6 contours"):
            prep.prepare(path, self.root / "assets", layout="components")
        self.assertFalse((self.root / "assets").exists())

    def test_repeatable_outputs(self):
        path = self.sheet()
        out = self.root / "assets"
        files = prep.prepare(path, out)
        old = {p.name: p.read_bytes() for p in files}
        prep.prepare(path, out)
        self.assertEqual(old, {p.name: p.read_bytes() for p in files})

    def command(self, *args, cwd=None):
        return subprocess.run(
            args, cwd=cwd, check=True, capture_output=True, text=True
        ).stdout.strip()

    def test_publish_pushes_only_assets_and_preserves_unrelated_index(self):
        remote = self.root / "remote.git"
        repo = self.root / "repo"
        self.command("git", "init", "--bare", str(remote))
        self.command("git", "init", "-b", "main", str(repo))
        self.command("git", "config", "user.name", "Asset pipeline test", cwd=repo)
        self.command(
            "git", "config", "user.email", "asset-test@example.invalid", cwd=repo
        )
        (repo / "readme.txt").write_text("base")
        self.command("git", "add", "readme.txt", cwd=repo)
        self.command("git", "commit", "-m", "base", cwd=repo)
        self.command("git", "remote", "add", "origin", str(remote), cwd=repo)
        self.command("git", "push", "-u", "origin", "main", cwd=repo)
        (repo / "unrelated.txt").write_text("keep staged")
        self.command("git", "add", "unrelated.txt", cwd=repo)
        files = prep.prepare(self.sheet(), repo / "src/assets")
        commit = prep.publish(repo, files, push=True)
        self.assertEqual(
            commit, self.command("git", "rev-parse", "refs/heads/main", cwd=remote)
        )
        paths = self.command(
            "git", "diff-tree", "--no-commit-id", "--name-only", "-r", "HEAD", cwd=repo
        ).splitlines()
        self.assertEqual(set(paths), {p.relative_to(repo).as_posix() for p in files})
        self.assertEqual(
            self.command("git", "diff", "--cached", "--name-only", cwd=repo),
            "unrelated.txt",
        )
        self.assertIsNone(prep.publish(repo, files, push=True))
        (repo / "local.txt").write_text("not ready to publish")
        self.command("git", "add", "local.txt", cwd=repo)
        self.command(
            "git", "commit", "--only", "-m", "local change", "--", "local.txt", cwd=repo
        )
        (files[0]).write_bytes(files[0].read_bytes() + b"\n")
        with self.assertRaisesRegex(ValueError, "differs from upstream"):
            prep.publish(repo, files, push=True)


if __name__ == "__main__":
    unittest.main()
