"""Only hold repair, damaged fence feedback, raid preparation and report UI."""
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


def ready(q):
    choose_hero(q)
    q.evaluate("window.g=lumberPhaser;window.m=g.core;window.w=g.scene;window.h=w.scene.get('Hud');w.manual=true;g.step(0);void 0")


def control_point(q):
    return q.evaluate("()=>{const r=document.querySelector('canvas').getBoundingClientRect(),b=h.repairControl.button;return{x:r.x+b.x/g.game.scale.width*r.width,y:r.y+(b.y-b.height/2)/g.game.scale.height*r.height}}")


server = ThreadingHTTPServer(("127.0.0.1", 0), partial(Handler, directory=str(ROOT)))
Thread(target=server.serve_forever, daemon=True).start()
try:
    with sync_playwright() as p:
        for mobile in (False, True):
            browser = p.chromium.launch(headless=True, executable_path=which("chromium"), args=["--no-sandbox"] + (["--disable-webgl"] if mobile else ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"]))
            ctx = browser.new_context(viewport={"width": 390 if mobile else 1360, "height": 844 if mobile else 1050}, is_mobile=mobile, has_touch=mobile)
            q = ctx.new_page()
            errors = []
            q.on("pageerror", lambda e: errors.append(str(e)))
            q.goto(f"http://127.0.0.1:{server.server_port}/" + ("dist/" if mobile else "phaser.html"))
            ready(q)
            q.evaluate("m.state.campLevel=3;m.nav.rebuildObstacles();m.state.maxWood=82;for(let i=0;i<4;i++)m.forestry.addCargo(7);window.f=m.defenses.all().find(s=>s.kind==='fence');m.defenses.damage(f.id,60);Object.assign(m.player,m.nav.nearestGround(f.x,f.y+40),{path:[],autoTimer:10000});w.camera.stopFollow();w.camera.centerOn(m.player.x,m.player.y-70);g.step(0)")
            q.wait_for_timeout(100)
            q.evaluate("g.step(0)")
            assert q.evaluate("h.repairControl.button.visible&&w.defenseView.objects.find(o=>o.d.id===f.id).label.text.includes('ПРОЛОМ')")
            if mobile:
                cdp = ctx.new_cdp_session(q)
                point = control_point(q)
                def press():
                    cdp.send("Input.dispatchTouchEvent", {"type": "touchStart", "touchPoints": [point]})
                def release():
                    cdp.send("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []})
            else:
                def press():
                    q.keyboard.down("r")
                def release():
                    q.keyboard.up("r")
            press()
            q.evaluate("g.step(.35)")
            assert q.evaluate("m.defenseRepair?.held&&m.defenseRepair.progress>.5&&m.state.wood===4")
            q.locator("#game-frame").screenshot(path=str(ROOT / f"docs/defense-hold-{'mobile' if mobile else 'desktop'}.png"))
            release()
            q.evaluate("g.step(1)")
            assert q.evaluate("m.state.wood===4&&m.defenses.get(f.id).hp===0&&m.defenseRepair.progress===0")
            press()
            q.evaluate("g.step(.61)")
            release()
            assert q.evaluate("m.state.wood===3&&m.state.cargoValue===21&&m.defenses.get(f.id).hp===20&&!m.nav.isWalkable(f.x,f.y)&&w.defenseView.objects.find(o=>o.d.id===f.id).label.text.includes('20/60')")
            # A real modal pause releases the hold; it cannot silently resume on closing.
            press()
            q.evaluate("g.step(.2)")
            q.locator("#defenseButton").click()
            release()
            assert q.evaluate("m.paused&&m.defenseRepair===null")
            q.evaluate("g.step(10)")
            q.locator("[data-defense-close]").click()
            q.wait_for_function("!m.paused")
            q.evaluate("g.step(.5)")
            assert q.evaluate("m.state.wood===3")
            q.evaluate("m.state.calendarDay=3;m.state.worldTime=599.99;g.step(.02)")
            assert q.evaluate("h.dayHud.warning.visible&&h.dayHud.warning.text.includes('Сегодня налёт')&&!m.survival.minionHunt")
            q.evaluate("g.step(11);m.state.worldTime=239.99;g.step(.02);g.step(8)")
            assert q.evaluate("!m.sunsetWarning&&h.dayHud.warning.visible&&h.dayHud.warning.text.includes('Метатели')&&h.dayHud.raid.text.includes('сегодня')")
            if not mobile:
                q.locator("#game-frame").screenshot(path=str(ROOT / "docs/raid-preparation-countdown.png"))
            q.evaluate("m.state.worldTime=299.99;g.step(.02);g.step(12.1);for(const e of [...m.survival.raiders])m.survival.hit(e.id,e.maxHP,false);window.other=m.defenses.all().find(s=>s.kind==='fence'&&s.hp===s.maxHP);m.defenses.damage(other.id,60);g.step(0)")
            assert q.evaluate("m.survival.wave.status==='won'&&m.state.coins===60&&m.state.lastRaidReport===null")
            q.evaluate("m.state.worldTime=599.99;g.step(.02)")
            assert q.evaluate("m.state.lastRaidReport?.night===5&&m.state.lastRaidReport.brokenSections===1&&m.state.lastRaidReport.defenseDamage===60&&m.state.coins===60")
            q.locator("#defenseButton").click()
            report = q.locator("#defenseDialog [data-raid-report]")
            assert report.count() == 1
            assert "60 монет" in report.inner_text()
            assert "3/3" in report.inner_text()
            q.locator("#defenseDialog").screenshot(path=str(ROOT / f"docs/raid-result-{'mobile' if mobile else 'desktop'}.png"))
            q.locator("[data-defense-close]").click()
            q.wait_for_function("!m.paused")
            q.locator("#journalButton").click()
            assert q.locator("#journalDialog [data-raid-report]").count() == 1
            assert q.evaluate("m.state.coins===60&&m.state.raidsWon===1")
            q.locator("[data-journal-close]").click()
            q.wait_for_function("!m.paused")
            q.reload()
            ready(q)
            assert q.evaluate("m.state.lastRaidReport===null&&m.defenseRepair===null&&m.state.wood===0")
            assert not errors, errors
            print("PASS defense preparation", "mobile Canvas/dist" if mobile else "desktop WebGL", "native hold/release, pause, HP/gap, warnings, report/no duplicate reward, reset", flush=True)
            ctx.close()
            browser.close()
finally:
    server.shutdown()
