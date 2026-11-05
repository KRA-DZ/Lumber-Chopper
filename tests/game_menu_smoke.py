"""Only compact actions, manual pause/settings, modal isolation and scene cleanup."""
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
            q.goto(f"http://127.0.0.1:{server.server_port}/" + ("dist/" if mobile else "index.html"))
            choose_hero(q)
            q.evaluate("window.g=lumberPhaser;window.m=g.core;window.w=g.scene;w.manual=true;g.step(0);scrollTo(0,0);void 0")
            assert q.locator(".game-actions button").count() == 8
            assert q.evaluate("[...document.querySelectorAll('.game-actions button')].every(b=>b.getBoundingClientRect().height>=44)&&document.documentElement.scrollWidth<=innerWidth")
            assert not q.locator("#sound").is_visible()
            if mobile:
                assert q.evaluate("[...document.querySelectorAll('.game-actions button')].every(b=>b.getBoundingClientRect().bottom<=innerHeight)")
                q.screenshot(path=str(ROOT / "docs/mobile-actions.png"))
                q.locator("#menuButton").tap()
            else:
                q.keyboard.down("w")
                q.evaluate("g.step(.1)")
                q.keyboard.press("p")
                q.keyboard.up("w")
            q.wait_for_selector("#gameMenu[open]")
            assert q.evaluate("m.paused&&m.keys.size===0&&m.player.path.length===0")
            before = q.evaluate("[m.state.worldTime,m.elapsed,m.state.health,m.state.wood,m.player.x,m.player.y]")
            q.evaluate("g.step(10)")
            assert q.evaluate("[m.state.worldTime,m.elapsed,m.state.health,m.state.wood,m.player.x,m.player.y]") == before
            q.locator("#sound").click()
            q.wait_for_function("w.audio.enabled&&w.audio.context.state==='suspended'")
            q.locator("#effectsBtn").click()
            assert q.evaluate("w.effectsLight&&m.paused")
            q.locator("#gameMenu").screenshot(path=str(ROOT / f"docs/pause-menu-{'mobile' if mobile else 'desktop'}.png"))
            q.locator(".controls-help summary").click()
            assert q.locator(".controls-help").get_attribute("open") is not None
            assert "удерживайте R" in q.locator(".controls-help").inner_text()
            if mobile:
                q.locator("[data-menu-close]").tap()
            else:
                q.keyboard.press("Escape")
            q.wait_for_function("!m.paused&&w.audio.context.state==='running'")
            assert q.locator("#menuButton").get_attribute("aria-expanded") == "false"
            q.evaluate("g.step(.1)")
            assert q.evaluate("m.state.worldTime") > before[0]
            assert q.evaluate("m.keys.size===0")
            # P cannot hide another modal; Escape closes that modal without opening pause.
            q.locator("#shopButton").click()
            q.keyboard.press("p")
            assert q.locator("#shopDialog").is_visible() and not q.locator("#gameMenu").is_visible()
            q.keyboard.press("Escape")
            q.wait_for_function("!m.paused")
            assert not q.locator("#gameMenu").is_visible()
            # The menu only removes its own reason, never a blur/platform pause.
            q.locator("#menuButton").click()
            q.evaluate("w.pause('external-test',true);void 0")
            q.locator("[data-menu-close]").click()
            q.wait_for_function("!document.querySelector('#gameMenu').open")
            assert q.evaluate("m.paused&&w.pauseReasons.has('external-test')")
            q.evaluate("w.pause('external-test',false);void 0")
            q.wait_for_function("!m.paused")
            click_setting(q, "#effectsBtn")
            assert q.evaluate("!w.effectsLight&&!m.paused")
            click_setting(q, "#sound")
            q.wait_for_function("!w.audio.enabled&&w.audio.context.state==='suspended'")
            # Restart must remove the old document hotkey; one press opens exactly one menu.
            q.evaluate("window.old=m;w.scene.restart();void 0")
            q.wait_for_function("lumberPhaser.core!==old&&lumberPhaser.scene.hudReady")
            q.evaluate("window.g=lumberPhaser;window.m=g.core;window.w=g.scene;w.manual=true;void 0")
            q.keyboard.down("p")
            q.keyboard.down("p")  # Native repeat must not toggle it closed.
            q.keyboard.up("p")
            q.wait_for_selector("#gameMenu[open]")
            assert q.evaluate("m.paused&&!w.effectsLight&&!w.audio.context")
            q.keyboard.press("p")
            q.wait_for_function("!m.paused")
            if mobile:
                q.set_viewport_size({"width": 375, "height": 667})
                q.evaluate("scrollTo(0,0)")
                q.wait_for_timeout(100)
                assert q.evaluate("[...document.querySelectorAll('.game-actions button')].every(b=>b.getBoundingClientRect().bottom<=innerHeight&&b.getBoundingClientRect().height>=44)&&document.documentElement.scrollWidth<=innerWidth")
                q.locator("#menuButton").tap()
                q.wait_for_selector("#gameMenu[open]")
                q.locator("[data-menu-close]").tap()
                q.wait_for_function("!m.paused")
                q.screenshot(path=str(ROOT / "docs/mobile-actions-small.png"))
            q.evaluate("m.state.gameOver=true;void 0")
            q.keyboard.press("p")
            assert not q.locator("#gameMenu").is_visible()
            assert not errors, errors
            print("PASS game menu", "mobile Canvas/dist" if mobile else "desktop WebGL", "compact/touch, P/Esc, frozen state/audio, settings, other pause reasons, restart", flush=True)
            ctx.close()
            browser.close()
finally:
    server.shutdown()
