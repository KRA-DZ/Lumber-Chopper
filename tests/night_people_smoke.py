"""Only grounded side motion, retained lantern, opaque night and faster watcher attacks."""

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


def focus(q, point):
    q.evaluate(
        "p=>{Object.assign(m.player,p,{path:[],moving:false,autoTimer:10000});w.camera.stopFollow();w.camera.centerOn(p.x,p.y-120);w.atmosphere.maskKey='';g.step(0)}",
        point,
    )
    q.wait_for_timeout(150)
    q.evaluate("w.atmosphere.maskKey='';g.step(0)")


def mask(q, point):
    return q.evaluate(
        "p=>{const a=w.atmosphere,v=w.camera.worldView,c=a.mask.getSourceImage(),x=Math.floor((p.x-v.x)/v.width*c.width),y=Math.floor((p.y-v.y)/v.height*c.height);return [...a.mask.getContext().getImageData(x,y,1,1).data]}",
        point,
    )


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
            q.on(
                "pageerror",
                lambda e: (
                    errors.append(str(e)),
                    print("PAGE ERROR", str(e), flush=True),
                ),
            )
            base = f"http://127.0.0.1:{server.server_port}/"
            q.goto(base + ("dist/" if mobile else "phaser.html"))
            choose_hero(q, "woodcutter" if mobile else "traveler")
            q.evaluate(
                "window.g=lumberPhaser;window.w=g.scene;window.m=g.core;w.manual=true;m.player.autoTimer=10000;g.step(0)"
            )
            print(
                "READY motion/night", "mobile Canvas" if mobile else "WebGL", flush=True
            )
            assert q.evaluate(
                "w.assets.people.manifest.version===2&&w.textures.get('forest').getSourceImage().height<=2048"
            )
            # Native motion keeps the feet on the body, without an extra view-level hop.
            q.keyboard.down("d")
            q.evaluate("g.step(.08)")
            assert q.evaluate(
                "w.player.anims.isPlaying&&w.player.anims.currentAnim.frameRate===8&&w.heroView.bob===0&&Math.abs(w.player.y-m.player.y)<=1"
            )
            for _ in range(5):
                q.wait_for_timeout(140)
                assert q.evaluate(
                    "w.heroView.bob===0&&Math.abs(w.player.y-m.player.y)<=1"
                )
            q.keyboard.up("d")
            q.evaluate("g.step(.05)")
            q.evaluate(
                "m.state.maxWood=40;for(let i=0;i<30;i++)m.forestry.addCargo(10);m.player.moving=true;m.player.direction='right';m.player.celebration=0;w.renderModel()"
            )
            assert q.evaluate(
                "w.heroView.bob===0&&w.heroView.pose==='heavy'&&w.cargo.filter(l=>l.visible).length===30"
            )
            q.evaluate(
                "while(m.state.wood)m.forestry.takeCargo();m.player.moving=false;g.step(0)"
            )
            # All six NPC designs use four distinct side poses, including worker carry poses.
            assert q.evaluate(
                """()=>{const roles=['worker3','worker4','buyer1','buyer2','buyer3','buyer4'];const samples=roles.map((role,i)=>({role,body:{id:i,x:1600,y:1800,moving:true,direction:'right',phase:'outbound',cargo:[],swing:0},image:w.add.sprite(1600,1800,'forest',`person.${role}-walk-side-0`),keys:new Set()}));for(let i=0;i<4;i++){m.update(.125);for(const a of samples){w.animatePerson(a.image,a.role,a.body);a.keys.add(a.image.frame.name);if(a.image.y!==1800)return false;}}const ok=samples.every(a=>a.keys.size===4);for(const a of samples){if(a.role.startsWith('worker')){a.body.cargo=[8];a.keys.clear();for(let i=0;i<4;i++){m.update(.125);w.animatePerson(a.image,a.role,a.body);a.keys.add(a.image.frame.name);}if(a.keys.size!==4)return false;}a.image.destroy();}return ok;}"""
            )

            q.evaluate(
                "m.state.campLevel=1;m.nav.rebuildObstacles();m.state.worldTime=299.99;g.step(.02);m.state.worldTime=450"
            )
            focus(q, {"x": 2280, "y": 1940})
            assert q.evaluate(
                "w.atmosphere.lights()[0].kind==='player'&&w.atmosphere.lights()[0].r===140"
            )
            far = q.evaluate(
                "({x:w.camera.worldView.right-20,y:w.camera.worldView.y+20})"
            )
            assert mask(q, far) == [0, 0, 0, 255]
            assert mask(q, {"x": 2280, "y": 1916})[3] == 0
            before = mask(q, {"x": 2470, "y": 1916})[3]
            assert before == 255
            # Buy the real existing lantern upgrades through mouse/touch UI.
            q.evaluate("m.state.coins=100000")
            (
                q.locator("#shopButton").tap()
                if mobile
                else q.locator("#shopButton").click()
            )
            q.wait_for_function("document.querySelector('#shopDialog').open")
            assert "Лесной фонарь" in q.locator("#shopDialog").inner_text()
            for level in range(1, 5):
                (
                    q.locator('[data-buy="lantern"]').tap()
                    if mobile
                    else q.locator('[data-buy="lantern"]').click()
                )
                assert q.evaluate("m.state.lanternLevel") == level
            q.locator("#shopDialog [data-close]").click()
            q.wait_for_function("!m.paused")
            q.evaluate("w.atmosphere.maskKey='';g.step(0)")
            assert q.evaluate("w.atmosphere.lights()[0].r===236")
            assert mask(q, {"x": 2470, "y": 1916})[3] < before
            assert mask(q, far) == [0, 0, 0, 255]
            # Decorative eyes are above the mask while the terrain beneath stays opaque.
            q.evaluate(
                "w.atmosphere.mystery.eyes.length=0;w.atmosphere.mystery.eyes.push({x:2500,y:1600,age:1,life:20,phase:0});g.step(0)"
            )
            assert mask(q, {"x": 2500, "y": 1600}) == [0, 0, 0, 255]
            q.locator("#game-frame").screenshot(
                path=str(
                    ROOT
                    / (
                        "docs/night-black-mobile.png"
                        if mobile
                        else "docs/night-black-forest.png"
                    )
                )
            )
            (
                q.locator("#effectsBtn").tap()
                if mobile
                else q.locator("#effectsBtn").click()
            )
            q.evaluate("w.atmosphere.maskKey='';g.step(0)")
            assert q.evaluate("w.effectsLight") and mask(q, far) == [0, 0, 0, 255]
            (
                q.locator("#effectsBtn").tap()
                if mobile
                else q.locator("#effectsBtn").click()
            )
            focus(q, {"x": 1600, "y": 1720})
            assert mask(q, {"x": 1600, "y": 1600})[3] == 0
            if not mobile:
                assert 0 < mask(q, {"x": 2000, "y": 1600})[3] < 255
                q.locator("#game-frame").screenshot(
                    path=str(ROOT / "docs/night-black-camp.png")
                )

            # Existing warnings, pause, locked attack area and camp sanctuary remain real.
            q.evaluate(
                "g.step(12.1);window.clear=m.nav.nearestGround(1600,2000);Object.assign(m.player,clear,{path:[],autoTimer:10000});Object.assign(m.survival.monster,{x:clear.x+40,y:clear.y,path:[],warning:0,repath:100,senseTimer:0,phase:'waking',phaseTime:0});for(let i=0;i<60&&m.survival.monster.phase!=='windup';i++)g.step(.025)"
            )
            assert q.evaluate(
                "m.survival.monster.phase==='windup'&&m.survival.monster.attack.duration===.55&&m.survival.hit('watcher',99999)===false"
            )
            q.evaluate(
                "window.attack={...m.survival.monster.attack};window.time=m.survival.monster.phaseTime"
            )
            q.locator("#shopButton").click()
            q.wait_for_function("m.paused")
            q.evaluate("g.step(3)")
            assert q.evaluate("m.survival.monster.phaseTime===time")
            q.locator("#shopDialog [data-close]").click()
            q.wait_for_function("!m.paused")
            q.keyboard.down("a")
            q.evaluate("g.step(.35)")
            q.keyboard.up("a")
            assert q.evaluate(
                "JSON.stringify(m.survival.monster.attack)===JSON.stringify(attack)&&Math.hypot(m.player.x-attack.x,m.player.y-attack.y)>54"
            )
            q.evaluate("g.step(.3)")
            assert q.evaluate("m.state.health===100")
            q.evaluate("Object.assign(m.player,{x:1600,y:1720,path:[]});g.step(.05)")
            assert q.evaluate(
                "m.survival.monster.phase==='repelled'&&m.state.health===100"
            )
            q.evaluate(
                "Object.assign(m.player,clear,{path:[],autoTimer:10000});Object.assign(m.survival.monster,{x:clear.x+40,y:clear.y,path:[],repath:100,senseTimer:0,phase:'waking',phaseTime:0});for(let i=0;i<160&&!m.state.gameOver;i++)g.step(.05)"
            )
            assert q.evaluate("m.state.gameOver&&m.state.health===0")
            q.evaluate("window.old=m;w.scene.restart();void 0")
            q.wait_for_function("lumberPhaser.core!==old&&lumberPhaser.scene.hudReady")
            assert q.evaluate(
                "lumberPhaser.core.state.health===100&&lumberPhaser.core.state.lanternLevel===0&&!lumberPhaser.scene.atmosphere.shade.visible"
            )
            assert not errors, errors
            print(
                "PASS motion/night",
                "mobile Canvas" if mobile else "WebGL",
                "grounded heroes/NPC, carry, black exterior, all lantern upgrades, eyes, light mode, dodge/pause/sanctuary/lethal watcher, reset",
                flush=True,
            )
            ctx.close()
            browser.close()
finally:
    server.shutdown()
