"""Only natural ground, visual trails, seams and the bounded terrain caches."""
from functools import partial
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from pathlib import Path
from threading import Thread
from shutil import which
from playwright.sync_api import sync_playwright
from helpers.browser_start import choose_hero
ROOT=Path(__file__).resolve().parents[1]
class Handler(SimpleHTTPRequestHandler):
    def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Handler,directory=str(ROOT)))
Thread(target=server.serve_forever,daemon=True).start()
try:
    with sync_playwright() as p:
        for mobile in [False,True]:
            browser=p.chromium.launch(headless=True,executable_path=which('chromium'),args=['--no-sandbox']+(['--disable-webgl'] if mobile else ['--use-angle=swiftshader','--enable-unsafe-swiftshader']))
            q=browser.new_page(viewport={'width':390 if mobile else 1360,'height':844 if mobile else 900},is_mobile=mobile,has_touch=mobile);errors=[]
            q.on('pageerror',lambda e:errors.append(str(e)))
            q.goto(f'http://127.0.0.1:{server.server_port}/'+('dist/' if mobile else ''));q.wait_for_selector('#heroDialog[open]')
            if not mobile:q.locator('[name=players][value="2"]').check()
            choose_hero(q)
            q.evaluate('''window.g=lumberPhaser;window.w=g.scene;window.c=g.core;w.manual=true;
              for(const id of ['1:0','0:1','-1:0']){const r=c.regions.all.find(r=>r.id===id);c.regions.unlocked.add(id);if(!c.state.unlockedRegions.includes(id))c.state.unlockedRegions.push(id);c.world.generate(r)}
              for(const [i,a] of (c.actors||[c]).entries()){a.refreshWorld();const p=c.world.forestLayouts.get(i?'0:1':'1:0').clearings[0];Object.assign(a.player,a.nav.nearestGround(p.x,p.y+60),{path:[],autoTimer:10000})}g.step(0);
            ''')
            result=q.evaluate('''async()=>{
              const {prepareGroundMaterials,sampleNaturalGround}=await import('./game/ground-surfaces.js');
              const {sampleMaterial}=await import('./game/biome-terrain.js');const {createForestGround}=await import('./phaser/art/ground-art.js');
              const raw=w.registry.get('biomePack').materials,prepared=prepareGroundMaterials(raw),far={x:-100000,y:-100000};
              const source=createForestGround({center:far,ancientTree:far,merchant:far,trails:[],materials:raw});
              for(const cx of [-2,-1,0,1,2])for(const px of [0,127]){
                const canvas=source.getChunk(cx,1),actual=[...canvas.getContext('2d').getImageData(px,32,1,1).data].slice(0,3);
                const expected=[...new Uint8ClampedArray(sampleNaturalGround(prepared,cx*128+px,160))];if(actual.join()!==expected.join())throw Error('Ground seam mismatch');
              }
              const pond=[{x:768,y:768},{x:1024,y:768},{x:1024,y:1024},{x:768,y:1024}];
              const water=createForestGround({center:far,ancientTree:far,merchant:far,trails:[],materials:raw,pondOutline:pond});
              const pixel=[...water.getChunk(3,3).getContext('2d').getImageData(32,32,1,1).data].slice(0,3);if(pixel.join()!==sampleMaterial(raw,'water',416,416).join())throw Error('Water changed');
              const floor=createForestGround({center:far,ancientTree:far,merchant:far,trails:[],materials:raw,fortressFloor:()=>[71,64,56]});
              if([...floor.getChunk(0,0).getContext('2d').getImageData(2,2,1,1).data].join()!=='71,64,56,255')throw Error('Floor changed');
              const energy=d=>{let sum=0;for(let y=0;y<64;y++)for(let x=1;x<64;x++)sum+=Math.abs(d[(y*64+x)*4]-d[(y*64+x-1)*4]);return sum};
              const ratio=energy(prepared.forest)/energy(raw.forest);if(ratio>.5)throw Error('Fine grass contrast remains high: '+ratio);
              const start=performance.now();for(let x=0;x<32;x++)source.getChunk(x,5);if(source.cachedChunks>source.maxChunks)throw Error('Cache overflow');
              return {contrastRatio:ratio,bake32ms:Math.round(performance.now()-start),scenic:[...w.terrain.scenicRoutes.values()].reduce((n,p)=>n+p.length,0)};
            }''')
            assert result['scenic']>=4,result
            q.evaluate('''for(const r of c.regions.all){c.regions.unlocked.add(r.id);if(!c.state.unlockedRegions.includes(r.id))c.state.unlockedRegions.push(r.id);c.world.generate(r)}for(const a of c.actors||[c])a.refreshWorld();for(const [i,a] of (c.actors||[c]).entries()){const paths=w.terrain.scenicRoutes.get(i?'0:1':'1:0');const path=paths.reduce((a,b)=>a.length>b.length?a:b);const point=path[Math.floor(path.length/2)];Object.assign(a.player,a.nav.nearestGround(point.x,point.y+45),{path:[]})}g.step(0)''')
            q.screenshot(path=f'/tmp/natural-ground-{mobile}.png')
            for i in range(12):
                q.evaluate('i=>{const a=c.actors?.[0]||c,p=a.nav.nearestGround(3250+(i%4)*230,600+Math.floor(i/4)*210);Object.assign(a.player,p,{path:[]});g.step(0)}',i)
            assert q.evaluate('w.terrain.images.size<=(c.coop?40:24)&&w.terrain.source.cachedChunks<=28')
            assert not errors,errors
            print('PASS natural ground, PNG contrast, negative/chunk seams, water/floor, trails and streaming',mobile,result,flush=True)
            browser.close()
finally:server.shutdown()
