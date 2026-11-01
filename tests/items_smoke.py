"""Only resource PNGs, actual pickup/sale, held tools, shop icons and large stack."""

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


def matches(q, frame, source):
    return q.evaluate(
        """([frame,source])=>{const p=w.registry.get('itemPack'),f=p.manifest.frames[source],c=document.createElement('canvas');c.width=f.width;c.height=f.height;c.getContext('2d').drawImage(p.image,f.x,f.y,f.width,f.height,0,0,f.width,f.height);const a=c.getContext('2d').getImageData(0,0,c.width,c.height).data,s=w.textures.getFrame('forest',frame),b=w.textures.get('forest').getSourceImage().getContext('2d').getImageData(s.cutX,s.cutY,s.cutWidth,s.cutHeight).data;return a.length===b.length&&[...a].every((v,i)=>v===b[i]);}""",
        [frame, source],
    )


server = ThreadingHTTPServer(("127.0.0.1", 0), partial(Handler, directory=str(ROOT)))
Thread(target=server.serve_forever, daemon=True).start()
try:
    with sync_playwright() as p:
        for mobile in (False, True):
            b = p.chromium.launch(
                headless=True,
                executable_path=which("chromium"),
                args=["--no-sandbox"]
                + (
                    ["--disable-webgl"]
                    if mobile
                    else ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"]
                ),
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
            q.set_default_timeout(60000)
            errors = []
            q.on(
                "pageerror",
                lambda e: (
                    errors.append(str(e)),
                    print("PAGE ERROR items", str(e), flush=True),
                ),
            )
            url = f"http://127.0.0.1:{server.server_port}/"
            q.goto(url + ("dist/" if mobile else "phaser.html"))
            choose_hero(q)
            q.evaluate(
                "window.g=lumberPhaser;window.w=g.scene;window.m=g.core;w.manual=true;m.player.autoTimer=10000;g.step(0)"
            )
            print("READY items", "mobile Canvas" if mobile else "WebGL", flush=True)
            assert q.evaluate(
                "w.assets.items.variant===3&&!w.textures.exists('items.source')&&w.textures.get('forest').getSourceImage().height<=2048"
            )
            assert matches(q, "log", "log")
            for tier in range(6):
                assert matches(q, f"axes.{tier}.0", f"axe.{tier}")
            q.evaluate(
                "window.tree=m.trees.find(t=>t.size===2&&m.nav.isWalkable(t.x+46,t.y+38));Object.assign(m.player,{x:tree.x+46,y:tree.y+38,path:[]});m.player.clickTimer=0;m.tryChop(tree.id);g.step(0)"
            )
            assert q.evaluate(
                "w.heroView.bakedTool&&!w.axe.visible&&tree.hp<tree.maxHp"
            )
            q.evaluate(
                "for(let i=0;tree.hp>0&&i<20;i++){m.player.clickTimer=0;m.tryChop(tree.id);m.update(.2)}m.update(.8);g.step(0)"
            )
            assert q.evaluate(
                "m.state.wood===2&&m.forestry.piles.get(tree.id).count===1"
            )
            assert q.evaluate(
                "w.cargo.filter(i=>i.visible).every(i=>i.frame.name==='log')&&w.pileObjects.get(tree.id)[0].visible"
            )
            q.evaluate(
                "while(m.state.wood)m.forestry.takeCargo();m.update(.5);g.step(0);window.value=m.state.cargoValue"
            )
            assert q.evaluate("m.state.wood===1&&!m.forestry.piles.has(tree.id)")
            q.evaluate(
                "Object.assign(m.player,{x:m.sale.x,y:m.sale.y,path:[]});for(let i=0;i<400&&m.state.wood;i++)m.update(.05);g.step(0)"
            )
            assert q.evaluate(
                "m.state.wood===0&&m.state.coins===value&&m.buyers[0].load===1"
            )
            q.evaluate("m.state.coins=50000;g.step(0)")
            (
                q.locator("#shopButton").tap()
                if mobile
                else q.locator("#shopButton").click()
            )
            assert q.evaluate("m.paused")
            for tier in range(1, 6):
                q.wait_for_function(
                    "document.querySelector('[data-buy=axe]').closest('article').querySelector('img')?.complete"
                )
                assert (
                    q.locator('[data-buy="axe"]')
                    .locator("..")
                    .locator("img")
                    .get_attribute("src")
                    .endswith(f"axe-{tier}.png")
                )
                (
                    q.locator('[data-buy="axe"]').tap()
                    if mobile
                    else q.locator('[data-buy="axe"]').click()
                )
                assert q.evaluate("m.state.axeLevel") == tier
            assert q.locator('[data-buy="axe"]').is_disabled()
            assert (
                q.locator('[data-buy="carry"]')
                .locator("..")
                .locator("img")
                .get_attribute("src")
                .endswith("wood-bundle.png")
            )
            assert (
                q.locator('[data-buy="pickup"]')
                .locator("..")
                .locator("img")
                .get_attribute("src")
                .endswith("wood-pile.png")
            )
            assert q.evaluate(
                "[...document.querySelectorAll('#shopDialog img')].every(i=>i.complete&&i.naturalWidth===32)"
            )
            if not mobile:
                q.locator("#shopDialog").screenshot(
                    path=str(ROOT / "docs/items-shop.png")
                )
            q.locator("#shopDialog [data-close]").click()
            q.wait_for_function("!m.paused")
            q.wait_for_function("w.flights.size===0")
            q.evaluate("m.player.swing=0;m.player.celebration=0;g.step(0)")
            assert q.evaluate(
                "w.axe.visible&&w.axe.frame.name==='axes.5.0'&&Math.abs(w.axe.originX-12/36)<.001"
            )
            q.evaluate(
                "m.state.maxWood=82;for(let i=0;i<82;i++)m.forestry.addCargo(10);Object.assign(m.player,{x:1600,y:1720,path:[]});g.step(0);window.offset=w.cargo[27].x-m.player.x"
            )
            assert q.evaluate(
                "w.cargo.filter(i=>i.visible).length===82&&w.cargo.every(i=>i.frame.name==='log')"
            )
            q.keyboard.down("d")
            q.evaluate("g.step(.18)")
            assert q.evaluate(
                "w.heroView.pose==='heavy'&&m.player.moving&&Math.abs(w.cargo[27].x-m.player.x-offset)>1"
            )
            q.keyboard.up("d")
            q.locator("#game-frame").screenshot(
                path=str(
                    ROOT
                    / (
                        "docs/items-stack-mobile.png"
                        if mobile
                        else "docs/items-stack.png"
                    )
                )
            )
            q.evaluate("g.step(0)")
            q.evaluate(
                "while(m.state.wood)m.forestry.takeCargo();m.state.worldTime=120;m.update(55);window.buyer=m.buyers.find(b=>b.kind==='cart');m.buyers.filter(b=>b!==buyer).forEach(b=>b.phase='leaving');Object.assign(buyer,{phase:'waiting',slot:0,load:0,x:1420,y:1775,path:[]});Object.assign(m.player,{x:m.sale.x,y:m.sale.y,path:[]});for(let i=0;i<3;i++)m.forestry.addCargo(10);window.coins=m.state.coins;m.update(.7);m.state.campLevel=2;m.workers.data.autoSell=false;m.workers.data.stock.push(8,8,8);g.step(0)"
            )
            q.wait_for_function("w.flights.size===0")
            q.evaluate("g.step(0)")
            assert q.evaluate(
                "buyer.load===3&&m.state.coins===coins+30&&w.customerObjects.get(buyer.id).logs.filter(i=>i.visible).length===3&&w.workerView.stock.filter(i=>i.visible).length===3"
            )
            q.evaluate("window.old=m;w.scene.restart();void 0")
            q.wait_for_function(
                "lumberPhaser.core!==old&&lumberPhaser.scene.hudReady", timeout=60000
            )
            assert q.evaluate(
                "lumberPhaser.scene.assets.items.variant===3&&lumberPhaser.core.state.wood===0&&lumberPhaser.core.state.axeLevel===0"
            )
            if not mobile:
                q.goto(url + "phaser.html?art=procedural")
                choose_hero(q)
                assert q.evaluate("!lumberPhaser.scene.assets.items")
                q.locator("#shopButton").click()
                assert q.locator("#shopDialog img").count() == 0
                q.goto(url + "index.html")
                q.locator("#shopButton").click()
                assert (
                    q.locator("#shopDialog").is_visible()
                    and q.locator("#shopDialog img").count() == 0
                )
            assert not errors, errors
            print(
                "PASS items",
                "mobile Canvas" if mobile else "WebGL",
                "source pixels, chopping/pickup, sale, six tools/icons, 82-log sway, cart/stock, restart",
                flush=True,
            )
            ctx.close()
            b.close()
finally:
    server.shutdown()
