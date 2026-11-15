"""Master orders, joint shop/house rooms, private purchases and visible storage only."""
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
            q=browser.new_page(viewport={'width':390 if mobile else 1280,'height':844 if mobile else 900},is_mobile=mobile,has_touch=mobile)
            errors=[];q.on('pageerror',lambda e:errors.append(str(e)))
            q.goto(f'http://127.0.0.1:{server.server_port}/dist/');q.wait_for_selector('#heroDialog[open]')
            if not mobile:q.locator('[name=players][value="2"]').check()
            choose_hero(q)
            q.evaluate('''window.g=lumberPhaser;window.w=g.scene;window.c=g.core;window.a=c.actors?.[0]||c;window.b=c.actors?.[1];w.manual=true;
                a.state.maxWood=10;a.state.coins=1000;if(b)b.state.coins=777;
                Object.assign(a.player,{x:1780,y:1770,path:[]});w.serviceView.open('workshop');''')
            q.wait_for_selector('#campDesk[open]');assert q.locator('[data-camp-action="build:fire"]').count()==1
            q.locator('[data-camp-action="build:fire"]').click();assert q.evaluate('c.state.buildProject==="fire"&&c.state.workshopBuild')
            q.locator('[data-camp-close]').click();q.wait_for_function('!c.paused')
            q.evaluate('for(let i=0;i<10;i++)a.forestry.addCargo(8);g.step(3)')
            assert q.evaluate('c.state.campBuildings.fire&&a.state.wood===0')
            q.evaluate('''c.state.campBuildings={fire:true,fence:true,tent:true,house:true,workbench:true};c.state.campLevel=5;c.state.campFuel=200;
                for(const actor of c.actors||[c])actor.refreshWorld();Object.assign(a.player,{x:1350,y:1660,path:[]});
                if(b)Object.assign(b.player,{x:3000,y:1800,path:[]});''')
            q.keyboard.press('e');q.wait_for_function('(c.actors||[c]).every(x=>x.player.room?.id==="shop")&&w.houseView.entries[0].root.visible')
            if not mobile:assert q.evaluate('!w.coopCamera.split')
            q.evaluate('Object.assign(a.player.room,{x:320,y:225})')
            q.wait_for_timeout(220)
            q.screenshot(path=f'/tmp/camp-shop-interior-{mobile}.png')
            if mobile:
                q.evaluate('Object.assign(a.player.room,{x:320,y:310})')
                point=q.evaluate('''(()=>{const l=w.houseView.layout(w.camera),r=w.game.canvas.getBoundingClientRect();return {x:r.x+(l.x+320*l.scale)*r.width/w.scale.width,y:r.y+(l.y+150*l.scale)*r.height/w.scale.height}})()''')
                q.touchscreen.tap(point['x'],point['y']);q.evaluate('g.step(1)')
            else:q.keyboard.press('e')
            if mobile:
                q.wait_for_selector('#shopDialog[open]');q.locator('[data-buy="carry"]').click();q.keyboard.press('q')
            else:
                q.wait_for_selector('[data-player-shop="0"]');q.locator('[data-personal-buy="carry"]').click();q.keyboard.press('q')

            q.wait_for_function('!c.paused&&!a.player.menuOpen',timeout=2000)
            assert q.evaluate('a.state.carryLevel===1&&a.state.coins<1000')
            if not mobile:assert q.evaluate('b.state.coins===777&&b.state.carryLevel===0')
            q.evaluate('Object.assign(a.player.room,{x:320,y:402})');q.keyboard.press('e');q.wait_for_function('(c.actors||[c]).every(x=>!x.player.room)')
            q.evaluate('Object.assign(a.player,{x:1775,y:1435,path:[]});g.step(.7)');q.keyboard.press('e');q.wait_for_function('(c.actors||[c]).every(x=>x.player.room?.id==="house")')
            q.evaluate('Object.assign(a.player.room,{x:500,y:245})');q.keyboard.press('e');q.wait_for_selector('#workerDialog[open]')
            q.locator('[data-worker-action=hire]').click();assert q.evaluate('c.workers.crew.length===1')
            q.locator('[data-worker-close]').click();q.wait_for_function('!c.paused');q.wait_for_timeout(220);q.screenshot(path=f'/tmp/camp-house-interior-{mobile}.png')
            q.evaluate('Object.assign(a.player.room,{x:320,y:402})');q.keyboard.press('e');q.wait_for_function('!a.player.room')
            q.evaluate('Object.assign(a.player,{x:1780,y:1770,path:[]});w.serviceView.open("workshop")')
            q.wait_for_selector('#campDesk[open]');q.locator('[data-camp-action="defense:trap-left"]').click()
            q.locator('[data-camp-close]').click();q.wait_for_function('!c.paused')
            q.evaluate('a.forestry.addCargo(8);a.forestry.addCargo(8);g.step(1.2)')
            assert q.evaluate('c.defenses.get("trap-left").hp===1&&w.defenseView.objects.every(o=>!["trap","barricade"].includes(o.d.kind)||o.d.hp>0)')
            assert q.evaluate('w.serviceView.entries.every(e=>!e.pad&&!e.upgrade)')
            q.screenshot(path=f'/tmp/camp-hub-outside-{mobile}.png')
            assert not errors,errors
            print('PASS','mobile Canvas' if mobile else 'co-op WebGL')
            browser.close()
finally:server.shutdown()
