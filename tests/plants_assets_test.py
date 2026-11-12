"""Only approved plant pack: native alpha, clean frame borders and stable base anchors."""
import json
import hashlib
from pathlib import Path
from PIL import Image
root=Path(__file__).resolve().parents[1]/'src/assets/plants'
m=json.loads((root/'manifest.json').read_text());assert m['approvedRow']==2 and len(m['frames'])==16
assert m['bushVariant']==4 and m['bushSource']['nativeAlpha']
source=root.parents[2]/'art/source'/m['bushSource']['file']
assert hashlib.sha256(source.read_bytes()).hexdigest()==m['bushSource']['sha256']
atlas=Image.open(root/'plants.png');assert atlas.size==(256,256) and atlas.mode=='RGBA'
for key,f in m['frames'].items():
    im=Image.open(root/(key+'.png'));assert im.mode=='RGBA' and im.size==(64,64) and f['anchor']==[32,60]
    alpha=im.getchannel('A');assert set(alpha.getdata())=={0,255};bbox=alpha.getbbox()
    assert bbox[0]>=2 and bbox[1]>=2 and bbox[2]<=62 and bbox[3]<=60
    assert atlas.crop((f['x'],f['y'],f['x']+64,f['y']+64)).tobytes()==im.tobytes()
for v in range(3):
    # Relative colour distinguishes muted red berries from the cool foliage.
    def red(state):return sum(1 for r,g,b,a in Image.open(root/f'{state}.{v}.png').getdata() if a and r>100 and r>g*1.35 and r>b*1.35)
    assert red('ripe')>red('empty')+5
icon=Image.open(root/'berry-icon.png');assert icon.size==(32,32) and icon.getchannel('A').getextrema()==(0,255)
print('PASS 16 approved PNGs: binary transparency, atlas, anchors, berry states and icon')
