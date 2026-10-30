"""Actual region activities, native pointer/keyboard input, paused menus and live fishing."""

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
        "window.g=lumberPhaser;window.m=g.core;window.w=g.scene;window.e=m.exploration;window.d=m.state.exploration;w.manual=true;g.step(0)"
    )


def click_world(q, expr, mobile):
    q.locator("#game-frame").scroll_into_view_if_needed()
    x, y = q.evaluate(
        f"""()=>{{const p=({expr}),r=document.querySelector('canvas').getBoundingClientRect(),v=w.camera.worldView;return[r.x+(p.x-v.x)/g.game.scale.width*r.width,r.y+(p.y-v.y)/g.game.scale.height*r.height]}}"""
    )
    if mobile:
        q.touchscreen.tap(x, y)
    else:
        q.mouse.click(x, y)


def go(q, id):
    q.evaluate(
        "id=>{const s=e.get(id),p=m.nav.nearestGround(s.x,s.y+48);Object.assign(m.player,p,{path:[],moving:false});g.step(0)}",
        id,
    )


def close(q):
    q.locator("[data-activity-close]").click()
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
                lambda ex: (
                    errors.append(str(ex)),
                    print("PAGE ERROR", mode, str(ex), flush=True),
                ),
            )
            q.goto(url + ("dist/" if mode == "canvas" else "phaser.html"))
            ready(q)
            print("READY exploration", mode, flush=True)
            assert q.evaluate(
                'w.assets.meta.has("exploration.chestOpen")&&w.assets.meta.has("exploration.rod")&&w.textures.get("forest").getSourceImage().height<=2048'
            )
            q.locator("#bagButton").click()
            assert q.locator("#activityDialog").is_visible()
            assert q.locator('[data-site-route="fishing"]').is_disabled()
            assert q.evaluate("m.paused")
            close(q)
            # Open all four neighbours through the actual log transaction, not unlocked-state edits.
            q.evaluate(
                """window.openRegion=id=>{const gate=m.regions.frontiers().find(g=>g.region.id===id);Object.assign(m.player,{x:gate.x,y:gate.y,path:[]});while(m.state.wood)m.forestry.takeCargo();m.state.maxWood=82;for(let i=0;i<gate.region.cost;i++)m.forestry.addCargo(10);for(let i=0;i<=gate.region.cost;i++)g.step(.2)};for(const id of ["0:1","-1:0","1:0","0:-1"])openRegion(id);m.state.coins=200;m.state.worldTime=120;w.expansionBanner=null;w.scene.get("Hud").banner.setVisible(false);void 0;"""
            )
            go(q, "mysterious-merchant")
            click_world(q, "({x:m.world.merchant.x,y:m.world.merchant.y-75})", mobile)
            assert q.locator("#activityDialog").is_visible()
            assert q.evaluate('m.paused&&e.context==="mysterious-merchant"')
            q.locator('[data-activity-action="buy-rod"]').click()
            q.locator('[data-activity-action="buy-key"]').click()
            assert q.evaluate("d.rod&&d.items.key===1&&m.state.coins===90")
            if mode == "desktop":
                q.locator("#activityDialog").screenshot(
                    path=str(ROOT / "docs/exploration-merchant.png")
                )
            close(q)
            # Native E opens the nearer chest, not a nearby story note.
            go(q, "chest:0:-1:0")
            q.keyboard.press("e")
            assert q.evaluate('e.context==="chest:0:-1:0"')
            q.locator('[data-activity-action="open-chest"]').click()
            assert q.evaluate(
                "m.state.coins===145&&d.items.key===0&&d.items.relic===1&&d.openedChests.length===1"
            )
            assert q.locator('[data-activity-action="open-chest"]').is_disabled()
            close(q)
            q.evaluate("g.step(0)")
            assert q.evaluate(
                'Array.from(w.regionView.objects.values()).flat().find(o=>o.getData("chest")==="chest:0:-1:0").frame.name==="exploration.chestOpen"'
            )
            if mode == "desktop":
                q.locator("#game-frame").screenshot(
                    path=str(ROOT / "docs/exploration-chest.png")
                )
            # Stream away and return; chest visual and one-time loot survive object disposal.
            go(q, "fishing")
            go(q, "chest:0:-1:0")
            q.keyboard.press("e")
            assert q.locator('[data-activity-action="open-chest"]').is_disabled()
            close(q)
            # Root offering removes three exact stack entries. One daily reward, no axe harvesting.
            go(q, "ancient-roots")
            q.evaluate(
                "m.forestry.addCargo(11);m.forestry.addCargo(12);m.forestry.addCargo(13);g.step(0)"
            )
            q.keyboard.press("e")
            q.locator('[data-activity-action="offer-logs"]').click()
            assert q.evaluate(
                "d.items.resin===1&&m.state.wood===0&&m.state.cargoValue===0&&m.world.ancientTree.workerOnly"
            )
            assert q.locator('[data-activity-action="offer-logs"]').is_disabled()
            close(q)
            # Fishing runs with world time and can be paused by an ordinary dialog.
            go(q, "fishing")
            q.keyboard.press("e")
            q.locator('[data-activity-action="fish"]').click()
            q.wait_for_function("!m.paused")
            q.evaluate("g.step(0)")
            assert q.evaluate(
                "!!e.fishing&&w.explorationView.rod.visible&&!w.axe.visible"
            )
            q.locator("#shopButton").click()
            timer = q.evaluate("e.fishing.timer")
            q.evaluate("g.step(10)")
            assert q.evaluate("e.fishing.timer") == timer
            q.locator("#shopDialog [data-close]").click()
            q.wait_for_function("!m.paused")
            before = q.evaluate("m.state.worldTime")
            q.evaluate('for(let i=0;i<150&&e.fishing?.phase!=="bite";i++)g.step(.05)')
            assert q.evaluate('e.fishing.phase==="bite"&&m.state.worldTime') > before
            assert q.locator("[data-reel]").is_enabled()
            if mode == "desktop":
                q.locator("#game-frame").screenshot(
                    path=str(ROOT / "docs/exploration-fishing.png")
                )
            assert q.evaluate('w.scene.get("Hud").tutorial.text.includes("Клюёт!")')
            if mobile:
                q.locator("#game-frame").scroll_into_view_if_needed()
                x, y = q.evaluate(
                    """()=>{const h=w.scene.get("Hud"),r=document.querySelector("canvas").getBoundingClientRect();return[r.x+h.guideButton.x/g.game.scale.width*r.width,r.y+(h.guideButton.y-h.guideButton.height/2)/g.game.scale.height*r.height]}"""
                )
                q.touchscreen.tap(x, y)
            else:
                q.keyboard.press("Space")
            q.evaluate("g.step(0)")
            assert q.evaluate("d.items.fish===1&&!e.fishing&&w.axe.visible")
            if mode == "mobile":
                q.locator("#game-frame").screenshot(
                    path=str(ROOT / "docs/exploration-mobile.png")
                )
            # Cooking heals, trader sells a separate consumable, bag can use it.
            q.evaluate("m.state.campLevel=1;m.state.health=50;m.nav.rebuildObstacles()")
            go(q, "camp-kitchen")
            q.keyboard.press("e")
            q.locator('[data-activity-action="cook-fish"]').click()
            assert q.evaluate("m.state.health===70&&d.items.fish===0")
            close(q)
            go(q, "mysterious-merchant")
            q.keyboard.press("e")
            q.locator('[data-activity-action="sell-relic"]').click()
            assert q.evaluate("m.state.coins===185&&d.items.relic===0")
            q.locator('[data-activity-action="buy-salve"]').click()
            assert q.evaluate(
                "d.items.salve===1&&d.items.resin===0&&m.state.coins===155"
            )
            close(q)
            q.locator("#bagButton").click()
            q.locator('[data-use-item="salve"]').click()
            assert q.evaluate("m.state.health===100&&d.items.salve===0")
            close(q)
            # Reusing the same dialog for an already-near route must not unpause or lose context.
            q.locator("#bagButton").click()
            q.locator('[data-site-route="mysterious-merchant"]').click()
            q.wait_for_function('m.paused&&e.context==="mysterious-merchant"')
            assert q.locator('[data-activity-action="buy-key"]').is_enabled()
            close(q)
            # Native map describes activities and routes to land at the dock rather than pond centre.
            q.locator("#mapButton").click()
            assert "Рыба сегодня: 1/4" in q.locator('[data-region="-1:0"]').inner_text()
            q.locator('[data-region="-1:0"]').click()
            q.wait_for_function("!m.paused")
            assert q.evaluate('m.player.targetX===e.get("fishing").x')
            # Leaving the dock cancels a cast, no free catch; keyboard movement remains usable.
            go(q, "fishing")
            q.keyboard.press("e")
            q.locator('[data-activity-action="fish"]').click()
            q.wait_for_function("!m.paused")
            q.keyboard.down("d")
            q.evaluate("g.step(.1)")
            q.keyboard.up("d")
            assert q.evaluate("!e.fishing&&d.items.fish===0")
            # Cleanup detaches menu/control listeners and resets all session progress.
            q.evaluate("window.old=m;w.scene.restart();void 0")
            q.wait_for_function(
                "window.lumberPhaser?.core!==old&&window.lumberPhaser?.scene.hudReady",
                timeout=60000,
            )
            ready(q)
            assert q.evaluate(
                "!d.rod&&d.openedChests.length===0&&Object.values(d.items).every(v=>v===0)&&!e.fishing"
            )
            q.locator("#bagButton").click()
            close(q)
            assert not errors, errors
            print(
                "PASS exploration",
                mode,
                "merchant, one-time chest, streaming, roots, timed fishing, cooking, bag, map, mouse/touch, modal lifecycle, restart",
                flush=True,
            )
            ctx.close()
            b.close()
finally:
    server.shutdown()
