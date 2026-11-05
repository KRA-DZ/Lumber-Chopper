"""Only approved items, near/lit loot markers, pickup FX, bag/trade icons and fishing."""
from functools import partial
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from threading import Thread
from shutil import which
import sys
from playwright.sync_api import sync_playwright
from helpers.browser_start import choose_hero

ROOT = Path(__file__).resolve().parents[1]


class Handler(SimpleHTTPRequestHandler):
    def log_message(self, *args): pass


def click(q, selector, mobile):
    q.locator(selector).tap() if mobile else q.locator(selector).click()


def visit(q, id):
    q.evaluate("id=>{const s=m.exploration.get(id),r=m.regions.all.find(r=>r.id===s.regionId);if(r&&!m.regions.unlocked.has(r.id)){m.regions.unlocked.add(r.id);m.world.generate(r);m.nav.rebuildObstacles()}Object.assign(m.player,m.nav.nearestGround(s.x,s.y+48),{path:[],autoTimer:10000,moving:false});w.camera.stopFollow();w.camera.centerOn(m.player.x,m.player.y-70);g.step(0);m.exploration.request(id);void 0}", id)
    q.wait_for_selector("#activityDialog[open]")


server = ThreadingHTTPServer(("127.0.0.1", 0), partial(Handler, directory=str(ROOT)))
Thread(target=server.serve_forever, daemon=True).start()
try:
    with sync_playwright() as p:
        for mobile in ((True,) if "--mobile-only" in sys.argv else (False, True)):
            browser = p.chromium.launch(headless=True, executable_path=which("chromium"), args=["--no-sandbox"] + (["--disable-webgl"] if mobile else ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"]))
            ctx = browser.new_context(viewport={"width": 390 if mobile else 1360, "height": 844 if mobile else 1050}, is_mobile=mobile, has_touch=mobile)
            q = ctx.new_page(); errors = []
            q.on("pageerror", lambda e: errors.append(str(e)))
            q.goto(f"http://127.0.0.1:{server.server_port}/" + ("dist/" if mobile else "index.html"))
            choose_hero(q)
            q.evaluate("window.g=lumberPhaser;window.m=g.core;window.w=g.scene;w.manual=true;m.player.autoTimer=10000;g.step(0);void 0")
            assert q.evaluate("w.assets.lootItems.variant===3&&!w.textures.exists('lootItems.source')&&w.assets.meta.has('loot.coins')&&w.assets.meta.has('loot.resin')&&w.assets.meta.has('exploration.bobber')&&w.textures.get('forest').getSourceImage().height<=2048")
            # Controlled render fixtures: real economic pickup is checked by combat_loot_smoke.py.
            q.evaluate("const r=m.regions.all.find(r=>r.id==='1:0');m.regions.unlocked.add(r.id);m.world.generate(r);m.nav.rebuildObstacles();Object.assign(m.player,{x:3520,y:1600,path:[],autoTimer:10000});w.camera.stopFollow();w.camera.centerOn(3520,1530);m.state.worldTime=330;m.combatLoot.piles.set('lit',{id:'lit',x:3610,y:1600,coins:2,resin:1,boss:false,age:0});m.combatLoot.piles.set('dark',{id:'dark',x:3700,y:1600,coins:2,resin:0,boss:false,age:0});g.step(0)")
            q.wait_for_timeout(100); q.evaluate("g.step(0)")
            assert q.evaluate("w.combatLootView.objects.get('lit').image.visible&&w.combatLootView.objects.get('lit').resin.visible&&w.combatLootView.objects.get('lit').image.frame.name==='loot.coins'&&w.combatLootView.objects.get('lit').image.depth===11002&&!w.combatLootView.objects.get('dark').image.visible&&!w.combatLootView.objects.get('dark').label.visible")
            q.evaluate("m.state.lanternLevel=4;g.step(0)")
            assert q.evaluate("w.combatLootView.objects.get('dark').image.visible")
            q.evaluate("m.state.worldTime=120;m.state.exploration.items.resin=6;g.step(0)")
            assert q.evaluate("w.combatLootView.objects.get('lit').label.text.includes('полна')")
            q.locator("#game-frame").screenshot(path=str(ROOT / f"docs/loot-item-ground-{'mobile' if mobile else 'desktop'}.png"))
            q.evaluate("m.combatLoot.piles.clear();for(let i=0;i<8;i++)w.combatLootView.collected({x:m.player.x+80,y:m.player.y,coins:2,resin:1});g.step(0)")
            assert q.evaluate("w.combatLootView.flights.length===6&&m.state.coins===0")
            click(q, "#bagButton", mobile)
            before = q.evaluate("w.combatLootView.flights.map(f=>[f.image.x,f.image.y])")
            q.evaluate("g.step(3)")
            assert q.evaluate("w.combatLootView.flights.map(f=>[f.image.x,f.image.y])") == before
            assert q.locator("[data-bag-item] img[data-item-icon]").count() == 4
            assert q.locator("[data-use-item] img[data-item-icon=salve]").count() == 1
            q.locator("#activityDialog").screenshot(path=str(ROOT / f"docs/loot-item-bag-{'mobile' if mobile else 'desktop'}.png"))
            click(q, "[data-activity-close]", mobile); q.wait_for_function("!m.paused")
            q.evaluate("g.step(.6)")
            assert q.evaluate("w.combatLootView.flights.length===0")
            q.evaluate("m.state.coins=100;m.state.exploration.items.resin=2;m.state.exploration.items.salve=1;void 0")
            visit(q, "mysterious-merchant")
            assert q.locator("[data-activity-action=buy-key] img[data-item-icon=key]").count() == 1
            assert q.locator("[data-activity-action=buy-rod] img[data-item-icon=rod]").count() == 1
            click(q, "[data-activity-action=buy-salve] img", mobile)
            assert q.evaluate("m.state.coins===70&&m.state.exploration.items.resin===1&&m.state.exploration.items.salve===2")
            if not mobile: q.locator("#activityDialog").screenshot(path=str(ROOT / "docs/loot-item-merchant.png"))
            click(q, "[data-activity-close]", mobile); q.wait_for_function("!m.paused")
            click(q, "#shopButton", mobile)
            assert q.locator("[data-balance] img.loot-item-icon").count() == 1
            click(q, "#shopDialog [data-close]", mobile); q.wait_for_function("!m.paused")
            q.evaluate("m.state.exploration.rod=true;void 0")
            visit(q, "fishing")
            click(q, "[data-activity-action=fish]", mobile)
            q.wait_for_function("!m.paused&&m.exploration.fishing")
            q.evaluate("g.step(.1)")
            assert q.evaluate("w.explorationView.rod.visible&&w.explorationView.bobber.visible&&w.explorationView.rod.frame.name==='exploration.rod'&&w.explorationView.bobber.frame.name==='exploration.bobber'&&w.explorationView.rod.rotation===0")
            q.wait_for_timeout(100); q.evaluate("g.step(0)")
            q.locator("#game-frame").screenshot(path=str(ROOT / f"docs/loot-item-fishing-{'mobile' if mobile else 'desktop'}.png"))
            click(q, "[data-fish-cancel]", mobile)
            assert q.evaluate("!m.exploration.fishing&&!w.explorationView.bobber.visible")
            q.evaluate("window.old=m;w.scene.restart();void 0")
            q.wait_for_function("lumberPhaser.core!==old&&lumberPhaser.scene.hudReady")
            assert q.evaluate("lumberPhaser.scene.assets.lootItems.variant===3&&lumberPhaser.scene.combatLootView.flights.length===0&&lumberPhaser.scene.combatLootView.objects.size===0&&!lumberPhaser.scene.explorationView.bobber.visible")
            assert not errors, errors
            print("PASS approved loot items", "mobile Canvas/dist" if mobile else "desktop WebGL", "PNG, near/light, FX cap/pause, bag, native trade, fishing, restart", flush=True)
            ctx.close(); browser.close()
finally:
    server.shutdown()
