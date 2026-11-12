"""Only approved plants, native harvest input, private berries, food, regrowth and reset."""
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
        for mobile in ([True] if '--mobile-only' in __import__('sys').argv else [False,True]):
            browser=p.chromium.launch(headless=True,executable_path=which('chromium'),args=['--no-sandbox']+(['--disable-webgl'] if mobile else ['--use-angle=swiftshader','--enable-unsafe-swiftshader']))
            q=browser.new_page(viewport={'width':390 if mobile else 1360,'height':844 if mobile else 1050},is_mobile=mobile,has_touch=mobile);errors=[]
            q.on('pageerror',lambda e:errors.append(str(e)))
            q.goto(f'http://127.0.0.1:{server.server_port}/'+('dist/' if mobile else ''))
            q.wait_for_selector('#heroDialog[open]');q.locator(f'[name=players][value="{1 if mobile else 2}"]').check();choose_hero(q)
            q.evaluate('''window.g=lumberPhaser;window.w=g.scene;window.m=g.core;window.a=m.actors?.[1]||m;window.b=a.world.berryBushes.find(b=>!b.decorative);w.manual=true;
              Object.assign(a.player,a.nav.nearestGround(b.x,b.y+40),{path:[],autoTimer:10000});a.state.health=80;a.forestry.addCargo(7);a.forestry.addCargo(12);if(m.coop)w.coopViews.focus(1);g.step(0)''')
            assert q.evaluate('w.plantsView.objects.get(b.id).image.frame.name==="plants.ripe.0"&&w.registry.get("plantPack").manifest.approvedRow===2')
            if mobile:
                q.evaluate('Object.assign(a.player,a.nav.nearestGround(b.x,b.y+190),{path:[]});w.camera.stopFollow();w.camera.centerOn(b.x,b.y+30);w.camera.preRender();g.step(0)')
                q.wait_for_timeout(650)
                point=q.evaluate('(()=>{const c=w.camera;return{x:(b.x+10-c.worldView.x)*c.zoom,y:(b.y-25-c.worldView.y)*c.zoom,width:w.scale.width,height:w.scale.height}})()')
                box=q.locator('canvas').first.bounding_box();q.touchscreen.tap(box['x']+point['x']*box['width']/point['width'],box['y']+point['y']*box['height']/point['height']);q.evaluate('g.step(3)')
            else:q.keyboard.press('Enter');q.evaluate('g.step(0)')
            assert q.evaluate('a.state.exploration.items.berry===2&&a.state.wood===2&&a.state.cargoValue===19&&w.plantsView.objects.get(b.id).image.frame.name==="plants.empty.0"')
            if not mobile:assert q.evaluate('m.actors[0].state.exploration.items.berry===0&&!m.actors[0].berries.harvest(b.id)')
            q.keyboard.press('i' if mobile else 'l');q.wait_for_selector('#activityDialog[open]')
            assert '2/12' in q.locator('[data-bag-item=berry]').inner_text()
            q.locator('[data-use-item=berry]').click();assert q.evaluate('a.state.health===86&&a.state.exploration.items.berry===1&&a.state.wood===2')
            q.locator('[data-activity-close]').click();q.wait_for_function('!m.paused')
            q.evaluate('m.cycle.update(600-m.state.worldTime);g.step(0)');assert q.evaluate('w.plantsView.objects.get(b.id).image.frame.name==="plants.ripe.0"')
            q.evaluate('Object.assign(a.player,a.nav.nearestGround(b.x+90,b.y+100),{path:[]});g.step(0)')
            q.locator('#game-frame').screenshot(path=str(ROOT/f'docs/berries-{"mobile" if mobile else "coop"}.png'))
            q.evaluate('window.old=m;w.scene.restart();void 0');q.wait_for_function('lumberPhaser.core!==old&&lumberPhaser.scene.hudReady')
            assert q.evaluate('lumberPhaser.core.state.exploration.items.berry===0&&Object.keys(lumberPhaser.core.state.exploration.berryDays).length===0')
            assert not errors,errors
            print('PASS approved PNGs, harvest, private food, regrowth and reset',mobile,flush=True);browser.close()
finally:server.shutdown()
