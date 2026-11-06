"""Only free project choice, cold fire/direct E, fuel HUD, and W/S shopping with zero coins."""
from functools import partial
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from threading import Thread
from shutil import which
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
class Handler(SimpleHTTPRequestHandler):
    def log_message(self,*args): pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Handler,directory=str(ROOT)))
Thread(target=server.serve_forever,daemon=True).start()
def press(q,key): q.keyboard.press(key,delay=70)
try:
    with sync_playwright() as p:
        for coop in (True,False):
            browser=p.chromium.launch(headless=True,executable_path=which('chromium'),args=['--no-sandbox']+(['--use-angle=swiftshader','--enable-unsafe-swiftshader'] if coop else ['--disable-webgl']))
            q=browser.new_page(viewport={'width':1360 if coop else 390,'height':1100 if coop else 844},is_mobile=not coop,has_touch=not coop);errors=[]
            q.on('pageerror',lambda e: errors.append(str(e)))
            q.goto(f'http://127.0.0.1:{server.server_port}/'+('index.html' if coop else 'dist/'))
            q.wait_for_selector('#heroDialog[open]');q.locator(f'input[name=players][value="{2 if coop else 1}"]').check();q.locator('[data-hero-start]').click()
            q.wait_for_function('window.lumberPhaser?.scene.hudReady',timeout=60000)
            q.evaluate('window.g=lumberPhaser;window.w=g.scene;window.m=g.core;window.a=m.actors?.[0]||m;window.b=m.actors?.[1]||m;w.manual=true;g.step(0);void 0')
            assert q.evaluate('!w.fire.visible&&!w.enemyView.starterLight.visible&&m.state.campFuel===0&&!w.tent.visible&&!w.hut.visible')
            # W/S visibly selects unaffordable rows too; confirming one cannot debit money.
            q.evaluate('Object.assign(a.player,{x:1420,y:1670,path:[],autoTimer:10000});g.step(0)');press(q,'e')
            shop='[data-player-shop="0"]' if coop else '#shopDialog[open]';q.wait_for_selector(shop)
            press(q,'s')
            assert q.evaluate('document.querySelector("[data-player-shop=\'0\'] [data-personal-buy=axe]")?.dataset.selected==="true"' if coop else 'document.querySelector("[data-buy=axe]").closest(".shop-item").dataset.selected==="true"')
            press(q,'e');assert q.evaluate('a.state.coins===0&&a.state.axeLevel===0')
            press(q,'q');q.wait_for_function('!m.paused');q.evaluate('a.state.coins=1000');press(q,'e');q.wait_for_selector(shop);press(q,'s');press(q,'e')
            assert q.evaluate('a.state.axeLevel===1')
            if coop:
                q.keyboard.down('ArrowRight');q.evaluate('window.bx=b.player.x;g.step(.2)');q.keyboard.up('ArrowRight');assert q.evaluate('b.player.x>bx+20&&!m.paused')
            press(q,'q');q.wait_for_function('!m.paused')
            # Entering empty handed opens the choice, without constructing anything.
            q.evaluate('Object.assign(a.player,m.build,{path:[]});if(m.coop)w.coopViews.focus(0);g.step(.05)')
            q.wait_for_selector('#buildDialog[open]');assert q.evaluate('m.state.wood===0&&m.state.campLevel===0')
            first='fence' if coop else 'house';down=2 if coop else 3
            for _ in range(down): press(q,'s')
            assert q.locator(f'[data-build-project="{first}"]').evaluate('(b)=>b.closest(".build-option").dataset.selected==="true"')
            q.locator('#buildDialog').screenshot(path=str(ROOT/f'docs/build-choice-{"coop" if coop else "solo"}.png'))
            press(q,'Enter');q.wait_for_function('!m.paused')
            cost=35 if coop else 50
            q.evaluate(f'a.state.maxWood=60;for(let i=0;i<{cost+5};i++)a.forestry.addCargo(8);g.step(1)')
            assert q.evaluate(f'a.state.wood==={cost+5}&&m.state.buildWood===0&&m.state.campLevel===0')
            q.evaluate(f'Object.assign(a.player,{{x:m.build.x+140,y:m.build.y,path:[]}});g.step(.05);Object.assign(a.player,m.build,{{path:[]}});g.step({cost*.2+1})')
            q.wait_for_selector('#buildDialog[open]')
            assert q.evaluate(f'm.state.campBuildings.{first}===true&&m.state.campLevel===1&&a.state.wood===5&&!w.fire.visible&&m.state.campFuel===0')
            assert q.evaluate('w.core.defenses.all().filter(d=>d.kind==="gate").length===4' if coop else 'w.hut.visible')
            # The next picker is automatic. Fire may follow any first project.
            assert q.locator('[data-build-project="fire"]').count()==1
            press(q,'Enter');q.wait_for_function('!m.paused')
            q.evaluate('for(let i=0;i<5;i++)a.forestry.addCargo(8);g.step(.5)');assert q.evaluate('a.state.wood===10&&m.state.buildWood===0')
            q.evaluate('a.player.x=m.build.x+140;g.step(.05);a.player.x=m.build.x;g.step(3)')
            q.wait_for_selector('#buildDialog[open]');press(q,'q');q.wait_for_function('!m.paused');q.evaluate('g.step(0)')
            assert q.evaluate('w.fire.visible&&!w.fire.anims.isPlaying&&w.fire.frame.name==="unlitFire"&&m.state.campFuel===0&&m.state.campLevel===2')
            # Direct E adds exactly one log without a dialog at every period of the day.
            q.evaluate('Object.assign(a.player,{x:1600,y:1660,path:[]});for(let i=0;i<8;i++)a.forestry.addCargo(8)')
            for index,time in enumerate((20,150,400,500),1):
                q.evaluate(f'm.state.worldTime={time};g.step(0)');press(q,'e');q.evaluate('g.step(0)')
                assert q.evaluate(f'm.state.campFuel==={index*60}&&a.state.wood==={8-index}&&!m.paused&&w.fire.anims.isPlaying')
            assert q.evaluate('Math.abs(w.scene.get("Hud").dayHud.fuelRatio-.4)<1e-8')
            q.locator('#game-frame').screenshot(path=str(ROOT/f'docs/fuel-bar-{"coop" if coop else "solo"}.png'))
            q.evaluate('g.step(30)');assert q.evaluate('Math.abs(m.state.campFuel-210)<1e-7&&Math.abs(w.scene.get("Hud").dayHud.fuelRatio-.35)<1e-7')
            q.evaluate('m.state.campFuel=.01;g.step(.02)');assert q.evaluate('m.state.campFuel===0&&!w.fire.anims.isPlaying&&w.scene.get("Hud").dayHud.fuelRatio===0')
            press(q,'e');q.evaluate('g.step(0)');assert q.evaluate('m.state.campFuel===60&&w.fire.anims.isPlaying')
            if not coop:
                q.evaluate('Object.assign(a.player,{x:1680,y:1500,path:[]});g.step(0)');press(q,'Enter');q.evaluate('g.step(0)');assert q.evaluate('!!a.player.room&&w.houseView.entries[0].root.visible')
            q.evaluate('window.old=m;w.scene.restart();void 0');q.wait_for_function('lumberPhaser.core!==old&&lumberPhaser.scene.hudReady')
            assert q.evaluate('lumberPhaser.core.state.campLevel===0&&lumberPhaser.core.state.buildProject===null&&!lumberPhaser.scene.fire.visible')
            assert not errors,errors
            print('PASS project choice, cold fire, day/night E, fuel HUD and W/S', 'co-op WebGL' if coop else 'solo mobile Canvas/dist',flush=True)
            browser.close()
finally:
    server.shutdown()
