"""Targeted sleeping-worker visibility, dawn wake-up, new warehouse and room frame load."""
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
        browser=p.chromium.launch(executable_path=which('chromium'),headless=True,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        q=browser.new_page(viewport={'width':1280,'height':900});errors=[]
        q.on('pageerror',lambda e:errors.append(str(e)))
        q.goto(f'http://127.0.0.1:{server.server_port}/dist/');q.wait_for_selector('#heroDialog[open]');choose_hero(q)
        q.evaluate('''window.g=lumberPhaser;window.w=g.scene;window.c=g.core;w.manual=true;
            c.state.campBuildings={tent:true,fire:true,fence:true};c.state.campLevel=3;c.state.campFuel=600;c.state.coins=1000;c.refreshWorld();
            Object.assign(c.player,{x:1385,y:1858,path:[]});if(!c.workers.hire())throw Error('hire');
            Object.assign(c.player,{x:1450,y:1510});c.state.worldTime=391;
            for(let i=0;i<1000&&!c.workers.crew[0].sleeping;i++)g.step(.05);''')
        assert q.evaluate('c.workers.crew[0].sleeping&&w.workerView.sleepLabel.visible')
        assert q.evaluate('!w.workerView.objects.get(0).sprite.visible&&!w.workerView.objects.get(0).label.visible&&w.workerView.objects.get(0).logs.every(x=>!x.visible)')
        assert q.evaluate('w.assets.meta.has("interior.house")&&w.assets.meta.has("interior.bed")&&w.campServicesView.store.frame.name==="interior.warehouse"')
        q.screenshot(path='/tmp/workers-sleeping-tent.png')
        q.evaluate('c.state.worldTime=0;g.step(.1)')
        assert q.evaluate('!c.workers.crew[0].sleeping&&w.workerView.objects.get(0).sprite.visible&&!w.workerView.sleepLabel.visible')
        assert not errors,errors
        browser.close();print('PASS tent arrival, hidden cargo/sprite/name, dawn wake and generated frames')
finally:server.shutdown()
