"""Targeted role presentation check: existing art, HP, names, renderer and mobile input."""
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
        for mobile in [False,True]:
            browser=p.chromium.launch(headless=True,executable_path=which('chromium'),args=['--no-sandbox']+(['--disable-webgl'] if mobile else ['--use-angle=swiftshader','--enable-unsafe-swiftshader']))
            q=browser.new_page(viewport={'width':390 if mobile else 1360,'height':844 if mobile else 900},is_mobile=mobile,has_touch=mobile);errors=[]
            q.on('pageerror',lambda e:errors.append(str(e)))
            q.goto(f'http://127.0.0.1:{server.server_port}/'+('dist/' if mobile else ''));choose_hero(q)
            q.evaluate('''window.g=lumberPhaser;window.w=g.scene;window.m=g.core;w.manual=true;
              const r=m.regions.all.find(r=>r.id==='1:0');m.regions.unlocked.add(r.id);m.world.generate(r);m.refreshWorld();
              Object.assign(m.player,m.nav.nearestGround(r.cx,r.cy),{path:[],autoTimer:10000});g.step(3.2);
              window.roles=['melee','heavy','ranged'].map(role=>m.survival.minions.find(e=>e.role===role));
              if(roles.some(e=>!e))throw Error('Missing role');
              for(const [i,e] of roles.entries())Object.assign(e,{x:m.player.x+(i-1)*100,y:m.player.y-50,warning:0,stun:1000,path:[]});g.step(0)''')
            assert q.evaluate('roles.map(e=>e.maxHP).join()===\'6,12,4\'')
            assert q.evaluate("roles.every((e,i)=>w.enemyView.objects.get(e.id).label.text.includes(['Преследователь','Громила','Метатель'][i]))")
            assert q.evaluate('w.enemyView.objects.get(roles[1].id).image.scaleX>w.enemyView.objects.get(roles[0].id).image.scaleX')
            assert q.evaluate('roles.every(e=>w.combatView.labels.get("enemy:"+e.id).text.includes(e.maxHP+"/"+e.maxHP+" HP"))')
            assert not errors,errors
            print('PASS three roles, names, existing textures and overhead HP', 'mobile Canvas build' if mobile else 'desktop WebGL',flush=True)
            browser.close()
finally:server.shutdown()
