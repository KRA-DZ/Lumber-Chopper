"""Focused camp caption budget/layout and platform feedback, desktop co-op and mobile Canvas."""
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
            browser=p.chromium.launch(executable_path=which('chromium'),headless=True,args=['--no-sandbox']+(['--disable-webgl'] if mobile else ['--use-angle=swiftshader','--enable-unsafe-swiftshader']))
            q=browser.new_page(viewport={'width':390 if mobile else 1100,'height':844 if mobile else 800},is_mobile=mobile,has_touch=mobile)
            errors=[];q.on('pageerror',lambda e:errors.append(str(e)))
            q.goto(f'http://127.0.0.1:{server.server_port}/dist/');q.wait_for_selector('#heroDialog[open]')
            if not mobile:q.locator('[name=players][value="2"]').check()
            choose_hero(q)
            q.evaluate('''window.g=lumberPhaser;window.w=g.scene;window.c=g.core;window.h=w.scene.get('Hud');w.manual=true;
                c.state.campBuildings={fire:true,fence:true,tent:true,house:true,workbench:true};c.state.campLevel=5;c.state.campFuel=300;
                for(const a of c.actors||[c])a.refreshWorld();
                const a=c.actors?.[0]||c;Object.assign(a.player,{x:1696,y:1616,path:[]});
                if(c.coop)Object.assign(c.actors[1].player,{x:1420,y:1690,path:[]});g.step(.01);''')
            q.wait_for_function('h.interactionHints.panels.some(p=>p.root.visible)')
            assert q.evaluate('w.worldHints.candidates.every(e=>!e.label.visible)&&w.atmosphere.prompts.every(p=>!p.visible)')
            assert q.evaluate('w.worldHints.active.length<=(c.coop?2:1)')
            assert q.evaluate('w.children.list.filter(o=>o.type==="Text"&&o.visible).every(o=>o.style.color!=="#304c35"&&o.text!=="ЛЕСНАЯ ЛАВКА")')
            assert q.evaluate('h.interactionHints.panels.filter(p=>p.root.visible).every(p=>p.root.depth<0&&p.text.style.color==="#ffffff")')
            q.screenshot(path=f'/tmp/camp-readable-shared-{mobile}.png')
            q.evaluate('''const actors=c.actors||[c];Object.assign(actors[0].player,{x:1775,y:1460,path:[]});
                if(c.coop)Object.assign(actors[1].player,{x:1400,y:1910,path:[]});g.step(.01);''')
            q.wait_for_function('w.worldHints.active[0]?.entry.point.x===1775')
            if not mobile:
                q.wait_for_function('w.coopCamera.split&&h.interactionHints.panels.every(p=>p.root.visible)&&h.interactionHints.panels[0].text.text.includes("Дом")&&h.interactionHints.panels[1].text.text.toLowerCase().includes("склад")')
                assert q.evaluate('h.interactionHints.panels[0].text.text.includes("Дом")&&h.interactionHints.panels[1].text.text.toLowerCase().includes("склад")')
                assert q.evaluate('h.interactionHints.panels[0].bounds.x+h.interactionHints.panels[0].bounds.width<=w.camera.width&&h.interactionHints.panels[1].bounds.x>=w.coopCamera.second.x')
            q.wait_for_function('w.serviceView.entries.find(e=>e.id==="house").glow>.9')
            q.screenshot(path=f'/tmp/camp-readable-station-{mobile}.png')
            assert q.evaluate('h.interactionHints.panels.filter(p=>p.root.visible).every(p=>p.bounds.y+p.bounds.height<h.scale.height-80)')
            # Night overlay cannot darken the HUD hint; menus suppress the caption panels.
            q.evaluate('c.state.worldTime=500;g.step(.01)')
            q.wait_for_function('h.interactionHints.panels[0].root.visible')
            q.evaluate('w.pause("ui-test",true)')
            q.wait_for_function('h.interactionHints.panels.every(p=>!p.root.visible)')
            assert not errors,errors
            print('PASS','mobile Canvas' if mobile else 'co-op WebGL')
            browser.close()
finally:server.shutdown()
