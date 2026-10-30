"""Chapter I through actual journal pages, choices, regional commands and fifth dawn."""

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
        "window.g=lumberPhaser;window.m=g.core;window.w=g.scene;w.manual=true;g.step(0)"
    )


def close(q):
    q.locator("[data-activity-close]").click()
    q.wait_for_function("!m.paused")


def site(q, id):
    q.evaluate(
        "id=>{const s=m.exploration.get(id);Object.assign(m.player,m.nav.nearestGround(s.x,s.y+42),{path:[],moving:false});m.exploration.request(id);g.step(0)}",
        id,
    )
    assert q.locator("#activityDialog").is_visible()


def read(q, id):
    q.evaluate(
        "id=>{const c=m.world.clues.find(c=>c.id===id);Object.assign(m.player,m.nav.nearestGround(c.x,c.y+32),{path:[]});g.step(0)}",
        id,
    )
    q.keyboard.press("e")
    assert q.locator("#clueDialog").is_visible()
    q.locator("#clueClose").click()
    q.wait_for_function("!m.paused")


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
            q.on(
                "pageerror",
                lambda e: (
                    errors.append(str(e)),
                    print("PAGE ERROR", mode, str(e), flush=True),
                ),
            )
            q.goto(url + ("dist/" if mode == "canvas" else "phaser.html"))
            ready(q)
            print("READY story", mode, flush=True)
            q.locator("#journalButton").click()
            assert q.locator('[data-story-phase="0"]').is_visible()
            q.locator("[data-journal-close]").click()
            q.wait_for_function("!m.paused")
            # An actual dawn delivers the opening page. The chapter does not advance with wall-clock time.
            q.evaluate("m.state.worldTime=599.99;g.step(.02)")
            assert q.evaluate("m.story.overview().phase===1&&m.story.unread===1")
            q.locator("#journalButton").click()
            before = q.evaluate("m.state.worldTime")
            q.evaluate("g.step(10)")
            assert q.evaluate("m.state.worldTime") == before
            q.locator('[data-story-page="invitation"] summary').click()
            q.wait_for_function("m.story.unread===0")
            # Journal route closes its own modal and walks to a real note; E reads it only nearby.
            q.locator('[data-story-route="note"]').click()
            q.wait_for_function("!m.paused")
            q.evaluate("for(let i=0;i<160&&m.player.path.length;i++)g.step(.05)")
            assert q.evaluate("Math.hypot(m.player.x-1290,m.player.y-1380)<140")
            q.keyboard.press("e")
            assert q.locator("#clueDialog").is_visible()
            q.locator("#clueClose").click()
            q.wait_for_function("!m.paused")
            # Build the fire using real cargo transfer, then open all cardinal regions through paid gates.
            q.evaluate(
                """m.state.maxWood=82;for(let i=0;i<10;i++)m.forestry.addCargo(10);Object.assign(m.player,{x:m.build.x,y:m.build.y,path:[]});for(let i=0;i<12;i++)g.step(.2);window.openRegion=id=>{const gate=m.regions.frontiers().find(g=>g.region.id===id);Object.assign(m.player,{x:gate.x,y:gate.y,path:[]});while(m.state.wood)m.forestry.takeCargo();for(let i=0;i<gate.region.cost;i++)m.forestry.addCargo(10);for(let i=0;i<=gate.region.cost;i++)g.step(.2)};for(const id of ["0:1","0:-1","-1:0","1:0"])openRegion(id);m.state.worldTime=120;w.expansionBanner=null;w.scene.get("Hud").banner.setVisible(false);void 0;"""
            )
            assert q.evaluate("m.state.campLevel===1&&m.story.overview().phase===2")
            # Gate and note requirements are visible before a choice becomes available.
            site(q, "mysterious-merchant")
            assert q.locator('[data-activity-action="story:ask-watcher"]').is_disabled()
            close(q)
            read(q, "merchant-note")
            q.evaluate("m.state.coins=200")
            site(q, "mysterious-merchant")
            topic = "story:ask-contract" if mobile else "story:ask-watcher"
            q.locator(f'[data-activity-action="{topic}"]').click()
            assert q.evaluate(
                "m.story.overview().phase===3&&m.state.story.traderTopic.length>0"
            )
            assert q.locator("[data-story-dialogue]").is_visible()
            # Buy ordinary gear and pay normal prices; story never substitutes for economic transactions.
            q.locator('[data-activity-action="buy-rod"]').click()
            q.locator('[data-activity-action="buy-key"]').click()
            close(q)
            read(q, "ruins-note")
            site(q, "chest:0:-1:0")
            q.locator('[data-activity-action="open-chest"]').click()
            close(q)
            read(q, "pond-note")
            site(q, "fishing")
            q.locator('[data-activity-action="fish"]').click()
            q.wait_for_function("!m.paused")
            q.evaluate(
                'for(let i=0;i<150&&m.exploration.fishing?.phase!=="bite";i++)g.step(.05)'
            )
            if mobile:
                q.locator("[data-reel]").tap()
            else:
                q.keyboard.press("Space")
            q.evaluate("g.step(0)")
            assert q.evaluate("m.state.exploration.totalFishCaught===1")
            read(q, "oak-note")
            q.evaluate("for(let i=0;i<3;i++)m.forestry.addCargo(12)")
            site(q, "ancient-roots")
            q.locator('[data-activity-action="offer-logs"]').click()
            close(q)
            assert q.evaluate(
                "m.story.overview().phase===4&&m.story.evidence.every(e=>e.identified)"
            )
            site(q, "mysterious-merchant")
            assert q.locator(
                '[data-activity-action="story:show-evidence"]'
            ).is_disabled()
            q.locator('[data-activity-action="sell-fish"]').click()
            q.locator('[data-activity-action="sell-relic"]').click()
            close(q)
            # Simulated dawn edges stand in for long idle waits; quests still use real calendar events.
            q.evaluate(
                "while(m.state.nightsSurvived<3){m.state.worldTime=599.99;g.step(.02)}"
            )
            site(q, "mysterious-merchant")
            q.locator('[data-activity-action="story:show-evidence"]').click()
            assert q.evaluate("m.story.overview().phase===5")
            if mode == "desktop":
                q.locator("#activityDialog").screenshot(
                    path=str(ROOT / "docs/story-contract.png")
                )
            close(q)
            # Final action stays blocked until the fifth dawn and a built tent.
            site(q, "camp-kitchen")
            assert q.locator('[data-activity-action="story:sign-name"]').is_disabled()
            close(q)
            q.evaluate(
                "m.state.worldTime=120;for(let i=0;i<20;i++)m.forestry.addCargo(10);Object.assign(m.player,{x:m.build.x,y:m.build.y,path:[]});for(let i=0;i<22;i++)g.step(.2);while(m.state.nightsSurvived<5){m.state.worldTime=599.99;g.step(.02)}"
            )
            site(q, "camp-kitchen")
            before = q.evaluate("m.state.coins")
            ending = "story:leave-mark" if mobile else "story:sign-name"
            q.locator(f'[data-activity-action="{ending}"]').click()
            assert q.evaluate(
                "m.state.story.completed&&m.state.story.rewardClaimed&&m.story.overview().phase===6"
            )
            assert q.evaluate("m.state.coins") == before + 120
            assert q.locator('[data-activity-action^="story:"]').count() == 0
            close(q)
            q.evaluate("g.step(0)")
            assert q.evaluate(
                'w.campView.storySeal.visible&&w.campView.storySeal.frame.name==="story.campSeal"&&m.survival.safeRadius()===310'
            )
            q.locator("#journalButton").click()
            assert q.locator('[data-story-phase="6"]').is_visible()
            assert q.locator("[data-story-evidence]").count() == 3
            q.locator('[data-story-page="ending"] summary').click()
            q.wait_for_function('m.state.story.readPages.includes("ending")')
            if mode != "canvas":
                q.locator("#journalDialog").screenshot(
                    path=str(ROOT / f"docs/story-journal-{mode}.png")
                )
            q.locator("[data-journal-close]").click()
            q.wait_for_function("!m.paused")
            q.evaluate("g.step(1);m.state.worldTime=599.99;g.step(.02)")
            assert q.evaluate("m.state.coins") == before + 120
            # Scene restart releases listeners and leaves no story or reward flags from the old run.
            q.evaluate("window.old=m;w.scene.restart();void 0")
            q.wait_for_function(
                "window.lumberPhaser?.core!==old&&window.lumberPhaser?.scene.hudReady",
                timeout=60000,
            )
            ready(q)
            assert q.evaluate(
                "m.story.overview().phase===0&&m.story.pages().length===0&&!m.state.story.rewardClaimed&&!w.campView.storySeal.visible"
            )
            q.locator("#journalButton").click()
            assert q.locator("[data-story-chapter]").count() == 1
            q.locator("[data-journal-close]").click()
            q.wait_for_function("!m.paused")
            assert not errors, errors
            print(
                "PASS story",
                mode,
                "dawn, guarded notes, journal routes/pages, dialogue choices, three proofs, trade, fifth-dawn finale, one reward, cosmetic, pause/restart",
                flush=True,
            )
            ctx.close()
            b.close()
finally:
    server.shutdown()
