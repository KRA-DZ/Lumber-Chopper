"""Only dam/bridge/boardwalk/gate gameplay, dynamic terrain and shared safety."""
from functools import partial
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from threading import Thread
from shutil import which
from sys import argv
from playwright.sync_api import sync_playwright
from helpers.browser_start import choose_hero

ROOT=Path(__file__).resolve().parents[1]
class Handler(SimpleHTTPRequestHandler):
    def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Handler,directory=str(ROOT)))
Thread(target=server.serve_forever,daemon=True).start()
def press(q,key):q.keyboard.press(key,delay=60)
def close(q):press(q,'q');q.wait_for_function('!m.paused')
def act(q,id):return q.locator(f'[data-activity-action="{id}"]')
def visit(q,id):
    q.evaluate('id=>{const p=b.exploration.get(id);Object.assign(b.player,{x:p.x,y:p.y,path:[],autoTimer:10000});if(m.coop)w.coopViews.focus(1);g.step(0)}',id)
    press(q,'Enter');q.wait_for_selector('#activityDialog[open]')
def build(q,id):
    visit(q,id)
    q.evaluate('id=>{const p=b.worldWorks.sites.find(p=>p.id===id);b.state.maxWood=82;while(b.state.wood<p.cost.logs)b.forestry.addCargo(11)}',id)
    act(q,'works:contribute').click();assert q.evaluate('id=>m.state.worldWorks.built[id]===true',id)
    close(q)
try:
    with sync_playwright() as p:
        for mobile in ((True,) if '--mobile-only' in argv else (False,True)):
            browser=p.chromium.launch(headless=True,executable_path=which('chromium'),args=['--no-sandbox']+(['--disable-webgl'] if mobile else ['--use-angle=swiftshader','--enable-unsafe-swiftshader']))
            q=browser.new_page(viewport={'width':390 if mobile else 1360,'height':844 if mobile else 1100},is_mobile=mobile,has_touch=mobile);errors=[]
            q.on('pageerror',lambda e:errors.append(str(e)))
            q.goto(f'http://127.0.0.1:{server.server_port}/'+('dist/' if mobile else 'index.html'))
            q.wait_for_selector('#heroDialog[open]');q.locator(f'input[name=players][value="{1 if mobile else 2}"]').check();choose_hero(q)
            q.evaluate('''window.g=lumberPhaser;window.w=g.scene;window.m=g.core;window.a=m.actors?.[0]||m;window.b=m.actors?.[1]||m;w.manual=true;
              for(const id of ['-1:0','0:-1']){const r=m.regions.all.find(r=>r.id===id);m.regions.unlocked.add(id);m.state.unlockedRegions.push(id);m.world.generate(r);}
              for(const c of m.actors||[m]){c.refreshWorld();c.player.autoTimer=10000;c.state.health=c.state.maxHealth=1000000;}
              g.step(3.1);for(const e of [...m.survival.residents]){e.warning=0;m.survival.hit(e.id,10000,false);}
              m.state.campIndustry.materials.boards=m.state.campIndustry.materials.blocks=100;g.step(0)''')
            # Native inspection and partial personal log payments, with common processed materials.
            visit(q,'old-dam');assert act(q,'works:low').is_disabled()
            for i in range(4):
                if i:close(q)
                q.evaluate('b.forestry.addCargo(9);b.forestry.addCargo(15)')
                if i:visit(q,'old-dam')
                press(q,'Enter')
                assert q.evaluate('(n)=>m.state.worldWorks.paid["old-dam"].logs===n',(i+1)*2)
            assert q.evaluate('m.state.worldWorks.built["old-dam"]&&m.state.worldWorks.level==="high"&&b.state.wood===0&&m.state.campIndustry.materials.boards===96&&m.state.campIndustry.materials.blocks===96')
            q.evaluate('''window.wetChunk=w.terrain.source.getChunk(-3,3);window.wetPixel=Array.from(wetChunk.getContext('2d').getImageData(4,114,1,1).data);
              window.oldWaterImages=[...w.terrain.images.entries()].filter(([key])=>key.includes('terrain/-')).map(([key,image])=>({key,image}));''')
            if mobile:act(q,'works:low').tap()
            else:act(q,'works:low').click()
            assert q.evaluate('''m.state.worldWorks.level==='low'&&m.nav.isWalkable(-400,1280)&&m.nav.isWalkable(-760,996)&&
              w.terrain.source.getChunk(-3,3)!==wetChunk&&JSON.stringify(Array.from(w.terrain.source.getChunk(-3,3).getContext('2d').getImageData(4,114,1,1).data))!==JSON.stringify(wetPixel)&&
              oldWaterImages.some(({key,image})=>w.terrain.images.get(key)!==image)''')
            close(q)
            q.locator('#game-frame').screenshot(path=str(ROOT/f'docs/world-works-drained-{"mobile" if mobile else "coop"}.png'))
            # Occupied channels cannot be flooded, including the partner in a split view.
            if not mobile:
                q.evaluate('Object.assign(a.player,{x:-400,y:1280,path:[]});g.step(0)');visit(q,'old-dam');assert act(q,'works:high').is_disabled()
                assert 'затопления' in q.locator('[data-activity-content]').inner_text();close(q)
                q.evaluate('Object.assign(a.player,{x:1600,y:1720,path:[]});g.step(0)')
            # The bridge gives a genuinely walkable shortcut at high water.
            build(q,'river-bridge');visit(q,'old-dam');act(q,'works:high').click();close(q)
            q.evaluate('Object.assign(b.player,{x:-128,y:760,path:[],autoTimer:10000});b.setDestination(-528,760);g.step(2.5)')
            assert q.evaluate('b.player.x < -500&&m.nav.clearSegment({x:-128,y:760},{x:-528,y:760})&&[...w.worldWorksView.objects.keys()].some(id=>id.startsWith("deck:river-bridge"))')
            visit(q,'old-dam');act(q,'works:low').click();close(q);build(q,'sluice-gate')
            assert q.evaluate('m.nav.clearSegment({x:-508,y:996},{x:-760,y:996})')
            q.evaluate('b.state.exploration.items.key=1;window.coinsBefore=b.state.coins');visit(q,'chest:-1:0:2');act(q,'open-chest').click()
            assert act(q,'open-chest').is_disabled();assert q.evaluate('b.state.coins===coinsBefore+75&&b.state.exploration.items.relic===1');close(q)
            visit(q,'waterworks-archive');assert 'Старый брод' in q.locator('[data-activity-content]').inner_text();close(q)
            # Restored northern boardwalk is an actual second regional route.
            build(q,'north-boardwalk');q.evaluate('Object.assign(b.player,{x:1600,y:560,path:[],autoTimer:10000});b.setDestination(1600,240);g.step(2)')
            assert q.evaluate('b.player.y<270&&m.nav.clearSegment({x:1600,y:560},{x:1600,y:240})&&m.regions.unlocked.size===3')
            press(q,'j');assert q.locator('[data-world-work]').count()==4
            assert 'восстановлено' in q.locator('[data-world-work=old-dam]').inner_text();close(q)
            q.evaluate('window.rev=m.state.worldWorks.revision;for(let i=0;i<6;i++)g.step(.01)')
            assert q.evaluate('w.terrain.source.cachedChunks<=w.terrain.source.maxChunks&&w.terrain.images.size<=(m.coop?40:24)&&w.worldWorksView.objects.size<100&&m.state.worldWorks.revision===rev')
            q.evaluate('window.old=m;w.scene.restart();void 0');q.wait_for_function('lumberPhaser.core!==old&&lumberPhaser.scene.hudReady')
            assert q.evaluate('lumberPhaser.core.state.worldWorks.level==="high"&&Object.keys(lumberPhaser.core.state.worldWorks.built).length===0&&lumberPhaser.core.state.worldWorks.revision===0&&lumberPhaser.scene.worldWorksView.objects.size===0')
            assert not errors,errors
            print('PASS dam/partial repair/water/bridge/gate/chest/boardwalk/shared safety/cache/reset','mobile Canvas/dist' if mobile else 'co-op WebGL',flush=True)
            browser.close()
finally:server.shutdown()
