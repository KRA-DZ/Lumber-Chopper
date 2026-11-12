"""Only guarded cache/reward and partial tower repair/survey through existing menus."""
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
def visit(q,id):
    q.evaluate('id=>{const p=a.exploration.get(id);Object.assign(a.player,{x:p.x,y:p.y,path:[],autoTimer:10000});if(m.coop)w.coopViews.focus(1);g.step(0)}',id)
    q.keyboard.press('Enter');q.wait_for_selector('#activityDialog[open]')
def close(q):q.locator('[data-activity-close]').click();q.wait_for_function('!m.paused')
try:
    with sync_playwright() as p:
        for mobile in ([True] if '--mobile-only' in __import__('sys').argv else [False,True]):
            browser=p.chromium.launch(headless=True,executable_path=which('chromium'),args=['--no-sandbox']+(['--disable-webgl'] if mobile else ['--use-angle=swiftshader','--enable-unsafe-swiftshader']))
            q=browser.new_page(viewport={'width':390 if mobile else 1360,'height':844 if mobile else 1050},is_mobile=mobile,has_touch=mobile);errors=[]
            q.on('pageerror',lambda e:errors.append(str(e)))
            q.goto(f'http://127.0.0.1:{server.server_port}/'+('dist/' if mobile else ''))
            q.wait_for_selector('#heroDialog[open]');q.locator(f'[name=players][value="{1 if mobile else 2}"]').check();choose_hero(q)
            q.evaluate('''window.g=lumberPhaser;window.w=g.scene;window.m=g.core;window.a=m.actors?.[1]||m;w.manual=true;
              for(const id of ['1:0','0:1']){const r=m.regions.all.find(r=>r.id===id);m.regions.unlocked.add(id);m.state.unlockedRegions.push(id);m.world.generate(r);}
              for(const c of m.actors||[m]){c.refreshWorld();c.state.health=c.state.maxHealth=100000;}
              Object.assign(a.player,{x:3680,y:2440,path:[],autoTimer:10000});g.step(3.2)''')
            assert q.evaluate('m.survival.minions.filter(e=>e.campGuard).length===3&&m.survival.minions.length<=12')
            visit(q,'forest-camp-cache');assert q.locator('[data-activity-action="forest:claim"]').is_disabled();close(q)
            # Existing axe command and enemy HP/event pipeline; only fixture strength is high.
            q.evaluate('''a.state.axePower=100;for(const e of [...m.survival.minions.filter(e=>e.campGuard)]){e.warning=0;Object.assign(a.player,a.nav.nearestGround(e.x+30,e.y),{path:[]});a.player.clickTimer=0;if(!a.tryAttack(e.id))throw Error('Guard attack failed');}
              window.before=(m.actors||[m]).map(c=>c.state.coins);g.step(0)''')
            visit(q,'forest-camp-cache')
            if mobile:q.locator('[data-activity-action="forest:claim"]').tap()
            else:q.locator('[data-activity-action="forest:claim"]').click()
            assert q.evaluate('m.state.forestTasks.claimed&&m.state.campIndustry.materials.boards===4&&m.state.campIndustry.materials.coal===2&&(m.actors||[m]).every((c,i)=>c.state.coins===before[i]+60)')
            assert q.locator('[data-activity-action="forest:claim"]').is_disabled();close(q)
            q.locator('#game-frame').screenshot(path=str(ROOT/f'docs/forest-camp-{"mobile" if mobile else "coop"}.png'))
            q.evaluate('m.state.campIndustry.materials.boards=6;m.state.campIndustry.materials.blocks=4;window.openCount=m.regions.unlocked.size')
            visit(q,'lookout-tower');assert q.locator('[data-activity-action="forest:survey"]').is_disabled();close(q)
            for i in range(8):
                q.evaluate('a.forestry.addCargo(7);a.forestry.addCargo(12)')
                visit(q,'lookout-tower');q.locator('[data-activity-action="works:contribute"]').click()
                if i<7:close(q)
            assert q.evaluate('m.state.worldWorks.built["lookout-tower"]&&m.state.forestTasks.surveyed.length===5&&m.regions.unlocked.size===openCount&&!m.regions.unlocked.has("1:1")')
            assert q.locator('[data-activity-action="works:contribute"]').is_disabled();close(q)
            q.locator('#game-frame').screenshot(path=str(ROOT/f'docs/lookout-{"mobile" if mobile else "coop"}.png'))
            q.locator('#mapButton').click();q.wait_for_selector('#mapDialog[open]')
            assert q.locator('[data-region="1:1"]').get_attribute('data-surveyed')=='true'
            assert 'лесопилка' in q.locator('[data-region="1:1"]').inner_text()
            assert 'region-open' not in q.locator('[data-region="1:1"]').get_attribute('class')
            q.keyboard.press('q');q.wait_for_function('!m.paused')
            q.evaluate('window.old=m;w.scene.restart();void 0');q.wait_for_function('lumberPhaser.core!==old&&lumberPhaser.scene.hudReady')
            assert q.evaluate('!lumberPhaser.core.state.forestTasks.claimed&&lumberPhaser.core.state.forestTasks.surveyed.length===0&&!lumberPhaser.core.state.worldWorks.built["lookout-tower"]')
            assert not errors,errors
            print('PASS camp, axe, shared reward, partial tower, locked map and reset',mobile,flush=True);browser.close()
finally:server.shutdown()
