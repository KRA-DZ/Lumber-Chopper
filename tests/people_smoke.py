"""Both explicit hero choices, approved generated NPCs, held tools and cargo in all renderers."""

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
url = f"http://127.0.0.1:{server.server_port}/"


def ready(q):
    q.wait_for_function("!!window.lumberPhaser?.scene.hudReady", timeout=60000)
    q.evaluate(
        "window.g=lumberPhaser;window.m=g.core;window.w=g.scene;w.manual=true;g.step(0)"
    )


def equals_source(q):
    return q.evaluate(
        """()=>{const f=w.textures.getFrame('forest','characters.player.down.0'),pack=w.registry.get('peoplePack'),spec=pack.manifest.frames[w.assets.people.role+'-walk-down-0'],a=w.textures.get('forest').getSourceImage().getContext('2d').getImageData(f.cutX,f.cutY,f.cutWidth,f.cutHeight).data,c=document.createElement('canvas');c.width=spec.width;c.height=spec.height;c.getContext('2d').drawImage(pack.image,spec.x,spec.y,spec.width,spec.height,0,0,spec.width,spec.height);const b=c.getContext('2d').getImageData(0,0,c.width,c.height).data;return [...a].every((v,i)=>v===b[i])}"""
    )


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
            q.on(
                "pageerror",
                lambda e: (
                    errors.append(str(e)),
                    print("PAGE ERROR", mode, str(e), flush=True),
                ),
            )
            q.goto(url + ("dist/" if mode == "canvas" else "phaser.html"))
            for index, appearance in enumerate(("traveler", "woodcutter")):
                q.locator("#heroDialog").wait_for(state="visible", timeout=60000)
                assert q.evaluate("!window.lumberPhaser")
                q.keyboard.press("Escape")
                assert q.locator("#heroDialog").is_visible()
                q.keyboard.press("w")
                assert q.evaluate("!window.lumberPhaser")
                if mobile:
                    q.locator(f'#heroDialog input[value="{appearance}"]').tap()
                else:
                    q.locator(f'#heroDialog input[value="{appearance}"]').check()
                if mode == "desktop" and index == 0:
                    q.locator("#heroDialog").screenshot(
                        path=str(ROOT / "docs/people-selection.png")
                    )
                q.locator("[data-hero-start]").click()
                ready(q)
                print("READY people", mode, appearance, flush=True)
                assert q.evaluate("m.state.appearance") == appearance
                assert q.evaluate("w.assets.people.role") == (
                    "hero2" if index == 0 else "hero3"
                )
                assert equals_source(q)
                assert q.evaluate(
                    "m.state.coins===0&&m.state.maxWood===2&&m.state.axePower===1"
                )
                for key in ("d", "w", "a", "s"):
                    q.keyboard.down(key)
                    q.evaluate("g.step(.08)")
                    q.keyboard.up(key)
                    assert q.evaluate("w.player.anims.isPlaying")
                q.evaluate(
                    "m.player.path=[];m.player.autoTimer=1000;m.state.maxWood=82;for(let i=0;i<82;i++)m.forestry.addCargo(10);g.step(0)"
                )
                assert q.evaluate(
                    'w.heroView.pose==="heavy"&&w.cargo.filter(l=>l.visible).length===82'
                )
                q.evaluate(
                    'while(m.state.wood)m.forestry.takeCargo();m.player.celebration=0;window.tree=m.trees.find(t=>t.size===2&&t.type==="spruce"&&m.nav.isWalkable(t.x+58,t.y));Object.assign(m.player,{x:tree.x+58,y:tree.y,path:[]});m.player.clickTimer=0;m.tryChop(tree.id);g.step(0)'
                )
                assert q.evaluate(
                    'w.heroView.bakedTool&&!w.axe.visible&&w.player.frame.name.startsWith("hero.strike.0.")'
                )
                q.evaluate(
                    'g.step(.4);m.state.coins=2000;for(let i=0;i<3;i++)m.purchaseUpgrade("axe");m.player.clickTimer=0;m.tryChop(tree.id);g.step(0)'
                )
                assert q.evaluate('w.player.frame.name.startsWith("hero.strike.3.")')
                if mode == "desktop":
                    q.evaluate('w.pause("photo",true);void 0')
                    q.locator("#game-frame").screenshot(
                        path=str(ROOT / f"docs/people-{appearance}.png")
                    )
                    q.evaluate('w.pause("photo",false);void 0')
                # Use actual camp construction and gate deposits, then approved helper identities.
                q.evaluate(
                    """m.state.worldTime=120;m.state.maxWood=82;m.player.swing=0;while(m.state.wood)m.forestry.takeCargo();for(let i=0;i<30;i++)m.forestry.addCargo(10);Object.assign(m.player,{x:m.build.x,y:m.build.y,path:[]});m.update(6.5);window.openRegion=id=>{const gate=m.regions.frontiers().find(g=>g.region.id===id);while(m.state.wood)m.forestry.takeCargo();for(let i=0;i<gate.region.cost;i++)m.forestry.addCargo(10);Object.assign(m.player,{x:gate.x,y:gate.y,path:[]});m.update(gate.region.cost*.21+.3);};openRegion('1:0');Object.assign(m.player,{x:1600,y:1720,path:[]});m.state.coins=2000;for(let i=0;i<3;i++)m.workers.hire();m.workers.setAutoSell(false);m.workers.setRecalled(true);m.update(1);g.step(0)"""
                )
                assert q.evaluate(
                    'm.workers.crew.map(n=>n.appearance).join(",")==="worker3,worker4,worker3"'
                )
                assert q.evaluate(
                    'w.workerView.objects.get(0).sprite.frame.name.startsWith("person.worker3-")&&w.workerView.objects.get(1).sprite.frame.name.startsWith("person.worker4-")'
                )
                # Buyer appearance cycles independently of transport; do not auto-sell their orders here.
                q.evaluate(
                    "for(let i=0;i<4;i++){m.state.worldTime=120;m.update(55)}m.state.worldTime=120;g.step(0)"
                )
                assert q.evaluate("new Set(m.buyers.map(b=>b.appearance)).size===4")
                assert q.evaluate(
                    '[...w.customerObjects.values()].every(o=>o.sprite.frame.name.startsWith("person.buyer"))'
                )
                # The selected pale merchant has real distinct gestures in the same atlas.
                q.evaluate(
                    'openRegion("0:1");Object.assign(m.player,{x:1670,y:3520,path:[]});g.step(0)'
                )
                assert q.evaluate(
                    'w.merchant.visible&&w.assets.meta.has("person.merchant-read")&&w.assets.meta.get("merchant.read.0").originY===44/46'
                )
                if mode == "desktop" and index == 0:
                    q.locator("#game-frame").screenshot(
                        path=str(ROOT / "docs/people-ivory-merchant.png")
                    )
                q.evaluate(
                    "window.count=w.children.length;for(let i=0;i<100;i++)w.renderModel()"
                )
                assert q.evaluate(
                    'w.children.length<=count&&w.terrain.images.size<=24&&!w.textures.exists("people.source")&&w.textures.get("forest").source[0].width===2048&&w.textures.get("forest").source[0].height===2048'
                )
                assert q.evaluate(
                    "!Object.keys(localStorage).some(k=>/hero|appearance/.test(k))"
                )
                q.reload()
                q.locator("#heroDialog").wait_for(state="visible", timeout=60000)
                assert q.evaluate("!window.lumberPhaser")
                print(
                    "PASS people",
                    mode,
                    appearance,
                    "choice, source pixels, movement, 82 logs, baked/colored axe, workers, four buyers, ivory merchant, atlas and reload",
                    flush=True,
                )
            assert not errors, errors
            ctx.close()
            b.close()
finally:
    server.shutdown()
