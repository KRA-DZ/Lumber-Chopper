"""Phaser watcher: visible states, locked ground area, real dodge, light, audio and dawn."""

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
    q.wait_for_function("!!window.lumberPhaser?.scene.hudReady", timeout=60000)
    q.evaluate(
        'window.g=lumberPhaser;window.w=g.scene;window.m=g.core;window.h=w.scene.get("Hud");w.manual=true;g.step(0)'
    )


def phase(q, value):
    q.evaluate(
        f'for(let i=0;i<120&&m.survival.monster.phase!=="{value}";i++)g.step(.05)'
    )
    assert q.evaluate("m.survival.monster.phase") == value


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
            q.goto(url + ("dist/" if mode == "canvas" else "phaser.html"))
            ready(q)
            assert q.evaluate(
                'w.assets.meta.has("survival.watcher.windup")&&w.textures.get("forest").getSourceImage().height<=2048'
            )
            assert q.evaluate("!w.audio.enabled&&!w.audio.context")
            q.locator("#sound").click()
            q.wait_for_function('w.audio.context.state==="running"')
            q.evaluate(
                "window.cues=[];const cue=w.audio.watcherCue.bind(w.audio);w.audio.watcherCue=(...args)=>{cues.push(args[0]);return cue(...args)};m.state.campLevel=1;m.nav.rebuildObstacles();m.state.worldTime=299.99;g.step(.02);g.step(12.1)"
            )
            assert q.evaluate(
                'm.survival.monster.phase==="repelled"&&m.state.health===100'
            )
            q.evaluate(
                "const p=m.nav.nearestGround(1600,2000);Object.assign(m.player,p,{path:[],autoTimer:1000});Object.assign(m.survival.monster,{x:p.x+40,y:p.y,repath:100,path:[],senseTimer:0});m.state.worldTime=450;g.step(.05)"
            )
            phase(q, "notice")
            assert q.evaluate(
                'h.watcherHud.label.visible&&h.watcherHud.label.text.includes("ЗАМЕТИЛ")'
            )
            if mode == "desktop":
                q.locator("#game-frame").screenshot(
                    path=str(ROOT / "docs/watcher-notice.png")
                )
            phase(q, "windup")
            q.evaluate(
                "window.area={...m.survival.monster.attack};window.at=[m.survival.monster.x,m.survival.monster.y];g.step(.2)"
            )
            assert q.evaluate(
                'm.guide.id==="dodge"&&h.watcherHud.label.text.includes("круга")&&w.enemyView.objects.get("watcher").image.frame.name==="survival.watcher.windup"'
            )
            assert q.evaluate(
                "JSON.stringify(m.survival.monster.attack)===JSON.stringify(area)&&m.state.health===100"
            )
            if mode != "canvas":
                q.locator("#game-frame").screenshot(
                    path=str(ROOT / f"docs/watcher-telegraph-{mode}.png")
                )
            q.locator("#shopButton").click()
            q.wait_for_function('w.audio.context.state==="suspended"')
            before = q.evaluate("[m.survival.monster.phaseTime,m.state.worldTime]")
            q.evaluate("g.step(5)")
            assert (
                q.evaluate("[m.survival.monster.phaseTime,m.state.worldTime]") == before
            )
            q.locator("#shopDialog [data-close]").click()
            q.wait_for_function('!m.paused&&w.audio.context.state==="running"')
            # WASD physically moves the player out of the painted area; the attack does not follow.
            if mobile:
                q.locator("#game-frame").scroll_into_view_if_needed()
                x, y = q.evaluate(
                    "()=>{const r=document.querySelector('canvas').getBoundingClientRect(),v=w.camera.worldView;return[r.x+(m.player.x-120-v.x)/g.game.scale.width*r.width,r.y+(m.player.y-v.y)/g.game.scale.height*r.height]}"
                )
                q.touchscreen.tap(x, y)
                q.evaluate("g.step(.5)")
            else:
                q.keyboard.down("s")
                q.evaluate("g.step(.5)")
                q.keyboard.up("s")
            q.evaluate("g.step(0)")
            phase(q, "recover")
            assert q.evaluate(
                "m.state.health===100&&JSON.stringify([m.survival.monster.x,m.survival.monster.y])===JSON.stringify(at)"
            )
            q.evaluate("g.step(.8)")
            assert q.evaluate(
                'm.survival.monster.phase==="recover"&&m.survival.monster.goal===null'
            )
            q.locator("#campButton").click()
            q.evaluate("for(let i=0;i<400&&m.player.path.length;i++)g.step(.05)")
            assert q.evaluate(
                'm.survival.isSafe(m.player)&&m.survival.monster.phase==="repelled"&&m.state.health===100'
            )
            assert q.evaluate(
                'cues.includes("notice")&&cues.includes("windup")&&cues.includes("repelled")&&w.audio.activeVoices<=12'
            )
            if mode == "mobile":
                q.locator("#game-frame").screenshot(
                    path=str(ROOT / "docs/watcher-light-mobile.png")
                )
            # Offscreen threat has a coarse direction arrow, rather than an invisible attack.
            q.evaluate(
                'm.player.x=1600;m.player.y=2000;m.player.path=[];Object.assign(m.survival.monster,{x:2200,y:1500,phase:"chase",phaseTime:1});g.step(0)'
            )
            assert q.evaluate("h.watcherHud.arrow.visible&&h.watcherHud.label.visible")
            q.locator("#sound").click()
            q.wait_for_function('w.audio.context.state==="suspended"')
            assert q.evaluate("w.audio.activeVoices===0")
            # Dawn removes gameplay danger immediately; the presentation fades out on its own.
            q.evaluate("m.state.worldTime=599.99;g.step(.02)")
            assert q.evaluate(
                'm.survival.monster===null&&!w.enemyView.objects.has("watcher")&&m.state.health===100'
            )
            q.wait_for_function("!w.enemyView.fade", timeout=3000)
            # In silence the same telegraph remains visible and standing still is lethal.
            q.evaluate(
                "m.state.worldTime=299.99;g.step(.02);g.step(12.1);const p=m.nav.nearestGround(1600,2000);Object.assign(m.player,p,{path:[],autoTimer:1000});Object.assign(m.survival.monster,{x:p.x+40,y:p.y,repath:100,path:[],senseTimer:0});g.step(.05)"
            )
            phase(q, "windup")
            assert q.evaluate("!w.audio.enabled&&h.watcherHud.label.visible")
            q.evaluate("g.step(12)")
            assert q.evaluate("m.state.health===0&&m.state.gameOver")
            assert q.locator("#deathDialog").is_visible()
            with q.expect_navigation(wait_until="load"):
                q.locator("[data-restart]").click()
            ready(q)
            assert q.evaluate(
                "m.state.health===100&&!m.survival.monster&&!w.audio.context"
            )
            assert not errors, errors
            print(
                "PASS watcher",
                mode,
                "states, fixed telegraph, WASD/touch dodge, recovery, light, audio/pause, arrow, dawn, lethal without sound, fresh restart",
                flush=True,
            )
            ctx.close()
            b.close()
finally:
    server.shutdown()
