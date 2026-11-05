"""Only the new camp pack: construction, repairs, sale/stock/cart and loader restart."""

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


def partial_matches(q, kind, stage):
    return q.evaluate(
        """([kind,stage])=>{const s=w.assets.art.sprites.campStates[kind][stage],c=document.createElement('canvas');c.width=c.height=192;c.getContext('2d').drawImage(s.bitmap,96-s.ax,176-s.ay);const a=c.getContext('2d').getImageData(0,0,192,192).data,b=w.partialTexture.getContext().getImageData(0,0,192,192).data;return [...a].every((v,i)=>v===b[i]);}""",
        [kind, stage],
    )


server = ThreadingHTTPServer(("127.0.0.1", 0), partial(Handler, directory=str(ROOT)))
Thread(target=server.serve_forever, daemon=True).start()
try:
    with sync_playwright() as p:
        for mode in ("desktop", "mobile", "canvas"):
            mobile = mode != "desktop"
            b = p.chromium.launch(
                headless=True,
                executable_path=which("chromium"),
                args=["--no-sandbox"]
                + (
                    ["--disable-webgl"]
                    if mode == "canvas"
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
                    print("PAGE ERROR camp", str(e), flush=True),
                ),
            )
            url = f"http://127.0.0.1:{server.server_port}/"
            q.goto(url + ("dist/" if mode == "canvas" else "phaser.html"))
            choose_hero(q)
            q.evaluate(
                "window.g=lumberPhaser;window.w=g.scene;window.m=g.core;w.manual=true;m.player.autoTimer=10000;m.state.maxWood=82;g.step(0)"
            )
            print("READY camp", mode, flush=True)
            assert q.evaluate(
                "w.assets.camp.variant===4&&!w.textures.exists('camp.source')&&w.textures.get('forest').getSourceImage().height<=2048"
            )
            # Match an actual atlas frame to the generated source PNG, including alpha.
            assert q.evaluate(
                """()=>{const p=w.registry.get('campPack'),f=p.manifest.frames.salePad,c=document.createElement('canvas');c.width=f.width;c.height=f.height;c.getContext('2d').drawImage(p.image,f.x,f.y,f.width,f.height,0,0,f.width,f.height);const expected=c.getContext('2d').getImageData(0,0,c.width,c.height).data,a=w.textures.getFrame('forest','camp.salePad'),actual=w.textures.get('forest').getSourceImage().getContext('2d').getImageData(a.cutX,a.cutY,a.cutWidth,a.cutHeight).data;return [...expected].every((v,i)=>v===actual[i]);}"""
            )
            for stage, cost in enumerate((10, 20, 35, 50)):
                q.evaluate(
                    "cost=>{while(m.state.wood)m.forestry.takeCargo();for(let i=0;i<cost;i++)m.forestry.addCargo(10);Object.assign(m.player,{x:m.build.x,y:m.build.y,path:[]});for(let i=0;i<20&&!m.state.buildWood;i++)m.update(.05);g.step(0)}",
                    cost,
                )
                if stage in (1, 3):
                    kind = "tent" if stage == 1 else "hut"
                    assert partial_matches(q, kind, "early")
                    q.evaluate(
                        "([stage,cost])=>{for(let i=0;i<300&&m.state.campLevel===stage&&m.state.buildWood<cost*.55;i++)m.update(.05);g.step(0)}",
                        [stage, cost],
                    )
                    assert partial_matches(q, kind, "late")
                    if mode == "desktop":
                        q.locator("#game-frame").screenshot(
                            path=str(ROOT / f"docs/refuge-{kind}-construction.png")
                        )
                q.evaluate(
                    "stage=>{for(let i=0;i<300&&m.state.campLevel===stage;i++)m.update(.05);g.step(0)}",
                    stage,
                )
                assert q.evaluate("m.state.campLevel") == stage + 1
                assert q.evaluate("m.state.wood===0&&m.state.coins===0")
                if stage == 1:
                    assert q.evaluate("w.tent.visible&&w.workerView.depot.visible")
                if stage == 2:
                    assert q.evaluate(
                        "w.fences.length>20&&w.fences.some(i=>i.frame.name.startsWith('camp.rail.'))"
                    )
            assert q.evaluate(
                "w.hut.visible&&!w.tent.visible&&w.hut.frame.name==='house'"
            )
            # HP changes switch only housing graphics, not fence objects or navigation.
            q.evaluate(
                "window.fenceObject=w.fences[0];m.state.campHealth=180;g.step(0)"
            )
            assert q.evaluate(
                "w.hut.frame.name==='campStates.hut.damaged'&&w.fences[0]===fenceObject"
            )
            q.evaluate("m.forestry.addCargo(10);m.update(.3);g.step(0)")
            assert q.evaluate(
                "m.state.campHealth===200&&w.hut.frame.name==='house'&&m.state.wood===0"
            )
            q.evaluate(
                "window.f=m.defenses.all().find(d=>d.kind==='fence');m.defenses.damage(f.id,20);g.step(0)"
            )
            assert q.evaluate(
                "w.fences.some(i=>i.frame.name===`camp.rail.${f.a.id}.damaged`)"
            )
            q.evaluate("m.defenses.damage(f.id,40);g.step(0)")
            assert q.evaluate(
                "w.fences.some(i=>i.frame.name===`camp.rail.${f.a.id}.broken`)&&m.nav.isWalkable(f.x,f.y)"
            )
            q.evaluate(
                "Object.assign(m.player,m.nav.nearestGround(f.x+30,f.y+30),{path:[]});for(let i=0;i<3;i++)m.forestry.addCargo(10);m.orderDefense(f.id);for(let i=0;i<160&&m.defenseOrder;i++)m.update(.05);g.step(0)"
            )
            assert q.evaluate(
                "m.defenses.get(f.id).hp===60&&!m.nav.isWalkable(f.x,f.y)&&w.fences.some(i=>i.frame.name===`camp.rail.${f.a.id}.ready`)"
            )
            # Existing generated cart is empty; only actual sold/stocked logs are visible.
            q.evaluate(
                "m.state.worldTime=120;m.update(55);Object.assign(m.player,{x:m.sale.x,y:m.sale.y,path:[]});window.buyer=m.buyers.find(b=>b.kind==='cart');m.buyers.filter(b=>b!==buyer).forEach(b=>b.phase='leaving');Object.assign(buyer,{phase:'waiting',slot:0,load:0,x:1420,y:1775,path:[]});while(m.state.wood)m.forestry.takeCargo();m.forestry.addCargo(10);window.coins=m.state.coins;m.update(.5);g.step(0)"
            )
            assert q.evaluate(
                "m.state.wood===0&&m.state.coins===coins+10&&buyer.load===1&&w.customerObjects.get(buyer.id).cart.frame.name==='cart'"
            )
            q.evaluate(
                "m.workers.data.autoSell=false;m.workers.data.stock.push(8,8,8);g.step(0)"
            )
            assert q.evaluate(
                "w.workerView.stock.filter(i=>i.visible).length===3&&w.workerView.depot.frame.name==='workers.depot'"
            )
            # Click the generated shop counter and the empty depot bay with actual pointer input.
            for target, dialog, close in [
                ("stall", "#shopDialog", "#shopDialog [data-close]"),
                ("depot", "#workerDialog", "[data-worker-close]"),
            ]:
                q.evaluate(
                    "target=>{const p=target==='stall'?{x:1500,y:1680}:{x:1710,y:1820};Object.assign(m.player,{...p,path:[]});g.step(0)}",
                    target,
                )
                q.locator("#game-frame").scroll_into_view_if_needed()
                x, y = q.evaluate(
                    "target=>{const p=target==='stall'?{x:1420,y:1582}:{x:1710,y:1768},r=document.querySelector('canvas').getBoundingClientRect(),v=w.camera.worldView;return [r.x+(p.x-v.x)/g.game.scale.width*r.width,r.y+(p.y-v.y)/g.game.scale.height*r.height]}",
                    target,
                )
                if mobile:
                    q.touchscreen.tap(x, y)
                else:
                    q.mouse.click(x, y)
                assert q.locator(dialog).is_visible()
                assert q.evaluate("m.paused")
                q.locator(close).click()
                q.wait_for_function("!m.paused")
            if mode == "desktop":
                q.evaluate(
                    "Object.assign(m.player,{x:1600,y:1580,path:[]});w.camera.stopFollow();w.camera.centerOn(1600,1540);g.step(0)"
                )
                q.locator("#game-frame").screenshot(
                    path=str(ROOT / "docs/refuge-camp.png")
                )
                q.evaluate(
                    "m.state.campHealth=100;m.defenses.damage(f.id,60);g.step(0)"
                )
                q.locator("#game-frame").screenshot(
                    path=str(ROOT / "docs/refuge-damaged.png")
                )
            q.evaluate("window.old=m;w.scene.restart();void 0")
            q.wait_for_function(
                "lumberPhaser.core!==old&&lumberPhaser.scene.hudReady", timeout=60000
            )
            assert q.evaluate(
                "lumberPhaser.scene.assets.camp.variant===4&&lumberPhaser.core.state.campLevel===0&&lumberPhaser.core.state.wood===0"
            )
            assert not errors, errors
            print(
                "PASS camp",
                mode,
                "PNG, four paid stages, construction poses, HP/repair, broken fence, sale/cart/stock, restart",
                flush=True,
            )
            ctx.close()
            b.close()
finally:
    server.shutdown()
