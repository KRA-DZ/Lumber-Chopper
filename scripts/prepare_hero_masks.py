"""Offline material labels for existing hero frames; originals and NPCs stay unchanged."""
from pathlib import Path
import hashlib,json,re
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]

def prepare_hero_masks(output=ROOT/'src/assets/people'):
    metadata=json.loads((output/'manifest.json').read_text());atlas=Image.open(output/'people.png').convert('RGBA')
    mask=Image.new('L',atlas.size);counts={};cache={}
    for key,f in metadata['frames'].items():
        if not key.startswith(('hero2-','hero3-')):continue
        base=re.sub(r'-tier\d+$','-tier0',key)
        if base not in cache:
            b=metadata['frames'][base];im=atlas.crop((b['x'],b['y'],b['x']+b['width'],b['y']+b['height']))
            labels=Image.new('L',im.size);p=im.load();q=labels.load();ax,ay=b['anchor'];role=key[:5]
            direction=next((d for d in ('down','up','side') if '-'+d+'-' in key),'down')
            def warm(r,g,b):return r>g*1.2 and r>b*1.7 and r>40 and g>20
            def skin(r,g,b):return r>145 and g>92 and b>48 and r<g*1.95
            head=next((y for y in range(max(0,ay-54),ay-22) if sum(p[x,y][3]>0 and warm(*p[x,y][:3]) and not skin(*p[x,y][:3]) for x in range(max(0,ax-12),min(im.width,ax+13)))>=3),max(0,ay-42))
            head_bottom=head+min(14,round((ay-head)*.34))
            for y in range(im.height):
                for x in range(im.width):
                    r,g,b,a=p[x,y];dx=x-ax
                    if not a or max(r,g,b)<35 or skin(r,g,b):continue
                    material=0
                    if head<=y<head_bottom and abs(dx)<15 and warm(r,g,b):material=1
                    elif role=='hero3' and head_bottom<=y<ay-16 and warm(r,g,b) and r>g*1.8 and b<g*.7 and ((direction=='up' and 3<dx<13) or (direction!='up' and -15<dx<-6)):material=1
                    elif head_bottom-2<=y<ay-(12 if role=='hero2' else 15) and abs(dx)<16:
                        pack=(direction=='up' and abs(dx)<9 and y>head_bottom+2) or (direction=='side' and dx<-6)
                        if not pack and ((role=='hero2' and g>r*1.15 and b>r*1.03 and g<150) or (role=='hero3' and warm(r,g,b))):material=2
                    if not material and ay-(14 if direction=='side' else 18)<=y<ay-7 and abs(dx)<15:
                        pack=(direction=='up' and abs(dx)<9 and y<ay-14) or (direction=='side' and dx<-6 and y<ay-13)
                        if not pack and ((role=='hero2' and r>g*1.12 and r>b*1.3) or (role=='hero3' and g*.85<r<g*1.55 and r>b*1.25 and g>b*1.2)):material=3
                    q[x,y]=material*85
            cache[base]=labels
        labels=cache[base];mask.paste(labels,(f['x'],f['y']))
        counts[key]=[labels.histogram()[n] for n in (85,170,255)]
    mask.save(output/'hero-materials.png',optimize=True)
    (output/'hero-materials.json').write_text(json.dumps({'version':1,'sourceSha256':hashlib.sha256((output/'people.png').read_bytes()).hexdigest(),'labels':['unchanged','hair','jacket','pants'],'size':list(mask.size),'counts':counts},indent=2)+'\n')
    print('Prepared material masks for',len(counts),'hero frames')

if __name__=='__main__':prepare_hero_masks()
