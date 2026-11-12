"""Replace only nine bush-state frames, retaining the other approved plant images."""
from pathlib import Path
import hashlib
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]


def apply_bushes(atlas, frames, output):
    source=ROOT/'art/source/bushes-style4-sheet.png'
    with Image.open(source) as original:
        if original.mode!='RGBA' or original.getchannel('A').getextrema()[0]!=0:
            raise ValueError('Bushes require native transparent alpha')
        sheet=original.copy()
    raw={}
    for row,state in enumerate(('empty','ripe','flower')):
        for col in range(3):
            cell=sheet.crop(tuple(round(v) for v in (col*sheet.width/3,row*sheet.height/3,(col+1)*sheet.width/3,(row+1)*sheet.height/3)))
            cell.putalpha(cell.getchannel('A').point(lambda a:255 if a>=176 else 0))
            box=cell.getbbox()
            if not box: raise ValueError(f'Missing {state}.{col}')
            raw[f'{state}.{col}']=cell.crop(box)
    for col in range(3):
        peers=[raw[f'{state}.{col}'] for state in ('empty','ripe','flower')]
        scale=min(54/max(p.width for p in peers),49/max(p.height for p in peers))
        for state in ('empty','ripe','flower'):
            key=f'{state}.{col}';im=raw[key]
            im=im.resize((max(1,round(im.width*scale)),max(1,round(im.height*scale))),Image.Resampling.NEAREST)
            frame=Image.new('RGBA',(64,64));frame.alpha_composite(im,(32-im.width//2,60-im.height))
            frame.save(output/f'{key}.png',optimize=True)
            f=frames[key];atlas.paste(frame,(f['x'],f['y']))
    return {'file':source.name,'sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'nativeAlpha':True,'grid':[3,3],'alphaThreshold':176}
