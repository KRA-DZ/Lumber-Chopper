"""Only optional discovery, dusk preparation, existing fuel/food and priority in the HUD."""
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
def click_guide(q,mobile):
    point=q.evaluate('''()=>{const h=w.scene.get('Hud'),r=w.game.canvas.getBoundingClientRect(),b=h.guideButton.getBounds();return {x:r.x+(b.x+b.width/2)*r.width/w.scale.width,y:r.y+(b.y+b.height/2)*r.height/w.scale.height}}''')
    if mobile:q.touchscreen.tap(point['x'],point['y'])
    else:q.mouse.click(point['x'],point['y'])
try:
    with sync_playwright() as p:
        for mobile in [False,True]:
            browser=p.chromium.launch(headless=True,executable_path=which('chromium'),args=['--no-sandbox']+(['--disable-webgl'] if mobile else ['--use-angle=swiftshader','--enable-unsafe-swiftshader']))
            q=browser.new_page(viewport={'width':390 if mobile else 1280,'height':844 if mobile else 900},is_mobile=mobile,has_touch=mobile);errors=[]
            q.on('pageerror',lambda e:errors.append(str(e)))
            q.goto(f'http://127.0.0.1:{server.server_port}/'+('dist/' if mobile else ''))
            q.wait_for_selector('#heroDialog[open]')
            if not mobile:q.locator('[name=players][value="2"]').check()
            choose_hero(q)
            q.evaluate('window.g=lumberPhaser;window.w=g.scene;window.m=g.core;window.a=m.actors?.[0]||m;w.manual=true;a.tutorial.cut=true;g.step(.01)')
            assert q.evaluate('w.scene.get("Hud").contextGuide.id==="explore-berry"')
            q.screenshot(path=str(ROOT/f'docs/context-explore-{ "mobile" if mobile else "desktop"}.png'))
            click_guide(q,mobile);q.evaluate('g.step(4)')
            assert q.evaluate('a.state.exploration.items.berry===2&&a.contextHints.explored&&a.state.coins===0')
            q.evaluate('m.state.worldTime=390;g.step(.01)')
            assert q.evaluate('w.scene.get("Hud").contextGuide.id==="prep-fire"&&!w.scene.get("Hud").dayHud.warning.visible')
            click_guide(q,mobile);assert q.evaluate('!m.state.buildProject')
            q.evaluate('a.player.path=[];m.state.campBuildings={fire:true};m.state.campFuel=20;a.forestry.addCargo(10);g.step(.01)')
            assert q.evaluate('w.scene.get("Hud").contextGuide.id==="prep-fuel"')
            q.screenshot(path=str(ROOT/f'docs/context-preparation-{ "mobile" if mobile else "desktop"}.png'))
            click_guide(q,mobile);q.evaluate('g.step(6)')
            assert q.evaluate('m.state.campFuel>20&&a.state.wood===0')
            q.evaluate('m.state.campFuel=550;a.state.health=40;g.step(.01)')
            assert q.evaluate('w.scene.get("Hud").contextGuide.id==="prep-heal"')
            click_guide(q,mobile);q.wait_for_selector('#activityDialog[open]');assert q.evaluate('a.state.health===40')
            q.locator('[data-use-item=berry]').click();assert q.evaluate('a.state.health===46')
            if not mobile:assert q.evaluate('m.actors[1].state.health===100&&m.actors[1].state.exploration.items.berry===0')
            q.locator('[data-activity-close]').click()
            q.evaluate('a.state.health=100;g.step(.01)')
            assert q.evaluate('!w.scene.get("Hud").contextGuide&&!w.scene.get("Hud").tutorial.visible&&!w.scene.get("Hud").guideButton.visible')
            q.evaluate('m.state.worldTime=450;g.step(.01)')
            assert q.evaluate('!w.scene.get("Hud").contextGuide&&w.scene.get("Hud").tutorial.visible')
            assert not errors,errors
            print('PASS discovery, real route/fuel/food, quiet readiness and night priority',mobile,flush=True)
            browser.close()
finally:server.shutdown()
