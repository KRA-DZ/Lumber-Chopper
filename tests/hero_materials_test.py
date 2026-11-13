"""Check material coverage, source provenance and protected skin/NPC pixels."""
import hashlib,json
from pathlib import Path
from PIL import Image
root=Path(__file__).resolve().parents[1]/'src/assets/people'
manifest=json.loads((root/'manifest.json').read_text());meta=json.loads((root/'hero-materials.json').read_text())
assert meta['sourceSha256']==hashlib.sha256((root/'people.png').read_bytes()).hexdigest()
atlas=Image.open(root/'people.png');mask=Image.open(root/'hero-materials.png');assert mask.size==atlas.size and mask.mode=='L'
assert set(mask.getdata())=={0,85,170,255}
count=0
for key,f in manifest['frames'].items():
    box=(f['x'],f['y'],f['x']+f['width'],f['y']+f['height']);labels=mask.crop(box)
    if not key.startswith(('hero2-','hero3-')):
        assert labels.getbbox() is None,key
        continue
    count+=1;assert all(meta['counts'][key]),key
    for (r,g,b,a),label in zip(atlas.crop(box).getdata(),labels.getdata()):
        if label:assert a==255,key
        if r>=200 and g>=140 and b>=85 and r<g*1.7:assert label==0,(key,'bright skin/shirt')
assert count==162
print('PASS 162 hero masks, source hash, coverage, opaque labels, bright skin and unchanged NPCs')
