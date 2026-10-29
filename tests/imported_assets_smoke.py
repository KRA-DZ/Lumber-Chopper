"""PNG loader/atlas integration, alpha hit testing, fire anchors, restart/fallback."""

from functools import partial
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from threading import Thread
from shutil import which
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]


class Handler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


server = ThreadingHTTPServer(("127.0.0.1", 0), partial(Handler, directory=str(ROOT)))
Thread(target=server.serve_forever, daemon=True).start()
url = f"http://127.0.0.1:{server.server_port}/"


def ready(q):
    q.wait_for_function("!!window.lumberPhaser?.scene.hudReady")
    q.evaluate("window.g=lumberPhaser;window.w=g.scene;window.m=g.core;w.manual=true")


def point(q, x, y):
    return q.evaluate(
        """([x,y])=>{const r=document.querySelector('canvas').getBoundingClientRect(),v=w.camera.worldView;return [r.left+(x-v.x)/g.game.scale.width*r.width,r.top+(y-v.y)/g.game.scale.height*r.height]}""",
        [x, y],
    )


try:
    with sync_playwright() as p:
        for canvas in (False, True):
            b = p.chromium.launch(
                headless=True,
                args=["--no-sandbox"]
                + (
                    ["--disable-webgl"]
                    if canvas
                    else ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"]
                ),
                **({"executable_path": which("chromium")} if which("chromium") else {}),
            )
            context = b.new_context(viewport={"width": 1360, "height": 1050})
            q = context.new_page()
            errors = []
            q.on("pageerror", lambda e: errors.append(e.stack))
            q.goto(url + ("dist/" if canvas else "phaser.html"))
            ready(q)
            assert q.evaluate(
                'w.assets.art.style==="generated-camp-png"&&Object.keys(g.game.registry.get("importedPack").images).length===6&&g.game.textures.getTextureKeys().every(k=>!k.startsWith("import."))'
            )
            assert q.evaluate(
                """()=>{const a=w.assets.art.sprites;return a.trees.birch.every(s=>s.mask.some(a=>a===0)&&s.mask.some(a=>a===255))&&a.fire.every(s=>s.height===a.unlitFire.height&&s.ay===a.unlitFire.ay)}"""
            )
            q.evaluate(
                'window.tree=m.trees.find(t=>t.type==="birch"&&m.nav.isWalkable(t.x+46,t.y+38));m.player.x=tree.x+46;m.player.y=tree.y+38;m.player.path=[];m.player.clickTimer=0;m.player.autoTimer=1;window.hp=tree.hp;g.step(0)'
            )
            q.wait_for_timeout(50)
            x, y = point(q, q.evaluate("tree.x"), q.evaluate("tree.y-18"))
            q.mouse.click(x, y)
            assert q.evaluate("tree.hp===hp-1")
            q.evaluate("while(tree.hp>0)m.hitTree(tree);g.step(0)")
            assert q.evaluate(
                'w.treeObjects.get(tree.id).image.frame.name==="stump"&&m.forestry.piles.has(tree.id)'
            )
            q.evaluate(
                "m.state.campLevel=2;m.state.buildWood=0;m.nav.rebuildObstacles();m.player.x=1640;m.player.y=1680;m.player.path=[];g.step(0)"
            )
            assert q.evaluate(
                'Math.abs(w.fire.originY-w.assets.meta.get("fire.0").originY)<.001'
            )
            if not canvas:
                q.wait_for_timeout(1200)
                q.locator("#game-frame").screenshot(
                    path=str(ROOT / "docs/png-assets-camp.png")
                )
            q.evaluate(
                """const gate=m.regions.frontiers().find(g=>g.region.id==='0:1');m.player.x=gate.x;m.player.y=gate.y;m.player.path=[];m.state.maxWood=12;while(m.state.wood)m.forestry.takeCargo();for(let i=0;i<12;i++)m.forestry.addCargo(10);for(let i=0;i<13;i++)g.step(.2);m.player.x=m.world.merchant.x-150;m.player.y=m.world.merchant.y+90;m.player.path=[];g.step(0)"""
            )
            assert q.evaluate(
                'w.merchant.visible&&w.merchantTent.visible&&w.merchantTent.frame.name==="merchantTent"'
            )
            if not canvas:
                q.wait_for_timeout(100)
                q.locator("#game-frame").screenshot(
                    path=str(ROOT / "docs/png-assets-merchant.png")
                )
            q.evaluate("window.oldCore=m;w.scene.restart();void 0")
            q.wait_for_function(
                "lumberPhaser.core!==oldCore&&lumberPhaser.scene.hudReady"
            )
            ready(q)
            assert q.evaluate(
                'w.assets.art.style==="generated-camp-png"&&g.game.registry.get("importedPack").images.birch.naturalWidth>0'
            )
            if not canvas:
                requests = []
                q.on("request", lambda r: requests.append(r.url))
                q.goto(url + "phaser.html?art=procedural")
                ready(q)
                assert q.evaluate(
                    'w.assets.art.style==="forest-ledger"&&!g.game.registry.get("importedPack")'
                )
                assert not any("/src/assets/" in r for r in requests)
            assert not errors, errors
            print(
                "PASS imported PNGs",
                "Canvas dist" if canvas else "WebGL",
                "loader, native atlas, alpha hit test, fire anchors, merchant house, restart, procedural fallback",
                flush=True,
            )
            context.close()
            b.close()
finally:
    server.shutdown()
