"""Only station UI, cargo and worker controls: desktop co-op WebGL / solo mobile Canvas."""
from functools import partial
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from threading import Thread
from shutil import which
from playwright.sync_api import sync_playwright
from helpers.browser_start import choose_hero

ROOT = Path(__file__).resolve().parents[1]
class Handler(SimpleHTTPRequestHandler):
    def log_message(self, *args): pass
server = ThreadingHTTPServer(('127.0.0.1', 0), partial(Handler, directory=str(ROOT)))
Thread(target=server.serve_forever, daemon=True).start()
try:
    with sync_playwright() as p:
        for mobile in [False, True]:
            browser = p.chromium.launch(executable_path=which('chromium'), headless=True, args=['--no-sandbox']+(['--disable-webgl'] if mobile else ['--use-angle=swiftshader', '--enable-unsafe-swiftshader']))
            q = browser.new_page(viewport={'width':390 if mobile else 1280, 'height':844 if mobile else 900}, is_mobile=mobile, has_touch=mobile)
            errors=[]; missing=[]
            q.on('pageerror', lambda e: errors.append(str(e)))
            q.on('response', lambda r: missing.append(r.url) if r.status>=400 else None)
            q.goto(f'http://127.0.0.1:{server.server_port}/dist/')
            q.wait_for_selector('#heroDialog[open]')
            if not mobile: q.locator('[name=players][value="2"]').check()
            choose_hero(q)
            q.evaluate('''window.g=lumberPhaser;window.w=g.scene;window.c=g.core;window.a=c.actors?.[0]||c;window.b=c.actors?.[1];w.manual=true;
                a.state.campBuildings={fire:true,fence:true,tent:true,house:true,workbench:true,kiln:true,'tower-west':true};a.state.campLevel=7;
                for(const actor of c.actors||[c]){actor.state.coins=10000;actor.state.maxWood=20;actor.refreshWorld();actor.clearKeys();}
                Object.assign(a.state.campIndustry.materials,{boards:12,blocks:8,stone:24,coal:2});
                Object.assign(c.player,{x:1710,y:1780,path:[]});w.workerUi.open();''')
            q.locator('[data-worker-action=hire]').click()
            assert q.locator('[data-worker-id]').count()==1
            assert q.locator('[data-worker-action=withdraw],[data-worker-action=sell],[data-worker-action=recall],[data-worker-action=reserve-more]').count()==0
            assert q.locator('[data-worker-id] [aria-pressed=true]').inner_text()=='Рубка'
            q.locator('[data-worker-action="assign:0:rest"]').click()
            q.screenshot(path=f'/tmp/camp-workers-{mobile}.png')
            q.locator('[data-worker-close]').click(); q.wait_for_function('!c.paused')
            q.evaluate('g.step(2)')
            assert q.evaluate('c.workers.crew[0].role==="rest"&&c.workers.data.logTarget==="store"')
            q.evaluate('''if(b)c.focus(1);window.owner=b||a;Object.assign(owner.player,{x:1400,y:1840,path:[]});w.campDesk.open('storage');''')
            q.wait_for_selector('#campDesk[open]')
            board=q.locator('.camp-product').filter(has=q.locator('[data-camp-action="take:boards"]'))
            board.locator('.quantity-picker button').nth(2).click()
            board.locator('.quantity-picker button').nth(2).click()
            q.locator('[data-camp-action="take:boards"]').click()
            assert q.evaluate('owner.state.boardCargo===3&&a.state.campIndustry.materials.boards===9')
            if not mobile: assert q.evaluate('a.state.boardCargo===0&&b.state.boardCargo===3')
            q.screenshot(path=f'/tmp/camp-storage-{mobile}.png')
            q.locator('[data-camp-close]').click(); q.wait_for_function('!c.paused')
            q.evaluate('g.step(.05)')
            assert q.evaluate('w.stackView.logs.filter(o=>o.visible).length>=3')
            q.evaluate('''Object.assign(owner.player,{x:1775,y:1460,path:[]});w.serviceView.open('house');''')
            q.wait_for_selector('#campDesk[open]')
            assert q.locator('[data-camp-action^="upgrade:"]').count()==1
            assert q.locator('[data-camp-action="upgrade:house"]').inner_text()=='Начать улучшение'
            assert q.locator('#campDesk details').count()==0
            q.screenshot(path=f'/tmp/camp-house-{mobile}.png')
            # Activate through the opener's keyboard, never the other player's key.
            if not mobile:
                q.keyboard.press('e'); assert q.evaluate('!a.state.campIndustry.upgradeSelected.house')
            q.keyboard.press('Enter' if not mobile else 'e')
            assert q.evaluate('a.state.campIndustry.upgradeSelected.house===true')
            q.locator('[data-camp-close]').click(); q.wait_for_function('!c.paused')
            q.evaluate('g.step(1.2)')
            assert q.evaluate('owner.state.boardCargo===0&&a.state.campIndustry.upgradePaid.house.boards===3')
            q.evaluate('''Object.assign(owner.player,{x:1340,y:1540,path:[]});w.serviceView.open('workbench');''')
            q.wait_for_selector('#campDesk[open]')
            assert q.locator('[data-camp-action^="recipe:"]').count()==3
            assert q.locator('[data-camp-action="recipe:coal"]').count()==0
            q.screenshot(path=f'/tmp/camp-recipes-{mobile}.png')
            q.locator('[data-camp-close]').click(); q.wait_for_function('!c.paused')
            q.evaluate('''Object.assign(owner.player,{x:1600,y:1780,path:[]});g.step(0);w.camera.setZoom(.8);w.camera.centerOn(1600,1600);w.renderModel();''')
            q.screenshot(path=f'/tmp/camp-square-{mobile}.png')
            assert not errors, errors
            assert not missing, missing
            print('PASS', 'mobile Canvas' if mobile else 'desktop co-op WebGL')
            browser.close()
finally:
    server.shutdown()
