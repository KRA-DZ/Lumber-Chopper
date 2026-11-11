"""Only restoration/old niche, operator, real freight inventories, shift pause and bounded PNG views."""
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
def press(q,key):q.keyboard.press(key,delay=55)
def close(q):press(q,'q');q.wait_for_function('!m.paused')
def act(q,id):return q.locator(f'[data-activity-action="{id}"]')
def visit(q,id):
    q.evaluate('id=>{const p=b.exploration.get(id);Object.assign(b.player,{x:p.x,y:p.y,path:[],autoTimer:10000});b.sawmill.freight.sync();if(m.coop)w.coopViews.focus(1);g.step(0)}',id)
    press(q,'Enter');q.wait_for_selector('#activityDialog[open]')
def restore(q,n):
    q.evaluate('n=>{const count=[12,20,16][n];b.state.maxWood=20;while(b.state.wood<count)b.forestry.addCargo(11)}',n)
    visit(q,'sawmill-restoration');act(q,'mill:restore').click();assert q.evaluate('n=>m.state.sawmill.stage===n+1',n);close(q)
def until(q,expr,seconds=120):
    q.evaluate('''([expr,seconds])=>{for(let i=0;i<seconds*20&&!eval(expr);i++)m.update(.05);g.step(0);if(!eval(expr))throw Error(JSON.stringify({mill:m.state.sawmill,crew:m.workers.crew.map(w=>({role:w.role,x:w.x,y:w.y,job:w.job,reason:w.reason}))}))}''',[expr,seconds])
try:
    with sync_playwright() as p:
        for mobile in ((True,) if '--mobile-only' in argv else (False,True)):
            mode='mobile Canvas/dist' if mobile else 'co-op WebGL'
            browser=p.chromium.launch(headless=True,executable_path=which('chromium'),args=['--no-sandbox']+(['--disable-webgl'] if mobile else ['--use-angle=swiftshader','--enable-unsafe-swiftshader']))
            q=browser.new_page(viewport={'width':390 if mobile else 1360,'height':844 if mobile else 1100},is_mobile=mobile,has_touch=mobile);errors=[]
            q.on('pageerror',lambda e:errors.append(str(e)))
            q.goto(f'http://127.0.0.1:{server.server_port}/'+('dist/' if mobile else 'index.html'))
            q.wait_for_selector('#heroDialog[open]');q.locator(f'input[name=players][value="{1 if mobile else 2}"]').check();choose_hero(q)
            q.evaluate('''window.g=lumberPhaser;window.w=g.scene;window.m=g.core;window.a=m.actors?.[0]||m;window.b=m.actors?.[1]||m;w.manual=true;
              m.state.campBuildings={tent:true,fire:true,house:true};m.state.campLevel=3;
              for(const id of ['1:0','1:1']){const r=m.regions.all.find(r=>r.id===id);m.regions.unlocked.add(id);m.state.unlockedRegions.push(id);m.world.generate(r);}
              for(const c of m.actors||[m]){c.refreshWorld();Object.assign(c.player,{x:1600,y:1720,path:[],autoTimer:10000});c.state.coins=0;c.state.health=c.state.maxHealth=1000000;}
              b.state.coins=10000;m.state.campIndustry.materials.boards=m.state.campIndustry.materials.blocks=200;if(m.coop)w.coopViews.focus(1);g.step(0)''')
            press(q,'h');press(q,'s');press(q,'Enter');assert q.evaluate('m.workers.crew.length===1&&b.state.coins===9850');close(q)
            visit(q,'sawmill-restoration');assert act(q,'mill:restore').is_disabled();close(q)
            # Normal clearing command, with a fixture axe; original clue/drive/discovery actions stay in use.
            q.evaluate('''b.state.axePower=50;for(const id of ['sawmill-fallen-beams','sawmill-heavy-collapse']){const d=b.clearing.get(id);Object.assign(b.player,b.nav.nearestGround(d.x-60,d.y),{path:[]});b.player.clickTimer=0;b.tryClear(id);}g.step(3.1);
              for(const e of [...m.survival.residents]){e.warning=0;m.survival.hit(e.id,10000,false);}''')
            restore(q,0);visit(q,'sawmill-hand-drive');assert act(q,'open-passage').is_disabled();close(q)
            q.evaluate('b.lore.read(b.world.clues.find(c=>c.id==="sawmill-last-shift"))')
            visit(q,'sawmill-hand-drive');act(q,'open-passage').click();close(q);restore(q,1)
            visit(q,'sawmill-restoration');assert act(q,'mill:restore').is_disabled();close(q)
            visit(q,'sawmill-shift-tag');act(q,'collect-discovery').click();close(q);restore(q,2)
            assert q.evaluate('m.state.exploration.discoveries.includes("sawmill-shift-tag")&&m.state.exploration.openedPassages.includes("sawmill-machine-cache")')
            print('PASS restoration and old niche',mode,flush=True)
            # Build/load/attach one cart through UI; its payload does not increase the hero capacity.
            q.evaluate('b.state.maxWood=20;while(b.state.wood<12)b.forestry.addCargo(13);m.state.logStore=Array(24).fill(17)')
            visit(q,'camp-freight');act(q,'mill:cart-build').click();act(q,'mill:load-cart').click();act(q,'mill:attach').click();close(q)
            q.evaluate('b.state.maxWood=2;window.oldX=b.player.x');move_key='d' if mobile else 'ArrowRight'
            q.keyboard.down(move_key);q.evaluate('g.step(1)');q.keyboard.up(move_key)
            assert q.evaluate('Math.abs(b.player.x-oldX-160)<3&&m.state.sawmill.cart.logs.length===24&&Math.abs(m.state.sawmill.cart.x-b.player.x)<.1&&b.state.maxWood===2'),q.evaluate('({oldX,x:b.player.x,y:b.player.y,speed:b.player.speed,cart:m.state.sawmill.cart,paused:m.paused,menu:b.player.menuOpen,focus:m.activeActor,wood:b.state.wood})')
            visit(q,'sawmill-loading');act(q,'mill:deposit').click();act(q,'mill:operator:0').click();act(q,'mill:toggle').click();close(q)
            q.evaluate('g.step(.2)');assert q.evaluate('m.state.sawmill.job===null')
            until(q,'m.state.sawmill.job!==null')
            assert q.evaluate('Math.hypot(m.workers.crew[0].x-(b.exploration.get("sawmill-production").x+96),m.workers.crew[0].y-(b.exploration.get("sawmill-production").y-80))<65&&m.workers.crew.length===1')
            visit(q,'sawmill-loading');q.evaluate('window.remaining=m.state.sawmill.job.remaining;g.step(30)');assert q.evaluate('m.state.sawmill.job.remaining===remaining');close(q)
            q.evaluate('g.step(12.1);window.bankBefore=m.state.campIndustry.materials.boards');visit(q,'sawmill-loading')
            assert q.evaluate('m.state.sawmill.output===4');act(q,'mill:collect').click();act(q,'mill:detach').click();close(q)
            assert q.evaluate('m.state.sawmill.cart.boards===4&&b.state.boardCargo===0&&m.state.campIndustry.materials.boards===bankBefore')
            q.evaluate('g.step(12.1)');visit(q,'sawmill-production');act(q,'mill:toggle').click();act(q,'mill:collect').click();close(q)
            assert q.evaluate('b.state.boardCargo===2&&m.state.sawmill.output===2&&!b.forestry.addCargo(8)&&(m.coop?w.coopViews.entries[1].stackView:w.stackView).logs.filter(i=>i.visible&&i.frame.name==="sawmill.woodRack").length===2')
            q.locator('#game-frame').screenshot(path=str(ROOT/f'docs/sawmill-production-{"mobile" if mobile else "coop"}.png'))
            visit(q,'freight-cart');act(q,'mill:attach').click();close(q);visit(q,'camp-freight')
            if mobile:act(q,'mill:unload').tap()
            else:act(q,'mill:unload').click()
            assert q.evaluate('m.state.campIndustry.materials.boards===bankBefore+6&&b.state.boardCargo===0&&m.state.sawmill.cart.boards===0');close(q)
            print('PASS operator/production/cargo/cart/bank/pause',mode,flush=True)
            # Late-night fixture clears newly respawned enemies; attraction is tested separately in the model.
            visit(q,'sawmill-production');act(q,'mill:night').click();act(q,'mill:toggle').click();close(q)
            q.evaluate('''m.state.worldTime=500;g.step(.01);for(const e of [...m.survival.residents]){e.warning=0;m.survival.hit(e.id,10000,false);}
              Object.assign(m.workers.crew[0],{x:(b.exploration.get("sawmill-production").x+96),y:(b.exploration.get("sawmill-production").y-80),path:[],job:'mill',dangerUntil:0});g.step(1.6)''')
            assert q.evaluate('m.sawmill.noise()?.radius===600&&m.state.sawmill.job.remaining<12')
            visit(q,'sawmill-production');act(q,'mill:night').click();close(q);q.evaluate('window.left=m.state.sawmill.job.remaining;g.step(2)');assert q.evaluate('m.state.sawmill.job.remaining===left&&!m.sawmill.noise()')
            q.evaluate('window.old=m;w.scene.restart();void 0');q.wait_for_function('lumberPhaser.core!==old&&lumberPhaser.scene.hudReady')
            assert q.evaluate('lumberPhaser.core.state.sawmill.stage===0&&lumberPhaser.core.state.sawmill.cart.owner===null&&!lumberPhaser.core.state.sawmill.cart.built&&lumberPhaser.core.state.boardCargo===0&&!lumberPhaser.scene.sawmillProductionView.cart.visible')
            assert not errors,errors
            print('PASS mill night switch and restart',mode,flush=True);browser.close()
finally:server.shutdown()
