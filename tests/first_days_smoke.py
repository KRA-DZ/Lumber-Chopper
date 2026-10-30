"""Use the native guide buttons to earn carry, build a fire and survive the first night."""

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
        'window.g=lumberPhaser;window.m=g.core;window.w=g.scene;window.h=w.scene.get("Hud");w.manual=true;g.step(0)'
    )


def button(q, mobile):
    q.wait_for_timeout(30)
    x, y = q.evaluate(
        '()=>{const r=document.querySelector("canvas").getBoundingClientRect(),b=h.guideButton.getBounds();return[r.x+(b.x+b.width/2)/g.game.scale.width*r.width,r.y+(b.y+b.height/2)/g.game.scale.height*r.height]}'
    )
    (q.touchscreen.tap if mobile else q.mouse.click)(x, y)


def until(q, condition):
    q.evaluate(f"for(let i=0;i<2000&&!({condition})&&!m.state.gameOver;i++)g.step(.05)")
    assert q.evaluate(condition), q.evaluate(
        "({guide:m.guide,wood:m.state.wood,coins:m.state.coins,position:m.player,night:m.cycle.isNight})"
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
            q.on("pageerror", lambda e: errors.append(str(e)))
            q.goto(url + ("dist/" if mode == "canvas" else "phaser.html"))
            ready(q)
            assert q.evaluate(
                'm.guide.id==="cut"&&h.tutorial.text.includes("1/7")&&h.dayHud.raid.text.includes("ночь 5")'
            )
            assert q.evaluate(
                "h.guideButton.getBounds().left>=0&&h.guideButton.getBounds().right<=g.game.scale.width"
            )
            if mode != "canvas":
                q.locator("#game-frame").screenshot(
                    path=str(ROOT / f"docs/first-days-{mode}.png")
                )
            button(q, mobile)
            assert q.evaluate("m.player.path.length>0")
            until(q, "m.state.wood===m.state.maxWood")
            assert q.evaluate('m.guide.id==="sell"')
            button(q, mobile)
            until(q, "m.state.wood===0")
            assert q.evaluate('m.guide.id==="carry"&&m.state.coins>=20')
            button(q, mobile)
            assert q.locator("#shopDialog").is_visible()
            assert (
                q.locator('[data-recommended="true"] [data-buy="carry"]').count() == 1
            )
            before = q.evaluate("m.state.worldTime")
            q.evaluate("g.step(2)")
            assert q.evaluate("m.state.worldTime") == before
            q.locator('[data-buy="carry"]').click()
            q.locator("#shopDialog [data-close]").click()
            q.wait_for_function("!m.paused")
            assert q.evaluate('m.state.maxWood===4&&m.guide.id==="fire"')
            # Real pickups and automatic construction; no inventory or money injection.
            for trip in range(20):
                if q.evaluate("m.state.campLevel>=1"):
                    break
                action = q.evaluate("m.guide.action")
                before_wood = q.evaluate("m.state.wood")
                button(q, mobile)
                if action == "trees":
                    until(q, f"m.state.wood>{before_wood}&&!m.player.path.length")
                else:
                    until(q, "m.state.wood===0||m.state.campLevel>=1")
            assert q.evaluate(
                'm.state.campLevel>=1&&m.guide.id==="prepare"&&!m.cycle.isNight'
            )
            # Leave on a real route; then test warning, return and pause without teleportation.
            q.evaluate("m.setDestination(1600,2150)")
            until(q, "!m.player.path.length")
            q.evaluate("m.state.worldTime=239.99;g.step(.02)")
            assert q.evaluate(
                'm.guide.id==="sunset"&&h.dayHud.warning.visible&&h.dayHud.phase.text.includes("01:00")'
            )
            before = q.evaluate("[m.player.x,m.player.y]")
            button(q, mobile)
            assert q.evaluate("[m.player.x,m.player.y]") == before
            until(q, "!m.player.path.length")
            assert q.evaluate("m.survival.isSafe(m.player)")
            q.evaluate("m.state.worldTime=284.99;g.step(.02)")
            assert q.evaluate(
                'h.dayHud.phase.style.color==="#ffc0a0"&&h.dayHud.warning.visible'
            )
            if mode != "canvas":
                q.locator("#game-frame").screenshot(
                    path=str(ROOT / f"docs/sunset-warning-{mode}.png")
                )
            q.locator("#journalButton").click()
            assert q.locator("[data-plan-day]").count() == 4
            before = q.evaluate("[m.state.worldTime,m.sunsetWarning.until]")
            q.evaluate("g.step(30)")
            assert q.evaluate("[m.state.worldTime,m.sunsetWarning.until]") == before
            q.locator("[data-journal-close]").click()
            q.wait_for_function("!m.paused")
            q.evaluate("m.state.worldTime=299.99;g.step(.02);g.step(3.1)")
            assert q.evaluate(
                'm.tutorial.sheltered&&m.guide.id==="shelter"&&h.dayHud.phase.text.startsWith("Ночь")'
            )
            q.evaluate("g.step(600-m.state.worldTime+.02)")
            assert q.evaluate(
                'm.state.health===100&&m.state.nightsSurvived===1&&m.guide.id==="letter"'
            )
            button(q, mobile)
            assert q.locator("#journalDialog").is_visible()
            q.locator('[data-quest="warm-dawn"]').click()
            assert q.locator('[data-quest="warm-dawn"]').is_disabled()
            if mode == "desktop":
                q.locator("#journalDialog").screenshot(
                    path=str(ROOT / "docs/first-days-journal.png")
                )
            q.locator("[data-journal-close]").click()
            q.wait_for_function("!m.paused")
            assert q.evaluate('m.guide.step===7&&m.guide.id==="plan"')
            # Fifth-night status is visible and the actual raid schedule remains unchanged.
            q.evaluate("m.state.calendarDay=4;m.state.worldTime=299.99;g.step(.02)")
            assert q.evaluate(
                'm.survival.pending===3&&h.dayHud.raid.text.includes("ночь 5")'
            )
            q.evaluate("window.old=m;w.scene.restart();void 0")
            q.wait_for_function("lumberPhaser.core!==old&&lumberPhaser.scene.hudReady")
            ready(q)
            assert q.evaluate(
                "m.guide.step===0&&m.state.nightsSurvived===0&&m.state.coins===0"
            )
            assert q.evaluate(
                "h.tutorial.style.fontSize===" + ('"14px"' if mobile else '"12px"')
            )
            assert not errors, errors
            print(
                "PASS first days",
                mode,
                "native guide, earned upgrade/fire, dusk/dawn, safe return, journal/claim, fifth-night schedule, fresh restart",
                flush=True,
            )
            ctx.close()
            b.close()
finally:
    server.shutdown()
