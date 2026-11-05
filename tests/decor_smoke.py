"""Only new decor: source pixels, stage visibility, wind, passability and reload."""

from functools import partial
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from threading import Thread
from shutil import which
from playwright.sync_api import sync_playwright
from helpers.browser_start import choose_hero, click_setting

ROOT = Path(__file__).resolve().parents[1]


class Handler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def matches(q, frame, source):
    return q.evaluate(
        """([frame,source])=>{const p=w.registry.get('decorPack'),f=p.manifest.frames[source],c=document.createElement('canvas');c.width=f.width;c.height=f.height;c.getContext('2d').drawImage(p.image,f.x,f.y,f.width,f.height,0,0,f.width,f.height);const a=c.getContext('2d').getImageData(0,0,c.width,c.height).data,t=w.textures.getFrame('forest',frame),b=w.textures.get('forest').getSourceImage().getContext('2d').getImageData(t.cutX,t.cutY,t.cutWidth,t.cutHeight).data;return a.length===b.length&&[...a].every((v,i)=>v===b[i]);}""",
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
                    print("PAGE ERROR decor", str(e), flush=True),
                ),
            )
            url = f"http://127.0.0.1:{server.server_port}/"
            q.goto(url + ("dist/" if mobile else "phaser.html"))
            choose_hero(q)
            q.evaluate(
                "window.g=lumberPhaser;window.w=g.scene;window.m=g.core;w.manual=true;m.player.autoTimer=10000;g.step(0)"
            )
            print("READY decor", "mobile Canvas" if mobile else "WebGL", flush=True)
            assert q.evaluate(
                "w.assets.decor.variant===3&&!w.textures.exists('decor.source')&&w.textures.get('forest').getSourceImage().height<=2048"
            )
            for kind in ("rock", "fern", "mushroom", "flowers"):
                for variant in range(2):
                    assert matches(q, f"details.{kind}.{variant}", f"{kind}.{variant}")
            assert matches(q, "camp.crate", "crate") and matches(q, "camp.mat", "mat")
            assert q.evaluate(
                "w.assets.meta.get('world.supplies').width===48&&w.assets.meta.get('world.supplies').height===33&&w.assets.meta.get('world.tools').width===34&&w.assets.meta.get('world.tools').height===45"
            )
            # The model knows no PNGs: decoration positions/count match an independent fresh model.
            assert q.evaluate(
                """async()=>{const {createSimulation}=await import('./game/simulation.js');const other=createSimulation({regional:true});return JSON.stringify(m.world.decorBins.get('0:0'))===JSON.stringify(other.world.decorBins.get('0:0'));}"""
            )
            assert q.evaluate("w.campView.props.every(p=>!p.image.visible)")
            for level in (1, 2, 4):
                q.evaluate(
                    "level=>{m.state.campLevel=level;m.nav.rebuildObstacles();g.step(0)}",
                    level,
                )
                assert q.evaluate(
                    "w.campView.props.every(p=>p.image.visible===(p.min<=m.state.campLevel))"
                )
            assert q.evaluate(
                "w.campView.props.find(p=>p.key==='mat').image.y===1478&&w.campDecor.some(o=>o.p.type==='tools'&&o.image.visible)&&w.campDecor.some(o=>o.p.type==='supplies'&&o.image.visible)"
            )
            if not mobile:
                q.evaluate(
                    "Object.assign(m.player,{x:1600,y:1580,path:[]});w.camera.stopFollow();w.camera.centerOn(1600,1540);g.step(0)"
                )
                q.locator("#game-frame").screenshot(
                    path=str(ROOT / "docs/decor-camp.png")
                )
                q.evaluate("w.camera.startFollow(m.player,true,1,1,0,160);void 0")
            q.evaluate(
                "window.flower=w.regionView.objects.get('0:0').find(i=>i.getData('plant')?.type==='fern');window.plant=flower.getData('plant');Object.assign(m.player,m.nav.nearestGround(plant.x,plant.y+60),{path:[]});g.step(0)"
            )
            frames = []
            for _ in range(5):
                q.evaluate("m.update(1);g.step(0)")
                frames.append(q.evaluate("flower.frame.name"))
            assert any(f.startswith("plant.fern.") for f in frames), frames
            assert any(f.startswith("details.fern.") for f in frames), frames
            (
                q.locator("#effectsBtn").tap()
                if mobile
                else click_setting(q, "#effectsBtn")
            )
            q.evaluate("g.step(0)")
            assert q.evaluate(
                "w.effectsLight&&flower.frame.name.startsWith('details.fern.')"
            )
            (
                q.locator("#effectsBtn").tap()
                if mobile
                else click_setting(q, "#effectsBtn")
            )
            q.evaluate("g.step(0)")
            if not mobile:
                q.locator("#game-frame").screenshot(
                    path=str(ROOT / "docs/decor-forest.png")
                )
            for kind in ("rock", "fern", "mushroom", "flowers"):
                q.evaluate(
                    "kind=>{window.prop=m.world.decorBins.get('0:0').find(p=>p.type===kind&&m.nav.clearSegment({x:p.x-24,y:p.y},{x:p.x+24,y:p.y}));if(!prop)throw Error('No clear decor sample '+kind);Object.assign(m.player,{x:prop.x-24,y:prop.y,path:[]});m.setDestination(prop.x+24,prop.y);m.update(.6);g.step(0)}",
                    kind,
                )
                assert q.evaluate(
                    "Math.hypot(m.player.x-(prop.x+24),m.player.y-prop.y)<8"
                )
            q.evaluate("window.old=m;w.scene.restart();void 0")
            q.wait_for_function(
                "lumberPhaser.core!==old&&lumberPhaser.scene.hudReady", timeout=60000
            )
            assert q.evaluate(
                "lumberPhaser.scene.assets.decor.variant===3&&lumberPhaser.core.state.campLevel===0&&lumberPhaser.core.state.coins===0"
            )
            assert not errors, errors
            print(
                "PASS decor",
                "mobile Canvas" if mobile else "WebGL",
                "PNG pixels, fixed density, camp stages, wind/light mode, passable details, restart",
                flush=True,
            )
            ctx.close()
            b.close()
finally:
    server.shutdown()
