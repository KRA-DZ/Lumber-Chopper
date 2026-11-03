"""Only the sawmill's notes, drive, hidden discovery and journal, with native input."""

from functools import partial
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from threading import Thread
from shutil import which
from playwright.sync_api import sync_playwright
from helpers.browser_start import choose_hero

ROOT = Path(__file__).resolve().parents[1]
DRIVE = "sawmill-hand-drive"
TAG = "sawmill-shift-tag"


class Handler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def focus(q, expr):
    q.evaluate(
        "p=>{m.clearKeys();Object.assign(m.player,{x:p.x,y:p.y+42,path:[],moving:false,autoTimer:10000});w.camera.stopFollow();w.camera.centerOn(p.x,p.y-60);g.step(0)}",
        q.evaluate(expr),
    )
    q.wait_for_timeout(150)
    q.evaluate("g.step(0)")


def tap(q, expr, mobile):
    q.locator("#game-frame").scroll_into_view_if_needed()
    x, y = q.evaluate(
        "p=>{const r=document.querySelector('canvas').getBoundingClientRect(),v=w.camera.worldView;return[r.x+(p.x-v.x)/v.width*r.width,r.y+(p.y-v.y)/v.height*r.height]}",
        q.evaluate(expr),
    )
    q.touchscreen.tap(x, y) if mobile else q.mouse.click(x, y)


def close_activity(q):
    q.locator("[data-activity-close]").click()
    q.wait_for_function("!m.paused")


server = ThreadingHTTPServer(("127.0.0.1", 0), partial(Handler, directory=str(ROOT)))
Thread(target=server.serve_forever, daemon=True).start()
try:
    with sync_playwright() as p:
        for mobile in (False, True):
            browser = p.chromium.launch(
                headless=True,
                executable_path=which("chromium"),
                args=["--no-sandbox"]
                + (
                    ["--disable-webgl"]
                    if mobile
                    else ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"]
                ),
            )
            ctx = browser.new_context(
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
            choose_hero(q, "woodcutter" if mobile else "traveler")
            q.evaluate(
                "window.g=lumberPhaser;window.w=g.scene;window.m=g.core;window.e=m.exploration;w.manual=true"
            )
            # Reuse the real border transaction; clearing itself is covered separately.
            q.evaluate("""()=>{
                for(const id of ['1:0','1:1']) {
                    const gate=m.regions.frontiers().find(p=>p.region.id===id);
                    Object.assign(m.player,{x:gate.x,y:gate.y,path:[],autoTimer:10000});
                    m.state.maxWood=gate.region.cost;
                    for(let i=0;i<gate.region.cost;i++)m.forestry.addCargo(10);
                    for(let i=0;i<gate.region.cost+1;i++)g.step(.2);
                }
                m.state.maxWood=2;
            }""")
            print(
                "READY sawmill story",
                "mobile Canvas/dist" if mobile else "WebGL",
                flush=True,
            )

            focus(q, f"e.get('{TAG}')")
            assert q.evaluate(
                f"!w.regionView.locations.objects.has('{TAG}')&&!e.request('{TAG}')&&e.nearest()?.id!=='{TAG}'"
            )
            focus(q, f"e.get('{DRIVE}')")
            tap(q, f"e.get('{DRIVE}')", mobile)
            q.wait_for_function("document.querySelector('#activityDialog').open")
            assert q.locator('[data-activity-action="open-passage"]').is_disabled()
            assert "Памятку" in q.locator("[data-activity-content]").inner_text()
            close_activity(q)

            for site in ("sawmill-unshipped-load", "sawmill-empty-crate"):
                focus(q, f"e.get('{site}')")
                tap(q, f"e.get('{site}')", mobile)
                q.wait_for_function("document.querySelector('#activityDialog').open")
                assert q.locator("[data-activity-action]").count() == 0
                assert (
                    "смен" in q.locator("[data-activity-content]").inner_text().lower()
                    or "семь"
                    in q.locator("[data-activity-content]").inner_text().lower()
                )
                close_activity(q)

            for note in ("sawmill-order", "sawmill-ledger", "sawmill-last-shift"):
                expr = f"m.world.clues.find(n=>n.id==='{note}')"
                focus(q, expr)
                tap(q, expr, mobile)
                q.wait_for_function("document.querySelector('#clueDialog').open")
                assert q.evaluate(f"m.state.readClues.includes('{note}')")
                if note == "sawmill-last-shift" and not mobile:
                    q.locator("#clueDialog").screenshot(
                        path=str(ROOT / "docs/sawmill-instruction.png")
                    )
                q.locator("#clueClose").click()
                q.wait_for_function("!m.paused")

            focus(q, f"e.get('{DRIVE}')")
            if mobile:
                tap(q, f"e.get('{DRIVE}')", True)
            else:
                q.keyboard.press("e")
            q.wait_for_function("document.querySelector('#activityDialog').open")
            assert q.locator('[data-activity-action="open-passage"]').is_enabled()
            q.locator('[data-activity-action="open-passage"]').click()
            assert q.locator('[data-activity-action="open-passage"]').is_disabled()
            assert q.evaluate(
                "m.state.exploration.openedPassages.includes('sawmill-machine-cache')&&m.state.coins===0&&m.state.wood===0"
            )
            close_activity(q)
            q.evaluate("g.step(0)")
            assert q.evaluate(f"w.regionView.locations.objects.has('{TAG}')")

            focus(q, f"e.get('{TAG}')")
            if not mobile:
                q.locator("#game-frame").screenshot(
                    path=str(ROOT / "docs/sawmill-cache.png")
                )
            tap(q, f"e.get('{TAG}')", mobile)
            q.wait_for_function("document.querySelector('#activityDialog').open")
            q.locator('[data-activity-action="collect-discovery"]').click()
            assert q.locator('[data-activity-action="collect-discovery"]').is_disabled()
            close_activity(q)
            q.evaluate("g.step(0)")
            assert q.evaluate(
                f"!w.regionView.locations.objects.has('{TAG}')&&e.discoveries().length===1&&m.state.coins===0&&m.state.wood===0&&Object.keys(m.state.exploration.debrisHP).length===0&&m.state.story.phase===0"
            )

            q.locator("#journalButton").click()
            q.wait_for_function("document.querySelector('#journalDialog').open")
            entry = q.locator(f'[data-discovery="{TAG}"]')
            assert entry.count() == 1 and "Бирка седьмой смены" in entry.inner_text()
            assert "Ведомость пустых телег" in q.locator("[data-journal]").inner_text()
            if not mobile:
                entry.scroll_into_view_if_needed()
                q.locator("#journalDialog").screenshot(
                    path=str(ROOT / "docs/sawmill-shift-journal.png")
                )
            q.locator("[data-journal-close]").click()
            q.wait_for_function("!m.paused")
            q.locator("#mapButton").click()
            cell = q.locator('[data-region="1:1"]')
            assert (
                "Записки: 3/3" in cell.inner_text()
                and "Находки: 1/1" in cell.inner_text()
            )
            cell.click()
            q.wait_for_function("!m.paused")
            assert q.evaluate(
                "m.player.targetY===m.world.locations.find(l=>l.regionId==='1:1').entrance.y"
            )
            focus(q, "({x:1600,y:1720})")
            assert q.evaluate("w.regionView.locations.objects.size===0")
            focus(q, f"e.get('{TAG}')")
            assert q.evaluate(
                f"!w.regionView.locations.objects.has('{TAG}')&&e.discoveries().length===1"
            )
            q.evaluate("window.old=m;w.scene.restart();void 0")
            q.wait_for_function("lumberPhaser.core!==old&&lumberPhaser.scene.hudReady")
            assert q.evaluate(
                "lumberPhaser.core.state.exploration.openedPassages.length===0&&lumberPhaser.core.exploration.discoveries().length===0&&lumberPhaser.core.state.readClues.length===0"
            )
            assert not errors, errors
            print(
                "PASS sawmill story",
                "mobile Canvas/dist" if mobile else "WebGL",
                "notes, clues, local drive, finite cache, journal, map, streaming, reset",
                flush=True,
            )
            ctx.close()
            browser.close()
finally:
    server.shutdown()
