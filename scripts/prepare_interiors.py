#!/usr/bin/env python3
"""Generated native-alpha sheet -> nine bounded sprites; no background colour keying."""
import hashlib
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
# Explicit source gutters: generated columns vary in width. Never infer white pixels as background.
PARTS = {
    'house': ((20, 14, 548, 364), (320, 224)),
    'shop': ((566, 14, 1096, 364), (320, 224)),
    'bed': ((1200, 12, 1430, 366), (48, 70)),
    'counter': ((26, 386, 535, 632), (100, 50)),
    'chest': ((640, 402, 953, 632), (48, 36)),
    'bench': ((1055, 392, 1506, 636), (90, 50)),
    'workshop': ((20, 650, 542, 1016), (150, 108)),
    'warehouse': ((560, 650, 1095, 1016), (124, 86)),
    'cupboard': ((1145, 642, 1485, 1016), (52, 60)),
}

def main():
    path = ROOT / 'art/source/camp-interiors-sheet.png'
    image = Image.open(path).convert('RGBA')
    if image.getchannel('A').getextrema()[0] != 0:
        raise ValueError('Source must have genuine transparent alpha')
    out = ROOT / 'src/assets/interiors'
    out.mkdir(parents=True, exist_ok=True)
    frames = {}
    for name, (box, size) in PARTS.items():
        raw = image.crop(box)
        raw.putalpha(raw.getchannel('A').point(lambda a: 255 if a >= 128 else 0))
        raw = raw.crop(raw.getchannel('A').getbbox())
        if name in ('house', 'shop'):
            # Compress only the rear wall: preserve a deep walkable floor for existing room coordinates.
            split = 132
            frame = Image.new('RGBA', size)
            frame.alpha_composite(raw.crop((0, 0, raw.width, split)).resize((320, 60), Image.Resampling.NEAREST))
            frame.alpha_composite(raw.crop((0, split, raw.width, raw.height)).resize((320, 164), Image.Resampling.NEAREST), (0, 60))
        else:
            frame = raw.resize(size, Image.Resampling.NEAREST)
        # Clear invisible RGB; binary edges cannot retain matte-colour fringes.
        clean = Image.new('RGBA', size)
        clean.paste(frame, (0, 0), frame.getchannel('A'))
        clean.save(out / f'{name}.png', optimize=True)
        frames[name] = {'width': size[0], 'height': size[1], 'anchor': [size[0]//2, size[1]-4]}
    (out / 'manifest.json').write_text(json.dumps({
        'version': 1, 'source': path.name, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest(),
        'frames': frames, 'processing': {'nativeAlpha': True, 'filter': 'nearest', 'alphaThreshold': 128},
    }, indent=2)+'\n')
    print(f'Prepared {len(frames)} interior and camp sprites')

if __name__ == '__main__':
    main()
