"""Phaser art/environment integration in WebGL and real Canvas fallback.
Run after npm run build. Preview fixtures use development state, not saved games.
"""

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
    q.wait_for_timeout(130)
    q.locator("#game-frame").screenshot(path=str(ROOT / f"docs/forest-{name}.png"))


try:
    with sync_playwright() as p:
        for canvas in (False, True):
            browser = p.chromium.launch(
                headless=True,
                args=["--no-sandbox"]
                + (
                    ["--disable-webgl"]
                    if canvas
                    else ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"]
                ),
                **({"executable_path": which("chromium")} if which("chromium") else {}),
            )
            context = browser.new_context(
                viewport={"width": 390 if canvas else 1360, "height": 1000},
                is_mobile=canvas,
                has_touch=canvas,
            )
            q = context.new_page()
            errors = []
            q.on("pageerror", lambda e: errors.append(str(e)))
            q.goto(url + ("dist/" if canvas else "phaser.html"))
            q.wait_for_function("!!window.lumberPhaser?.scene.hudReady", timeout=30000)
            q.evaluate(
                "window.g=lumberPhaser;window.w=g.scene;window.m=g.core;w.manual=true;window.a=w.atmosphere;void 0"
            )
            assert q.evaluate("g.renderer") == ("Canvas" if canvas else "WebGL")
            assert q.evaluate(
                "w.audio.context===undefined&&!w.audio.enabled&&a.wildlife.animals.length===18"
            )
            art = q.evaluate(
                """async()=>{const {createPixelArt}=await import('./pixel-art.js');const old=createPixelArt().sprites,n=w.assets.art.sprites;return {newStyle:w.assets.art.style,hero:n.characters.player.down[0].height>old.characters.player.down[0].height,trees:n.trees.oak[0].width>old.trees.oak[0].width,house:n.house.width>old.house.width,atlas:[w.textures.get('forest').getSourceImage().width,w.textures.get('forest').getSourceImage().height]};}"""
            )
            assert (
                art["hero"]
                and art["trees"]
                and art["house"]
                and max(art["atlas"]) <= 2048
            ), art
            # A nearest animal flees; no unbounded spawning or off-map movement.
            assert q.evaluate(
                """()=>{const b=a.wildlife.animals[0];m.player.x=b.x+40;m.player.y=b.y;m.player.path=[];g.step(.05);return b.state==='flee'&&a.wildlife.animals.every(b=>Number.isFinite(b.x+b.y)&&Math.hypot(b.x-1600,b.y-1600)<m.forestRadius());}"""
            )
            # Clicking a clue opens the real modal, pauses all simulation, then resumes.
            q.evaluate("m.player.x=1290;m.player.y=1420;m.player.path=[];g.step(0)")
            x, y = point(q, 1290, 1377)
            (q.touchscreen.tap if canvas else q.mouse.click)(x, y)
            assert q.locator("#clueDialog").is_visible()
            before = q.evaluate(
                """()=>({time:m.state.worldTime,animal:JSON.stringify(a.wildlife.animals),leaves:JSON.stringify(a.environment.leaves)})"""
            )
            q.evaluate("g.step(20)")
            assert (
                q.evaluate(
                    """()=>({time:m.state.worldTime,animal:JSON.stringify(a.wildlife.animals),leaves:JSON.stringify(a.environment.leaves)})"""
                )
                == before
            )
            q.locator("#clueClose").click()
            q.wait_for_function("!m.paused")
            assert q.evaluate('a.mystery.read.has("note")')
            q.evaluate("m.player.x=1290;m.player.y=1420;g.step(0)")
            q.keyboard.press("e")
            assert q.locator("#clueDialog").is_visible()
            q.keyboard.press("Escape")
            q.wait_for_function("!m.paused")
            # Weather follows the calendar, not wall time. Rain stops; wet leaves drip.
            q.evaluate("m.state.worldTime=220;g.step(.1)")
            assert q.evaluate("a.weather.profile.rain===1&&a.weather.rainCount===80")
            q.evaluate("m.state.worldTime=285;for(let i=0;i<20;i++)g.step(.1)")
            assert q.evaluate(
                "a.weather.profile.rain===0&&a.weather.profile.wet>0&&a.weather.drips.length>0"
            )
            q.locator("#effectsBtn").click()
            assert q.evaluate(
                'a.quality==="light"&&a.weather.rainCount===28&&a.environment.leaves.length<=8&&a.weather.drips.length<=5'
            )
            q.locator("#effectsBtn").click()
            # Native pixels are distinct; night light mask keeps a clear centre and dark distance.
            q.evaluate(
                "m.state.campLevel=4;m.nav.rebuildObstacles();m.player.x=2270;m.player.y=1730;m.player.path=[];m.state.worldTime=450;for(let i=0;i<70;i++)g.step(.1)"
            )
            q.evaluate(
                """window.maskSample=()=>{const v=w.camera.worldView,f=w.scale.width/a.mask.width,x=(m.player.x-v.x)/f,y=(m.player.y-24-v.y)/f,ctx=a.mask.getContext();return {centre:ctx.getImageData(Math.floor(x),Math.floor(y),1,1).data[3],edge:ctx.getImageData(5,5,1,1).data[3]}}"""
            )
            assert q.evaluate(
                "a.shade.visible&&maskSample().centre<10&&maskSample().edge>230"
            ), q.evaluate("maskSample()")
            q.evaluate(
                """window.opacity=()=>{const d=a.mask.getContext().getImageData(0,0,a.mask.width,a.mask.height).data;let sum=0;for(let i=3;i<d.length;i+=4)sum+=d[i];return sum};window.beforeLight=opacity();m.state.lanternLevel=4;g.step(0)"""
            )
            assert q.evaluate("opacity()<beforeLight")
            q.evaluate("m.state.lanternLevel=0;g.step(0)")
            assert q.evaluate("a.mystery.eyes.length>0&&a.mystery.eyes.length<=3")
            assert q.evaluate(
                "a.mystery.eyes.every(e=>a.lights().every(l=>Math.hypot(e.x-l.x,e.y-l.y)>=l.r*.9))"
            )
            if not canvas:
                shot(q, "night")
            q.evaluate("m.state.worldTime=120;g.step(.1)")
            assert q.evaluate("!a.shade.visible&&a.mystery.eyes.length===0")
            # Sound has a user gesture, and pauses while an interaction is open.
            q.locator("#sound").click()
            q.wait_for_function('w.audio.enabled&&w.audio.context.state==="running"')
            q.locator("#shopButton").click()
            q.wait_for_function('w.audio.context.state==="suspended"')
            q.keyboard.press("Escape")
            q.wait_for_function('!m.paused&&w.audio.context.state==="running"')
            q.locator("#sound").click()
            q.wait_for_function('!w.audio.enabled&&w.audio.context.state==="suspended"')
            # Representative daytime camp, same coordinates in both editions.
            q.evaluate(
                "m.state.campLevel=4;m.state.buildWood=0;m.player.x=1600;m.player.y=1640;m.player.path=[];m.state.worldTime=120;a.reveal={from:1450,to:1450,age:18};while(m.state.wood)m.forestry.takeCargo();m.player.direction='down';g.step(0)"
            )
            shot(q, "mobile" if canvas else "day")
            if not canvas:
                q.evaluate("m.state.worldTime=220;g.step(.1)")
                shot(q, "rain")
                q.evaluate("m.state.worldTime=33;g.step(.1)")
                shot(q, "mist")
            # Restart releases audio/mask and creates exactly one fresh copy of each UI handler.
            q.evaluate(
                "window.oldCore=m;window.oldAudio=w.audio.context;w.scene.restart();void 0"
            )
            q.wait_for_function(
                "lumberPhaser.core!==oldCore&&lumberPhaser.scene.hudReady"
            )
            q.wait_for_function('oldAudio.state==="closed"')
            assert q.evaluate(
                'lumberPhaser.core.state.campLevel===0&&!lumberPhaser.scene.audio.enabled&&lumberPhaser.core.state.unlockedRegions.length===1&&document.querySelector("#effectsBtn").getAttribute("aria-pressed")==="false"'
            )
            assert not errors, errors
            print(
                "PASS",
                "Canvas mobile" if canvas else "WebGL desktop",
                "new art, wildlife, clue click/E/pause, weather/light mode, night/lantern/eyes, gesture audio/pause, restart",
                art,
                flush=True,
            )
            context.close()
            browser.close()
finally:
    server.shutdown()
