"""Only the new 1-5 camp loop: stations, queue, upgrades, orders, kit, lantern and real tower combat."""
from functools import partial
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from threading import Thread
from shutil import which
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
class Handler(SimpleHTTPRequestHandler):
    def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Handler,directory=str(ROOT)))
Thread(target=server.serve_forever,daemon=True).start()
def press(q,key):q.keyboard.press(key,delay=70)
def close(q):press(q,'q');q.wait_for_function('!m.paused')
try:
    with sync_playwright() as p:
        for coop in (True,False):
            browser=p.chromium.launch(headless=True,executable_path=which('chromium'),args=['--no-sandbox']+(['--use-angle=swiftshader','--enable-unsafe-swiftshader'] if coop else ['--disable-webgl']))
            q=browser.new_page(viewport={'width':1360 if coop else 390,'height':1100 if coop else 844},is_mobile=not coop,has_touch=not coop);errors=[]
            q.on('pageerror',lambda e:errors.append(str(e)))
            q.goto(f'http://127.0.0.1:{server.server_port}/'+('index.html' if coop else 'dist/'))
            q.wait_for_selector('#heroDialog[open]');q.locator(f'input[name=players][value="{2 if coop else 1}"]').check();q.locator('[data-hero-start]').click()
            q.wait_for_function('window.lumberPhaser?.scene.hudReady',timeout=60000)
            q.evaluate('window.g=lumberPhaser;window.w=g.scene;window.m=g.core;window.a=m.actors?.[0]||m;window.b=m.actors?.[1]||m;w.manual=true;g.step(0);void 0')
            assert q.evaluate('m.state.campIndustry.queue.length===0&&w.industryView.objects.size===6&&!w.fire.visible')
            # Real construction of both processing stations; kiln waits for its four blocks.
            q.evaluate('Object.assign(a.player,m.build,{path:[],autoTimer:10000});g.step(.05)');q.wait_for_selector('#buildDialog[open]')
            q.locator('[data-build-project=workbench]').click();q.wait_for_function('!m.paused')
            q.evaluate('a.state.maxWood=60;for(let i=0;i<45;i++)a.forestry.addCargo(8);a.player.x=m.build.x+140;g.step(.05);a.player.x=m.build.x;g.step(5)')
            q.wait_for_selector('#buildDialog[open]');q.locator('[data-build-project=kiln]').click();q.wait_for_function('!m.paused')
            q.evaluate('a.player.x=m.build.x+140;g.step(.05);a.player.x=m.build.x;g.step(6)')
            assert q.evaluate('m.state.campBuildings.workbench&&m.state.buildProject==="kiln"&&m.state.buildWood===24&&a.state.wood===3')
            q.evaluate('a.state.stone=15')
            if coop:press(q,'c')
            else:q.locator('#industryButton').tap()
            q.wait_for_selector('#campDesk[open]')
            q.locator('[data-camp-action="deposit:logs"]').click();q.locator('[data-camp-action="deposit:stone"]').click()
            for _ in range(3):q.locator('[data-camp-action="recipe:blocks"]').click()
            assert q.evaluate('m.state.logStore.length===3&&m.state.campIndustry.queue.length===3&&m.state.campIndustry.materials.stone===6')
            assert q.locator('[data-camp-action="recipe:blocks"]').get_attribute('aria-disabled')=='true'
            assert q.evaluate('m.state.campIndustry.queue.length===3')
            close(q);q.evaluate('g.step(30.2)');assert q.evaluate('m.state.campIndustry.materials.blocks===3&&m.state.buildProject==="kiln"')
            press(q,'c');q.wait_for_selector('#campDesk[open]');q.locator('[data-camp-action="recipe:blocks"]').click();close(q);q.evaluate('g.step(10.2)')
            q.wait_for_selector('#buildDialog[open]');close(q)
            assert q.evaluate('m.state.campBuildings.kiln&&m.state.campIndustry.materials.blocks===0&&m.state.buildProject===null')
            # Native W/S/E enqueues efficient fuel. An open planning menu freezes the job.
            press(q,'c');q.wait_for_selector('#campDesk[open]')
            for _ in range(4):press(q,'s')
            assert q.locator('[data-camp-action="recipe:coal"]').evaluate('(b)=>b.closest(".camp-card").dataset.selected==="true"')
            press(q,'e');assert q.evaluate('m.state.campIndustry.queue[0].recipe==="coal"&&m.state.logStore.length===0')
            q.evaluate('g.step(100)');assert q.evaluate('m.state.campIndustry.queue[0].remaining===25')
            close(q);q.evaluate('g.step(25.05)');assert q.evaluate('m.state.campIndustry.materials.coal===2')
            # Controlled late-camp fixture isolates upgrade UI from resource gathering already checked above.
            q.evaluate('''Object.assign(m.state.campBuildings,{fire:true,fence:true,house:true,'tower-west':true,'lamp-north':true});
              m.state.campLevel=Object.keys(m.state.campBuildings).length;m.state.campFuel=120;
              for(const id of Object.keys(m.state.campIndustry.materials))m.state.campIndustry.materials[id]=80;
              m.state.campIndustry.materials.kits=1;for(const c of m.actors||[m])c.refreshWorld();
              Object.assign(a.player,{x:1600,y:1720,path:[]});if(m.coop)w.coopViews.focus(0);g.step(0)''')
            press(q,'c');q.locator('[data-camp-action="tab:upgrades"]').click()
            for id in ('fire','fence','house','towers'):q.locator(f'[data-camp-action="upgrade:{id}"]').click()
            assert q.evaluate('m.state.campIndustry.upgrades.fire===1&&m.state.campIndustry.upgrades.fence===1&&a.camp.maxFuel()===900&&a.camp.storageLimit()===600&&m.state.campFuel===120')
            q.locator('#campDesk').screenshot(path=str(ROOT/f'docs/camp-upgrades-{"coop" if coop else "mobile"}.png'))
            close(q)
            q.evaluate('''window.testFence=m.defenses.all().find(d=>d.kind==='fence');m.defenses.damage(testFence.id,100);
              Object.assign(a.player,a.nav.nearestGround(testFence.x,testFence.y+45),{path:[]});g.step(0)''')
            press(q,'c');q.locator('[data-camp-action="tab:defense"]').click();q.locator('[data-camp-action="kit:'+q.evaluate('testFence.id')+'"]').click()
            assert q.evaluate('m.defenses.get(testFence.id).hp===60&&m.state.campIndustry.materials.kits===0&&!m.nav.isWalkable(testFence.x,testFence.y)')
            close(q)
            # Orders pay once and credit both personal purses, with ordinary buyer limits unchanged.
            q.evaluate('Object.assign(b.player,m.sale,{path:[]});if(m.coop)w.coopViews.focus(1);b.state.maxWood=12;for(let i=0;i<12;i++)b.forestry.addCargo(10);g.step(0)')
            press(q,'Enter');q.wait_for_selector('#campDesk[open]');q.locator('[data-camp-action="order:accept:logs"]').click()
            assert q.evaluate('m.orders.current.id==="logs"')
            close(q);q.evaluate('g.step(3.7)');assert q.evaluate('m.state.buyerOrders.completed===1&&(m.actors||[m]).every(c=>c.state.coins===180)&&m.buyers.every(b=>b.capacity===(b.kind==="cart"?15:5))')
            # A placed lantern has its own finite light, without camp protection.
            q.evaluate('Object.assign(b.player,{x:1600,y:1300,path:[]});m.state.campFuel=0;g.step(0)');press(q,'Enter');q.evaluate('m.state.worldTime=500;g.step(1)')
            assert q.evaluate('m.preparation.lights().length===1&&m.state.campIndustry.lampFuel["lamp-north"]>178&&!m.survival.isSafe(b.player)')
            # Fire a real tower at a real wave raider; the fixture only positions actors and prevents unrelated defeat.
            q.evaluate('''for(const c of m.actors||[m])c.state.health=c.state.maxHealth=1000000;
              m.state.campHealth=m.state.maxCampHealth=1000000;m.state.calendarDay=4;m.state.worldTime=449.99;g.step(.02);g.step(12.1);
              window.target=m.survival.raiders[0];for(const e of m.survival.raiders)e.warning=10000;
              Object.assign(target,{x:1310,y:1260,path:[],repath:100,cooldown:100,warning:0});
              m.state.campIndustry.towerCooldown['tower-west']=0;m.state.campIndustry.towerAmmo['tower-west']=8;
              window.beforeHP=target.hp;g.step(.05)''')
            assert q.evaluate('target.hp===beforeHP-2&&m.state.campIndustry.towerAmmo["tower-west"]===7&&m.survival.monster.invulnerable&&w.industryView.shots.size<=8')
            q.evaluate('m.defenses.damage("tower-west",120);window.afterShot=target.hp;g.step(1.6)');assert q.evaluate('target.hp===afterShot&&m.defenses.get("tower-west").hp===0')
            q.evaluate('window.old=m;w.scene.restart();void 0');q.wait_for_function('lumberPhaser.core!==old&&lumberPhaser.scene.hudReady')
            assert q.evaluate('lumberPhaser.core.state.campIndustry.queue.length===0&&Object.values(lumberPhaser.core.state.campIndustry.materials).every(n=>n===0)&&lumberPhaser.core.state.buyerOrders.active===null&&lumberPhaser.scene.industryView.shots.size===0')
            assert not errors,errors
            print('PASS processing/upgrades/orders/preparation', 'co-op WebGL' if coop else 'mobile Canvas/dist',flush=True)
            browser.close()
finally:server.shutdown()
