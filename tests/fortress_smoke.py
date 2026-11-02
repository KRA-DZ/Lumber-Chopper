"""Only the fortress: streamed PNG walls, native input, notes, chest and shortcut."""

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


def place(q, expr):
    q.evaluate(
        """p=>{Object.assign(m.player,p,{path:[],moving:false});w.camera.stopFollow();w.camera.centerOn(p.x,p.y-100);g.step(0)}""",
        q.evaluate(expr),
    )
    q.wait_for_timeout(120)  # Camera preRender updates worldView separately.
    q.evaluate("g.step(0)")


def click_world(q, expr, mobile):
    q.locator("#game-frame").scroll_into_view_if_needed()
    x, y = q.evaluate(
        """p=>{const r=document.querySelector('canvas').getBoundingClientRect(),v=w.camera.worldView;return [r.x+(p.x-v.x)/v.width*r.width,r.y+(p.y-v.y)/v.height*r.height]}""",
        q.evaluate(expr),
    )
    q.touchscreen.tap(x, y) if mobile else q.mouse.click(x, y)


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
            q.on("pageerror", lambda e: errors.append(str(e)))
            q.goto(
                f"http://127.0.0.1:{server.server_port}/"
                + ("dist/" if mobile else "phaser.html")
            )
            choose_hero(q)
            q.evaluate(
                """()=>{window.g=lumberPhaser;window.w=g.scene;window.m=g.core;window.e=m.exploration;w.manual=true;const gate=m.regions.frontiers().find(p=>p.region.id==='0:-1');Object.assign(m.player,{x:gate.x,y:gate.y,path:[],autoTimer:10000});m.state.maxWood=16;for(let i=0;i<12;i++)m.forestry.addCargo(10);for(let i=0;i<13;i++)g.step(.2);}"""
            )
            print("READY fortress", "mobile Canvas" if mobile else "WebGL", flush=True)
            assert q.evaluate(
                "m.regions.unlocked.has('0:-1')&&w.assets.meta.size>0&&w.textures.get('forest').getSourceImage().height<=2048"
            )
            place(q, "({x:1600,y:-112})")
            assert q.evaluate(
                "w.regionView.locations.objects.size>10&&w.regionView.locations.objects.size<180"
            )
            if not mobile:
                q.locator("#game-frame").screenshot(
                    path=str(ROOT / "docs/fortress-courtyard.png")
                )

            # Keyboard motion hits the new wall without crossing its base.
            place(q, "({x:1744,y:-640})")
            q.keyboard.down("d")
            q.evaluate("for(let i=0;i<20;i++)g.step(.05)")
            q.keyboard.up("d")
            q.evaluate("g.step(0)")
            assert q.evaluate("m.player.x<1772")

            # A native click/touch inspects the archive chest, with a clue requirement.
            place(q, "(()=>{const p=e.get('chest:0:-1:1');return{x:p.x,y:p.y+42}})()")
            q.evaluate("m.state.exploration.items.key=1")
            click_world(q, "e.get('chest:0:-1:1')", mobile)
            q.wait_for_function("document.querySelector('#activityDialog').open")
            assert q.locator('[data-activity-action="open-chest"]').is_disabled()
            assert "ведомость" in q.locator("[data-activity-content]").inner_text()
            q.locator("[data-activity-close]").click()
            q.wait_for_function("!m.paused")

            # Read the actual note using pointer input; it is retained in the journal.
            place(
                q,
                "(()=>{const p=m.world.clues.find(p=>p.id==='fortress-ledger');return{x:p.x,y:p.y+32}})()",
            )
            click_world(q, "m.world.clues.find(p=>p.id==='fortress-ledger')", mobile)
            q.wait_for_function("document.querySelector('#clueDialog').open")
            assert q.evaluate("m.state.readClues.includes('fortress-ledger')")
            q.locator("#clueClose").click()
            q.wait_for_function("!m.paused")

            place(q, "(()=>{const p=e.get('chest:0:-1:1');return{x:p.x,y:p.y+42}})()")
            click_world(q, "e.get('chest:0:-1:1')", mobile)
            q.wait_for_function("document.querySelector('#activityDialog').open")
            q.locator('[data-activity-action="open-chest"]').click()
            assert q.evaluate(
                "m.state.coins===65&&m.state.exploration.items.key===0&&m.state.exploration.items.relic===1"
            )
            assert q.locator('[data-activity-action="open-chest"]').is_disabled()
            q.locator("[data-activity-close]").click()
            q.wait_for_function("!m.paused")

            place(q, "(()=>{const p=e.get('fortress-winch');return{x:p.x,y:p.y+32}})()")
            click_world(q, "e.get('fortress-winch')", mobile)
            q.wait_for_function("document.querySelector('#activityDialog').open")
            q.locator('[data-activity-action="open-passage"]').click()
            assert q.evaluate(
                "m.state.exploration.openedPassages.includes('fortress-shortcut')&&m.nav.clearSegment({x:1744,y:-640},{x:1840,y:-640})"
            )
            assert q.locator('[data-activity-action="open-passage"]').is_disabled()
            q.locator("[data-activity-close]").click()
            q.wait_for_function("!m.paused")
            q.evaluate("g.step(0)")
            assert q.evaluate(
                "[...w.regionView.locations.objects.keys()].every(k=>!k.includes('/archive-shortcut/'))"
            )
            if not mobile:
                q.locator("#game-frame").screenshot(
                    path=str(ROOT / "docs/fortress-archive.png")
                )

            place(q, "({x:1600,y:1720})")
            assert q.evaluate("w.regionView.locations.objects.size===0")
            place(q, "({x:1872,y:-608})")
            assert q.evaluate(
                "m.state.exploration.openedPassages.length===1&&w.regionView.locations.objects.size<180"
            )

            # The secret latch cannot open before reading the real archive note.
            place(
                q,
                "(()=>{const p=e.get('fortress-hidden-latch');return{x:p.x,y:p.y+32}})()",
            )
            assert q.evaluate(
                "!w.regionView.locations.objects.has('fortress-watch-token')&&m.state.exploration.discoveries.length===0"
            )
            click_world(q, "e.get('fortress-hidden-latch')", mobile)
            q.wait_for_function("document.querySelector('#activityDialog').open")
            assert q.locator('[data-activity-action="open-passage"]').is_disabled()
            assert (
                "Последний дозор" in q.locator("[data-activity-content]").inner_text()
            )
            q.locator("[data-activity-close]").click()
            q.wait_for_function("!m.paused")

            # Inspect a narrative scene without granting supplies or money.
            place(
                q,
                "(()=>{const p=e.get('fortress-last-fire');return{x:p.x,y:p.y+32}})()",
            )
            click_world(q, "e.get('fortress-last-fire')", mobile)
            q.wait_for_function("document.querySelector('#activityDialog').open")
            assert "нет ни тепла" in q.locator("[data-activity-content]").inner_text()
            assert q.locator("[data-activity-action]").count() == 0
            q.locator("[data-activity-close]").click()
            q.wait_for_function("!m.paused")

            place(
                q,
                "(()=>{const p=m.world.clues.find(p=>p.id==='fortress-last-watch');return{x:p.x,y:p.y+32}})()",
            )
            click_world(
                q, "m.world.clues.find(p=>p.id==='fortress-last-watch')", mobile
            )
            q.wait_for_function("document.querySelector('#clueDialog').open")
            assert q.evaluate("m.state.readClues.includes('fortress-last-watch')")
            q.locator("#clueClose").click()
            q.wait_for_function("!m.paused")
            place(
                q,
                "(()=>{const p=e.get('fortress-hidden-latch');return{x:p.x,y:p.y+32}})()",
            )
            click_world(q, "e.get('fortress-hidden-latch')", mobile)
            q.wait_for_function("document.querySelector('#activityDialog').open")
            q.locator('[data-activity-action="open-passage"]').click()
            assert q.evaluate(
                "m.state.exploration.openedPassages.includes('fortress-secret')&&m.nav.clearSegment({x:1552,y:-528},{x:1552,y:-640})"
            )
            q.locator("[data-activity-close]").click()
            q.wait_for_function("!m.paused")
            q.evaluate("g.step(0)")
            assert q.evaluate(
                "[...w.regionView.locations.objects.keys()].every(k=>!k.includes('/secret-door/'))&&w.regionView.locations.objects.has('fortress-watch-token')"
            )

            # Walk the actual open doorway before picking up the personal discovery.
            q.evaluate(
                "const t=e.get('fortress-watch-token');m.setDestination(t.x,t.y+40);for(let i=0;i<100&&m.player.path.length;i++)m.update(.05);g.step(0)"
            )
            assert q.evaluate(
                "Math.hypot(m.player.x-e.get('fortress-watch-token').x,m.player.y-e.get('fortress-watch-token').y-40)<2"
            )
            place(q, "({x:m.player.x,y:m.player.y})")
            if not mobile:
                q.locator("#game-frame").screenshot(
                    path=str(ROOT / "docs/fortress-secret.png")
                )
            click_world(q, "e.get('fortress-watch-token')", mobile)
            q.wait_for_function("document.querySelector('#activityDialog').open")
            q.locator('[data-activity-action="collect-discovery"]').click()
            assert q.evaluate(
                "m.state.exploration.discoveries.length===1&&m.state.coins===65&&m.state.exploration.items.relic===1"
            )
            assert q.locator('[data-activity-action="collect-discovery"]').is_disabled()
            q.locator("[data-activity-close]").click()
            q.wait_for_function("!m.paused")
            q.evaluate("g.step(0)")
            assert q.evaluate(
                "!w.regionView.locations.objects.has('fortress-watch-token')&&e.nearest()?.id!=='fortress-watch-token'"
            )
            q.locator("#journalButton").click()
            q.wait_for_function("document.querySelector('#journalDialog').open")
            entry = q.locator('[data-discovery="fortress-watch-token"]')
            assert (
                entry.count() == 1 and "Жетон последнего дозора" in entry.inner_text()
            )
            if not mobile:
                entry.scroll_into_view_if_needed()
                q.locator("#journalDialog").screenshot(
                    path=str(ROOT / "docs/fortress-token-journal.png")
                )
            q.locator("[data-journal-close]").click()
            q.wait_for_function("!m.paused")
            place(q, "({x:1600,y:1720})")
            assert q.evaluate("w.regionView.locations.objects.size===0")
            place(q, "({x:1552,y:-696})")
            assert q.evaluate(
                "!w.regionView.locations.objects.has('fortress-watch-token')&&e.discoveries().length===1&&w.regionView.locations.objects.size<180"
            )
            q.evaluate("window.old=m;w.scene.restart();void 0")
            q.wait_for_function("lumberPhaser.core!==old&&lumberPhaser.scene.hudReady")
            assert q.evaluate(
                "lumberPhaser.core.state.exploration.openedPassages.length===0&&lumberPhaser.core.state.exploration.discoveries.length===0&&lumberPhaser.core.state.readClues.length===0&&lumberPhaser.core.state.coins===0"
            )
            assert not errors, errors
            print(
                "PASS fortress",
                "mobile Canvas" if mobile else "WebGL",
                "walls, clue, chest, shortcut, narrative scene, secret latch, token journal, streaming, restart",
                flush=True,
            )
            ctx.close()
            b.close()
finally:
    server.shutdown()
