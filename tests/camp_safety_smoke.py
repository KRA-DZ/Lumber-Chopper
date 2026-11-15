"""Only new unloading pad and permanent sawmill refuge, desktop co-op and mobile Canvas."""
from functools import partial
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from threading import Thread
from shutil import which
from playwright.sync_api import sync_playwright
from helpers.browser_start import choose_hero
ROOT=Path(__file__).resolve().parents[1]
class Handler(SimpleHTTPRequestHandler):
    def log_message(self,*args): pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Handler,directory=str(ROOT)))
Thread(target=server.serve_forever,daemon=True).start()
try:
    with sync_playwright() as p:
        for mobile in [False,True]:
            browser=p.chromium.launch(executable_path=which('chromium'),headless=True,args=['--no-sandbox']+(['--disable-webgl'] if mobile else ['--use-angle=swiftshader','--enable-unsafe-swiftshader']))
            q=browser.new_page(viewport={'width':390 if mobile else 1280,'height':844 if mobile else 900},is_mobile=mobile,has_touch=mobile)
            errors=[];q.on('pageerror',lambda e:errors.append(str(e)))
            q.goto(f'http://127.0.0.1:{server.server_port}/dist/');q.wait_for_selector('#heroDialog[open]')
            if not mobile:q.locator('[name=players][value="2"]').check()
            choose_hero(q)
            q.evaluate('''window.g=lumberPhaser;window.w=g.scene;window.c=g.core;w.manual=true;
                for(const a of c.actors||[c]){a.state.stone=3;a.state.boardCargo=2;Object.assign(a.player,{x:1400,y:1910,path:[]});}
                g.step(1.2);''')
            assert q.evaluate('(c.actors||[c]).every(a=>a.state.stone===0&&a.state.boardCargo===0)')
            assert q.evaluate('c.state.campIndustry.materials.stone===(c.coop?6:3)&&c.state.campIndustry.materials.boards===(c.coop?4:2)')
            assert q.evaluate('w.campServicesView.storageZone.visible&&w.campServicesView.storagePad.visible')
            q.screenshot(path=f'/tmp/camp-unloading-{mobile}.png')
            q.evaluate('''const r=c.regions.all.find(r=>r.id==='1:1');c.regions.unlocked.add(r.id);c.state.unlockedRegions.push(r.id);c.world.generate(r);
                for(const a of c.actors||[c]){a.refreshWorld();Object.assign(a.player,{x:r.cx,y:r.cy+400,path:[]});}
                c.state.worldTime=500;g.step(.05);''')
            q.wait_for_function('w.sawmillProductionView.refuge.visible')
            assert q.evaluate('c.survival.isSafe(c.player)&&c.outposts.lights().some(l=>l.kind==="sawmill-refuge")&&c.state.campFuel===0')
            q.screenshot(path=f'/tmp/sawmill-refuge-{mobile}.png')
            assert not errors,errors
            print('PASS', 'mobile Canvas' if mobile else 'desktop co-op WebGL')
            browser.close()
finally:server.shutdown()
