"""Target only new shop segments, personal panels and night-mask falloff."""
from functools import partial
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
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
        for mobile,coop in [(False,False),(False,True),(True,False)]:
            browser=p.chromium.launch(headless=True,executable_path=which('chromium'),args=['--no-sandbox']+(['--disable-webgl'] if mobile else ['--use-angle=swiftshader','--enable-unsafe-swiftshader']))
            q=browser.new_page(viewport={'width':390 if mobile else 1360,'height':844 if mobile else 1050},is_mobile=mobile,has_touch=mobile);errors=[]
            q.on('pageerror',lambda e:errors.append(str(e)))
            q.goto(f'http://127.0.0.1:{server.server_port}/'+('dist/' if mobile else ''))
            q.wait_for_selector('#heroDialog[open]');q.locator(f'input[name=players][value="{2 if coop else 1}"]').check();choose_hero(q)
            q.evaluate('window.g=lumberPhaser;window.m=g.core;window.w=g.scene;w.manual=true;for(const a of m.actors||[m])a.state.coins=1e7;w.shop.open();void 0')
            root=q.locator('[data-player-shop="0"]' if coop else '#shopDialog')
            assert root.locator('[role=progressbar]').count()==5
            assert root.locator('[role=progressbar][aria-label="Сила переноски"] i').count()==40
            assert root.locator('[role=progressbar][aria-label="Лесной фонарь"]').get_attribute('aria-valuenow')=='0'
            buy=root.locator('[data-personal-buy=lantern]' if coop else '[data-buy=lantern]')
            for level in range(1,5):
                buy.click()
                assert root.locator('[role=progressbar][aria-label="Лесной фонарь"]').get_attribute('aria-valuenow')==str(level)
                assert root.locator('[role=progressbar][aria-label="Лесной фонарь"] [data-filled=true]').count()==level
            if coop:
                assert q.evaluate('m.actors[1].state.lanternLevel===0&&!m.paused')
                q.evaluate('w.keyboardUi.openShop(1);void 0')
                assert q.locator('[data-player-shop="1"] [role=progressbar][aria-label="Лесной фонарь"]').get_attribute('aria-valuenow')=='0'
                q.evaluate('w.keyboardUi.closeShop(1);w.keyboardUi.closeShop(0)')
            else:
                assert buy.is_disabled()
                root.screenshot(path=str(ROOT/f'docs/shop-progress-{"mobile" if mobile else "desktop"}.png'))
                q.evaluate('document.querySelector("#shopDialog").close();void 0')
            assert q.evaluate('document.documentElement.scrollWidth<=innerWidth')
            q.evaluate('''for(const a of m.actors||[m])Object.assign(a.player,{x:2400,y:2350,direction:"right",path:[]});m.state.worldTime=500;m.state.campFuel=0;
                w.camera.centerOn(2400,2350);w.camera.preRender();g.step(0)''')
            # The precomputed stamp has a broad monotonic translucent rim, not a hard disc.
            assert q.evaluate('''(()=>{const ctx=w.atmosphere.playerStamp.getContext('2d');const a=[0,16,28,40,50,58,63].map(x=>ctx.getImageData(64+x,64,1,1).data[3]);return a[0]>245&&a[3]>40&&a[3]<160&&a[4]>0&&a[4]<70&&a[6]<5&&a.every((v,i)=>!i||v<=a[i-1])})()''')
            # At the same point 200 units from the hero, the upgraded lamp removes more darkness.
            if not coop:
                alphas=[]
                for level in [0,4]:
                    q.evaluate('level=>{m.state.lanternLevel=level;w.atmosphere.maskKey="";g.step(0)}',level)
                    alphas.append(q.evaluate('''(()=>{const a=w.atmosphere,v=w.camera.worldView;return a.mask.getContext().getImageData(Math.floor((m.player.x+200-v.x)/2),Math.floor((m.player.y-24-v.y)/2),1,1).data[3]})()'''))
                assert alphas[0]>180 and alphas[1]<alphas[0]-60,alphas
                q.locator('#game-frame').screenshot(path=str(ROOT/f'docs/lantern-soft-{"mobile" if mobile else "desktop"}.png'))
            assert not errors,errors
            print('PASS shop levels, private ownership and soft light',mobile,coop,flush=True)
            browser.close()
finally:server.shutdown()
