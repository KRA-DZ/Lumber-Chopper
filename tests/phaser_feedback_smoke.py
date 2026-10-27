"""Hero motion, directional chopping, focused feedback and bounded visual objects."""

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
try:
    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=True,
            args=[
                "--no-sandbox",
                "--use-angle=swiftshader",
                "--enable-unsafe-swiftshader",
            ],
            **({"executable_path": which("chromium")} if which("chromium") else {}),
        )
        for mobile in (False, True):
            context = browser.new_context(
                viewport={"width": 390 if mobile else 1360, "height": 950},
                is_mobile=mobile,
                has_touch=mobile,
            )
            q = context.new_page()
            errors = []
            q.on("pageerror", lambda e: errors.append(str(e)))
            q.goto(url + "phaser.html")
            q.wait_for_function("!!window.lumberPhaser?.scene.hudReady")
            q.evaluate(
                "window.g=lumberPhaser;window.w=g.scene;window.m=g.core;w.manual=true"
            )
            assert q.evaluate(
                'w.anims.get("walk.player.neutral.down").frames.length===8&&w.anims.get("chop.0.up").frames.length===6'
            )
            q.evaluate("m.player.x=1620;m.player.y=1760;m.player.path=[];g.step(0)")
            q.keyboard.down("d")
            q.evaluate("g.step(.1)")
            q.keyboard.up("d")
            assert q.evaluate('w.heroView.pose==="walk"&&w.player.anims.isPlaying')
            q.evaluate(
                "m.player.path=[];m.state.maxWood=8;m.forestry.addCargo(10);g.step(0)"
            )
            assert q.evaluate('w.heroView.pose==="carry"')
            q.evaluate("while(m.state.wood<8)m.forestry.addCargo(10);g.step(0)")
            assert q.evaluate('w.heroView.pose==="heavy"&&w.cargo.length===8')
            q.evaluate(
                "while(m.state.wood)m.forestry.takeCargo();m.player.celebration=1;g.step(0)"
            )
            assert q.evaluate('w.heroView.pose==="cheer"')
            q.evaluate(
                'm.player.celebration=0;window.tree=m.trees.filter(t=>t.size===2&&t.type==="oak"&&m.treeAccessible(t)&&m.nav.isWalkable(t.x+58,t.y)).sort((a,b)=>{const score=t=>m.trees.filter(o=>o!==t&&o.y>t.y&&o.y<t.y+300&&Math.abs(o.x-t.x-58)<85).length;return score(a)-score(b)})[0];void 0'
            )
            for direction, dx, dy in [
                ("left", 46, 0),
                ("right", -46, 0),
                ("up", 0, 58),
                ("down", 0, -58),
            ]:
                q.evaluate(
                    """([dx,dy])=>{m.player.x=tree.x+dx;m.player.y=tree.y+dy;m.player.path=[];m.hitTree(tree);g.step(0)}""",
                    [dx, dy],
                )
                assert q.evaluate(
                    'w.heroView.pose==="strike"&&w.feedback.barVisible&&w.feedback.target===tree'
                )
                assert q.evaluate("m.player.direction") == direction
                q.wait_for_function("w.axe.anims.currentFrame.index>=2", timeout=2000)
                assert q.evaluate("w.axe.anims.currentFrame.index>=2")
                q.evaluate('w.pause("test",true);void 0')
                frame = q.evaluate("w.axe.frame.name")
                before = q.evaluate("[tree.hp,m.state.wood,m.state.worldTime]")
                q.wait_for_timeout(90)
                q.evaluate("g.step(1)")
                assert q.evaluate("w.axe.frame.name") == frame
                assert q.evaluate("[tree.hp,m.state.wood,m.state.worldTime]") == before
                q.evaluate('w.pause("test",false);void 0')
                q.wait_for_timeout(200)
            # Capture a real early strike with a single health badge, then the finishing impact.
            q.evaluate(
                "m.player.x=tree.x+58;m.player.y=tree.y;m.hitTree(tree);g.step(0)"
            )
            q.wait_for_timeout(40)
            q.locator("#game-frame").screenshot(
                path=str(ROOT / f'docs/chopping-{"mobile"if mobile else "hero"}.png')
            )
            q.evaluate("while(tree.hp>0)m.hitTree(tree);g.step(0)")
            assert q.evaluate(
                "!w.feedback.barVisible&&w.feedback.impacts.length>0&&m.forestry.piles.has(tree.id)"
            )
            # A render alone cannot consume a pile; nearby brackets disappear with full hands.
            q.evaluate(
                'm.player.x=1600;m.player.y=1760;m.player.path=[];for(let i=0;i<14;i++)m.forestry.piles.set("fixture"+i,{id:"fixture"+i,x:1600+(i%5)*10,y:1760+Math.floor(i/5)*8,count:3,value:10});g.step(0)'
            )
            assert q.evaluate("w.feedback.highlightCount===8")
            before = q.evaluate("m.forestry.piles.size")
            q.evaluate(
                "window.objectCount=w.children.length;for(let i=0;i<200;i++)w.renderModel()"
            )
            assert q.evaluate(
                "w.children.length<=objectCount&&w.feedback.highlightCount<=8"
            )
            assert q.evaluate("m.forestry.piles.size") == before
            q.locator("#effectsBtn").click()
            q.evaluate("g.step(0)")
            assert q.evaluate("w.feedback.highlightCount===3")
            q.locator("#effectsBtn").click()
            q.evaluate(
                "while(m.state.wood<m.state.maxWood)m.forestry.addCargo(10);g.step(0)"
            )
            assert q.evaluate("w.feedback.highlightCount===0")
            # Genuine rapid cutting exercises caps; visual completion never awards additional resources.
            q.evaluate(
                "m.forestry.piles.clear();for(const t of m.trees.filter(t=>m.treeAccessible(t)&&t.hp>0).slice(0,25))while(t.hp>0)m.hitTree(t);g.step(0)"
            )
            assert q.evaluate(
                "w.feedback.impacts.length<=4&&w.falls.length<=4&&w.labels.length<=32&&w.chips.getAliveParticleCount()<=64"
            )
            before = q.evaluate("[m.state.wood,m.state.coins,m.forestry.piles.size]")
            q.wait_for_timeout(1300)
            assert (
                q.evaluate("[m.state.wood,m.state.coins,m.forestry.piles.size]")
                == before
            )
            assert not errors, errors
            print(
                "PASS hero/feedback",
                "mobile" if mobile else "desktop",
                "walk/carry/heavy/cheer, four strike directions, pause, one badge, local pile highlights, bounded bursts, resource invariants",
                flush=True,
            )
            context.close()
        browser.close()
finally:
    server.shutdown()
