"""Only free decor, persistent local records, day banner, private spending and tempo."""
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
        for mobile,coop in ([(True,False)] if '--mobile-only' in __import__('sys').argv else [(False,False),(False,True),(True,False)]):
            browser=p.chromium.launch(headless=True,executable_path=which('chromium'),args=['--no-sandbox']+(['--disable-webgl'] if mobile else ['--use-angle=swiftshader','--enable-unsafe-swiftshader']))
            q=browser.new_page(viewport={'width':390 if mobile else 1360,'height':844 if mobile else 1050},is_mobile=mobile,has_touch=mobile);errors=[]
            q.on('pageerror',lambda e:errors.append(str(e)))
            q.goto(f'http://127.0.0.1:{server.server_port}/'+('dist/' if mobile else ''))
            q.wait_for_selector('#heroDialog[open]');q.locator('input[name=runName]').fill('Путник <1>');q.locator('[name=tempo]').select_option('quick');q.locator(f'[name=players][value="{2 if coop else 1}"]').check();choose_hero(q)
            q.evaluate('''window.g=lumberPhaser;window.w=g.scene;window.m=g.core;window.a=m.actors?.[0]||m;w.manual=true;
              for(const a of m.actors||[m])a.state.coins=200;
              window.spot=null;for(let x=1856;x<2400&&!spot;x+=32)for(let y=1952;y<2400&&!spot;y+=32){Object.assign(a.player,a.nav.nearestGround(x,y),{path:[]});if([-32,0,32].every(dx=>[-32,0,32].every(dy=>!a.custom.reason('flowers',{x:x+dx,y:y+dy}))))spot={x,y};}
              if(!spot)throw Error('No spot');g.step(0)''')
            assert q.evaluate('m.state.cycleSpeed===2.5&&m.state.campLevel===0')
            # Open through pause menu: works with mouse/touch and returns its pause reason.
            q.locator('#menuButton').click();q.locator('[data-custom-open]').click();q.wait_for_selector('#customDialog[open]')
            assert q.evaluate('m.paused&&m.state.coins===200')
            assert 'Семь целей' in q.locator('#customDialog').text_content()
            q.locator('#customDialog button',has_text='Разместить').first.click();q.wait_for_function('!m.paused')
            assert q.evaluate('m.state.campCustom.objects.length===0&&m.state.coins===200')
            # A real world click/tap uses camera conversion; invalid camp centre never pays.
            q.evaluate('w.customView.place({x:1600,y:1600});if(m.coop)Object.assign(m.actors[1].player,{x:a.player.x+34,y:a.player.y,path:[]});g.step(0);void 0')
            assert q.evaluate('m.state.coins===200')
            q.wait_for_timeout(250)
            point=q.evaluate('(()=>{const c=w.camera;return{x:c.x+(spot.x-c.worldView.x)*c.zoom,y:c.y+(spot.y-c.worldView.y)*c.zoom}})()')
            box=q.locator('#phaserGame canvas').bounding_box() if q.locator('#phaserGame canvas').count() else q.locator('canvas').first.bounding_box()
            size=q.evaluate('({width:w.scale.width,height:w.scale.height})')
            point['x']=box['x']+point['x']*box['width']/size['width'];point['y']=box['y']+point['y']*box['height']/size['height']
            if mobile:q.touchscreen.tap(point['x'],point['y'])
            else:q.mouse.click(point['x'],point['y'])
            q.evaluate('g.step(0)')
            assert q.evaluate('m.state.campCustom.objects.length===1&&a.state.coins===(m.coop?179:188)&&w.customView.images.size===1'),q.evaluate('({spot,coins:a.state.coins,d:m.state.campCustom,selection:w.customView.selection,notice:m.notice})')
            if coop:assert q.evaluate('m.actors[1].state.coins===200&&m.actors[1].state.campCustom===a.state.campCustom')
            # Free removal then replacement uses the owned stock, not a second purchase.
            q.keyboard.press('v');q.wait_for_selector('#customDialog[open]');q.locator('#customDialog button',has_text='Убрать в запас').click()
            assert q.evaluate('m.state.campCustom.stock.flowers===1&&m.state.campCustom.objects.length===0')
            q.locator('#customDialog button',has_text='Разместить').first.click();q.wait_for_function('!m.paused');q.evaluate('w.customView.place(spot);g.step(0)')
            assert q.evaluate('a.state.coins===(m.coop?179:188)&&m.state.campCustom.objects.length===1')
            # Actual calendar transition announces day two without pausing.
            q.evaluate('m.state.worldTime=599.99;g.step(.01)');q.wait_for_timeout(100)
            assert q.evaluate('m.state.nightsSurvived===1&&!m.paused')
            q.keyboard.press('v');q.wait_for_selector('#customDialog[open]')
            q.locator('[data-custom-tab=records]').click()
            assert 'Путник <1>' in q.locator('#customDialog table').inner_text()
            assert q.locator('#customDialog table b').count()==0
            assert q.evaluate('m.state.campCustom.unlocks.includes("first-night")')
            q.locator('#customDialog').screenshot(path=str(ROOT/f'docs/camp-custom-{"mobile" if mobile else "coop" if coop else "desktop"}.png'))
            q.locator('#customDialog button',has_text='Закрыть').click();q.wait_for_function('!m.paused')
            # Restart preserves only the record book/unlocks, not purchased objects or resources.
            q.evaluate('window.old=m;w.scene.restart();void 0');q.wait_for_function('lumberPhaser.core!==old&&lumberPhaser.scene.hudReady')
            assert q.evaluate('lumberPhaser.core.state.campCustom.objects.length===0&&lumberPhaser.core.state.nightsSurvived===0&&lumberPhaser.core.state.campCustom.unlocks.includes("first-night")')
            assert q.evaluate('document.querySelectorAll("#customDialog").length===1')
            assert not errors,errors
            print('PASS decor, coins, tempo, dawn, record and restart',mobile,coop,flush=True);browser.close()
finally:server.shutdown()
