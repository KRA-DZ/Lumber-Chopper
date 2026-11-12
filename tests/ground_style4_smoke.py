"""Only terrain PNG loading, padded path edges, chunk reuse and day/night appearance."""
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
            q=browser.new_page(viewport={'width':390 if mobile else 1280,'height':844 if mobile else 720},is_mobile=mobile,has_touch=mobile);errors=[]
            q.on('pageerror',lambda e:errors.append(str(e)))
            q.goto(f'http://127.0.0.1:{server.server_port}/'+('dist/' if mobile else ''))
            q.wait_for_selector('#heroDialog[open]')
            if not mobile:q.locator('[name=players][value="2"]').check()
            choose_hero(q)
            q.evaluate('window.g=lumberPhaser;window.w=g.scene;window.m=g.core;w.manual=true;g.step(6);m.state.worldTime=120;g.step(0)')
            assert q.evaluate('''()=>{const mats=w.registry.get('biomePack').materials;return Object.keys(mats).length===8&&Object.values(mats).every(a=>a.length===64*64*4&&a.every((v,i)=>i%4!==3||v===255))}''')
            # A straight path crossing x=0: its padded fringe must match either chunk.
            assert q.evaluate('''async()=>{const {createForestGround}=await import('./phaser/art/ground-art.js');
              const src=createForestGround({center:{x:99999,y:99999},ancientTree:{x:99999,y:99999},merchant:{x:99999,y:99999},trails:[[{x:-512,y:64},{x:512,y:64}]],materials:w.registry.get('biomePack').materials});
              const a=src.getChunk(-1,0),b=src.getChunk(0,0),px=(c,x,y)=>[...c.getContext('2d').getImageData(x,y,1,1).data];
              for(const y of [16,18,21,30,46,49]) {const left=px(a,127,y),right=px(b,0,y);if(left.some((v,i)=>Math.abs(v-right[i])>45))return false;}
              return src.cachedChunks===2&&a===src.getChunk(-1,0)}''')
            q.screenshot(path=str(ROOT/f'docs/ground-style4-{ "mobile" if mobile else "desktop"}.png'))
            if not mobile:
                q.evaluate('Object.assign(m.actors[1].player,{x:m.actors[0].player.x+1000,y:m.actors[0].player.y,path:[]});g.step(0)')
                assert q.evaluate('w.coopCamera.split&&w.terrain.images.size<=40')
            q.evaluate('m.state.worldTime=450;g.step(0)')
            q.wait_for_timeout(150)
            q.screenshot(path=f'/tmp/ground-style4-night-{mobile}.png')
            # Existing streaming bounds, including return trips, without new per-frame textures.
            assert q.evaluate('''()=>{const t=w.terrain,a={x:1000,y:1320,width:960,height:688};for(let i=0;i<8;i++)t.update({...a,x:a.x+i*256});t.update(a);const key=[...t.images.keys()][0],image=t.images.get(key);t.update(a);return t.images.size<=24&&t.source.cachedChunks<=28&&t.images.get(key)===image}''')
            assert not errors,errors
            print('PASS style4 PNGs, path seam, day/night, split and bounded cache',mobile,flush=True)
            browser.close()
finally:server.shutdown()
