"""Target only fullscreen layout, viewport resizing, input and split cameras."""
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
def layout(q):
    print('LAYOUT', q.evaluate('''()=>{const r=document.querySelector('#game-viewport canvas').getBoundingClientRect(),s=lumberPhaser.game.scale;return {window:[innerWidth,innerHeight],canvas:[r.x,r.y,r.width,r.height],size:[s.width,s.height],parent:[s.parentSize.width,s.parentSize.height]}}'''),flush=True)
    q.wait_for_function('''()=>{const r=document.querySelector('#game-viewport canvas').getBoundingClientRect();return Math.abs(r.width-innerWidth)<3&&Math.abs(r.height-innerHeight)<3}''')
    assert q.evaluate('document.documentElement.scrollWidth===innerWidth&&document.documentElement.scrollHeight===innerHeight')
    assert q.evaluate('lumberPhaser.game.scale.width<=1600&&lumberPhaser.game.scale.height<=1024')
    assert q.evaluate('''()=>{const h=lumberPhaser.scene.scene.get('Hud'),r=document.querySelector('footer').getBoundingClientRect(),c=lumberPhaser.game.canvas.getBoundingClientRect();return c.y+h.tutorial.y*c.height/h.scale.height<r.top}''')
try:
    with sync_playwright() as p:
        for mobile in [False,True]:
            browser=p.chromium.launch(headless=True,executable_path=which('chromium'),args=['--no-sandbox']+(['--disable-webgl'] if mobile else ['--use-angle=swiftshader','--enable-unsafe-swiftshader']))
            q=browser.new_page(viewport={'width':390 if mobile else 1280,'height':844 if mobile else 720},is_mobile=mobile,has_touch=mobile)
            errors=[];q.on('pageerror',lambda e:errors.append(str(e)))
            q.goto(f'http://127.0.0.1:{server.server_port}/'+('dist/' if mobile else ''))
            q.wait_for_selector('#heroDialog[open]')
            assert q.evaluate('!window.lumberPhaser&&!document.body.classList.contains("game-live")')
            if not mobile:q.locator('[name=players][value="2"]').check()
            choose_hero(q);q.wait_for_timeout(250);layout(q)
            q.evaluate('window.g=lumberPhaser;window.w=g.scene;window.c=g.core;w.manual=true')
            if mobile:
                assert not q.locator('#bagButton').is_visible()
                q.locator('#actionsToggle').tap();q.wait_for_timeout(150);layout(q)
                q.locator('#bagButton').tap();q.wait_for_selector('#activityDialog[open]');q.keyboard.press('q')
                q.locator('#actionsToggle').tap()
                q.set_viewport_size({'width':844,'height':390});q.wait_for_timeout(350);layout(q)
                q.locator('#menuButton').tap();q.wait_for_selector('#gameMenu[open]');q.locator('[data-menu-close]').tap()
                q.set_viewport_size({'width':375,'height':667});q.wait_for_timeout(350);layout(q)
            else:
                q.evaluate('''const [a,b]=c.actors;Object.assign(a.player,{x:1350,y:1600,path:[]});Object.assign(b.player,{x:2250,y:1600,path:[]});g.step(0)''')
                assert q.evaluate('w.coopCamera.split&&w.camera.worldView.contains(c.actors[0].player.x,c.actors[0].player.y)&&w.coopCamera.second.worldView.contains(c.actors[1].player.x,c.actors[1].player.y)')
                q.set_viewport_size({'width':1920,'height':1080});q.wait_for_timeout(350);q.evaluate('g.step(0)');layout(q)
                assert q.evaluate('w.camera.width+w.coopCamera.second.width===w.scale.width')
                q.evaluate('Object.assign(c.actors[1].player,{x:1550,y:1600});g.step(0)')
                assert q.evaluate('!w.coopCamera.split')
                # Resized pointer mapping without activating a world object.
                q.mouse.move(1050,650)
                assert q.evaluate('Math.abs(w.input.activePointer.x-1050*w.scale.width/innerWidth)<2&&Math.abs(w.input.activePointer.y-650*w.scale.height/innerHeight)<2')
                q.locator('[data-coop-player="1"] [data-coop-action="shop"]').click()
                q.wait_for_selector('[data-player-shop="1"]')
                assert q.evaluate('!c.paused&&c.actors[1].player.menuOpen&&!c.actors[0].player.menuOpen')
                q.keyboard.press('Backspace')
                q.keyboard.press('p');q.wait_for_selector('#gameMenu[open]');q.locator('[data-menu-close]').click()
            q.screenshot(path=f'/tmp/viewport-{"mobile" if mobile else "desktop"}.png')
            assert not errors,errors
            print('PASS viewport, layout, menu and input',mobile,flush=True)
            browser.close()
finally:server.shutdown()
