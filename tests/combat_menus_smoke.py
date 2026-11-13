"""Only new automatic combat, owner menus, resource feedback and service signs."""
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
def select_key(q,selector,key):
    for _ in range(35):
        if q.locator(selector).count():return
        q.keyboard.press(key)
    raise AssertionError('Could not navigate to '+selector)
try:
    with sync_playwright() as p:
        for mobile in [False,True]:
            browser=p.chromium.launch(headless=True,executable_path=which('chromium'),args=['--no-sandbox']+(['--disable-webgl'] if mobile else ['--use-angle=swiftshader','--enable-unsafe-swiftshader']))
            q=browser.new_page(viewport={'width':390 if mobile else 1360,'height':844 if mobile else 900},is_mobile=mobile,has_touch=mobile);errors=[];missing=[]
            q.on('pageerror',lambda e:errors.append(str(e)));q.on('response',lambda r:missing.append(r.url) if r.status>=400 else None)
            q.goto(f'http://127.0.0.1:{server.server_port}/'+('dist/' if mobile else ''));q.wait_for_selector('#heroDialog[open]')
            if not mobile:q.locator('[name=players][value="2"]').check()
            choose_hero(q)
            q.evaluate('''window.g=lumberPhaser;window.w=g.scene;window.c=g.core;w.manual=true;window.a=c.actors?.[0]||c;window.b=c.actors?.[1]||a;
              a.state.health=60;b.state.health=50;a.state.coins=b.state.coins=1000;a.state.exploration.items.berry=2;b.state.exploration.items.berry=2;g.step(0);''')
            assert q.locator('#attackButton').count()==0;assert q.locator('[data-coop-action=attack]').count()==0
            # Pin inventory to the actual owner even if the general UI focus changes.
            if not mobile:q.keyboard.press('l')
            else:q.locator('#bagButton').tap()
            q.wait_for_selector('#activityDialog[open]');q.evaluate('if(c.coop)c.focus(0);void 0')
            if not mobile:
                q.keyboard.press('ArrowRight');q.keyboard.press('ArrowDown');q.keyboard.press('ArrowLeft');q.keyboard.press('ArrowUp')
                select_key(q,'[data-use-item=berry][data-selected=true]','ArrowRight');q.keyboard.press('Enter')
            else:q.locator('[data-use-item=berry]').tap()
            assert q.evaluate('b.state.health===56&&(!c.coop||a.state.health===60)&&b.state.exploration.items.berry===1')
            select_key(q,'[data-activity-close][data-selected=true]','ArrowRight');q.keyboard.press('Enter');q.wait_for_function('!lumberPhaser.core.paused')
            # Both shops expose their Back button to the keyboard, including horizontal navigation.
            if not mobile:
                for i in [0,1]:
                    q.locator(f'[data-coop-player="{i}"] [data-coop-action=shop]').click()
                    q.keyboard.press('e' if i==0 else 'Enter');assert q.evaluate('(i)=>c.actors[i].state.carryLevel===1',i)
                    key='d' if i==0 else 'ArrowRight'
                    select_key(q,f'[data-player-shop="{i}"] [data-menu-back][data-selected=true]',key)
                    q.keyboard.press('e' if i==0 else 'Enter');assert not q.locator(f'[data-player-shop="{i}"]').count()
            else:
                q.locator('#shopButton').tap();q.wait_for_selector('#shopDialog[open]');q.keyboard.press('Enter');assert q.evaluate('a.state.carryLevel===1')
                select_key(q,'#shopDialog [data-close][data-selected=true]','ArrowRight');q.keyboard.press('Enter');q.wait_for_function('!lumberPhaser.core.paused')
            # Inspectable shop cells, not the former text list.
            q.locator('#shopButton').click();assert q.locator('.upgrade-cell').count()==5
            q.screenshot(path=f'/tmp/upgrade-cells-{mobile}.png')
            q.keyboard.press('Escape');q.wait_for_function('!lumberPhaser.core.paused')
            # Real mutable resource fields drive bounded receipt effects and inventory counts.
            q.evaluate('''b.state.boardCargo=1;b.state.exploration.items.berry+=2;a.state.campIndustry.materials.boards=3;g.step(0);''')
            assert q.locator('.resource-receipt[data-resource=boards]').count()>=1
            if not mobile:q.locator('[data-coop-player="1"] [data-coop-action=bag]').click()
            else:q.locator('#bagButton').click()
            assert '1' in q.locator('[data-bag-item=boards]').inner_text();assert '3' in q.locator('[data-shared-item=boards]').inner_text()
            q.screenshot(path=f'/tmp/resource-inventory-{mobile}.png');q.locator('[data-activity-close]').click();q.wait_for_function('!lumberPhaser.core.paused')
            # Every service has a text sign and a working entry point; camp workshop is conditional.
            q.evaluate('a.state.campBuildings={workbench:true,tent:true};a.state.campLevel=2;a.refreshWorld();g.step(0)')
            assert q.evaluate('w.serviceView.entries.every(e=>e.zone.visible&&e.label.text.length>0)')
            q.evaluate('c.focus?.(0);Object.assign(a.player,{x:1710,y:1780,path:[]});w.serviceView.open("workers");void 0')
            q.wait_for_selector('#workerDialog[open]');q.locator('[data-worker-close]').click();q.wait_for_function('!lumberPhaser.core.paused')
            # Camp texture scale in relation to the existing hero; no new image generation.
            q.evaluate('''const r=c.regions.all.find(r=>r.id==='1:0');c.regions.unlocked.add(r.id);if(!a.state.unlockedRegions.includes(r.id))a.state.unlockedRegions.push(r.id);c.world.generate(r);a.refreshWorld();
              Object.assign(b.player,b.nav.nearestGround(r.cx-380,r.cy+750),{path:[],autoTimer:10000});g.step(0);''')
            assert q.evaluate('w.forestTasksView.tent.scaleX>=2&&w.forestTasksView.chest.scaleX>=2')
            q.screenshot(path=f'/tmp/enemy-camp-scale-{mobile}.png')
            # Former attack keys do nothing; nearby combat still uses the automatic timer.
            q.evaluate('''Object.assign(a.player,a.nav.nearestGround(1700,2010),{path:[],autoTimer:10000});const point=Array.from({length:8},(_,i)=>({x:a.player.x+Math.cos(i*Math.PI/4)*30,y:a.player.y+Math.sin(i*Math.PI/4)*30})).find(p=>a.nav.clearSegment(a.player,p));window.enemy={id:'menu-test',kind:'raider',role:'attacker',...point,hp:20,maxHP:20,home:{x:a.player.x+30,y:a.player.y},path:[],windup:0,cooldown:1000,stun:1000,repath:0};c.survival.raiders.push(enemy);c.focus?.(0);g.step(0);''')
            q.evaluate('document.activeElement.blur()')
            for key in ['f','Space','Slash','Numpad0']:q.keyboard.press(key)
            assert q.evaluate('enemy.hp===20');q.evaluate('a.player.autoTimer=0;c.update(.01);g.step(0)');assert q.evaluate('enemy.hp===19'),q.evaluate('({hp:enemy.hp,auto:a.player.autoTimer,paused:c.paused,menu:a.player.menuOpen,clear:a.nav.clearSegment(a.player,enemy),wood:a.state.wood})')
            assert not errors,errors;assert not missing,missing
            print('PASS owner inventory, four-way/back navigation, cells, receipts, service signs, camp scale and automatic combat',mobile,flush=True)
            browser.close()
finally:server.shutdown()
