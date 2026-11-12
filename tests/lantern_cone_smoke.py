"""Only directed light, residual darkness, independent co-op upgrades, turn cache and quality."""
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
            q=browser.new_page(viewport={'width':390 if mobile else 1360,'height':844 if mobile else 1050},is_mobile=mobile,has_touch=mobile);errors=[]
            q.on('pageerror',lambda e:errors.append(str(e)))
            q.goto(f'http://127.0.0.1:{server.server_port}/'+('dist/' if mobile else ''))
            q.wait_for_selector('#heroDialog[open]');q.locator(f'[name=players][value="{1 if mobile else 2}"]').check();choose_hero(q)
            q.evaluate('''window.g=lumberPhaser;window.w=g.scene;window.m=g.core;window.a=m.actors?.[0]||m;w.manual=true;
              (m.actors||[m]).forEach((a,i)=>Object.assign(a.player,{x:i?2750:2050,y:2300,direction:i?'left':'right',path:[]}));m.state.worldTime=500;m.state.campFuel=0;
              window.stamps=w.atmosphere.beamStamps;g.step(0);
              window.sample=(x,y)=>{const v=w.camera.worldView,f=w.atmosphere.quality==='light'?4:2;return w.atmosphere.mask.getContext().getImageData(Math.floor((x-v.x)/f),Math.floor((y-v.y)/f),1,1).data[3];};
              window.draw=()=>{w.camera.preRender();w.atmosphere.maskKey='';w.atmosphere.drawNightFor(w.camera,w.atmosphere,.95,m.elapsed);};''')
            q.wait_for_timeout(650);q.evaluate('draw()')
            assert q.evaluate('sample(2150,2276)<130&&sample(1950,2276)>235&&sample(1950,2276)<250&&sample(2050,2260)<100')
            # Turning at zero simulation time must invalidate the mask immediately.
            q.evaluate('a.player.direction="left";g.step(0);draw()')
            assert q.evaluate('sample(1950,2276)<130&&sample(2150,2276)>235')
            q.evaluate('a.player.direction="right";a.state.lanternLevel=4;g.step(0);draw()')
            assert q.evaluate('sample(2350,2376)<210&&w.atmosphere.beamStamps===stamps&&stamps.length===5')
            if not mobile:
                assert q.evaluate('m.actors[1].state.lanternLevel===0&&w.atmosphere.lights().filter(l=>l.shape==="cone").map(l=>l.r).join() === "432,240"')
                q.keyboard.down('w');q.evaluate('g.step(.1)');q.keyboard.up('w')
                assert q.evaluate('a.player.direction==="up"&&w.atmosphere.lights()[0].angle===-Math.PI/2')
                q.evaluate('a.player.direction="right";g.step(0)')
            q.locator('#game-frame').screenshot(path=str(ROOT/f'docs/lantern-cone-{"mobile" if mobile else "coop"}.png'))
            q.evaluate('w.atmosphere.setQuality("light");draw()')
            assert q.evaluate('w.atmosphere.beamStamps===stamps&&sample(a.player.x-120,a.player.y-24)>235')
            assert not errors,errors
            print('PASS cone/glow, turn, upgrades, ambient, co-op and quality',mobile,flush=True);browser.close()
finally:server.shutdown()
