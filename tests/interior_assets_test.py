"""Only the new room/camp sprites: provenance, native alpha and bounded memory."""
import hashlib
import json
from pathlib import Path
import unittest
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
class InteriorAssets(unittest.TestCase):
    def test_complete_clean_native_alpha_pack(self):
        folder=ROOT/'src/assets/interiors'
        meta=json.loads((folder/'manifest.json').read_text())
        self.assertEqual(len(meta['frames']),9)
        self.assertEqual(hashlib.sha256((ROOT/'art/source'/meta['source']).read_bytes()).hexdigest(),meta['sha256'])
        total=0
        for name,f in meta['frames'].items():
            with Image.open(folder/f'{name}.png') as image:
                self.assertEqual(image.mode,'RGBA');self.assertEqual(image.size,(f['width'],f['height']))
                self.assertEqual(set(image.getchannel('A').getdata()),{0,255})
                self.assertTrue(all(a or (r,g,b)==(0,0,0) for r,g,b,a in image.getdata()))
                total+=image.width*image.height*4
        self.assertLess(total,900_000)
if __name__=='__main__':unittest.main()
