"""Only the fortress outpost: native ignite/refill/cook, mask, pause, fuel expiry and restart."""
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


def click(q, selector, mobile):
    q.locator(selector).tap() if mobile else q.locator(selector).click()


def click_fire(q, mobile):
    point = q.evaluate("""()=>{const box=w.game.canvas.getBoundingClientRect(),v=w.camera.worldView;
      return {x:box.x+(site.x-v.x)/v.width*box.width,y:box.y+(site.y-12-v.y)/v.height*box.height}}""")
    q.touchscreen.tap(**point) if mobile else q.mouse.click(**point)
    q.wait_for_selector("#activityDialog[open]")


server = ThreadingHTTPServer(("127.0.0.1", 0), partial(Handler, directory=str(ROOT)))
Thread(target=server.serve_forever, daemon=True).start()
try:
    with sync_playwright() as p:
        for mobile in (False, True):
            b = p.chromium.launch(headless=True, executable_path=which("chromium"), args=["--no-sandbox"] +
                (["--disable-webgl"] if mobile else ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"]))
            ctx = b.new_context(viewport={"width": 390 if mobile else 1360, "height": 844 if mobile else 1050}, is_mobile=mobile, has_touch=mobile)
            q = ctx.new_page(); errors = []
            q.on("pageerror", lambda e: errors.append(str(e)))
            q.goto(f"http://127.0.0.1:{server.server_port}/" + ("dist/" if mobile else "index.html"))
            choose_hero(q)
            q.evaluate("""()=>{window.g=lumberPhaser;window.w=g.scene;window.m=g.core;w.manual=true;
              window.id='fortress-last-fire';window.site=m.exploration.get(id);
              const r=m.regions.all.find(r=>r.id===site.regionId);m.regions.unlocked.add(r.id);m.world.generate(r);m.nav.rebuildObstacles();
              Object.assign(m.player,{x:site.x,y:site.y+40,path:[],autoTimer:10000,moving:false});
              w.camera.stopFollow();w.camera.centerOn(site.x,site.y-60);m.state.worldTime=450;g.step(0);
              window.maskAlpha=()=>{const a=w.atmosphere, v=w.camera.worldView,
                factor=w.effectsLight?4:2, x=Math.floor((site.x-160-v.x)/factor),y=Math.floor((site.y-v.y)/factor);
                return a.mask.getContext().getImageData(x,y,1,1).data[3]};
            }""")
            q.wait_for_timeout(150); q.evaluate("g.step(0)")
            assert q.evaluate("maskAlpha()>240&&!m.outposts.lit(id)&&!m.survival.isSafe(m.player)")
            click_fire(q, mobile)
            assert q.locator("[data-activity-action=stoke-fire]").is_disabled()
            assert q.locator("[data-activity-action=cook-fish]").is_disabled()
            click(q, "[data-activity-close]", mobile)
            q.wait_for_function("!m.paused")
            q.evaluate("m.forestry.addCargo(10);m.forestry.addCargo(20);m.state.health=90;m.state.exploration.items.fish=2;g.step(0)")
            click_fire(q, mobile)
            click(q, "[data-activity-action=stoke-fire]", mobile)
            assert q.evaluate("m.state.wood===0&&m.state.cargoValue===0&&m.outposts.remaining(id)===120&&m.survival.isSafe(m.player)&&maskAlpha()<40")
            assert q.evaluate("w.regionView.locations.objects.get(id).frame.name.startsWith('fire.')")
            click(q, "[data-activity-action=cook-fish] img", mobile)
            assert q.evaluate("m.state.health===100&&m.state.exploration.items.fish===1")
            assert q.locator("[data-activity-action=cook-fish]").is_disabled()
            q.evaluate("g.step(10)")
            assert q.evaluate("m.outposts.remaining(id)===120")
            q.locator("#activityDialog").screenshot(path=str(ROOT / f"docs/outpost-menu-{'mobile' if mobile else 'desktop'}.png"))
            click(q, "[data-activity-close]", mobile)
            q.wait_for_function("!m.paused")
            # A zero-time render fixture keeps the light inspection separate from enemy-wave tests.
            q.evaluate("m.forestry.addCargo(10);g.step(0)")
            click_fire(q, mobile)  # The enlarged burning frame must still accept native taps.
            click(q, "[data-activity-action=stoke-fire]", mobile)
            assert q.evaluate("m.outposts.remaining(id)===180&&m.state.wood===0")
            assert q.locator("[data-activity-action=stoke-fire]").is_disabled()
            click(q, "[data-activity-close]", mobile)
            q.wait_for_function("!m.paused")
            q.locator("#game-frame").screenshot(path=str(ROOT / f"docs/outpost-night-{'mobile' if mobile else 'desktop'}.png"))
            # Streamed rendering may disappear; the model continues burning the same fuel.
            q.evaluate("Object.assign(m.player,{x:1600,y:1780,path:[]});w.camera.centerOn(1600,1700);g.step(1)")
            assert q.evaluate("!w.regionView.locations.objects.has(id)&&m.outposts.remaining(id)<180&&m.outposts.remaining(id)>178.9")
            q.evaluate("Object.assign(m.player,{x:site.x,y:site.y+40,path:[]});w.camera.centerOn(site.x,site.y-60);m.state.exploration.outpostFuel[id]=.01;g.step(.05)")
            q.wait_for_timeout(100); q.evaluate("g.step(0)")
            assert q.evaluate("!m.outposts.lit(id)&&!m.survival.isSafe(m.player)&&maskAlpha()>240&&w.regionView.locations.objects.get(id).frame.name==='fortress.coldFire'")
            q.evaluate("window.old=m;w.scene.restart();void 0")
            q.wait_for_function("lumberPhaser.core!==old&&lumberPhaser.scene.hudReady")
            assert q.evaluate("Object.keys(lumberPhaser.core.state.exploration.outpostFuel).length===0&&lumberPhaser.scene.outpostView.labels.size===0")
            assert not errors, errors
            print("PASS temporary outpost", "mobile Canvas/dist" if mobile else "desktop WebGL", "native fire/refill/cook, light/pause/stream/expiry/restart", flush=True)
            ctx.close(); b.close()
finally:
    server.shutdown()
