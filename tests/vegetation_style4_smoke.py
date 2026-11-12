"""Only style-4 trees/bushes, cutting/growth, harvest and their atlas contracts."""
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
            q=browser.new_page(viewport={'width':390 if mobile else 1280,'height':844 if mobile else 900},is_mobile=mobile,has_touch=mobile);errors=[]
            q.on('pageerror',lambda e:errors.append(str(e)))
            q.goto(f'http://127.0.0.1:{server.server_port}/'+('dist/' if mobile else ''))
            q.wait_for_selector('#heroDialog[open]')
            if not mobile:q.locator('[name=players][value="2"]').check()
            choose_hero(q)
            q.evaluate('window.g=lumberPhaser;window.w=g.scene;window.m=g.core;window.a=m.actors?.[0]||m;w.manual=true;a.player.autoTimer=10000;g.step(0)')
            assert q.evaluate('w.registry.get("treePack").manifest.approvedVariant===4&&w.registry.get("plantPack").manifest.bushVariant===4&&w.textures.get("forest").getSourceImage().height<=2048')
            for kind in ['oak','spruce','birch','dead']:
                q.evaluate('''kind=>{window.tree=a.trees.find(t=>t.type===kind&&t.hp>0&&a.nav.isWalkable(t.x+58,t.y));if(!tree)throw Error('Missing walkable '+kind);Object.assign(a.player,{x:tree.x+58,y:tree.y,path:[]});if(m.coop)w.coopViews.focus(0);g.step(0);for(let i=0;tree.hp>0&&i<40;i++){a.player.clickTimer=0;a.hitTree(tree);}g.step(0)}''',kind)
                assert q.evaluate('w.treeObjects.get(tree.id).image.frame.name===`growth.${tree.type}.stump`&&a.forestry.piles.get(tree.id).count===(tree.size===2?3:2)')
                for stage in ['sprout','young','mature']:
                    q.evaluate('m.state.worldTime=599.99;g.step(.02)')
                    assert q.evaluate('stage=>stage==="mature"?tree.hp===tree.maxHp&&w.treeObjects.get(tree.id).image.input.enabled:w.treeObjects.get(tree.id).image.frame.name===`growth.${tree.type}.${stage}`',stage)
            q.evaluate('''window.b=a.world.berryBushes.find(b=>!b.decorative);Object.assign(a.player,a.nav.nearestGround(b.x,b.y+40),{path:[],autoTimer:10000});m.state.worldTime=120;if(m.coop){Object.assign(m.actors[1].player,a.nav.nearestGround(b.x+90,b.y+90),{path:[]});w.coopViews.focus(0);}g.step(0)''')
            q.keyboard.press('e');q.evaluate('g.step(0)')
            assert q.evaluate('a.state.exploration.items.berry===2&&w.plantsView.objects.get(b.id).image.frame.name==="plants.empty.0"')
            if not mobile:assert q.evaluate('!m.actors[1].berries.harvest(b.id)&&m.actors[1].state.exploration.items.berry===0')
            q.evaluate('m.state.worldTime=599.99;g.step(.02)')
            assert q.evaluate('w.plantsView.objects.get(b.id).image.frame.name==="plants.ripe.0"')
            q.screenshot(path=str(ROOT/f'docs/vegetation-style4-{ "mobile" if mobile else "desktop"}.png'))
            # The ancient sprite shares the same prepared pack; open just its region for inspection.
            q.evaluate('''const r=m.regions.all.find(r=>r.id==='1:0');m.regions.unlocked.add(r.id);m.world.generate(r);a.refreshWorld();Object.assign(a.player,a.nav.nearestGround(m.world.ancientTree.x,m.world.ancientTree.y+130),{path:[]});if(m.coop)Object.assign(m.actors[1].player,a.player,{path:[]});g.step(0)''')
            assert q.evaluate('w.ancient.visible&&w.ancient.frame.name==="ancient"')
            q.screenshot(path=f'/tmp/vegetation-ancient-{mobile}.png')
            assert not errors,errors
            print('PASS vegetation4 atlas, four species, cutting/growth, harvest and ancient oak',mobile,flush=True)
            browser.close()
finally:server.shutdown()
