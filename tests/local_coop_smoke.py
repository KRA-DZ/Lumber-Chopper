"""Local keyboard co-op only: mode, independent input/accounts, split/merge, two night masks and revival."""
from functools import partial
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import json
import sys
from threading import Thread
from shutil import which
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]


class Handler(SimpleHTTPRequestHandler):
    def log_message(self, *args): pass


def measure_load(q):
    q.evaluate((ROOT / 'tests/helpers/coop_load.js').read_text())
    measurements = []
    for light in (False, True):
        if q.evaluate('w.effectsLight') != light:
            q.evaluate("document.querySelector('#effectsBtn').click()")
        q.wait_for_timeout(1000)
        q.evaluate('samples.cpu=[];samples.frames=[];samples.on=true')
        q.wait_for_timeout(3000)
        measurements.append(q.evaluate("""()=>{samples.on=false;
          const stats=v=>{const a=[...v].sort((a,b)=>a-b);return {count:a.length,
            medianMs:a[Math.floor(a.length*.5)],p95Ms:a[Math.floor(a.length*.95)]}};
          return {light:w.effectsLight,cpu:stats(samples.cpu),raf:stats(samples.frames),
            cameras:w.coopCamera.cameras().length,logs:w.coopViews.entries.reduce((n,e)=>n+e.cargo.filter(l=>l.visible).length,0),
            raiders:m.survival.raiders.length,minions:m.survival.minions.length,bosses:m.survival.regionalBosses.length,
            worldTime:m.state.worldTime,watcher:!!m.survival.monster,terrain:w.terrain.images.size,sourceChunks:w.terrain.source.cachedChunks,
            crowns:w.crownOcclusion.entries.size,textures:w.textures.getTextureKeys().length,
            paused:m.paused,gameOver:m.state.gameOver}}"""))
    for row in measurements:
        assert row['cameras'] == 2 and row['logs'] == 164 and row['watcher'], row
        assert row['terrain'] <= 40 and row['sourceChunks'] <= 28 and row['crowns'] <= 16, row
        assert row['raiders'] == 8 and row['minions'] == 12 and 0 < row['bosses'] <= 6, row
        assert 450 < row['worldTime'] < 500 and row['cpu']['count'] > 0 and not row['paused'] and not row['gameOver'], row
    (ROOT / 'docs/coop-performance.json').write_text(json.dumps({
        'environment': 'Headless Chromium, SwiftShader WebGL, 1360x1100 browser viewport',
        'fixture': 'Two separated moving heroes, 164 logs, 3x3 regions, night 30, synthetic rain; 1s warmup + 3s sample per setting',
        'limits': 'CPU is scene update only; RAF includes software rendering and is not real-device FPS.',
        'measurements': measurements}, indent=2) + '\n')


server = ThreadingHTTPServer(("127.0.0.1", 0), partial(Handler, directory=str(ROOT)))
Thread(target=server.serve_forever, daemon=True).start()
try:
    with sync_playwright() as p:
        for canvas in ((False,) if "--performance-only" in sys.argv else (False, True)):
            browser = p.chromium.launch(headless=True, executable_path=which("chromium"), args=["--no-sandbox"] +
                (["--disable-webgl"] if canvas else ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"]))
            ctx = browser.new_context(viewport={"width": 1360, "height": 1100})
            q = ctx.new_page(); errors = []
            q.on("pageerror", lambda e: errors.append(str(e)))
            q.goto(f"http://127.0.0.1:{server.server_port}/" + ("dist/" if canvas else "index.html"))
            q.wait_for_selector("#heroDialog[open]")
            q.locator('input[name=players][value="2"]').check()
            q.locator('[data-hero-start]').click()
            q.wait_for_function("window.lumberPhaser?.scene.hudReady", timeout=60000)
            q.evaluate("window.g=lumberPhaser;window.w=g.scene;window.m=g.core;window.a=m.actors[0];window.b=m.actors[1];w.manual=true;g.step(0);void 0")
            assert q.evaluate("m.coop&&m.actors.length===2&&w.coopViews.entries[1].player.frame.name.startsWith('coop2.')&&w.textures.get('forest').getSourceImage().height<=2048")
            assert q.locator("[data-coop-player]").count() == 2
            if "--performance-only" in sys.argv:
                measure_load(q); assert not errors, errors
                q.evaluate("w.manual=true;a.player.hitCooldown=0;m.party.focus(a);m.party.hurt(a.state.maxHealth,'watcher');g.step(.01)")
                assert q.evaluate("m.activeActor===1&&w.playerModel===b.player&&!m.state.gameOver")
                print("PASS two-camera synthetic load: full/light effects", flush=True)
                ctx.close(); browser.close(); continue
            # Both real keyboard inputs are held during the same deterministic simulation step.
            before = q.evaluate("[a.player.x,b.player.x,m.state.worldTime]")
            q.keyboard.down("d"); q.keyboard.down("ArrowLeft")
            q.evaluate("g.step(.4)")
            q.keyboard.up("d"); q.keyboard.up("ArrowLeft")
            after = q.evaluate("[a.player.x,b.player.x,m.state.worldTime]")
            assert after[0] > before[0] + 70 and after[1] < before[1] - 70, (before, after)
            assert abs(after[2] - before[2] - .4) < 1e-7
            q.evaluate("a.state.coins=100;b.state.coins=100;g.step(0)")
            q.locator('[data-coop-player="1"] [data-coop-action="shop"]').click()
            q.wait_for_selector('[data-player-shop="1"]')
            assert q.evaluate("!m.paused&&!a.player.menuOpen&&b.player.menuOpen&&m.activeActor===1")
            q.locator('[data-player-shop="1"] [data-personal-buy=carry]').click()
            assert q.evaluate("b.state.maxWood===4&&b.state.coins===65&&a.state.maxWood===2&&a.state.coins===100")
            snapshot = q.evaluate("m.state.worldTime")
            q.evaluate("g.step(1)")
            assert abs(q.evaluate("m.state.worldTime")-snapshot-1)<1e-7
            q.keyboard.press("Backspace", delay=70)
            assert q.evaluate("!m.paused&&!b.player.menuOpen")
            q.evaluate("""()=>{Object.assign(a.player,a.nav.nearestGround(1050,1900),{path:[],autoTimer:10000});
              Object.assign(b.player,b.nav.nearestGround(2250,1900),{path:[],autoTimer:10000});
              b.state.lanternLevel=4;m.state.worldTime=450;g.step(0)}""")
            q.wait_for_timeout(150); q.evaluate("g.step(0)")
            assert q.evaluate("w.coopCamera.split&&w.camera.width===w.scale.width/2&&w.coopCamera.second.visible&&w.coopCamera.second.worldView.contains(b.player.x,b.player.y)&&w.camera.worldView.contains(a.player.x,a.player.y)")
            mask = q.evaluate("""()=>{const probe=(camera,mask,p,offset=0)=>{const v=camera.worldView;
              return mask.getContext().getImageData(Math.floor((p.x+offset-v.x)/2),Math.floor((p.y-24-v.y)/2),1,1).data[3]};
              return [probe(w.camera,w.atmosphere.mask,a.player),probe(w.coopCamera.second,w.atmosphere.secondMask.mask,b.player),
                probe(w.camera,w.atmosphere.mask,a.player,180),probe(w.coopCamera.second,w.atmosphere.secondMask.mask,b.player,180)]}""")
            assert mask[0] < 20 and mask[1] < 20 and mask[2] > 240 and mask[3] < 200, mask
            point = q.evaluate("""()=>{window.destinationCalls=[0,0];for(const [i,c] of m.actors.entries()){
              const original=c.setDestination;c.setDestination=(...args)=>{destinationCalls[i]++;return original(...args)}}
              const box=w.game.canvas.getBoundingClientRect(),camera=w.coopCamera.second,v=camera.worldView;
              return {x:box.x+(camera.x+b.player.x-v.x)*box.width/w.scale.width,
                y:box.y+(camera.y+b.player.y+90-v.y)*box.height/w.scale.height}}""")
            q.mouse.click(**point)
            assert q.evaluate("destinationCalls[0]===0&&destinationCalls[1]>0")
            q.locator("#game-frame").screenshot(path=str(ROOT / f"docs/coop-split-{'canvas' if canvas else 'webgl'}.png"))
            # Alternate distant views without generating a rectangle of terrain between players.
            q.evaluate("for(let i=0;i<5;i++){a.player.y=1050+(i%2)*1000;b.player.y=2100-(i%2)*1000;g.step(0)}")
            assert q.evaluate("w.terrain.images.size<=40&&w.terrain.source.cachedChunks<=28&&w.crownOcclusion.entries.size<=16")
            q.evaluate("Object.assign(a.player,{x:1600,y:1780,path:[]});Object.assign(b.player,{x:1660,y:1780,path:[]});m.state.worldTime=120;g.step(0)")
            assert q.evaluate("!w.coopCamera.split&&w.camera.width===w.scale.width&&!w.coopCamera.second.visible&&!w.atmosphere.secondMask.shade.visible")
            q.evaluate("m.party.focus(a);m.party.hurt(100,'watcher');g.step(.01)")
            assert q.evaluate("a.state.health===0&&!m.state.gameOver&&m.activeActor===1&&w.playerModel===b.player")
            q.keyboard.down("Enter"); q.evaluate("g.step(1)")
            assert q.evaluate("a.state.health===0&&m.helpProgress(1)>.3")
            q.evaluate("g.step(2.2)"); q.keyboard.up("Enter")
            assert q.evaluate("a.state.health===35&&b.state.health===100&&!m.state.gameOver")
            q.locator("#game-frame").screenshot(path=str(ROOT / f"docs/coop-together-{'canvas' if canvas else 'webgl'}.png"))
            if not canvas:
                measure_load(q)
            # Scene restart keeps mode but releases cameras, masks, labels and duplicate DOM panels.
            q.evaluate("window.old=m;w.scene.restart();void 0")
            q.wait_for_function("lumberPhaser.core!==old&&lumberPhaser.scene.hudReady")
            assert q.locator("#coopPlayers").count() == 1
            assert q.evaluate("lumberPhaser.scene.cameras.cameras.length===2&&lumberPhaser.core.actors.every(a=>a.state.health===100&&a.state.coins===0&&a.state.wood===0)")
            assert not errors, errors
            print("PASS local co-op", "Canvas/dist" if canvas else "WebGL", "native controls/shop/revive, split/merge, dual masks, bounded streaming/restart", flush=True)
            ctx.close(); browser.close()
finally:
    server.shutdown()
