"""Only new forest/swamp PNGs, chunk borders/streaming and audio gesture/pause."""
from functools import partial
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from threading import Thread
from shutil import which
from playwright.sync_api import sync_playwright
from helpers.browser_start import choose_hero, click_setting

ROOT = Path(__file__).resolve().parents[1]


class Handler(SimpleHTTPRequestHandler):
    def log_message(self, *args): pass


server = ThreadingHTTPServer(("127.0.0.1", 0), partial(Handler, directory=str(ROOT)))
Thread(target=server.serve_forever, daemon=True).start()
try:
    with sync_playwright() as p:
        for mobile in (False, True):
            browser = p.chromium.launch(headless=True, executable_path=which("chromium"), args=["--no-sandbox"] +
                (["--disable-webgl"] if mobile else ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"]))
            context = browser.new_context(viewport={"width": 390 if mobile else 1360, "height": 844 if mobile else 1050}, is_mobile=mobile, has_touch=mobile)
            q = context.new_page(); errors = []
            q.on("pageerror", lambda e: errors.append(str(e)))
            q.goto(f"http://127.0.0.1:{server.server_port}/" + ("dist/" if mobile else "index.html"))
            choose_hero(q)
            q.evaluate("""()=>{window.g=lumberPhaser;window.w=g.scene;window.m=g.core;w.manual=true;
              for(const id of ['1:0','0:1']){const r=m.regions.all.find(r=>r.id===id);m.regions.unlocked.add(id);m.world.generate(r)}
              m.nav.rebuildObstacles();m.player.autoTimer=10000;w.camera.stopFollow();g.step(0)}""")
            assert q.evaluate("!w.audio.context&&w.assets.decor.manifest.sources.length===3&&w.textures.get('forest').getSourceImage().height<=2048")
            # Compare the baked pixels on both sides of a chunk border with the global sampler.
            assert q.evaluate("""async()=>{const {sampleNaturalGround,prepareGroundMaterials}=await import('./game/ground-surfaces.js');
              for(const y of [2558,2560]){const x=1100,c=w.terrain.source.getChunk(Math.floor(x/256),Math.floor(y/256)),
                actual=[...c.getContext('2d').getImageData((x%256)/2,(y%256)/2,1,1).data].slice(0,3),
                expected=[...new Uint8ClampedArray(sampleNaturalGround(prepareGroundMaterials(w.registry.get('biomePack').materials),x/2,y/2))];
                if(actual.join()!==expected.join())return false}return true}""")
            for id in ("1:0", "0:1"):
                q.evaluate("""id=>{const p=m.world.biomeDetails.get(id)[0];Object.assign(m.player,m.nav.nearestGround(p.x,p.y+75),{path:[]});w.camera.centerOn(p.x,p.y);for(let i=0;i<10;i++)g.step(.05)}""", id)
                q.wait_for_timeout(100); q.evaluate("g.step(0)")
                assert q.evaluate("""id=>{const list=w.regionView.objects.get(id).filter(o=>o.getData('biomeDetail'));
                  return list.length===m.world.biomeDetails.get(id).length&&list.every(o=>o.frame.name.startsWith('habitat.')&&!o.input)}""", id)
                if not mobile: q.locator("#game-frame").screenshot(path=str(ROOT / f"docs/atmosphere-{'forest' if id=='1:0' else 'swamp'}.png"))
            q.evaluate("Object.assign(m.player,{x:1100,y:2560,path:[]});w.camera.centerOn(1100,2500);g.step(0)")
            q.wait_for_timeout(100); q.evaluate("g.step(0)")
            q.locator("#game-frame").screenshot(path=str(ROOT / f"docs/atmosphere-transition-{'mobile' if mobile else 'desktop'}.png"))
            click_setting(q, "#sound")
            q.wait_for_function("w.audio.context?.state==='running'")
            for id, cue in (("0:1", "frog"), ("1:0", "bird")):
                q.evaluate("id=>{const r=m.regions.all.find(r=>r.id===id);Object.assign(m.player,m.nav.nearestGround(r.cx,r.cy+400),{path:[]});m.state.worldTime=120;g.step(8)}", id)
                assert q.evaluate("w.audio.ambience.kind") == cue
                assert q.evaluate("w.audio.activeVoices<=12")
                q.wait_for_timeout(450)
            q.evaluate("""()=>{m.state.worldTime=299.99;g.step(.02);g.step(3.1);m.state.worldTime=450;
              for(const e of m.survival.residents)e.moving=false;
              Object.assign(m.survival.minions[0],{x:m.player.x-210,y:m.player.y,moving:true,warning:0});
              Object.assign(m.survival.monster,{x:m.player.x+900,y:m.player.y+900});
              w.audio.update(10,m,w.atmosphere.weather.profile)}""")
            assert q.evaluate("w.audio.ambience.kind==='steps'&&w.audio.ambience.pan<0&&w.audio.activeVoices<=12")
            q.locator("#menuButton").click()
            q.wait_for_function("w.audio.context.state==='suspended'")
            before = q.evaluate("JSON.stringify(w.audio.ambience)")
            q.evaluate("g.step(9)")
            assert q.evaluate("JSON.stringify(w.audio.ambience)") == before
            q.locator("[data-menu-close]").click()
            q.wait_for_function("w.audio.context.state==='running'")
            # Moving away removes whole region decoration lists; ground caches stay bounded.
            q.evaluate("Object.assign(m.player,{x:1600,y:1200,path:[]});w.camera.centerOn(1600,1100);g.step(0)")
            assert q.evaluate("!w.regionView.objects.has('0:1')&&w.terrain.images.size<=24&&w.terrain.source.cachedChunks<=28")
            click_setting(q, "#sound")
            q.wait_for_function("w.audio.context.state==='suspended'")
            q.evaluate("window.old=m;w.scene.restart();void 0")
            q.wait_for_function("lumberPhaser.core!==old&&lumberPhaser.scene.hudReady")
            assert q.evaluate("!lumberPhaser.scene.audio.context&&lumberPhaser.scene.assets.meta.has('habitat.swampRoots')")
            assert not errors, errors
            print("PASS forest/swamp props, ground seam, streaming, audio gesture/pause/restart", "mobile Canvas/dist" if mobile else "desktop WebGL", flush=True)
            context.close(); browser.close()
finally:
    server.shutdown()
