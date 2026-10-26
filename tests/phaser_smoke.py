"""Native Phaser integration: python tests/phaser_smoke.py (run npm run build first)."""

from functools import partial
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from threading import Thread
from shutil import which
import sys
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]


class Handler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


server = ThreadingHTTPServer(("127.0.0.1", 0), partial(Handler, directory=str(ROOT)))
Thread(target=server.serve_forever, daemon=True).start()
url = f"http://127.0.0.1:{server.server_port}/"


def ready(q):
    q.wait_for_function("!!window.lumberPhaser?.scene.hudReady", timeout=30000)
    q.evaluate("window.g=lumberPhaser;window.m=g.core;window.w=g.scene;w.manual=true")


def point(q, x, y):
    return q.evaluate(
        """([x,y])=>{const r=document.querySelector('canvas').getBoundingClientRect(),v=w.camera.worldView;return [r.left+(x-v.x)/g.game.scale.width*r.width,r.top+(y-v.y)/g.game.scale.height*r.height]}""",
        [x, y],
    )


def shot(q, name):
    q.wait_for_timeout(80)
    q.screenshot(path=f"/tmp/phaser-{name}.png", full_page=True)


try:
    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=True,
            args=[
                "--no-sandbox",
                "--use-angle=swiftshader",
                "--enable-unsafe-swiftshader",
            ],
            **({"executable_path": which("chromium")} if which("chromium") else {}),
        )
        for mobile in () if "--canvas-only" in sys.argv else (False, True):
            context = browser.new_context(
                viewport={
                    "width": 390 if mobile else 1360,
                    "height": 844 if mobile else 1050,
                },
                is_mobile=mobile,
                has_touch=mobile,
            )
            q = context.new_page()
            errors = []
            requests = []
            q.on("pageerror", lambda e: errors.append(str(e)))
            q.on(
                "console",
                lambda e: errors.append(e.text) if e.type == "error" else None,
            )
            q.on("request", lambda r: requests.append(r.url))
            q.goto(url + "phaser.html")
            ready(q)
            assert q.evaluate(
                'Phaser.VERSION==="3.90.0"&&g.renderer==="WebGL"&&w.player instanceof Phaser.GameObjects.Sprite&&w.treeObjects.values().next().value.image instanceof Phaser.GameObjects.Image'
            )
            assert q.evaluate(
                'm.state.maxWood===2&&m.state.coins===0&&m.trees.length===231&&g.game.textures.get("forest").frameTotal>150'
            )
            assert q.evaluate(
                """()=>{const a=document.querySelector('canvas').getBoundingClientRect(),b=document.querySelector('#game-viewport').getBoundingClientRect();return Math.abs(a.x-b.x)<1&&Math.abs(a.width-b.width)<1&&document.documentElement.scrollWidth<=innerWidth;}"""
            )
            # Keyboard, native animations, fixed heading and Phaser camera follow.
            q.evaluate(
                "m.player.x=1620;m.player.y=1760;m.player.path=[];w.renderModel()"
            )
            q.keyboard.down("d")
            q.evaluate("g.step(.2)")
            assert q.evaluate(
                "m.player.x>1650&&w.player.anims.isPlaying&&w.camera.rotation===0&&w.camera.zoom===1"
            )
            q.keyboard.up("d")
            q.evaluate("g.step(0)")
            target = q.evaluate("m.nav.nearestGround(1700,1770)")
            px, py = point(q, target["x"], target["y"])
            (q.touchscreen.tap if mobile else q.mouse.click)(px, py)
            q.evaluate("for(let i=0;i<160;i++)g.step(.03)")
            assert q.evaluate("p=>Math.hypot(m.player.x-p.x,m.player.y-p.y)<3", target)
            # Phaser's pixel hit-test, auto chopping and ground inventory use the real scene.
            tree = q.evaluate(
                """()=>{const t=m.trees.find(t=>t.size===2&&t.type==='oak'&&m.treeAccessible(t)&&m.nav.isWalkable(t.x+46,t.y+38));window.cut=t;m.player.x=t.x+46;m.player.y=t.y+38;m.player.path=[];m.player.autoTimer=1;m.player.clickTimer=0;w.renderModel();return {x:t.x,y:t.y-20,hp:t.hp};}"""
            )
            q.wait_for_timeout(50)
            px, py = point(q, tree["x"], tree["y"])
            (q.touchscreen.tap if mobile else q.mouse.click)(px, py)
            assert q.evaluate("cut.hp") == tree["hp"] - 1
            assert q.evaluate('w.axe.anims.currentAnim.key==="chop.0"')
            q.evaluate(
                "for(let i=0;i<300&&cut.hp>0;i++)g.step(.05);for(let i=0;i<10;i++)g.step(.1)"
            )
            assert q.evaluate(
                'm.state.wood===2&&m.forestry.piles.get(cut.id).count===1&&w.treeObjects.get(cut.id).image.frame.name==="stump"'
            )
            q.wait_for_timeout(1250)
            shot(q, "harvest-mobile" if mobile else "harvest")
            # No legacy full-scene Canvas draw is called while moving/rendering in Phaser.
            q.evaluate(
                "window.legacyDraws=0;const draw=w.assets.art.draw;w.assets.art.draw=(...args)=>{legacyDraws++;return draw(...args)};for(let i=0;i<20;i++)g.step(.016)"
            )
            assert q.evaluate("legacyDraws===0")
            q.evaluate(
                "for(let i=0;i<220;i++)g.step(.1);m.player.x=m.sale.x;m.player.y=m.sale.y;m.player.path=[];g.step(.2);g.step(.2)"
            )
            assert q.evaluate(
                "m.state.coins===20&&m.state.wood===0&&m.activeBuyer().load===2"
            )
            q.evaluate("m.player.x=1600;m.player.y=1760;g.step(0)")
            px, py = point(q, 1420, 1580)
            (q.touchscreen.tap if mobile else q.mouse.click)(px, py)
            assert q.locator("#shopDialog").is_visible()
            before = q.evaluate("m.state.worldTime")
            q.evaluate("g.step(5)")
            assert q.evaluate("m.state.worldTime") == before
            q.locator('[data-buy="carry"]').click()
            assert q.evaluate("m.state.maxWood===4&&m.state.coins===0")
            shot(q, "shop-mobile" if mobile else "shop")
            q.keyboard.press("Escape")
            q.wait_for_function("!m.paused")
            # Resize/orientation changes the view, preserving resources and the camera heading.
            q.set_viewport_size(
                {"width": 844 if mobile else 390, "height": 390 if mobile else 844}
            )
            q.wait_for_timeout(120)
            assert q.evaluate(
                "m.state.maxWood===4&&m.state.coins===0&&document.documentElement.scrollWidth<=innerWidth&&w.camera.rotation===0"
            )
            assert q.evaluate("g.game.scale.width") == (960 if mobile else 512)
            q.set_viewport_size(
                {"width": 390 if mobile else 1360, "height": 844 if mobile else 1050}
            )
            q.wait_for_timeout(120)
            # Construct all stages and verify native textures/colliders and bounded streaming.
            for level, cost in enumerate([10, 20, 35, 50], 1):
                q.evaluate(
                    """cost=>{m.state.maxWood=cost;for(let i=0;i<cost;i++)m.forestry.addCargo(10);m.player.x=m.build.x;m.player.y=m.build.y;m.player.path=[];for(let i=0;i<cost*3+5;i++)g.step(.1)}""",
                    cost,
                )
                assert q.evaluate("m.state.campLevel") == level
            assert q.evaluate(
                "w.hut.visible&&!w.tent.visible&&!m.nav.isWalkable(1680,1440)&&m.nav.isWalkable(630,1400)"
            )
            q.evaluate("m.player.x=1600;m.player.y=1690;m.player.path=[];g.step(0)")
            shot(q, "camp-mobile" if mobile else "camp")
            q.evaluate(
                """for(let i=0;i<16;i++){const a=i*Math.PI/8,p=m.nav.nearestGround(1600+Math.cos(a)*1200,1600+Math.sin(a)*1200);m.player.x=p.x;m.player.y=p.y;g.step(0)}"""
            )
            assert q.evaluate(
                'w.terrain.images.size<=28&&w.terrain.source.cachedChunks<=28&&g.game.textures.getTextureKeys().filter(k=>k.startsWith("terrain/")).length===w.terrain.images.size&&g.game.textures.getTextureKeys().length<128&&w.flights.size<=16'
            )
            # A scene restart must not duplicate shop cards/listeners or reuse old progress.
            q.evaluate("window.oldCore=m;w.scene.restart()")
            q.wait_for_function(
                "window.lumberPhaser?.core!==oldCore&&window.lumberPhaser?.scene.hudReady"
            )
            ready(q)
            assert q.evaluate(
                "m.state.maxWood===2&&m.state.wood===0&&m.state.coins===0&&m.state.campLevel===0&&g.game.textures.getTextureKeys().length<64"
            )
            assert q.locator("#shopDialog [data-buy]").count() == 5
            # Blur/focus is separate from the modal pause reason.
            q.evaluate('w.pause("shop",true);w.onBlur();w.onFocus()')
            assert q.evaluate("m.paused")
            q.evaluate('w.pause("shop",false)')
            assert q.evaluate("!m.paused")
            assert all(
                r.startswith(url) or r.startswith("data:") for r in requests
            ), requests
            assert not errors, errors
            print(
                "PASS Phaser WebGL",
                "mobile" if mobile else "desktop",
                "native sprites/input/camera, harvest/sale/shop, pause, resize, stages, bounded textures, restart, local requests",
                flush=True,
            )
            context.close()
        browser.close()
        # Real Canvas fallback, not a mocked renderer flag; load the production build entry.
        browser = p.chromium.launch(
            headless=True,
            args=["--no-sandbox", "--disable-webgl"],
            **({"executable_path": which("chromium")} if which("chromium") else {}),
        )
        q = browser.new_page()
        errors = []
        q.on("pageerror", lambda e: errors.append(str(e)))
        q.goto(url + "dist/")
        ready(q)
        assert q.evaluate('g.renderer==="Canvas"&&m.state.maxWood===2')
        assert q.locator("[data-legacy-link]").count() == 0
        q.keyboard.down("d")
        q.evaluate("g.step(.2)")
        q.keyboard.up("d")
        assert q.evaluate("m.player.x>1630")
        assert not errors, errors
        print("PASS static dist build in real Phaser Canvas fallback", flush=True)
        browser.close()
finally:
    server.shutdown()
