"""Native-alpha trees, actual cutting/regrowth, restart and bounded WebGL/Canvas atlas."""

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


server = ThreadingHTTPServer(("127.0.0.1", 0), partial(Handler, directory=str(ROOT)))
Thread(target=server.serve_forever, daemon=True).start()
try:
    with sync_playwright() as p:
        for mode in ("desktop", "mobile", "canvas"):
            mobile = mode != "desktop"
            browser = p.chromium.launch(
                headless=True,
                executable_path=which("chromium"),
                args=["--no-sandbox"]
                + (
                    ["--disable-webgl"]
                    if mode == "canvas"
                    else ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"]
                ),
            )
            context = browser.new_context(
                viewport={
                    "width": 390 if mobile else 1360,
                    "height": 844 if mobile else 1050,
                },
                is_mobile=mobile,
                has_touch=mobile,
            )
            page = context.new_page()
            errors = []
            page.on("pageerror", lambda e: errors.append(str(e)))
            page.goto(
                f"http://127.0.0.1:{server.server_port}/"
                + ("dist/" if mode == "canvas" else "phaser.html")
            )
            choose_hero(page)
            page.evaluate(
                "window.g=lumberPhaser;window.m=g.core;window.w=g.scene;w.manual=true;m.player.autoTimer=10000;g.step(0)"
            )
            print("READY trees", mode, flush=True)
            assert page.evaluate(
                "w.assets.art.generatedTrees&&w.registry.get('treePack').manifest.approvedVariant===1"
            )
            assert page.evaluate(
                "w.textures.get('forest').getSourceImage().height<=2048&&!w.textures.exists('trees.source')"
            )
            if mode == "desktop":
                page.locator("#game-frame").screenshot(
                    path=str(ROOT / "docs/trees-camp.png")
                )
            for kind in ("oak", "spruce", "birch", "dead"):
                page.evaluate(
                    "kind=>{window.tree=m.trees.find(t=>t.type===kind&&t.hp>0&&m.nav.isWalkable(t.x+58,t.y));Object.assign(m.player,{x:tree.x+58,y:tree.y,path:[]});g.step(0)}",
                    kind,
                )
                assert page.evaluate(
                    "w.treeObjects.has(tree.id)&&w.treeObjects.get(tree.id).image.input.enabled"
                )
                page.evaluate(
                    "for(let i=0;tree.hp>0&&i<40;i++){m.player.clickTimer=0;m.hitTree(tree)}g.step(0)"
                )
                assert page.evaluate(
                    "w.treeObjects.get(tree.id).image.frame.name===`growth.${tree.type}.stump`&&!w.treeObjects.get(tree.id).image.input.enabled"
                )
                assert page.evaluate(
                    "m.forestry.piles.get(tree.id).count===(tree.size===2?3:2)"
                )
                for stage in ("sprout", "young", "mature"):
                    page.evaluate("m.state.worldTime=599.99;g.step(.02)")
                    if stage == "mature":
                        assert page.evaluate(
                            "tree.hp===tree.maxHp&&tree.cutDay===null&&w.treeObjects.get(tree.id).image.input.enabled"
                        )
                    else:
                        assert page.evaluate(
                            "stage=>tree.hp===0&&w.treeObjects.get(tree.id).image.frame.name===`growth.${tree.type}.${stage}`&&w.treeObjects.get(tree.id).image.scaleX===2",
                            stage,
                        )
                assert page.evaluate("w.terrain.images.size<=24")
            # Open the ancient-oak region through the real log payment.
            page.evaluate(
                "const gate=m.regions.frontiers().find(g=>g.region.id==='1:0');m.state.worldTime=120;m.state.maxWood=20;while(m.state.wood)m.forestry.takeCargo();for(let i=0;i<gate.region.cost;i++)m.forestry.addCargo(10);Object.assign(m.player,{x:gate.x,y:gate.y,path:[]});for(let i=0;i<15;i++)m.update(.2);Object.assign(m.player,m.nav.nearestGround(m.world.ancientTree.x,m.world.ancientTree.y+130),{path:[]});g.step(0)"
            )
            assert page.evaluate(
                "w.ancient.visible&&w.ancient.frame.name==='ancient'&&m.regions.unlocked.has('1:0')"
            )
            page.evaluate(
                "w.expansionBanner=null;const hud=w.scene.get('Hud');hud.tweens.killTweensOf(hud.banner);hud.banner.setVisible(false);void 0"
            )
            if mode == "desktop":
                page.locator("#game-frame").screenshot(
                    path=str(ROOT / "docs/trees-ancient.png")
                )
            page.evaluate("m.state.worldTime=450;g.step(.05)")
            assert page.evaluate("m.survival.residents.every(e=>e.maxHP===40)")
            if mode == "desktop":
                page.locator("#game-frame").screenshot(
                    path=str(ROOT / "docs/trees-night.png")
                )
            page.evaluate("window.previous=m;w.scene.restart();void 0")
            page.wait_for_function(
                "lumberPhaser.core!==previous&&lumberPhaser.scene.hudReady",
                timeout=60000,
            )
            assert page.evaluate(
                "lumberPhaser.core.state.coins===0&&lumberPhaser.scene.assets.art.generatedTrees"
            )
            assert not errors, errors
            print(
                "PASS trees",
                mode,
                "four species, cutting, three dawns, ancient oak, night, restart",
                flush=True,
            )
            context.close()
            browser.close()
finally:
    server.shutdown()
