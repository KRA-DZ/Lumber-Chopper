"""Only new stream/ford terrain, real keyboard/touch crossing, cart cargo and old low water."""
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
        for mobile in ([True] if "--mobile-only" in __import__("sys").argv else [False,True]):
            browser=p.chromium.launch(headless=True,executable_path=which('chromium'),args=['--no-sandbox']+(['--disable-webgl'] if mobile else ['--use-angle=swiftshader','--enable-unsafe-swiftshader']))
            q=browser.new_page(viewport={'width':390 if mobile else 1360,'height':844 if mobile else 1050},is_mobile=mobile,has_touch=mobile);errors=[]
            q.on('pageerror',lambda e:errors.append(str(e)))
            q.goto(f'http://127.0.0.1:{server.server_port}/'+('dist/' if mobile else ''))
            q.wait_for_selector('#heroDialog[open]');q.locator(f'[name=players][value="{1 if mobile else 2}"]').check();choose_hero(q)
            q.evaluate('''window.g=lumberPhaser;window.w=g.scene;window.m=g.core;window.a=m.actors?.[0]||m;w.manual=true;
              for(const a of m.actors||[m])Object.assign(a.player,{x:832,y:1890,path:[],autoTimer:10000});
              const r=m.regions.all.find(r=>r.id==='-1:0');m.regions.unlocked.add(r.id);m.state.unlockedRegions.push(r.id);m.world.generate(r);for(const a of m.actors||[m])a.refreshWorld();
              m.state.sawmill.cart.built=true;Object.assign(m.state.sawmill.cart,{x:832,y:1890,logs:[7,12]});a.sawmill.freight.attach();g.step(0);
              window.rgb=(x,y)=>{const cx=Math.floor(x/256),cy=Math.floor(y/256),im=w.terrain.source.getChunk(cx,cy);return [...im.getContext('2d').getImageData(Math.floor((x-cx*256)/2),Math.floor((y-cy*256)/2),1,1).data].slice(0,3);};
              window.water=(x,y)=>{const pack=w.registry.get('biomePack').materials.water,i=(((Math.floor(y/2)%64+64)%64)*64+(Math.floor(x/2)%64+64)%64)*4;return [...pack.slice(i,i+3)];};''')
            assert q.evaluate('JSON.stringify(rgb(650,1980))===JSON.stringify(water(650,1980))&&!a.nav.isWalkable(650,1980)')
            assert q.evaluate('JSON.stringify(rgb(832,1963))!==JSON.stringify(water(832,1963))&&a.nav.isWalkable(832,1963)')
            assert q.evaluate('[...w.regionView.objects.values()].flat().some(i=>i.getData("streamFord")==="camp-stream-ford")')
            if mobile:q.evaluate("w.camera.stopFollow();w.camera.centerOn(832,1963);w.camera.preRender();g.step(0)")
            q.wait_for_timeout(650)
            if mobile:
                point=q.evaluate('(()=>{const c=w.camera;return{x:(832-c.worldView.x)*c.zoom,y:(2035-c.worldView.y)*c.zoom,width:w.scale.width,height:w.scale.height}})()')
                box=q.locator('canvas').first.bounding_box();q.touchscreen.tap(box['x']+point['x']*box['width']/point['width'],box['y']+point['y']*box['height']/point['height']);q.evaluate('g.step(2)')
            else:
                q.keyboard.down('s');q.evaluate('g.step(1)');q.keyboard.up('s')
            assert q.evaluate('a.player.y>2030&&m.state.sawmill.cart.logs.join()==="7,12"&&Math.abs(m.state.sawmill.cart.y-a.player.y)<.1'),q.evaluate('({player:a.player,cart:m.state.sawmill.cart,notice:m.notice})')
            q.locator('#game-frame').screenshot(path=str(ROOT/f'docs/camp-stream-{"mobile" if mobile else "coop"}.png'))
            # Paint and collision must agree after the old dam changes level as well.
            q.evaluate('m.state.worldWorks.level="low";m.state.worldWorks.revision++;g.step(0)')
            assert q.evaluate('JSON.stringify(rgb(-960,900))===JSON.stringify(water(-960,900))&&m.world.inWater(-960,900)')
            assert q.evaluate('w.terrain.images.size<=(m.coop?40:24)&&w.terrain.source.cachedChunks<=w.terrain.source.maxChunks+20')
            assert not errors,errors
            print('PASS stream/ford pixels, real crossing, cart and low-water geometry',mobile,flush=True);browser.close()
finally:server.shutdown()
