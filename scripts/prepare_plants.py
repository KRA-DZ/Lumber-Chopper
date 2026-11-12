"""Approved row-two plant style: trim native alpha, align states and pack small PNGs."""
from pathlib import Path
import json
import sys
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]
source=ROOT/'art/source/plants-approved-row2.png'
if len(sys.argv)>1:
    source.parent.mkdir(parents=True,exist_ok=True)
    source.write_bytes(Path(sys.argv[1]).read_bytes())
im=Image.open(source).convert('RGBA')
names=[*[f'empty.{i}' for i in range(3)],'berry',*[f'ripe.{i}' for i in range(3)],'reeds',*[f'flower.{i}' for i in range(3)],'fern',*[f'mushroom.{i}' for i in range(3)],'shrub']
raw={}
for index,key in enumerate(names):
    col,row=index%4,index//4
    cell=im.crop(tuple(round(v) for v in (col*im.width/4,row*im.height/4,(col+1)*im.width/4,(row+1)*im.height/4)))
    cell.putalpha(cell.getchannel('A').point(lambda a:255 if a>=176 else 0))
    if key=='mushroom.2':
        # Remove anomalous saturated-red fringe from the pale caps, not their ivory highlights.
        pixels=cell.load()
        for y in range(cell.height):
            for x in range(cell.width):
                r,g,b,a=pixels[x,y]
                if r>170 and g<80 and b<90:pixels[x,y]=(r,g,b,0)
    bbox=cell.getbbox()
    if not bbox:raise ValueError(key+' is empty')
    raw[key]=cell.crop(bbox)
output=ROOT/'src/assets/plants';output.mkdir(parents=True,exist_ok=True)
atlas=Image.new('RGBA',(256,256));frames={}
for index,key in enumerate(names):
    peers=[raw[f'{state}.{key[-1]}'] for state in ('empty','ripe','flower')] if key.split('.')[0] in ('empty','ripe','flower') else [raw[key]]
    maxw,maxh=(54,49) if len(peers)==3 else (30,20) if key.startswith('mushroom') else (28,28) if key=='berry' else (38,40)
    scale=min(maxw/max(p.width for p in peers),maxh/max(p.height for p in peers))
    p=raw[key].resize((max(1,round(raw[key].width*scale)),max(1,round(raw[key].height*scale))),Image.Resampling.NEAREST)
    frame=Image.new('RGBA',(64,64));frame.alpha_composite(p,(32-p.width//2,60-p.height))
    frame.save(output/(key+'.png'),optimize=True)
    if key=='berry':
        icon=Image.new('RGBA',(32,32));icon.alpha_composite(p,((32-p.width)//2,(32-p.height)//2));icon.save(output/'berry-icon.png',optimize=True)
    x,y=index%4*64,index//4*64;atlas.alpha_composite(frame,(x,y))
    frames[key]={'x':x,'y':y,'width':64,'height':64,'anchor':[32,60]}
atlas.save(output/'plants.png',optimize=True)
(output/'manifest.json').write_text(json.dumps({'version':1,'approvedRow':2,'size':[256,256],'frames':frames},ensure_ascii=False,indent=2)+'\n')
print('Prepared 16 aligned native-alpha plant frames and 256² atlas')
