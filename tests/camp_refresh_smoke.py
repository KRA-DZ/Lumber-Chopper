"""Targeted co-op trade/build panels, compact HUD and inventory; no full playthrough."""
from functools import partial
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from pathlib import Path
import sys
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
        for mobile in ([True] if '--mobile-only' in sys.argv else [False,True]):
            browser=p.chromium.launch(headless=True,executable_path=which('chromium'),args=['--no-sandbox']+(['--disable-webgl'] if mobile else ['--use-angle=swiftshader','--enable-unsafe-swiftshader']))
            q=browser.new_page(viewport={'width':390 if mobile else 1360,'height':844 if mobile else 900},is_mobile=mobile,has_touch=mobile);errors=[];missing=[]
            q.on('pageerror',lambda e:errors.append(str(e)));q.on('response',lambda r:missing.append(r.url) if r.status>=400 else None)
            q.goto(f'http://127.0.0.1:{server.server_port}/'+('dist/' if mobile else ''));q.wait_for_selector('#heroDialog[open]')
            if not mobile:q.locator('[name=players][value="2"]').check()
            choose_hero(q)
            q.evaluate('''window.g=lumberPhaser;window.w=g.scene;window.c=g.core;w.manual=true;window.a=c.actors?.[0]||c;window.b=c.actors?.[1];
              Object.assign(a.player,{x:c.build.x,y:c.build.y,path:[]});if(b)Object.assign(b.player,{x:1600,y:1770,path:[]});g.step(.05);''')
            if not mobile:
                q.wait_for_selector('[data-player-build="0"]');assert q.evaluate('!c.paused&&a.player.menuOpen&&!b.player.menuOpen&&w.coopCamera.split')
                box=q.locator('[data-player-build="0"]').bounding_box();assert box['x']+box['width']<680
                q.screenshot(path='/tmp/camp-private-build.png')
                before=q.evaluate('b.player.x');q.keyboard.down('ArrowRight');q.evaluate('g.step(.2)');q.keyboard.up('ArrowRight');assert q.evaluate('b.player.x')>before
                q.keyboard.press('s');q.keyboard.press('e');assert q.evaluate('c.state.buildProject==="tent"&&!a.player.menuOpen&&!c.paused')
                q.evaluate('''c.state.buildProject=null;Object.assign(b.player,{x:c.build.x,y:c.build.y,path:[]});c.withActor(1,actor=>actor.builder.requestChoice(true));g.step(0);''')
                q.wait_for_selector('[data-player-build="1"]');box=q.locator('[data-player-build="1"]').bounding_box();assert box['x']>=680
                q.keyboard.press('ArrowDown');q.keyboard.press('Enter');assert q.evaluate('c.state.buildProject==="tent"&&!b.player.menuOpen')
                assert not q.locator('.personal-builder').count()
            else:
                q.wait_for_selector('#buildDialog[open]');q.locator('#buildDialog [data-build-project=fire]').click();assert q.evaluate('c.state.buildProject==="fire"');q.wait_for_function('!lumberPhaser.core.paused')
            # Real customers arrive at the fenced camp and buy; no synthetic waiting buyer.
            q.evaluate('''a.state.buildProject=null;a.state.campBuildings={fire:true,fence:true};a.state.campLevel=2;a.state.campFuel=600;
              for(const actor of c.actors||[c]){actor.refreshWorld();Object.assign(actor.player,{x:c.sale.x,y:c.sale.y,path:[]});actor.forestry.addCargo(10);actor.forestry.addCargo(10);}
              c.update(100);g.step(0);''')
            assert q.evaluate('(c.actors||[c]).every(a=>a.state.wood===0&&a.state.coins===(c.coop?40:20))'),q.evaluate('({paused:c.paused,reasons:[...w.pauseReasons],accounts:(c.actors||[c]).map(a=>[a.state.wood,a.state.coins]),buyers:c.buyers.map(b=>[b.phase,b.x,b.y,b.path.length]),project:c.state.buildProject})')
            assert q.evaluate('c.regions.unlocked.has("1:0")&&c.world.trees.some(t=>t.regionId==="1:0")')
            assert q.evaluate('!w.scene.get("Hud").tutorial.visible')
            assert q.locator('footer').bounding_box()['height']<(130 if not mobile else 110)
            q.screenshot(path=f'/tmp/camp-world-{mobile}.png')
            assert not q.locator('#workerButton').is_visible();q.locator('#actionsToggle').click();assert q.locator('#workerButton').is_visible();q.locator('#actionsToggle').click()
            q.evaluate('''const actor=b||a;actor.state.exploration.items.berry=2;actor.state.health=70;''')
            if not mobile:q.locator('[data-coop-player="1"] [data-coop-action=bag]').click()
            else:q.locator('#bagButton').click()
            q.wait_for_selector('#activityDialog[open]');assert q.locator('.inventory-grid:not(.shared-stock) .inventory-slot').count()==12
            q.locator('[data-bag-item=berry]').click();assert '6 HP' in q.locator('.inventory-detail').inner_text()
            q.screenshot(path=f'/tmp/camp-inventory-{mobile}.png')
            q.locator('[data-use-item=berry]').click();assert q.evaluate('(b||a).state.health===76&&(b?a.state.health===100:true)')
            q.locator('[data-activity-close]').click();q.wait_for_function('!lumberPhaser.core.paused')
            assert not errors,errors;assert not missing,missing
            print('PASS private construction/keys, live trade, free grove, compact HUD and PNG inventory',mobile,flush=True)
            browser.close()
finally:server.shutdown()
