"""Real regional navigation/deposits, streamed objects, camp comfort and story clues."""

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


def point(q, x, y):
    return q.evaluate(
        """([x,y])=>{const r=document.querySelector('canvas').getBoundingClientRect(),v=w.camera.worldView;return [r.left+(x-v.x)/g.game.scale.width*r.width,r.top+(y-v.y)/g.game.scale.height*r.height]}""",
        [x, y],
    )


def shot(q, name):
    q.wait_for_timeout(90)
    q.locator("#game-frame").screenshot(path=str(ROOT / f"docs/regions-{name}.png"))


try:
    with sync_playwright() as p:
        for mobile in (False, True):
            b = p.chromium.launch(
                headless=True,
                args=["--no-sandbox"]
                + (
                    ["--disable-webgl"]
                    if mobile
                    else ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"]
                ),
                **({"executable_path": which("chromium")} if which("chromium") else {}),
            )
            context = b.new_context(
                viewport={"width": 390 if mobile else 1360, "height": 1050},
                is_mobile=mobile,
                has_touch=mobile,
            )
            q = context.new_page()
            errors = []
            q.on("pageerror", lambda e: errors.append(e.stack))
            q.goto(url + ("dist/" if mobile else "phaser.html"))
            q.wait_for_function("!!window.lumberPhaser?.scene.hudReady")
            q.evaluate(
                "window.g=lumberPhaser;window.m=g.core;window.w=g.scene;w.manual=true;window.startTrees=m.trees.length;void 0"
            )
            assert q.evaluate(
                "m.state.unlockedRegions.length===1&&m.world.decorBins.size===1&&w.regionView.gates.size===4&&!w.ancient.visible&&!w.merchant.visible&&g.game.scale.width===(innerWidth<600?512:960)"
            )
            assert q.evaluate('w.scene.get("Hud").tutorial.text.startsWith("1/3")')
            assert q.evaluate(
                "Array.from(w.regionView.gates.values()).every(g=>g.objects[0].depth < -3200 && g.label.depth > 6400)"
            )
            # The large region map pauses time and offers an explicit walk-to-border action.
            q.locator("#mapButton").click()
            assert q.locator("#mapDialog").is_visible()
            assert q.locator("[data-regions] button").count() == 25
            assert q.locator("[data-regions] button:enabled").count() == 5
            if not mobile:
                q.locator("#mapDialog").screenshot(
                    path=str(ROOT / "docs/regions-map.png")
                )
            assert q.evaluate("document.documentElement.scrollWidth<=innerWidth")
            before = q.evaluate("m.state.worldTime")
            q.evaluate("g.step(3)")
            assert q.evaluate("m.state.worldTime") == before
            q.keyboard.press("Escape")
            q.wait_for_function("!m.paused")
            q.keyboard.press("m")
            q.locator('[data-region="1:0"]').click()
            q.wait_for_function("!m.paused")
            assert q.evaluate("m.player.path.length>0&&m.player.targetX===2488")
            # Click the real border sign: walk to the pad and pay two logs, keeping partial progress.
            q.evaluate(
                'window.gate=m.regions.frontiers().find(g=>g.region.id==="1:0");m.player.x=gate.x-95;m.player.y=gate.y;m.player.path=[];m.forestry.addCargo(10);m.forestry.addCargo(10);g.step(0)'
            )
            x, y = point(q, q.evaluate("gate.x"), q.evaluate("gate.y-65"))
            (q.touchscreen.tap if mobile else q.mouse.click)(x, y)
            q.evaluate("for(let i=0;i<80;i++)g.step(.05)")
            assert q.evaluate(
                'm.state.regionWood["1:0"]===2&&m.state.wood===0&&!m.nav.isWalkable(2600,1600)'
            )
            if not mobile:
                shot(q, "border")
            q.evaluate(
                "for(let trip=0;trip<5;trip++){m.forestry.addCargo(10);m.forestry.addCargo(10);for(let i=0;i<12;i++)g.step(.05)}"
            )
            assert q.evaluate(
                'm.regions.unlocked.has("1:0")&&m.state.regionWood["1:0"]===12&&m.trees.length>=startTrees+90&&m.nav.isWalkable(2600,1600)&&w.ancient.visible'
            )
            assert q.evaluate(
                'w.scene.get("Hud").banner.text.includes("Роща древнего дуба")'
            )
            q.evaluate("m.setDestination(2700,1600);for(let i=0;i<100;i++)g.step(.03)")
            assert q.evaluate("Math.abs(m.player.x-2700)<3&&m.player.x>2560")
            if not mobile:
                q.evaluate("m.player.x=3250;m.player.y=1570;m.player.path=[];g.step(0)")
                shot(q, "ancient")
            # Open other cardinal regions through genuine deposits, then inspect future activities.
            q.evaluate(
                """window.openRegion=id=>{const gate=m.regions.frontiers().find(g=>g.region.id===id);m.player.x=gate.x;m.player.y=gate.y;m.player.path=[];while(m.state.wood)m.forestry.takeCargo();m.state.maxWood=gate.region.cost;for(let i=0;i<gate.region.cost;i++)m.forestry.addCargo(10);for(let i=0;i<gate.region.cost+1;i++)g.step(.2)};void 0"""
            )
            for region, px, py, name in [
                ("-1:0", -60, 1800, "pond"),
                ("0:-1", 1570, -180, "ruins"),
                ("0:1", 1500, 3580, "mystery"),
            ]:
                q.evaluate("id=>openRegion(id)", region)
                q.evaluate(
                    """([x,y])=>{const p=m.nav.nearestGround(x,y);m.player.x=p.x;m.player.y=p.y;m.player.path=[];g.step(0)}""",
                    [px, py],
                )
                assert q.evaluate(
                    "w.treeObjects.size<170&&w.regionView.objects.size<=4&&w.terrain.images.size<=28&&w.terrain.source.cachedChunks<=28"
                )
                if not mobile:
                    shot(q, name)
            assert q.evaluate(
                "w.merchant.visible&&m.state.unlockedRegions.length===5&&m.world.decorBins.size===5"
            )
            q.evaluate("m.player.x=1490;m.player.y=3620;m.player.path=[];g.step(0)")
            q.keyboard.press("e")
            assert q.locator("#clueDialog").is_visible()
            assert q.locator("#clueText").inner_text().startswith("«Он не просит")
            q.keyboard.press("Escape")
            q.wait_for_function("!m.paused")
            # Real construction unlocks cozy props; its progress doesn't change unlocked tiles.
            for level, cost in enumerate([10, 20, 35, 50], 1):
                q.evaluate(
                    """cost=>{m.player.x=m.build.x;m.player.y=m.build.y;m.player.path=[];while(m.state.wood)m.forestry.takeCargo();m.state.maxWood=cost;for(let i=0;i<cost;i++)m.forestry.addCargo(10);for(let i=0;i<cost+1;i++)g.step(.2)}""",
                    cost,
                )
                assert q.evaluate("m.state.campLevel") == level
                assert (
                    q.evaluate("w.campView.props.filter(p=>p.image.visible).length") > 0
                )
            q.evaluate(
                "m.player.x=1600;m.player.y=1640;m.player.path=[];m.state.worldTime=120;m.tutorial.cut=true;m.tutorial.sold=true;m.state.carryLevel=1;w.scene.get('Hud').doneAt=m.elapsed-10;w.scene.get('Hud').banner.setVisible(false);w.expansionBanner=null;g.step(0)"
            )
            assert q.evaluate(
                "m.state.unlockedRegions.length===5&&w.hut.visible&&w.campView.props.every(p=>p.image.visible)"
            )
            shot(q, "camp-mobile" if mobile else "camp")
            # Return between far sectors: native trees/decoration/pile sprites are released.
            q.evaluate(
                """for(const p of [{x:3250,y:1570},{x:-60,y:1800},{x:1500,y:3580},{x:1600,y:1720}]){m.player.x=p.x;m.player.y=p.y;g.step(0)}"""
            )
            assert q.evaluate(
                "w.treeObjects.size<170&&w.regionView.objects.size<=4&&g.game.textures.getTextureKeys().length<100"
            )
            if not mobile:
                q.evaluate(
                    "while(m.regions.unlocked.size<25)openRegion(m.regions.frontiers()[0].region.id)"
                )
                assert q.evaluate(
                    "m.world.decorBins.size===25&&m.trees.length>2200&&w.treeObjects.size<170&&w.terrain.images.size<=28"
                )
                q.evaluate(
                    "window.southTree=m.trees.find(t=>t.hp>1&&t.y>5200);m.player.x=southTree.x+58;m.player.y=southTree.y;m.player.path=[];m.hitTree(southTree);g.step(0)"
                )
                assert q.evaluate(
                    "w.feedback.barVisible&&w.feedback.badge.depth>southTree.y&&w.atmosphere.air.depth>southTree.y&&w.regionView.border.depth>southTree.y&&w.atmosphere.shade.depth>w.feedback.badge.depth"
                )
                q.evaluate("m.player.x=1600;m.player.y=1720;m.player.path=[];g.step(0)")
                assert q.evaluate(
                    "w.regionView.objects.size<=4&&g.game.textures.getTextureKeys().length<100"
                )
            assert not errors, errors
            print(
                "PASS regions",
                "mobile Canvas" if mobile else "desktop WebGL",
                "border pointer/payments/crossing, landmarks/notes, cozy stages, streamed trees/props/textures",
                flush=True,
            )
            context.close()
            b.close()
finally:
    server.shutdown()
