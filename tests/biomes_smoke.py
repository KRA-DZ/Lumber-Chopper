"""Generated PNG terrain, six regional creatures and strict territory in WebGL/Canvas."""

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
try:
    with sync_playwright() as p:
        for mode in ("desktop", "mobile", "canvas"):
            mobile = mode != "desktop"
            b = p.chromium.launch(
                headless=True,
                args=["--no-sandbox"]
                + (
                    ["--disable-webgl"]
                    if mode == "canvas"
                    else ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"]
                ),
                **({"executable_path": which("chromium")} if which("chromium") else {}),
            )
            ctx = b.new_context(
                viewport={
                    "width": 390 if mobile else 1360,
                    "height": 844 if mobile else 1050,
                },
                is_mobile=mobile,
                has_touch=mobile,
            )
            q = ctx.new_page()
            errors = []
            q.on("pageerror", lambda e: errors.append(str(e)))
            q.goto(
                f"http://127.0.0.1:{server.server_port}/"
                + ("dist/" if mode == "canvas" else "phaser.html")
            )
            q.wait_for_function("!!window.lumberPhaser?.scene.hudReady", timeout=60000)
            q.evaluate(
                "window.g=lumberPhaser;window.m=g.core;window.w=g.scene;w.manual=true;m.player.autoTimer=10000;g.step(0)"
            )
            print("READY biomes", mode, flush=True)
            q.evaluate(
                """()=>{m.state.maxWood=82;while(m.regions.unlocked.size<25){m.state.worldTime=120;const gate=m.regions.frontiers()[0];while(m.state.wood)m.forestry.takeCargo();for(let i=0;i<gate.region.cost;i++)m.forestry.addCargo(10);Object.assign(m.player,{x:gate.x,y:gate.y,path:[]});m.update(gate.region.cost*.21+.3);}m.state.worldTime=120;g.step(0)}"""
            )
            for biome, id in [
                ("field", "1:1"),
                ("swamp", "0:1"),
                ("forest", "1:0"),
                ("shore", "-1:0"),
                ("web", "2:1"),
                ("ruins", "0:-1"),
            ]:
                q.evaluate(
                    """id=>{window.r=m.regions.all.find(r=>r.id===id);m.state.worldTime=599.99;m.update(.02);m.state.worldTime=120;Object.assign(m.player,m.nav.nearestGround(r.cx,r.cy+180),{path:[]});w.expansionBanner=null;w.scene.get('Hud').banner.setVisible(false);g.step(0)}""",
                    id,
                )
                assert q.evaluate(
                    "w.terrain.images.size<=24&&w.terrain.source.cachedChunks<=28"
                )
                assert q.evaluate(
                    "w.assets.meta.has('enemy.doll.attack')&&w.assets.meta.has('biomeprop.web')"
                )
                if mode == "desktop":
                    q.locator("#game-frame").screenshot(
                        path=str(ROOT / f"docs/biome-{biome}.png")
                    )
                q.evaluate(
                    "m.state.worldTime=299.99;m.update(.02);m.update(3.2);g.step(0)"
                )
                assert q.evaluate(
                    "m.survival.residents.some(e=>e.regionId===r.id)&&m.survival.residents.length<=6"
                )
                q.evaluate(
                    "window.local=m.survival.residents.find(e=>e.regionId===r.id);Object.assign(m.player,m.nav.nearestGround(local.x,local.y+120),{path:[]});g.step(0)"
                )
                assert q.evaluate(
                    "w.enemyView.objects.get(local.id).image.frame.name.startsWith('enemy.')"
                )
                if mode == "desktop" and biome == "web":
                    q.locator("#game-frame").screenshot(
                        path=str(ROOT / "docs/biome-night-spider.png")
                    )
                # Map reports the real biome and stops clock/patrol.
                q.locator("#mapButton").click()
                before = q.evaluate("JSON.stringify(m.survival.residents)")
                q.evaluate("g.step(10)")
                assert q.evaluate("JSON.stringify(m.survival.residents)") == before
                assert biome in q.evaluate("r.biome")
                assert q.locator(f'[data-region="{id}"] span').inner_text()
                q.locator("[data-map-close]").click()
                q.wait_for_function("!m.paused")
                # Damage is routed through the same economic/combat command; no wave reward.
                coins = q.evaluate("m.state.coins")
                q.evaluate("m.survival.hit(local.id,100);g.step(0)")
                assert q.evaluate(
                    "!m.survival.residents.some(e=>e.id===local.id)&&!w.enemyView.objects.has(local.id)"
                )
                assert q.evaluate("m.state.coins") == coins
                q.evaluate("m.state.worldTime=599.99;m.update(.02);g.step(0)")
                assert q.evaluate("m.survival.residents.length===0")
            assert q.evaluate(
                "g.game.textures.get('forest').source[0].width===2048&&g.game.textures.get('forest').source[0].height===2048"
            )
            assert q.evaluate(
                "!g.game.textures.getTextureKeys().some(k=>k.startsWith('material.')||k.startsWith('enemy.')||k.startsWith('biomeprop.'))"
            )
            q.evaluate("window.old=m;w.scene.restart();void 0")
            q.wait_for_function(
                "window.lumberPhaser?.core!==old&&window.lumberPhaser?.scene.hudReady",
                timeout=60000,
            )
            assert q.evaluate(
                "lumberPhaser.core.survival.residents.length===0&&lumberPhaser.core.regions.unlocked.size===1"
            )
            assert not errors, errors
            print(
                "PASS biomes",
                mode,
                "six PNG materials/props/enemies, actual gates, bounded terrain, night/day, damage, map pause, atlas reuse and reset",
                flush=True,
            )
            ctx.close()
            b.close()
finally:
    server.shutdown()
