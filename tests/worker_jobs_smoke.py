"""Only specialist commands, finite delivery, shared materials, assignments and worker UI/input."""
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
def until(q,expr,seconds=90):
    q.evaluate('''([expr,seconds])=>{for(let i=0;i<seconds*20&&!eval(expr);i++)m.update(.05);g.step(0);if(!eval(expr))throw Error(JSON.stringify(m.workers.crew.map(n=>({id:n.id,role:n.role,phase:n.phase,reason:n.reason,wood:n.cargo.length,stone:n.stoneCargo,x:n.x,y:n.y}))))}''',[expr,seconds])
def action(q,id):return q.locator(f'[data-worker-action="{id}"]')
try:
    with sync_playwright() as p:
        for mobile in ((True,) if '--mobile-only' in argv else (False,True)):
            browser=p.chromium.launch(headless=True,executable_path=which('chromium'),args=['--no-sandbox']+(['--disable-webgl'] if mobile else ['--use-angle=swiftshader','--enable-unsafe-swiftshader']))
            q=browser.new_page(viewport={'width':390 if mobile else 1360,'height':844 if mobile else 1100},is_mobile=mobile,has_touch=mobile);errors=[]
            q.on('pageerror',lambda e:errors.append(str(e)))
            q.goto(f'http://127.0.0.1:{server.server_port}/'+('dist/' if mobile else 'index.html'))
            q.wait_for_selector('#heroDialog[open]');q.locator(f'input[name=players][value="{1 if mobile else 2}"]').check();choose_hero(q)
            q.evaluate('''window.g=lumberPhaser;window.w=g.scene;window.m=g.core;window.a=m.actors?.[0]||m;window.b=m.actors?.[1]||m;w.manual=true;
              m.state.campBuildings={fire:true,tent:true,fence:true,house:true,workbench:true};m.state.campLevel=5;
              for(const c of m.actors||[m]){c.refreshWorld();Object.assign(c.player,{x:1600,y:1720,path:[],autoTimer:10000});c.state.coins=0;}
              b.state.coins=10000;if(m.coop)w.coopViews.focus(1);g.step(0)''')
            if mobile:q.locator('#workerButton').tap()
            else:press(q,'h')
            q.wait_for_selector('#workerDialog[open]');press(q,'s');press(q,'s')
            assert action(q,'hire:miner').get_attribute('data-selected')=='true'
            press(q,'Enter');action(q,'hire:repairer').click()
            assert q.evaluate('m.workers.crew.length===2&&b.state.coins===9500&&(!m.coop||a.state.coins===0)')
            assert action(q,'hire').is_disabled();close(q);q.evaluate('g.step(3)')
            press(q,'h');assert 'Нет доступного камня' in q.locator('[data-worker-id="0"]').inner_text();close(q)
            # Use the actual house upgrade command/UI to unlock places three and four.
            q.evaluate('for(const id of ["boards","blocks","coal"])m.state.campIndustry.materials[id]=80')
            for role in ('lumberjack','repairer'):
                press(q,'c');q.locator('[data-camp-action="tab:upgrades"]').click();q.locator('[data-camp-action="upgrade:house"]').click();close(q)
                press(q,'h');action(q,'hire' if role=='lumberjack' else 'hire:repairer').click();close(q)
            assert q.evaluate('m.workers.slots()===4&&m.workers.crew.length===4&&b.state.coins===7500&&w.workerView.objects.size===4')
            press(q,'h');action(q,'target').click();assert 'общий склад' in action(q,'target').inner_text()
            action(q,'reserve-more').click();action(q,'reserve-less').click();assert q.evaluate('m.state.workforce.repairReserve===6')
            q.locator('#workerDialog').screenshot(path=str(ROOT/f'docs/worker-jobs-{"mobile" if mobile else "coop"}.png'))
            close(q)
            # Two repairers compete for the same finite surplus: six logs repair two breaches, six remain.
            q.evaluate('m.state.logStore=Array(12).fill(11);for(const d of m.defenses.all().filter(d=>d.kind==="fence").slice(0,2))m.defenses.damage(d.id,60)')
            until(q,'m.state.workforce.repaired===6',40);q.evaluate('g.step(3)');assert q.evaluate('m.state.logStore.length===6&&m.state.workforce.repaired===6')
            # Clear this fixture's regional enemies to isolate deliveries; danger/retreat has a separate model test.
            q.evaluate('window.region=m.regions.all.find(r=>r.id==="1:0");m.regions.unlocked.add(region.id);m.state.unlockedRegions.push(region.id);m.world.generate(region);for(const c of m.actors||[m])c.refreshWorld();g.step(3.1);for(const e of [...m.survival.residents]){e.warning=0;m.survival.hit(e.id,10000,false);}')
            until(q,'m.workers.crew[0].stoneCargo===8',90)
            assert q.evaluate('m.world.boulders.some(r=>m.state.boulderHP[r.id]===0)&&m.workers.crew[0].cargo.length===0&&w.workerView.objects.get(0).stones.length===4')
            press(q,'h');action(q,'assign:0:repairer').click()
            assert 'после возврата' in q.locator('[data-worker-id="0"]').inner_text()
            q.evaluate('g.step(100)');assert q.evaluate('m.workers.crew[0].role==="miner"&&m.workers.crew[0].stoneCargo===8')
            close(q);until(q,'m.workers.crew[0].role==="repairer"&&m.state.workforce.delivered>=4',90)
            assert q.evaluate('m.state.workforce.stoneDelivered===8&&m.state.campIndustry.materials.stone===8&&m.workers.crew[0].stoneCargo===0&&m.state.workforce.earned===0&&m.state.workforce.stock.length===0&&m.state.logStore.length===6+m.state.workforce.delivered')
            # Daylight production stops under recall, while UI stays informative and restart releases it.
            press(q,'h');action(q,'recall').click();close(q);q.evaluate('g.step(15)');until(q,'m.workers.crew.every(n=>!n.cargo.length&&!n.stoneCargo)',30)
            q.evaluate('window.beforeDelivered=m.state.workforce.delivered;g.step(5)');assert q.evaluate('m.state.workforce.delivered===beforeDelivered')
            q.evaluate('window.old=m;w.scene.restart();void 0');q.wait_for_function('lumberPhaser.core!==old&&lumberPhaser.scene.hudReady')
            assert q.evaluate('lumberPhaser.core.workers.crew.length===0&&lumberPhaser.core.state.workforce.repairReserve===6&&lumberPhaser.core.state.workforce.logTarget==="sell"&&lumberPhaser.scene.workerView.objects.size===0&&!document.querySelector("#workerDialog").open')
            assert not errors,errors
            print('PASS worker professions/slots/stock/mining/repair/assignment/pause/reset','mobile Canvas/dist' if mobile else 'co-op WebGL',flush=True)
            browser.close()
finally:server.shutdown()
