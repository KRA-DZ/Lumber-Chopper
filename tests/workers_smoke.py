"""Worker hiring, actual trips, stock/sales, sunset safety and restart on three renderers."""

from helpers.browser_start import choose_hero

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
    choose_hero(q)
    q.wait_for_function("!!window.lumberPhaser?.scene.hudReady", timeout=60000)
    q.evaluate(
        "window.g=lumberPhaser;window.m=g.core;window.w=g.scene;w.manual=true;g.step(0)"
    )


def close(q):
    q.locator("[data-worker-close]").click()
    q.wait_for_function("!m.paused")


def action(q, name):
    return q.locator(f'[data-worker-action="{name}"]')


def until(q, expr, seconds=90):
    q.evaluate(
        """([expr,seconds])=>{const done=()=>eval(expr);for(let i=0;i<seconds*20&&!done();i++)m.update(.05);g.step(0);if(!done())throw Error(JSON.stringify({time:m.state.worldTime,crew:m.workers.crew}))}""",
        [expr, seconds],
    )


def click_depot(q, mobile):
    q.locator("#game-frame").scroll_into_view_if_needed()
    x, y = q.evaluate(
        """()=>{const r=document.querySelector('canvas').getBoundingClientRect(),v=w.camera.worldView;return [r.x+(1710-v.x)/g.game.scale.width*r.width,r.y+(1768-v.y)/g.game.scale.height*r.height]}"""
    )
    if mobile:
        q.touchscreen.tap(x, y)
    else:
        q.mouse.click(x, y)


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
            print("READY workers", mode, flush=True)
            q.locator("#workerButton").click()
            assert q.locator("#workerDialog").is_visible()
            assert action(q, "hire").is_disabled()
            assert (
                q.locator("[data-worker-requirements]")
                .inner_text()
                .startswith("Сначала")
            )
            before = q.evaluate("m.state.worldTime")
            q.evaluate("g.step(10)")
            assert q.evaluate("m.state.worldTime") == before
            close(q)
            # Fixture funds/logs, then real construction and a fully paid frontier, no free region flags.
            q.evaluate(
                """m.player.autoTimer=1000;m.state.maxWood=82;for(let i=0;i<30;i++)m.forestry.addCargo(10);Object.assign(m.player,{x:m.build.x,y:m.build.y,path:[]});m.update(6.5);window.gate=m.regions.frontiers().find(g=>g.region.id==='1:0');Object.assign(m.player,{x:gate.x,y:gate.y,path:[]});for(let i=0;i<12;i++)m.forestry.addCargo(10);m.update(2.7);m.state.coins=1950;g.step(0)"""
            )
            assert q.evaluate(
                "m.state.campLevel===2&&m.workers.available()&&m.state.wood===0"
            )
            q.locator("#workerButton").click()
            assert action(q, "hire").is_disabled()  # remote
            action(q, "route").click()
            q.wait_for_function("!m.paused")
            until(q, "!m.player.path.length", 20)
            assert q.evaluate("m.workers.atDepot()")
            q.keyboard.press("h")
            assert q.locator("#workerDialog").is_visible()
            for _ in range(3):
                action(q, "hire").click()
            for _ in range(2):
                action(q, "upgrade").click()
            assert action(q, "hire").is_disabled()
            assert action(q, "upgrade").is_disabled()
            assert q.locator("[data-worker-id]").count() == 3
            assert q.evaluate(
                "m.state.coins===0&&m.workers.capacity()===8&&m.workers.crew.length===3"
            )
            action(q, "sell").click()  # reserve output for construction
            if mode != "canvas":
                q.locator("#workerDialog").evaluate("el=>{el.scrollTop=0}")
                q.locator("#workerDialog").screenshot(
                    path=str(ROOT / f"docs/workers-menu-{mode}.png")
                )
            close(q)
            until(q, "m.workers.crew.every(n=>n.phase==='cutting')", 30)
            q.evaluate("m.setDestination(3420,1800)")
            until(q, "!m.player.path.length", 20)
            assert q.evaluate(
                "w.workerView.objects.size===3&&w.workerView.objects.get(0).sprite.frame.name.startsWith('person.worker3-')&&w.workerView.objects.get(1).sprite.frame.name.startsWith('person.worker4-')"
            )
            until(q, "m.workers.crew.every(n=>n.cargo.length>=4)", 15)
            q.evaluate("g.step(0)")
            assert q.evaluate(
                "[...w.workerView.objects.values()].every(o=>o.logs.filter(l=>l.visible).length>=4)"
            )
            if mode == "desktop":
                q.evaluate(
                    "w.expansionBanner=null;w.scene.get('Hud').tweens.killTweensOf(w.scene.get('Hud').banner);w.scene.get('Hud').banner.setVisible(false);void 0"
                )
                q.locator("#game-frame").screenshot(
                    path=str(ROOT / "docs/workers-ancient-oak.png")
                )
            # Real deliveries; no auto-income before a log has reached the warehouse.
            until(q, "m.workers.data.delivered>=24", 45)
            assert q.evaluate(
                "m.workers.data.stock.length===24&&m.workers.data.earned===0&&m.state.coins===0"
            )
            q.evaluate("m.navigateWorkers()")
            until(q, "!m.player.path.length", 20)
            q.evaluate("m.state.maxWood=2;g.step(0)")
            click_depot(q, mobile)
            assert q.locator("#workerDialog").is_visible()
            action(q, "withdraw").click()
            action(q, "withdraw").click()
            assert action(q, "withdraw").is_disabled()
            assert q.evaluate(
                "m.state.wood===2&&m.state.cargoValue===16&&m.workers.data.stock.length===22"
            )
            # Reserved logs build the next camp stage through the ordinary blue platform.
            close(q)
            q.evaluate("m.setDestination(m.build.x,m.build.y)")
            until(q, "m.state.wood===0", 10)
            assert q.evaluate("m.state.buildWood===2&&m.state.cargoValue===0")
            q.locator("#workerButton").click()
            action(q, "sell").click()
            action(q, "recall").click()
            close(q)
            until(q, "m.workers.data.earned>=8", 15)
            assert q.evaluate(
                "m.state.coins===m.workers.data.earned&&m.buyers.every(b=>b.load<=b.capacity)"
            )
            until(q, "m.workers.crew.every(n=>n.phase==='resting')", 40)
            assert q.evaluate(
                "m.workers.crew.every(n=>Math.hypot(n.x-1600,n.y-1600)<310)"
            )
            # Explicit release starts work, but the sunset warning recalls them again.
            q.locator("#workerButton").click()
            action(q, "recall").click()
            close(q)
            q.evaluate("m.state.worldTime=210;m.update(15);g.step(0)")
            assert q.evaluate(
                "m.workers.crew.some(n=>Math.hypot(n.x-1600,n.y-1600)>1000)"
            )
            q.evaluate("m.state.worldTime=239.99;m.update(.02)")
            until(
                q,
                "m.workers.crew.every(n=>n.phase==='resting'||n.phase==='waiting')",
                45,
            )
            assert q.evaluate(
                "m.state.worldTime<300&&m.workers.crew.every(n=>Math.hypot(n.x-1600,n.y-1600)<310)"
            )
            # Enter a real night: no worker production, the Watcher/wave schedule remain unchanged.
            before = q.evaluate("m.workers.data.delivered")
            q.evaluate("m.state.worldTime=299.99;m.update(.02);m.update(13);g.step(0)")
            assert q.evaluate(
                "m.survival.monster?.invulnerable&&m.survival.raiders.length===0"
            )
            assert q.evaluate("m.workers.data.delivered") == before
            # Stable worker/stock text causes no GPU canvas text updates each frame.
            q.evaluate(
                "window.workerTextUpdates=0;for(const label of [w.workerView.label,...[...w.workerView.objects.values()].map(o=>o.label)]){const fn=label.updateText.bind(label);label.updateText=(...a)=>{workerTextUpdates++;return fn(...a)}};g.step(0);g.step(0)"
            )
            assert q.evaluate("workerTextUpdates") == 0
            assert q.evaluate(
                "g.assets.meta.size>0&&g.game.textures.get('forest').source[0].width===2048&&g.game.textures.get('forest').source[0].height===2048"
            )
            q.evaluate("m.state.worldTime=599.99;m.update(.02)")
            until(q, "m.workers.crew.some(n=>n.phase==='outbound')", 5)
            # Defeat disables the new menu too; restart removes DOM listeners and all model state.
            q.evaluate(
                "m.state.health=0;w.survivalUi.defeat({reason:'Проверка',nightsSurvived:1});void 0"
            )
            assert q.locator("#workerButton").is_disabled()
            q.evaluate("window.old=m;w.scene.restart();void 0")
            q.wait_for_function(
                "window.lumberPhaser?.core!==old&&window.lumberPhaser?.scene.hudReady",
                timeout=60000,
            )
            ready(q)
            assert q.evaluate(
                "m.workers.crew.length===0&&m.workers.data.stock.length===0&&m.workers.data.level===0&&w.workerView.objects.size===0"
            )
            q.locator("#workerButton").click()
            assert q.locator("#workerDialog").is_visible()
            assert q.locator("[data-worker-summary]").count() == 1
            close(q)
            assert not errors, errors
            print(
                "PASS workers",
                mode,
                "hire/upgrades, paths, stacked logs, reserve/build/sales, recall/dawn, pause, bounded atlas/text, restart",
                flush=True,
            )
            ctx.close()
            b.close()
finally:
    server.shutdown()
