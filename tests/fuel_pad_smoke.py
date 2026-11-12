"""Only automatic fuel-pad rendering, navigation, shared consumption and cold ignition."""
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
            q.evaluate('''window.g=lumberPhaser;window.w=g.scene;window.m=g.core;window.a=m.actors?.[0]||m;w.manual=true;g.step(0)''')
            assert q.evaluate('!w.campServicesView.fuelZone.visible&&!w.campServicesView.fuelZone.input.enabled&&m.state.campFuel===0')
            q.evaluate('''m.state.campBuildings={fire:true};m.state.campLevel=1;m.state.campFuel=0;a.refreshWorld();Object.assign(a.player,{x:1696,y:1736,path:[],autoTimer:10000});a.forestry.addCargo(7);a.forestry.addCargo(12);g.step(0)''')
            assert q.evaluate('w.campServicesView.fuelZone.visible&&w.campServicesView.fuelZone.input.enabled&&m.state.campFuel===0')
            q.wait_for_timeout(650)
            point=q.evaluate('(()=>{const v=w.camera.worldView;return{x:(1696-v.x)*w.camera.zoom,y:(1616-v.y)*w.camera.zoom,width:w.scale.width,height:w.scale.height}})()')
            box=q.locator('canvas').first.bounding_box();x=box['x']+point['x']*box['width']/point['width'];y=box['y']+point['y']*box['height']/point['height']
            if mobile:q.touchscreen.tap(x,y)
            else:q.mouse.click(x,y)
            assert q.evaluate('a.player.path.length>0')
            q.evaluate('g.step(2)')
            assert q.evaluate('a.camp.atFuelPad()&&a.state.wood===1&&m.state.campFuel>59&&m.state.campFuel<=60'),q.evaluate('({player:a.player,wood:a.state.wood,fuel:m.state.campFuel,pad:a.camp.atFuelPad()})')
            q.evaluate('w.pause("test",true);window.fuel=m.state.campFuel;g.step(5)')
            assert q.evaluate('m.state.campFuel===fuel&&a.state.wood===1')
            q.evaluate('w.pause("test",false);g.step(.9)')
            assert q.evaluate('a.state.wood===0&&m.state.campFuel>118&&m.state.campFuel<120')
            q.locator('#game-frame').screenshot(path=str(ROOT/f'docs/fuel-pad-{"mobile" if mobile else "coop"}.png'))
            q.evaluate('window.old=m;w.scene.restart();void 0');q.wait_for_function('lumberPhaser.core!==old&&lumberPhaser.scene.hudReady')
            assert q.evaluate('!lumberPhaser.scene.campServicesView.fuelZone.visible&&lumberPhaser.core.state.campFuel===0')
            assert not errors,errors
            print('PASS fuel pad navigation, ignition, pause and reset',mobile,flush=True);browser.close()
finally:server.shutdown()
