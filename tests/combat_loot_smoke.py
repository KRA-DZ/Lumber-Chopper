"""Targeted canonical entry/old URL, native combat pickup, PNG pile, shop and fresh reset."""
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


def tap(q, point, mobile):
    q.locator("#game-frame").scroll_into_view_if_needed()
    x, y = q.evaluate("p=>{const r=document.querySelector('canvas').getBoundingClientRect(),v=w.camera.worldView;return[r.x+(p.x-v.x)/v.width*r.width,r.y+(p.y-v.y)/v.height*r.height]}", point)
    q.touchscreen.tap(x, y) if mobile else q.mouse.click(x, y)


def prepare(q, name):
    q.evaluate(f"""()=>{{const e={name};for(let i=0;i<16;i++){{const a=i*Math.PI/8,p={{x:e.x+Math.cos(a)*38,y:e.y+Math.sin(a)*38}};if(m.nav.isWalkable(p.x,p.y)&&m.nav.clearSegment(e,p)){{Object.assign(m.player,p,{{path:[],autoTimer:10000,clickTimer:0}});w.camera.stopFollow();w.camera.centerOn(p.x,p.y-70);g.step(0);return;}}}}throw Error('No free melee position')}}""")
    q.wait_for_timeout(100)
    q.evaluate("g.step(0)")


def body(q, name):
    return q.evaluate("id=>{const im=w.enemyView.objects.get(id).image,f=im.frame,data=w.textures.get('forest').getSourceImage().getContext('2d').getImageData(f.cutX,f.cutY,f.cutWidth,f.cutHeight).data;let best=null;for(let y=0;y<f.cutHeight;y++)for(let x=0;x<f.cutWidth;x++){if(data[(y*f.cutWidth+x)*4+3]<200)continue;const d=(x-f.cutWidth/2)**2+(y-f.cutHeight*.6)**2;if(!best||d<best.d)best={x,y,d};}return{x:im.x+(best.x+.5-im.displayOriginX)*im.scaleX,y:im.y+(best.y+.5-im.displayOriginY)*im.scaleY}}", q.evaluate(f"{name}.id"))


def collect(q, mobile):
    point = q.evaluate("()=>{const p=[...m.combatLoot.piles.values()][0];return {x:p.x,y:p.y}}")
    tap(q, point, mobile)
    q.evaluate("for(let i=0;i<80&&m.combatLoot.piles.size;i++)g.step(.05)")


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
            base = f"http://127.0.0.1:{server.server_port}/"
            q.goto(base + ("dist/" if mobile else "phaser.html?art=procedural#camp"))
            choose_hero(q)
            if not mobile:
                assert q.url == base + "index.html?art=procedural#camp"
            assert q.locator("[data-legacy-link]").count() == 0
            q.evaluate("window.g=lumberPhaser;window.m=g.core;window.w=g.scene;w.manual=true;void 0")
            assert q.evaluate("w.assets.decor.variant===3&&g.game.registry.has('importedPack')&&m.state.coins===0")
            q.evaluate("const r=m.regions.all.find(r=>r.id==='1:0');m.regions.unlocked.add(r.id);m.world.generate(r);m.nav.rebuildObstacles();Object.assign(m.player,{x:3520,y:1600,path:[],autoTimer:10000});g.step(6.5);window.small=m.survival.minions.find(e=>e.role==='melee');for(const e of m.survival.minions)if(e!==small){e.warning=1000;e.x+=600}g.step(0)")
            prepare(q, "small")
            for _ in range(18):
                if not q.evaluate("m.survival.minions.some(e=>e.id===small.id)"):
                    break
                tap(q, body(q, "small"), mobile)
                q.evaluate("g.step(m.survival.minions.some(e=>e.id===small.id)?.2:0)")
            assert q.evaluate("!m.survival.minions.some(e=>e.id===small.id)&&m.combatLoot.piles.size===1&&m.state.coins===0")
            assert q.evaluate("w.combatLootView.objects.size===1&&[...w.combatLootView.objects.values()][0].image.frame.name==='loot.coins'&&w.textures.get('forest').getSourceImage().height<=2048")
            if not mobile:
                q.locator("#game-frame").screenshot(path=str(ROOT / "docs/combat-loot-ground.png"))
            q.locator("#shopButton").click()
            q.evaluate("g.step(5)")
            assert q.evaluate("m.paused&&m.state.coins===0&&[...m.combatLoot.piles.values()][0].age===0")
            q.locator("#shopDialog [data-close]").click()
            q.wait_for_function("!m.paused")
            collect(q, mobile)
            assert q.evaluate("m.state.coins===2&&m.state.combatLoot.coinsCollected===2&&m.state.wood===0&&m.combatLoot.piles.size===0")
            # The boss is a lethal-hit fixture; its actual kill event supplies guaranteed loot.
            q.evaluate("m.state.worldTime=301;g.step(.05);window.boss=m.survival.regionalBosses[0];boss.hp=1;boss.warning=0;for(const e of m.survival.residents)if(e!==boss)e.warning=1000;g.step(0)")
            prepare(q, "boss")
            tap(q, body(q, "boss"), mobile)
            q.evaluate("g.step(0)")
            assert q.evaluate("!m.survival.regionalBosses.some(e=>e.id===boss.id)&&m.combatLoot.piles.size===1")
            collect(q, mobile)
            assert q.evaluate("m.state.coins===22&&m.state.exploration.items.resin>=1&&m.state.raidsWon===0&&m.state.combatLoot.coinsCollected===22")
            assert "доступно улучшение" in q.locator("#shopButton").get_attribute("aria-label")
            q.locator("#shopButton").click()
            assert "Сила переноски" in q.locator("[data-combat-progress]").inner_text()
            assert "маз" in q.locator("[data-combat-progress]").inner_text()
            q.locator("#shopDialog").screenshot(path=str(ROOT / f"docs/combat-loot-shop-{'mobile' if mobile else 'desktop'}.png"))
            q.locator('[data-buy="carry"]').click()
            assert q.evaluate("m.state.coins===2&&m.state.maxWood===4&&m.state.combatLoot.coinsCollected===22")
            assert q.locator('[data-buy="carry"]').is_disabled()
            q.locator("#shopDialog [data-close]").click()
            q.wait_for_function("!m.paused")
            q.reload()
            choose_hero(q)
            assert q.evaluate("lumberPhaser.core.state.coins===0&&lumberPhaser.core.state.combatLoot.coinsCollected===0&&lumberPhaser.core.combatLoot.piles.size===0")
            assert not errors, errors
            print("PASS combat loot", "mobile Canvas/dist" if mobile else "desktop WebGL + old URL", "PNG, native hits/pickup, pause, boss, earned carry purchase, reset", flush=True)
            ctx.close()
            browser.close()
finally:
    server.shutdown()
