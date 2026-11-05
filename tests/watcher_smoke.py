"""Targeted enemy scale and tracking contact-strike checks; native WASD/touch and camp light."""

from helpers.browser_start import choose_hero, click_setting

from functools import partial
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from threading import Thread
from shutil import which
import sys
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]


class Handler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


server = ThreadingHTTPServer(("127.0.0.1", 0), partial(Handler, directory=str(ROOT)))
Thread(target=server.serve_forever, daemon=True).start()
url = f"http://127.0.0.1:{server.server_port}/"


def ready(q):
    choose_hero(q)
    q.wait_for_function("!!window.lumberPhaser?.scene.hudReady", timeout=60000)
    q.evaluate(
        'window.g=lumberPhaser;window.w=g.scene;window.m=g.core;window.h=w.scene.get("Hud");w.manual=true;g.step(0)'
    )


def phase(q, value):
    q.evaluate(
        f'for(let i=0;i<120&&m.survival.monster.phase!=="{value}";i++)g.step(.01)'
    )
    assert q.evaluate("m.survival.monster.phase") == value


try:
    with sync_playwright() as p:
        for mode in (("desktop",) if "--scale-only" in sys.argv else ("desktop", "canvas")):
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
            # Real spawned actors reuse their PNG frames; only the presentation grows.
            q.evaluate("const r=m.regions.all.find(r=>r.id==='1:0');m.regions.unlocked.add(r.id);m.world.generate(r);m.nav.rebuildObstacles();m.state.worldTime=299.99;g.step(.02)")
            assert q.evaluate("m.survival.minions.length>0&&m.survival.regionalBosses.length>0&&m.survival.minions.every(e=>w.enemyView.objects.get(e.id).image.scaleX===3.3)&&m.survival.regionalBosses.every(e=>w.enemyView.objects.get(e.id).image.scaleX===3.375)&&w.enemyView.objects.get('watcher').image.scaleX===2")
            # Keep the boss near the viewport edge: its tall silhouette must not be culled.
            q.evaluate("window.boss=m.survival.regionalBosses[0];window.small=m.survival.minions[0];const v=w.camera.worldView;Object.assign(boss,{x:m.player.x+110,y:v.bottom+150});m.selectedEnemyId=small.id;g.step(0)")
            assert q.evaluate("w.enemyView.objects.get(boss.id).image.visible&&w.enemyView.objects.get(small.id).label.y===small.y-228&&w.enemyView.objects.get(boss.id).label.y===boss.y-210")
            if mode == "desktop":
                # Zero-time presentation fixture; ordinary games still start without enemies in camp.
                q.evaluate("m.state.worldTime=120;Object.assign(m.player,{x:1600,y:1780,path:[]});Object.assign(boss,{x:1800,y:1820,warning:0});Object.assign(small,{x:1400,y:1820,warning:0});Object.assign(m.survival.monster,{warning:0,phase:'repelled',phaseTime:4});w.camera.stopFollow();w.camera.centerOn(1600,1720);g.step(0)")
                q.wait_for_timeout(100)
                q.evaluate("g.step(0)")
                q.locator("#game-frame").screenshot(path=str(ROOT / "docs/enemy-scale.png"))
            if "--scale-only" in sys.argv:
                assert not errors, errors
                print("PASS enemy scale/culling/labels", flush=True)
                ctx.close()
                b.close()
                continue
            q.reload()
            ready(q)
            assert q.evaluate("!w.audio.enabled&&!w.audio.context")
            click_setting(q, "#sound")
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
                "window.area={...m.survival.monster.attack};window.at=[m.survival.monster.x,m.survival.monster.y];g.step(.02)"
            )
            assert q.evaluate(
                'm.guide.id==="dodge"&&h.watcherHud.label.text.includes("свету")&&w.enemyView.objects.get("watcher").image.frame.name==="survival.watcher.windup"'
            )
            assert q.evaluate(
                "JSON.stringify(m.survival.monster.attack)===JSON.stringify(area)&&m.state.health===100"
            )
            q.locator("#game-frame").screenshot(
                path=str(ROOT / f"docs/watcher-tracking-{'mobile' if mobile else 'desktop'}.png")
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
            # Native movement updates the attack aim before the near-instant hit lands.
            if mobile:
                q.locator("#game-frame").scroll_into_view_if_needed()
                x, y = q.evaluate(
                    "()=>{const r=document.querySelector('canvas').getBoundingClientRect(),v=w.camera.worldView;return[r.x+(m.player.x-120-v.x)/g.game.scale.width*r.width,r.y+(m.player.y-v.y)/g.game.scale.height*r.height]}"
                )
                q.touchscreen.tap(x, y)
                q.evaluate("g.step(.01)")
            else:
                q.keyboard.down("s")
                q.evaluate("g.step(.01)")
                q.keyboard.up("s")
            assert q.evaluate("m.survival.monster.phase==='windup'&&m.survival.monster.attack.x===m.player.x&&m.survival.monster.attack.y===m.player.y&&(m.player.x!==area.x||m.player.y!==area.y)&&m.state.health===100")
            q.evaluate("g.step(.04)")
            phase(q, "recover")
            assert q.evaluate(
                "m.state.health===60&&JSON.stringify([m.survival.monster.x,m.survival.monster.y])!==JSON.stringify(at)"
            )
            q.evaluate("g.step(.08)")
            assert q.evaluate(
                'm.survival.monster.phase==="recover"&&m.survival.monster.goal!==null&&m.state.health===60'
            )
            q.locator("#campButton").click()
            q.evaluate("for(let i=0;i<400&&m.player.path.length;i++)g.step(.05)")
            assert q.evaluate(
                'm.survival.isSafe(m.player)&&m.survival.monster.phase==="repelled"&&m.state.health===60'
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
            click_setting(q, "#sound")
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
                "enemy scale/culling/labels, tracking strike, WASD/touch, moving recovery, light, audio/pause, dawn, lethal, reset",
                flush=True,
            )
            ctx.close()
            b.close()
finally:
    server.shutdown()
