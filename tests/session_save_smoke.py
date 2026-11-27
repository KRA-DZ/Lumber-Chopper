"""Save/continue lifecycle only; source WebGL co-op and built mobile Canvas solo."""
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
KEY='lumber-session-v1'
try:
    with sync_playwright() as p:
        for mobile in ([True] if '--mobile-only' in sys.argv else [False,True]):
            browser=p.chromium.launch(headless=True,executable_path=which('chromium'),args=['--no-sandbox']+(['--disable-webgl'] if mobile else ['--use-angle=swiftshader','--enable-unsafe-swiftshader']))
            context=browser.new_context(viewport={'width':390 if mobile else 1360,'height':844 if mobile else 900},is_mobile=mobile,has_touch=mobile)
            q=context.new_page();errors=[];q.on('pageerror',lambda e:errors.append(str(e)))
            url=f'http://127.0.0.1:{server.server_port}/'+('dist/' if mobile else '')
            q.goto(url);q.wait_for_selector('#heroDialog[open]')
            assert not q.locator('[data-session-continue]').is_visible()
            if not mobile:q.locator('[name=players][value="2"]').check()
            q.locator('[name=tempo]').select_option('quick');choose_hero(q)
            q.evaluate('''window.g=lumberPhaser;window.w=g.scene;window.m=g.core;w.manual=true;
              const actors=m.actors||[m];for(const [i,a] of actors.entries()){a.state.coins=1000+i*100;a.purchaseUpgrade(i?'carry':'axe');a.forestry.addCargo(10+i);a.state.health=80+i*10;}
              const a=actors[0],r=m.regions.all.find(r=>r.id==='1:0');m.regions.unlocked.add(r.id);a.state.unlockedRegions.push(r.id);m.world.generate(r);for(const a of actors)a.refreshWorld();
              a.state.campBuildings={fire:true,tent:true};a.state.campLevel=2;a.state.campFuel=240;a.state.worldTime=201;
              const t=m.trees.find(t=>!t.workerOnly);t.hp=0;a.forestry.fell(t,0);for(const a of actors)a.refreshWorld();g.step(0);
              window.expected={coins:actors.map(a=>a.state.coins),runId:w.registry.get('runId'),tree:t.id};''')
            expected=q.evaluate('expected')
            q.locator('#menuButton').click();q.locator('[data-session-save]').click();assert 'Прогресс сохранён' in q.locator('[data-save-status]').inner_text()
            assert q.evaluate(f'JSON.parse(localStorage.getItem("{KEY}")).actors.length')==(1 if mobile else 2)
            q.reload();q.wait_for_selector('#heroDialog[open]');assert q.locator('[data-session-continue]').is_visible()
            assert 'день 1' in q.locator('[data-session-info]').inner_text()
            q.screenshot(path=f'/tmp/session-save-{mobile}.png')
            # No simulation starts behind the selection dialog; offline time is not applied.
            assert q.evaluate('!window.lumberPhaser')
            q.locator('[data-session-continue]').click();q.wait_for_function('window.lumberPhaser?.scene?.hudReady')
            actual=q.evaluate('''()=>{const g=lumberPhaser,w=g.scene,m=g.core;w.manual=true;return {coins:(m.actors||[m]).map(a=>a.state.coins),runId:w.registry.get('runId'),time:m.state.worldTime,fuel:m.state.campFuel,regions:[...m.regions.unlocked],levels:(m.actors||[m]).map(a=>[a.state.axeLevel,a.state.carryLevel])}}''')
            assert actual['coins']==expected['coins'];assert actual['runId']==expected['runId'];assert 201<=actual['time']<203;assert 238<actual['fuel']<=240
            assert actual['regions']==['0:0','1:0'];assert actual['levels'][0][0]==1
            assert q.evaluate('(lumberPhaser.core.actors?.[0]||lumberPhaser.core).state.wood===1')
            assert q.evaluate('(id)=>lumberPhaser.core.trees.find(t=>t.id===id).hp===0',expected['tree'])
            # Timed save, bounded by active play; no per-frame storage writes.
            q.evaluate('''window.w=lumberPhaser.scene;window.m=lumberPhaser.core;window.writes=0;window.original=Storage.prototype.setItem;
              Storage.prototype.setItem=function(k,v){if(k==='lumber-session-v1')writes++;return original.call(this,k,v)};
              for(let i=0;i<5;i++)w.persistence.update();''');assert q.evaluate('writes')==0
            q.evaluate('m.update(20.1);w.persistence.update();void 0');assert q.evaluate('writes')==1
            q.evaluate("window.dispatchEvent(new Event('pagehide'));void 0");assert q.evaluate('writes')==2
            q.evaluate('Storage.prototype.setItem=original;void 0')
            # A corrupt primary falls back to the preceding valid snapshot.
            q.evaluate(f"w.persistence.stopped=true;localStorage.setItem('{KEY}','broken')")
            q.reload();q.wait_for_selector('#heroDialog[open]');assert 'резервная' in q.locator('[data-session-info]').inner_text()
            q.locator('[data-session-continue]').click();q.wait_for_function('window.lumberPhaser?.scene?.hudReady');q.evaluate('lumberPhaser.scene.manual=true')
            # New-game cancellation preserves the slot; accepting starts character selection.
            q.locator('#menuButton').click();q.once('dialog',lambda d:d.dismiss());q.locator('[data-session-new]').click();assert q.locator('#gameMenu').is_visible()
            assert q.evaluate(f'!!localStorage.getItem("{KEY}")')
            q.once('dialog',lambda d:d.accept());q.locator('[data-session-new]').click();q.wait_for_selector('#heroDialog[open]')
            assert not q.locator('[data-session-continue]').is_visible();choose_hero(q)
            q.evaluate("lumberPhaser.scene.manual=true;lumberPhaser.core.defeat('save lifecycle test')")
            assert q.evaluate(f'localStorage.getItem("{KEY}")===null&&localStorage.getItem("{KEY}-backup")===null')
            if mobile:
                q.evaluate("""async()=>{const {createLocalCoop}=await import('./game/local-coop.js');const {captureSession,SAVE_KEY}=await import('./game/session-save.js');localStorage.setItem(SAVE_KEY,JSON.stringify(captureSession(createLocalCoop())))}""")
                q.reload();q.wait_for_selector('#heroDialog[open]');assert q.locator('[data-session-continue]').is_disabled();assert 'на компьютере' in q.locator('[data-session-info]').inner_text()
            assert not errors,errors
            print('PASS save/continue, personal progress, terrain, tempo, autosave, backup, new game and defeat',mobile,flush=True)
            # Disabled storage must not prevent a new unsaved solo game.
            blocked=context.new_page();blocked.on('pageerror',lambda e:errors.append(str(e)))
            blocked.add_init_script("Object.defineProperty(window,'localStorage',{get(){throw Error('blocked storage')}})")
            blocked.goto(url);choose_hero(blocked);blocked.locator('#menuButton').click();blocked.locator('[data-session-save]').click()
            assert 'Не удалось сохранить' in blocked.locator('[data-save-status]').inner_text();assert not errors,errors
            print('PASS unavailable storage stays playable',mobile,flush=True)
            browser.close()
finally:server.shutdown()
