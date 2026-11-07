"""Only optional camp goals, raid readiness/forecast and ranged raid integration."""
from functools import partial
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
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
def press(q,key):q.keyboard.press(key,delay=60)
def close(q):press(q,'q');q.wait_for_function('!m.paused')
try:
    with sync_playwright() as p:
        for mobile in (False,True):
            browser=p.chromium.launch(headless=True,executable_path=which('chromium'),args=['--no-sandbox']+(['--disable-webgl'] if mobile else ['--use-angle=swiftshader','--enable-unsafe-swiftshader']))
            q=browser.new_page(viewport={'width':390 if mobile else 1360,'height':844 if mobile else 1100},is_mobile=mobile,has_touch=mobile);errors=[]
            q.on('pageerror',lambda e:errors.append(str(e)))
            q.goto(f'http://127.0.0.1:{server.server_port}/'+('dist/' if mobile else 'index.html'))
            q.wait_for_selector('#heroDialog[open]')
            q.locator(f'input[name=players][value="{1 if mobile else 2}"]').check();choose_hero(q)
            q.evaluate('window.g=lumberPhaser;window.w=g.scene;window.m=g.core;window.a=m.actors?.[0]||m;window.h=w.scene.get("Hud");w.manual=true;g.step(0);void 0')
            press(q,'j');q.wait_for_selector('#journalDialog[open]')
            assert q.locator('[data-camp-milestone]').count()==6
            assert q.locator('[data-camp-milestone][data-done=true]').count()==0
            assert 'Разведка' in q.locator('#journalDialog [data-raid-readiness]').inner_text()
            close(q)
            # Only lighting with real fuel records the milestone; extinguishing does not undo it.
            q.evaluate('m.state.campBuildings={fire:true,fence:true};m.state.campLevel=2;for(const c of m.actors||[m])c.refreshWorld();Object.assign(a.player,{x:1600,y:1665,path:[],autoTimer:10000});a.forestry.addCargo(8);a.camp.stoke();m.state.campFuel=0;g.step(0)')
            press(q,'j');assert q.locator('[data-camp-milestone=light]').get_attribute('data-done')=='true';close(q)
            # Forecast stays visible after the brief dawn notice expires. Readiness is a live snapshot.
            q.evaluate('m.state.calendarDay=8;m.state.worldTime=599.99;g.step(.02);g.step(11);m.state.worldTime=400;m.state.campFuel=200;g.step(0)')
            assert q.evaluate('h.dayHud.raid.text.includes("Быстрый отряд")&&h.dayHud.raid.text.includes("3/3")')
            # The actual HUD forecast opens defense, without issuing a world move.
            q.evaluate('window.beforePath=JSON.stringify(a.player.path)')
            point=q.evaluate('()=>{const r=document.querySelector("canvas").getBoundingClientRect();return{x:r.x+50/g.game.scale.width*r.width,y:r.y+130/g.game.scale.height*r.height}}')
            if mobile:q.touchscreen.tap(point['x'],point['y'])
            else:q.mouse.click(point['x'],point['y'])
            q.wait_for_selector('#defenseDialog[open]')
            card=q.locator('#defenseDialog [data-raid-readiness]')
            assert 'Быстрый отряд' in card.inner_text() and '3/3' in card.inner_text()
            q.evaluate('g.step(100)');assert q.evaluate('m.state.worldTime===400&&JSON.stringify(a.player.path)===beforePath')
            q.locator('#defenseDialog').screenshot(path=str(ROOT/f'docs/camp-readiness-{"mobile" if mobile else "coop"}.png'))
            q.locator('[data-defense-close]').click();q.wait_for_function('!m.paused')
            q.evaluate('window.testSection=m.defenses.all().find(d=>d.kind==="fence");m.defenses.damage(testSection.id,1000);m.state.campFuel=1;g.step(0)')
            press(q,'b');assert q.locator('#defenseDialog [data-raid-check=fuel]').get_attribute('data-ready')=='false'
            assert 'проломов 1' in q.locator('#defenseDialog [data-raid-check=fence]').inner_text();q.locator('[data-defense-close]').click();q.wait_for_function('!m.paused')
            # Real tenth-night roster agrees with the daytime forecast and remains paused by menus.
            q.evaluate('for(const c of m.actors||[m])c.state.health=c.state.maxHealth=1000000;m.state.campHealth=m.state.maxCampHealth=1000000;m.state.worldTime=449.99;g.step(.02);g.step(12.1)')
            assert q.evaluate('m.survival.wave.planId==="runners"&&m.survival.raiders.length===4&&m.survival.raiders.filter(e=>e.fast).length===2&&m.survival.raiders.some(e=>e.role==="thrower")')
            # Day twenty: the wave has three throwers. One shoots over a real intact fence.
            q.evaluate('''m.state.calendarDay=19;m.state.worldTime=449.99;g.step(.02);g.step(12.1);
              for(const d of m.defenses.all())if(d.kind==='fence'&&d.hp===0)m.defenses.restore(d.id,60);
              Object.assign(a.player,{x:1600,y:1690,path:[],autoTimer:10000});
              if(m.coop){m.actors[1].player.room={x:240,y:280};w.coopViews.focus(0);}
              for(const e of m.survival.raiders)e.warning=10000;
              window.thrower=m.survival.raiders.find(e=>e.role==='thrower');Object.assign(thrower,{x:1870,y:1690,path:[],warning:0,windup:0,cooldown:0,attack:null});
              Object.assign(m.survival.monster,{x:2500,y:2500,path:[]});g.step(.5)''')
            assert q.evaluate('m.survival.wave.planId==="throwers"&&m.survival.raiders.filter(e=>e.role==="thrower").length===3&&!m.nav.clearSegment(thrower,a.player)&&m.survival.projectiles.some(p=>p.id.startsWith("raid-shot:"))&&w.enemyView.objects.has(thrower.id)')
            q.evaluate('window.shot=m.survival.projectiles.find(p=>p.id.startsWith("raid-shot:"));window.shotAge=shot.age;window.hpBefore=a.state.health')
            press(q,'b');q.evaluate('g.step(10)');assert q.evaluate('shot.age===shotAge');q.locator('[data-defense-close]').click();q.wait_for_function('!m.paused')
            q.evaluate('Object.assign(a.player,{x:1600,y:1830,path:[]});g.step(.8)')
            assert q.evaluate('a.state.health===hpBefore&&!m.survival.projectiles.includes(shot)&&m.survival.monster.invulnerable')
            # Same profile captured in the dawn report, with no second reward from viewing it.
            q.evaluate('for(const e of [...m.survival.raiders])m.survival.hit(e.id,10000,false);window.paid=a.state.coins;m.state.worldTime=599.99;g.step(.02)')
            press(q,'j');assert 'Обстрел' in q.locator('#journalDialog [data-raid-report]').inner_text();assert q.evaluate('a.state.coins===paid');close(q)
            q.evaluate('window.old=m;w.scene.restart();void 0');q.wait_for_function('lumberPhaser.core!==old&&lumberPhaser.scene.hudReady')
            assert q.evaluate('Object.values(lumberPhaser.core.state.campMilestones).every(n=>!n)&&lumberPhaser.core.survival.projectiles.length===0')
            assert not errors,errors
            print('PASS camp goals/readiness/raid profiles/thrower/pause/report/reset', 'mobile Canvas/dist' if mobile else 'co-op WebGL',flush=True)
            browser.close()
finally:server.shutdown()
