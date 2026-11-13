"""Only grove layout, real movement/harvest, split cameras and local terrain invalidation."""
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
            q=browser.new_page(viewport={'width':390 if mobile else 1280,'height':844 if mobile else 800},is_mobile=mobile,has_touch=mobile);errors=[]
            q.on('pageerror',lambda e:errors.append(str(e)))
            q.goto(f'http://127.0.0.1:{server.server_port}/'+('dist/' if mobile else ''))
            q.wait_for_selector('#heroDialog[open]')
            if not mobile:q.locator('[name=players][value="2"]').check()
            choose_hero(q)
            q.evaluate('window.g=lumberPhaser;window.w=g.scene;window.m=g.core;window.a=m.actors?.[0]||m;w.manual=true;a.player.autoTimer=10000;m.state.worldTime=120;g.step(0)')
            assert q.evaluate('m.world.forestLayouts.size===1&&m.world.forestLayouts.get("0:0").unchanged===0')
            # Walk the real branch approach, then use the actual E interaction.
            q.evaluate('''window.b=m.world.berryBushes.find(b=>!b.decorative);window.branch=m.world.trails.find(p=>p.width===28&&Math.hypot(p.at(-1).x-b.x,p.at(-1).y-b.y)<1);
              if(!branch)throw Error('Missing starter berry branch');Object.assign(a.player,branch[0],{path:[]});if(m.coop){w.coopViews.focus(0);Object.assign(m.actors[1].player,branch[0],{path:[]});}a.setDestination(b.x,b.y);for(let i=0;i<240&&Math.hypot(a.player.x-b.x,a.player.y-b.y)>65;i++)g.step(.05);g.step(0)''')
            q.keyboard.press('e');q.evaluate('g.step(0)')
            assert q.evaluate('a.state.exploration.items.berry===2')
            # A future region may already have a cached edge: rebuild only that region on generation.
            assert q.evaluate('''()=>{const t=w.terrain,r=m.regions.all.find(r=>r.id==='1:0'),views=[{x:1536,y:1536,width:120,height:120},{x:3584,y:2048,width:120,height:120}];
              t.update(views);const home=t.images.get('terrain/6/6'),future=t.images.get('terrain/14/8');
              m.regions.unlocked.add(r.id);m.world.generate(r);a.refreshWorld();t.update(views);
              return t.images.get('terrain/6/6')===home&&t.images.get('terrain/14/8')!==future&&t.images.size<=40&&t.source.cachedChunks<=28}''')
            q.evaluate('''const p=m.world.forestLayouts.get('0:0').groves[0];Object.assign(a.player,a.nav.nearestGround(p.x+130,p.y+120),{path:[]});if(m.coop)Object.assign(m.actors[1].player,a.player,{path:[]});g.step(0)''')
            q.wait_for_timeout(2600);q.evaluate('g.step(0)')
            q.screenshot(path=str(ROOT/f'docs/forest-composition-{ "mobile" if mobile else "desktop"}.png'))
            if not mobile:
                q.evaluate('Object.assign(m.actors[1].player,{x:a.player.x+1000,y:a.player.y,path:[]});g.step(0)')
                assert q.evaluate('w.coopCamera.split&&w.terrain.images.size<=40')
            assert not errors,errors
            print('PASS forest composition, branch harvest, local cache refresh and cameras',mobile,flush=True)
            browser.close()
finally:server.shutdown()
