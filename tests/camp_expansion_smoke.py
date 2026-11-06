"""Only the new camp/progression UI: keyboards, private shop, fuel, store, house, mining and axe."""
from functools import partial
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from threading import Thread
from shutil import which
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
class Handler(SimpleHTTPRequestHandler):
    def log_message(self,*args): pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Handler,directory=str(ROOT)))
Thread(target=server.serve_forever,daemon=True).start()
try:
    with sync_playwright() as p:
        for coop in (True,False):
            browser=p.chromium.launch(headless=True,executable_path=which('chromium'),args=['--no-sandbox']+(['--use-angle=swiftshader','--enable-unsafe-swiftshader'] if coop else ['--disable-webgl']))
            q=browser.new_page(viewport={'width':1360 if coop else 390,'height':1100 if coop else 844},has_touch=not coop,is_mobile=not coop);errors=[]
            q.on('pageerror',lambda e:errors.append(str(e)))
            q.goto(f'http://127.0.0.1:{server.server_port}/'+('index.html' if coop else 'dist/'))
            q.wait_for_selector('#heroDialog[open]')
            q.locator(f'input[name=players][value="{2 if coop else 1}"]').check()
            q.locator('[data-hero-start]').click()
            q.wait_for_function('window.lumberPhaser?.scene.hudReady',timeout=60000)
            q.evaluate('window.g=lumberPhaser;window.w=g.scene;window.m=g.core;window.a=m.actors?.[0]||m;window.b=m.actors?.[1]||m;w.manual=true;g.step(0);void 0')
            q.evaluate('a.state.coins=500;b.state.coins=500;Object.assign(a.player,{x:1420,y:1670,path:[],autoTimer:10000});g.step(0)')
            q.keyboard.press('e',delay=70)
            if coop:
                q.wait_for_selector('[data-player-shop="0"]')
                assert q.evaluate('!m.paused&&a.player.menuOpen&&!b.player.menuOpen')
                q.keyboard.down('ArrowRight');q.evaluate('window.bx=b.player.x;g.step(.3)');q.keyboard.up('ArrowRight')
                assert q.evaluate('b.player.x>bx+40&&a.player.x===1420')
                q.keyboard.press('e',delay=70)
                assert q.evaluate('a.state.maxWood===4&&a.state.coins===465&&b.state.coins===500')
                q.evaluate('Object.assign(b.player,{x:1420,y:1670,path:[]});g.step(0)')
                q.keyboard.press('Enter',delay=70);q.wait_for_selector('[data-player-shop="1"]')
                q.keyboard.press('ArrowDown',delay=70);q.keyboard.press('Enter',delay=70)
                assert q.evaluate('b.state.axeLevel===1&&b.state.coins===368&&a.state.axeLevel===0&&!m.paused')
                q.locator('#game-frame').screenshot(path=str(ROOT/'docs/personal-shops.png'))
                q.keyboard.press('q',delay=70);q.keyboard.press('Backspace',delay=70)
                assert q.evaluate('!a.player.menuOpen&&!b.player.menuOpen')
            else:
                q.wait_for_selector('#shopDialog[open]');q.keyboard.press('Enter',delay=70)
                assert q.evaluate('a.state.maxWood===4&&a.state.coins===480')
                q.keyboard.press('q',delay=70);q.wait_for_function('!m.paused')
            # E and Enter both work in solo too, with keyboard-only confirmation/close.
            q.evaluate('Object.assign(a.player,{x:1290,y:1410,path:[]});if(m.coop)w.coopViews.focus(0);g.step(0)')
            q.keyboard.press('Enter' if not coop else 'e');q.wait_for_selector('#clueDialog[open]')
            assert q.evaluate('a.state.readClues.includes("note")')
            q.keyboard.press('Enter',delay=70);q.wait_for_function('!m.paused')
            # Actual interactive camp fire transaction, including a paused quote.
            q.evaluate('m.state.campLevel=1;m.state.campFuel=.01;g.step(.02);Object.assign(b.player,{x:1600,y:1660,path:[]});b.forestry.addCargo(10);g.step(0)')
            assert q.evaluate('m.state.campFuel===0&&!m.survival.isSafe(b.player)')
            q.keyboard.press('Enter',delay=70);q.wait_for_selector('#activityDialog[open]')
            q.keyboard.press('Enter',delay=70)
            assert q.evaluate('m.state.campFuel===60&&b.state.wood===0&&m.survival.isSafe(b.player)')
            q.keyboard.press('q',delay=70);q.wait_for_function('!m.paused')
            # Finite shared storage, no repeated credit on empty withdrawal.
            q.evaluate('if(m.coop)w.coopViews.focus(0);Object.assign(a.player,{x:1480,y:1740,path:[]});a.forestry.addCargo(8);a.forestry.addCargo(15);g.step(0)')
            q.keyboard.press('e',delay=70);assert q.evaluate('a.state.wood===0&&m.state.logStore.length===2')
            q.keyboard.press('e',delay=70);assert q.evaluate('a.state.wood===2&&a.state.cargoValue===23&&m.state.logStore.length===0'),q.evaluate('({wood:a.state.wood,value:a.state.cargoValue,store:m.state.logStore,actor:m.activeActor,paused:m.paused,menu:a.player.menuOpen})')
            # Mine a solid boulder beside an opened neighbouring region, then check its depleted state.
            q.evaluate('''()=>{const r=m.regions.all.find(r=>r.id==='1:0');m.regions.unlocked.add(r.id);m.world.generate(r);
              for(const c of m.actors||[m])c.refreshWorld();window.rock=m.world.boulders.find(r=>r.regionId==='1:0');
              Object.assign(b.player,b.nav.nearestGround(rock.x,rock.y+65),{path:[],autoTimer:0,clickTimer:0});
              b.state.axePower=20;g.step(.05)}''')
            assert q.evaluate('b.state.stone===8&&m.state.boulderHP[rock.id]===0')
            if coop:
                q.evaluate('''()=>{const r=m.regions.all.find(r=>r.id==='0:1');m.regions.unlocked.add(r.id);m.world.generate(r);
                  for(const c of m.actors)c.refreshWorld();const site=b.exploration.get('mysterious-merchant');
                  Object.assign(b.player,{x:site.x,y:site.y+30,path:[]});b.state.exploration.items.fish=2;b.state.coins=200;window.salesBefore=a.state.coins;g.step(0)}''')
                q.keyboard.press('Enter',delay=70);q.wait_for_selector('[data-player-shop="1"][data-merchant]')
                assert q.evaluate('!m.paused&&b.player.menuOpen')
                assert '105' in q.locator('[data-personal-buy="buy-key"]').inner_text()
                for _ in range(3): q.keyboard.press('ArrowDown',delay=70)
                q.keyboard.press('Enter',delay=70)
                assert q.evaluate('b.state.coins===224&&a.state.coins===salesBefore+24&&b.state.exploration.items.fish===0')
                q.keyboard.press('Backspace',delay=70)
            # Enter another location. The second player continues outdoors while the first walks indoors.
            q.evaluate('''m.state.campLevel=4;m.state.campFuel=600;for(const c of m.actors||[m])c.refreshWorld();
              Object.assign(a.player,{x:1680,y:1500,path:[],swing:0});if(m.coop)w.coopViews.focus(0);g.step(0)''')
            q.keyboard.press('e',delay=70);q.evaluate('g.step(0)')
            assert q.evaluate('!!a.player.room&&w.houseView.entries[0].root.visible&&!m.paused')
            if coop: assert q.evaluate('w.coopCamera.split&&!b.player.room')
            start=q.evaluate('a.player.room.x');q.keyboard.down('a');q.evaluate('g.step(.1)');q.keyboard.up('a')
            assert q.evaluate('a.player.room.x')<start
            # Native mouse/touch movement uses coordinates of this room, not the outdoor world.
            point=q.evaluate('''()=>{const c=w.camera,box=w.game.canvas.getBoundingClientRect(),scale=Math.min(c.width/480,c.height/352);
              return {x:box.x+((c.width-480*scale)/2+300*scale)/w.scale.width*box.width,
                y:box.y+((c.height-352*scale)/2+250*scale)/w.scale.height*box.height}}''')
            q.mouse.click(**point) if coop else q.touchscreen.tap(**point)
            q.evaluate('g.step(.3)');assert q.evaluate('a.player.room.x')>start
            q.locator('#game-frame').screenshot(path=str(ROOT/f'docs/camp-house-{"coop" if coop else "solo"}.png'))
            q.evaluate('Object.assign(a.player.room,{x:240,y:316});g.step(0)');q.keyboard.press('e',delay=70);q.evaluate('g.step(0)')
            assert q.evaluate('!a.player.room&&a.nav.isWalkable(a.player.x,a.player.y)&&w.campServicesView.store.visible')
            q.evaluate('a.player.swing=0;b.player.swing=0;g.step(0)')
            assert q.evaluate('(w.coopViews?.entries||[w]).every(e=>!e.axe.visible)')
            assert q.evaluate('m.defenses.all().filter(d=>d.kind==="gate").length===4')
            q.evaluate('window.old=m;w.scene.restart();void 0');q.wait_for_function('lumberPhaser.core!==old&&lumberPhaser.scene.hudReady')
            assert q.evaluate('lumberPhaser.core.state.campFuel===0&&lumberPhaser.core.state.logStore.length===0&&document.querySelectorAll(".personal-shop").length===0')
            assert not errors,errors
            print('PASS new camp loop', 'co-op WebGL' if coop else 'mobile solo Canvas/dist + touch',flush=True)
            browser.close()
finally:
    server.shutdown()
