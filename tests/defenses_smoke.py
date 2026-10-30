"""Real Phaser input and defense transactions in desktop/mobile WebGL and Canvas build."""

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


def click_world(q, expr, mobile):
    q.locator("#game-frame").scroll_into_view_if_needed()
    x, y = q.evaluate(
        f"""()=>{{const p=({expr}),r=document.querySelector('canvas').getBoundingClientRect(),v=w.camera.worldView;return[r.x+(p.x-v.x)/g.game.scale.width*r.width,r.y+(p.y-v.y)/g.game.scale.height*r.height]}}"""
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
            q.on("pageerror", lambda e: errors.append(str(e)))
            q.goto(url + ("dist/" if mode == "canvas" else "phaser.html"))
            ready(q)
            q.locator("#defenseButton").click()
            assert q.locator("#defenseDialog").is_visible()
            assert q.evaluate("m.paused")
            assert q.locator("[data-defense-order]").count() == 0
            q.locator("[data-defense-close]").click()
            q.wait_for_function("!m.paused")
            q.evaluate(
                "m.state.campLevel=3;m.nav.rebuildObstacles();m.state.maxWood=82;for(let i=0;i<12;i++)m.forestry.addCargo(10);g.step(0)"
            )
            q.locator("#defenseButton").click()
            assert q.locator("[data-defense-order]").count() == 4
            q.locator('[data-defense-order="barricade-left"]').click()
            q.wait_for_function("!m.paused")
            assert q.evaluate('m.defenseOrder==="barricade-left"')
            q.evaluate("for(let i=0;i<100&&m.defenseOrder;i++)g.step(.1)")
            assert q.evaluate(
                'm.defenses.get("barricade-left").hp===60&&m.state.wood===9&&m.state.cargoValue===90'
            )
            assert q.evaluate(
                "!m.nav.isWalkable(1485,1840)&&m.nav.clearSegment({x:1600,y:2000},{x:1600,y:1750})"
            )
            q.locator("#defenseButton").click()
            q.locator('[data-defense-order="trap-left"]').click()
            q.wait_for_function("!m.paused")
            q.evaluate("for(let i=0;i<100&&m.defenseOrder;i++)g.step(.1)")
            assert q.evaluate('m.defenses.get("trap-left").hp===1&&m.state.wood===7')
            # Real click on a damaged section places a repair order. Model walks and repairs it.
            q.evaluate(
                'window.f=m.defenses.all().find(s=>s.id==="fence-0");m.defenses.damage(f.id,60);Object.assign(m.player,m.nav.nearestGround(f.x+30,f.y+30),{path:[]});g.step(0)'
            )
            click_world(q, "({x:f.x,y:f.y-15})", mobile)
            assert q.evaluate("m.defenseOrder===f.id")
            q.evaluate("for(let i=0;i<100&&m.defenseOrder;i++)g.step(.1)")
            assert q.evaluate(
                "m.defenses.get(f.id).hp===60&&m.state.wood===4&&!m.nav.isWalkable(f.x,f.y)"
            )
            # Three roles, native atlas frames, persistent pointer targeting and a visible health bar.
            q.evaluate(
                "while(m.state.wood)m.forestry.takeCargo();Object.assign(m.player,{x:1600,y:1720,path:[],autoTimer:1000});m.state.calendarDay=4;m.state.worldTime=299.99;g.step(.02);g.step(12.1);window.a=m.survival.raiders[0];Object.assign(a,{x:1640,y:1720,path:[],repath:100});m.survival.raiders.slice(1).forEach((e,i)=>Object.assign(e,{x:1500+i*180,y:1810,path:[],repath:100}));g.step(0)"
            )
            assert q.evaluate(
                'w.enemyView.objects.size===4&&w.assets.meta.has("survival.raider.thief0")&&w.assets.meta.has("survival.raider.breaker0")'
            )
            click_world(q, "({x:a.x,y:a.y-55})", mobile)
            assert q.evaluate("m.selectedEnemyId===a.id&&a.hp===3&&a.x>1640")
            q.evaluate("g.step(0)")
            assert q.evaluate('w.enemyView.objects.get(a.id).label.text.includes("▾")')
            # Stable labels must not regenerate canvas/GPU text textures every render.
            q.evaluate(
                "window.textUpdates=0;for(const label of [...w.defenseView.objects.map(o=>o.label),...Array.from(w.enemyView.objects.values(),o=>o.label)]){const update=label.updateText.bind(label);label.updateText=(...args)=>{textUpdates++;return update(...args)}};g.step(0);g.step(0)"
            )
            assert q.evaluate("textUpdates") == 0
            # Input to the ground cancels targeting and work orders.
            click_world(q, "({x:1600,y:1780})", mobile)
            assert q.evaluate("m.selectedEnemyId===null")
            q.evaluate("m.player.path=[];m.selectEnemy(a.id);g.step(0)")
            q.evaluate("g.step(.2)")
            if mode != "canvas":
                q.locator("#game-frame").screenshot(
                    path=str(ROOT / f"docs/defense-raid-{mode}.png")
                )
            # Menus freeze attacks and wave bookkeeping; a single win pays once.
            q.locator("#defenseButton").click()
            before = q.evaluate(
                "[m.state.worldTime,m.survival.raiders.length,m.state.coins]"
            )
            q.evaluate("g.step(5)")
            assert (
                q.evaluate(
                    "[m.state.worldTime,m.survival.raiders.length,m.state.coins]"
                )
                == before
            )
            q.locator("[data-defense-close]").click()
            q.wait_for_function("!m.paused")
            q.evaluate(
                "for(const e of [...m.survival.raiders])m.survival.hit(e.id,100);g.step(0)"
            )
            assert q.evaluate(
                'm.survival.wave.status==="won"&&m.state.coins===60&&m.state.raidsWon===1&&w.enemyView.objects.size===1'
            )
            q.evaluate("g.step(1)")
            assert q.evaluate("m.state.coins===60")
            q.evaluate("m.state.worldTime=599.99;g.step(.02)")
            assert q.evaluate("m.state.coins===60&&w.enemyView.objects.size===0")
            if mode == "desktop":
                q.locator("#defenseButton").click()
                q.locator("#defenseDialog").screenshot(
                    path=str(ROOT / "docs/defense-preparation.png")
                )
                q.locator("[data-defense-close]").click()
                q.wait_for_function("!m.paused")
            # Scene restart removes old DOM handlers and rebuilds pristine model data.
            q.evaluate("window.old=m;w.scene.restart();void 0")
            q.wait_for_function("lumberPhaser.core!==old&&lumberPhaser.scene.hudReady")
            ready(q)
            assert q.evaluate(
                "m.state.coins===0&&m.state.raidsWon===0&&Object.keys(m.state.defenseHP).length===0&&w.defenseView.objects.length===0"
            )
            q.locator("#defenseButton").click()
            assert q.locator("#defenseDialog").is_visible()
            q.locator("[data-defense-close]").click()
            q.wait_for_function("!m.paused")
            assert not errors, errors
            print(
                "PASS defenses",
                mode,
                "native targeting, exact cargo, barricades, traps, fence repair, reward, pause, restart",
                flush=True,
            )
            ctx.close()
            b.close()
finally:
    server.shutdown()
