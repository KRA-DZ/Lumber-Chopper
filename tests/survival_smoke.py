"""Night director, journal, game over and full cargo rendering in the real Phaser scene."""

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
    q.evaluate("window.g=lumberPhaser;window.m=g.core;window.w=g.scene;w.manual=true")


try:
    with sync_playwright() as p:
        for mode in ("desktop", "mobile", "canvas"):
            mobile = mode == "mobile"
            browser = p.chromium.launch(
                headless=True,
                args=["--no-sandbox"]
                + (
                    ["--disable-webgl"]
                    if mode == "canvas"
                    else ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"]
                ),
                **({"executable_path": which("chromium")} if which("chromium") else {}),
            )
            context = browser.new_context(
                viewport={
                    "width": 390 if mobile else 1360,
                    "height": 844 if mobile else 1050,
                },
                is_mobile=mobile,
                has_touch=mobile,
            )
            q = context.new_page()
            errors = []
            q.on(
                "pageerror",
                lambda e: (
                    errors.append(str(e)),
                    print("PAGE ERROR", mode, str(e), flush=True),
                ),
            )
            q.goto(url + ("dist/" if mode == "canvas" else "phaser.html"))
            ready(q)
            print("READY", mode, flush=True)
            # Exercise the actual frame-update branch, not just the manual test helper.
            q.keyboard.down("d")
            q.evaluate(
                "window.beforeTime=m.state.worldTime;window.beforeX=m.player.x;w.manual=false;w.update(0,100);w.manual=true"
            )
            q.keyboard.up("d")
            assert q.evaluate("m.player.x>beforeX+15&&m.state.worldTime>beforeTime+.09")
            q.evaluate("m.player.x=1600;m.player.y=1720;m.player.path=[];g.step(0)")
            # A paused shop buys through the model and applies speed without a scene callback.
            q.evaluate("m.state.coins=90")
            q.locator("#shopButton").click()
            q.locator('[data-buy="boots"]').click()
            assert q.evaluate(
                "m.player.speed===216&&m.state.runSpeed===216&&m.state.coins===0"
            )
            q.locator("#shopDialog [data-close]").click()
            # Maximum supported cargo: every slot has a sprite; no forty-log cutoff.
            q.evaluate(
                "m.state.carryLevel=40;m.state.maxWood=82;for(let i=0;i<100;i++)m.forestry.addCargo(10);g.step(0)"
            )
            q.wait_for_timeout(60)
            assert q.evaluate(
                "w.cargo.filter(l=>l.visible).length===82&&new Set(w.cargo.map(l=>`${l.x}:${l.y}`)).size===82"
            )
            if mode == "desktop":
                q.locator("#game-frame").screenshot(
                    path=str(ROOT / "docs/stack-82.png")
                )
            q.evaluate(
                "while(m.state.wood)m.forestry.takeCargo();m.state.campLevel=2;m.nav.rebuildObstacles();m.state.worldTime=299.95;g.step(.1)"
            )
            assert q.evaluate(
                "m.cycle.isNight&&m.survival.monster.invulnerable&&m.survival.raiders.length===0"
            )
            q.evaluate("g.step(12.1)")
            assert q.evaluate("m.state.health===100&&w.enemyView.objects.size===1")
            # Entering camp light cancels an attack, including a chase already underway.
            q.evaluate(
                "Object.assign(m.survival.monster,{x:1600,y:1750,path:[]});g.step(8)"
            )
            assert q.evaluate("m.state.health===100&&!m.state.gameOver")
            # Real dawn -> delivered letter -> paused journal -> one claim only.
            q.evaluate("m.state.worldTime=599.99;g.step(.02)")
            assert q.evaluate(
                '!m.survival.monster&&m.state.nightsSurvived===1&&m.state.unlockedLetters.includes("first-dawn")'
            )
            q.locator("#journalButton").click()
            before = q.evaluate("m.state.worldTime")
            q.evaluate("g.step(2)")
            assert q.evaluate("m.state.worldTime") == before
            q.locator('[data-quest="warm-dawn"]').click()
            assert q.evaluate(
                'm.state.coins===20&&m.state.claimedQuests.includes("warm-dawn")'
            )
            assert q.locator('[data-quest="warm-dawn"]').is_disabled()
            q.locator("[data-journal-close]").click()
            q.wait_for_function("!m.paused", timeout=3000)
            # Exactly the fifth night schedules a wave after a visible grace period.
            q.evaluate("m.state.calendarDay=4;m.state.worldTime=299.95;g.step(.1)")
            assert q.evaluate("m.survival.pending===3&&m.survival.raiders.length===0")
            q.evaluate("g.step(12.1)")
            assert q.evaluate(
                "m.survival.raiders.length===3&&w.enemyView.objects.size===4"
            )
            # Camp damage and repair exercise the same resource transaction as construction.
            q.evaluate(
                "m.state.campHealth=176;m.player.x=m.build.x;m.player.y=m.build.y;m.player.path=[];m.forestry.addCargo(10);g.step(.3)"
            )
            assert q.evaluate("m.state.campHealth===196&&m.state.wood===0")
            # Sixth night is watcher-only. Camera presents an actual in-range encounter.
            q.evaluate(
                "m.state.worldTime=599.99;g.step(.02);m.state.calendarDay=5;m.state.worldTime=299.95;g.step(.1);g.step(12.1);const p=m.nav.nearestGround(1600,2000);Object.assign(m.player,p,{path:[],autoTimer:1000});Object.assign(m.survival.monster,{x:p.x+40,y:p.y,path:[],repath:100});m.state.worldTime=450;g.step(.05)"
            )
            assert q.evaluate('m.survival.raiders.length===0&&!m.tryAttack("watcher")')
            q.wait_for_timeout(100)
            if mode != "canvas":
                q.locator("#game-frame").screenshot(
                    path=str(ROOT / f"docs/watcher-{mode}.png")
                )
            q.evaluate("g.step(10)")
            assert q.evaluate("m.state.gameOver&&m.state.health===0&&m.paused")
            assert q.locator("#deathDialog").is_visible()
            before = q.evaluate("m.state.worldTime")
            q.keyboard.press("Escape")
            q.evaluate("g.step(10)")
            assert q.locator("#deathDialog").is_visible()
            assert q.evaluate("m.state.worldTime") == before
            # Button starts a genuinely new session; no saved state survives.
            with q.expect_navigation(wait_until="load"):
                q.locator("[data-restart]").click()
            ready(q)
            assert q.evaluate(
                "m.state.health===100&&m.state.coins===0&&m.state.wood===0&&m.state.nightsSurvived===0&&!m.state.gameOver&&!m.paused"
            )
            # Shutdown and recreation remove old journal/event handlers.
            q.evaluate("window.oldCore=m;w.scene.restart();void 0")
            q.wait_for_function(
                "lumberPhaser.core!==oldCore&&lumberPhaser.scene.hudReady"
            )
            ready(q)
            q.locator("#journalButton").click()
            assert q.locator("#journalDialog").is_visible()
            q.locator("[data-journal-close]").click()
            q.wait_for_function("!m.paused", timeout=3000)
            assert not errors, errors
            print(
                "PASS survival",
                mode,
                "82 logs, commands, watcher, light, fifth-night wave, repair, letters, defeat/restart",
            )
            context.close()
            browser.close()
finally:
    server.shutdown()
