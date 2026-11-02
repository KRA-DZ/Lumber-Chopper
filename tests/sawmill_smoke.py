"""Only sawmill routes, native mouse/touch/E chopping, stock and streamed scenery."""

from functools import partial
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from threading import Thread
from shutil import which
from playwright.sync_api import sync_playwright
from helpers.browser_start import choose_hero

ROOT = Path(__file__).resolve().parents[1]


class Handler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def focus(q, expr):
    q.evaluate(
        "p=>{m.clearKeys();Object.assign(m.player,p,{path:[],moving:false,autoTimer:0,clickTimer:0});w.camera.stopFollow();w.camera.centerOn(p.x,p.y-80);g.step(0)}",
        q.evaluate(expr),
    )
    q.wait_for_timeout(150)
    q.evaluate("g.step(0)")


def tap(q, expr, mobile):
    q.locator("#game-frame").scroll_into_view_if_needed()
    x, y = q.evaluate(
        "p=>{const r=document.querySelector('canvas').getBoundingClientRect(),v=w.camera.worldView;return[r.x+(p.x-v.x)/v.width*r.width,r.y+(p.y-v.y)/v.height*r.height]}",
        q.evaluate(expr),
    )
    q.touchscreen.tap(x, y) if mobile else q.mouse.click(x, y)


server = ThreadingHTTPServer(("127.0.0.1", 0), partial(Handler, directory=str(ROOT)))
Thread(target=server.serve_forever, daemon=True).start()
try:
    with sync_playwright() as p:
        for mobile in (False, True):
            browser = p.chromium.launch(
                headless=True,
                executable_path=which("chromium"),
                args=["--no-sandbox"]
                + (
                    ["--disable-webgl"]
                    if mobile
                    else ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"]
                ),
            )
            ctx = browser.new_context(
                viewport={
                    "width": 390 if mobile else 1360,
                    "height": 844 if mobile else 1050,
                },
                is_mobile=mobile,
                has_touch=mobile,
            )
            q = ctx.new_page()
            q.set_default_timeout(60000)
            errors = []
            q.on("pageerror", lambda e: errors.append(str(e)))
            q.goto(
                f"http://127.0.0.1:{server.server_port}/"
                + ("dist/" if mobile else "phaser.html")
            )
            choose_hero(q, "woodcutter" if mobile else "traveler")
            q.evaluate(
                "window.g=lumberPhaser;window.w=g.scene;window.m=g.core;w.manual=true"
            )
            q.evaluate("""()=>{
                for(const id of ['1:0','1:1']) {
                    const gate=m.regions.frontiers().find(p=>p.region.id===id);
                    Object.assign(m.player,{x:gate.x,y:gate.y,path:[],autoTimer:10000});
                    m.state.maxWood=gate.region.cost;
                    for(let i=0;i<gate.region.cost;i++)m.forestry.addCargo(10);
                    for(let i=0;i<gate.region.cost+1;i++)g.step(.2);
                }
                m.state.maxWood=2;
                window.light=m.clearing.all[0];window.heavy=m.clearing.all[1];
            }""")
            print(
                "READY sawmill", "mobile Canvas/dist" if mobile else "WebGL", flush=True
            )
            assert q.evaluate(
                "m.regions.unlocked.has('1:1')&&w.textures.get('forest').getSourceImage().height<=2048"
            )
            q.locator("#mapButton").click()
            cell = q.locator('[data-region="1:1"]')
            assert "Заброшенная лесопилка" in cell.inner_text()
            assert "0/2" in cell.inner_text()
            cell.click()
            q.wait_for_function("!m.paused")
            assert q.evaluate(
                "m.player.targetY===m.world.locations.find(l=>l.regionId==='1:1').entrance.y"
            )

            # Real input selects an obstacle, swings the axe, then continues automatically.
            focus(q, "({x:light.x+48,y:light.y})")
            assert q.evaluate(
                "w.regionView.clearing.objects.has(light.id)&&w.regionView.locations.objects.size>10"
            )
            assert q.evaluate(
                "[...w.regionView.locations.objects.values()].filter(im=>im.getData('locationPart').startsWith('abandoned-sawmill/')).every(im=>im.frame.name!=='__MISSING')"
            )
            if not mobile:
                q.locator("#game-frame").screenshot(
                    path=str(ROOT / "docs/sawmill-beams.png")
                )
            tap(q, "light", mobile)
            assert q.evaluate(
                "m.clearingOrder===light.id&&m.clearing.hp(light)===5&&m.player.swing>0"
            )
            q.evaluate("for(let i=0;i<120;i++)m.update(.05);g.step(0)")
            assert q.evaluate(
                "m.clearing.hp(light)===0&&m.state.wood===2&&m.forestry.piles.get(light.id).count===1&&!w.regionView.clearing.objects.has(light.id)"
            )
            assert q.evaluate(
                "m.nav.clearSegment({x:light.x-48,y:light.y},{x:light.x+48,y:light.y})"
            )

            # A distant tap navigates to the heavy obstruction; pause preserves partial HP.
            focus(q, "({x:heavy.x-180,y:heavy.y+80})")
            tap(q, "heavy", mobile)
            assert q.evaluate(
                "m.clearingOrder===heavy.id&&m.player.path.length>0&&m.clearing.hp(heavy)===24"
            )
            q.evaluate("for(let i=0;i<40;i++)m.update(.05);g.step(0)")
            assert q.evaluate(
                "m.clearing.hp(heavy)<24&&m.clearing.hp(heavy)>0&&m.nav.isWalkable(m.player.x,m.player.y)"
            )
            before = q.evaluate("m.clearing.hp(heavy)")
            q.locator("#mapButton").click()
            q.evaluate("g.step(10)")
            assert q.evaluate("m.clearing.hp(heavy)") == before
            q.locator("[data-map-close]").click()
            q.wait_for_function("!m.paused")
            focus(q, "({x:heavy.x-48,y:heavy.y})")
            if mobile:
                tap(q, "heavy", True)
            else:
                q.keyboard.press("e")
            assert q.evaluate("m.clearing.hp(heavy)") == before - 1
            q.evaluate("for(let i=0;i<500;i++)m.update(.05);g.step(0)")
            assert q.evaluate(
                "m.clearing.hp(heavy)===0&&m.forestry.piles.get(heavy.id).count===6&&m.state.wood===2"
            )
            assert q.evaluate(
                "!w.regionView.clearing.objects.has(heavy.id)&&m.nav.clearSegment({x:heavy.x-48,y:heavy.y},{x:heavy.x+48,y:heavy.y})"
            )
            if not mobile:
                q.locator("#game-frame").screenshot(
                    path=str(ROOT / "docs/sawmill-cleared.png")
                )

            # Objects leave the renderer away from the sawmill; progress and ground stock remain.
            focus(q, "({x:1600,y:1720})")
            assert q.evaluate(
                "w.regionView.clearing.objects.size===0&&w.regionView.clearing.labels.size===0&&w.regionView.locations.objects.size===0"
            )
            focus(q, "({x:heavy.x-48,y:heavy.y})")
            assert q.evaluate(
                "m.clearing.hp(heavy)===0&&m.forestry.piles.get(heavy.id).count===6&&w.regionView.clearing.objects.size===0"
            )
            q.locator("#mapButton").click()
            assert "2/2" in q.locator('[data-region="1:1"]').inner_text()
            q.locator("[data-map-close]").click()
            q.wait_for_function("!m.paused")
            q.evaluate("window.old=m;w.scene.restart();void 0")
            q.wait_for_function("lumberPhaser.core!==old&&lumberPhaser.scene.hudReady")
            assert q.evaluate(
                "Object.keys(lumberPhaser.core.state.exploration.debrisHP).length===0&&lumberPhaser.core.forestry.piles.size===0&&lumberPhaser.core.regions.unlocked.size===1"
            )
            assert not errors, errors
            print(
                "PASS sawmill",
                "mobile Canvas/dist" if mobile else "WebGL",
                "map, native chop, route, pause, exact stock, streaming, fresh restart",
                flush=True,
            )
            ctx.close()
            browser.close()
finally:
    server.shutdown()
