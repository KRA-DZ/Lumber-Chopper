"""Only new regional combat, fence/projectiles and discovery journal/merchant UI."""

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
    def log_message(self, *args):
        pass


def focus(q, point):
    q.evaluate(
        "p=>{m.clearKeys();Object.assign(m.player,p,{path:[],autoTimer:10000,clickTimer:0});w.camera.stopFollow();w.camera.centerOn(p.x,p.y-60);w.atmosphere.maskKey='';g.step(0)}",
        point,
    )
    q.wait_for_timeout(120)
    q.evaluate("g.step(0)")


def tap(q, point, mobile):
    q.locator("#game-frame").scroll_into_view_if_needed()
    x, y = q.evaluate(
        "p=>{const r=document.querySelector('canvas').getBoundingClientRect(),v=w.camera.worldView;return[r.x+(p.x-v.x)/v.width*r.width,r.y+(p.y-v.y)/v.height*r.height]}",
        point,
    )
    q.touchscreen.tap(x, y) if mobile else q.mouse.click(x, y)


def close_activity(q):
    q.locator("[data-activity-close]").click()
    q.wait_for_function("!m.paused")


def beside(q, expr):
    return q.evaluate(
        "e=>{for(let i=0;i<16;i++){const a=i*Math.PI/8,p={x:e.x+Math.cos(a)*38,y:e.y+Math.sin(a)*38};if(m.nav.isWalkable(p.x,p.y)&&m.nav.clearSegment(e,p))return p;}throw Error('No free melee approach')}",
        q.evaluate(f"({{x:{expr}.x,y:{expr}.y}})"),
    )


def enemy_point(q, expr):
    return q.evaluate(
        """id=>{const im=w.enemyView.objects.get(id).image,f=im.frame,data=w.textures.get('forest').getSourceImage().getContext('2d').getImageData(f.cutX,f.cutY,f.cutWidth,f.cutHeight).data;let best=null;for(let y=0;y<f.cutHeight;y++)for(let x=0;x<f.cutWidth;x++){if(data[(y*f.cutWidth+x)*4+3]<200)continue;const d=(x-f.cutWidth/2)**2+(y-f.cutHeight*.6)**2;if(!best||d<best.d)best={x,y,d};}if(!best)throw Error('Empty enemy frame');return{x:im.x+(best.x+.5-im.displayOriginX)*im.scaleX,y:im.y+(best.y+.5-im.displayOriginY)*im.scaleY}}""",
        q.evaluate(f"{expr}.id"),
    )


server = ThreadingHTTPServer(("127.0.0.1", 0), partial(Handler, directory=str(ROOT)))
Thread(target=server.serve_forever, daemon=True).start()
try:
    with sync_playwright() as p:
        for mobile in ((True,) if "--mobile-only" in sys.argv else (False, True)):
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
            q.set_default_timeout(30000)
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
                "window.g=lumberPhaser;window.w=g.scene;window.m=g.core;w.manual=true;void 0"
            )
            q.evaluate(
                """()=>{window.openRegion=id=>{const r=m.regions.all.find(r=>r.id===id);m.regions.unlocked.add(id);m.world.generate(r);m.nav.rebuildObstacles()};openRegion('1:0');Object.assign(m.player,{x:3520,y:1600,path:[],autoTimer:10000});for(let i=0;i<130;i++)m.update(.05);window.small=m.survival.minions.find(e=>e.role==='melee');for(const e of m.survival.residents)if(e!==small)e.warning=1000;g.step(0)}"""
            )
            print(
                "READY regional hunt",
                "mobile Canvas/dist" if mobile else "WebGL",
                flush=True,
            )
            assert q.evaluate(
                "m.survival.minions.length===3&&!m.survival.minionHunt&&small.maxHP===6&&m.survival.regionalBosses.length===0"
            )
            focus(q, beside(q, "small"))
            tap(q, enemy_point(q, "small"), mobile)
            assert q.evaluate(
                "small.hp===5&&m.selectedEnemyId===small.id&&m.player.swing>0"
            )
            if not mobile:
                q.locator("#game-frame").screenshot(
                    path=str(ROOT / "docs/regional-small-monsters.png")
                )
            q.evaluate(
                "m.state.coins=1000;m.purchaseUpgrade('axe');m.update(.2);g.step(0)"
            )
            tap(q, enemy_point(q, "small"), mobile)
            assert q.evaluate("small.hp===3&&m.state.axePower===2")

            # A boss keeps its strike when hit, and the watcher remains untouched.
            q.evaluate(
                "m.clearKeys();m.state.worldTime=301;m.update(.05);window.boss=m.survival.regionalBosses[0];for(const e of m.survival.residents)e.warning=e===boss?0:1000;void 0"
            )
            assert q.evaluate("boss.maxHP===120")
            focus(q, beside(q, "boss"))
            q.evaluate("m.update(.05);g.step(0)")
            assert q.evaluate("!!boss.attack")
            tap(q, enemy_point(q, "boss"), mobile)
            assert q.evaluate("boss.hp===118&&!!boss.attack")
            q.evaluate("m.update(.3);g.step(0)")
            assert q.evaluate("m.state.health===88")

            # Hunt activation is tied to dusk, while ordinary daytime stays local.
            q.evaluate(
                "m.state.calendarDay=4;m.state.worldTime=120;m.update(.05);void 0"
            )
            assert q.evaluate("!m.survival.minionHunt")
            q.evaluate(
                """()=>{m.state.worldTime=301;m.state.campLevel=3;m.nav.rebuildObstacles();Object.assign(m.player,{x:3520,y:1600,path:[],autoTimer:10000});m.update(.05);window.thrower=m.survival.minions.find(e=>e.role==='ranged');for(const e of m.survival.residents)e.warning=e===thrower?0:1000;Object.assign(thrower,m.nav.nearestGround(1925,1640),{warning:0,path:[],repath:0,cooldown:0});m.state.health=100;}"""
            )
            focus(q, q.evaluate("m.nav.nearestGround(1795,1640)"))
            assert q.evaluate(
                "m.survival.minionHunt&&!m.nav.hasLineOfSight(thrower,m.player)"
            )
            q.evaluate("m.update(.4);g.step(0)")
            assert q.evaluate("m.survival.projectiles.length===1")
            q.evaluate("m.update(.15);g.step(0)")
            if not mobile:
                q.locator("#game-frame").screenshot(
                    path=str(ROOT / "docs/regional-projectile.png")
                )
            if mobile:
                tap(q, {"x": 1705, "y": 1640}, True)
                q.evaluate("m.update(.9);g.step(0)")
            else:
                q.keyboard.down("s")
                q.evaluate("m.update(.5);g.step(0)")
                q.keyboard.up("s")
                q.evaluate("m.update(.3);g.step(0)")
            assert q.evaluate("m.state.health===100&&m.survival.projectiles.length===0")
            focus(q, q.evaluate("m.nav.nearestGround(1795,1640)"))
            q.evaluate(
                "for(let i=0;i<60&&!m.survival.projectiles.length;i++)m.update(.05);g.step(0)"
            )
            assert q.evaluate("m.survival.projectiles.length>0")
            q.evaluate("m.update(.7);g.step(0)")
            assert q.evaluate(
                "m.state.health===94&&m.defenses.all().filter(s=>s.kind==='fence').every(s=>s.hp===60)"
            )

            # A real fence loses HP and the melee actor follows its new breach.
            q.evaluate(
                """()=>{window.melee=m.survival.minions.find(e=>e.role==='melee');for(const e of m.survival.residents)e.warning=e===melee?0:1000;const section=m.defenses.all().filter(s=>s.kind==='fence').sort((a,b)=>b.x-a.x)[0];Object.assign(melee,m.nav.nearestGround(section.x+45,section.y),{path:[],repath:0,cooldown:0,warning:0,attack:null});m.state.health=100;}"""
            )
            focus(q, {"x": 1600, "y": 1720})
            q.evaluate("m.update(2);g.step(0)")
            assert q.evaluate(
                "m.state.health===100&&m.defenses.all().some(s=>s.kind==='fence'&&s.hp<60)"
            )
            q.evaluate("m.update(12);g.step(0)")
            assert q.evaluate(
                "m.defenses.all().some(s=>s.kind==='fence'&&s.hp===0)&&Math.hypot(melee.x-1600,melee.y-1720)<240"
            )
            if not mobile:
                q.locator("#game-frame").screenshot(
                    path=str(ROOT / "docs/regional-breach.png")
                )

            # Journal grouping and queued entrance routes do not teleport the hero.
            q.evaluate(
                """()=>{for(const id of ['0:-1','0:1','1:1'])openRegion(id);m.state.calendarDay=0;m.state.worldTime=120;m.state.readClues.push('fortress-ledger','sawmill-order');m.state.exploration.discoveries.push('fortress-watch-token','sawmill-shift-tag');for(const e of m.survival.residents)e.warning=10000;m.clearKeys();g.step(0)}"""
            )
            q.locator("#journalButton").click()
            q.wait_for_function("document.querySelector('#journalDialog').open")
            assert q.locator("[data-journal-location]").count() == 2
            assert q.locator('[data-location-clue="fortress-ledger"]').count() == 1
            assert q.locator('[data-location-clue="sawmill-order"]').count() == 1
            assert q.locator('[data-location-clue="sawmill-last-shift"]').count() == 0
            if not mobile:
                q.locator(
                    '[data-journal-location="abandoned-sawmill"]'
                ).scroll_into_view_if_needed()
                q.locator("#journalDialog").screenshot(
                    path=str(ROOT / "docs/location-journal.png")
                )
            before = q.evaluate("({x:m.player.x,y:m.player.y})")
            q.locator('[data-location-route="abandoned-sawmill"]').click()
            q.wait_for_function("!m.paused")
            assert q.evaluate("({x:m.player.x,y:m.player.y})") == before
            assert q.evaluate(
                "m.player.targetY===m.world.locations.find(l=>l.id==='abandoned-sawmill').entrance.y"
            )
            focus(
                q,
                q.evaluate(
                    "(()=>{const s=m.exploration.get('mysterious-merchant');return{x:s.x,y:s.y+35}})()"
                ),
            )
            if mobile:
                tap(q, q.evaluate("({x:w.merchant.x,y:w.merchant.y-35})"), True)
            else:
                q.keyboard.press("e")
            q.wait_for_function("document.querySelector('#activityDialog').open")
            before = q.evaluate(
                "JSON.stringify({coins:m.state.coins,cargo:m.state.cargo,items:m.state.exploration.items,chapter:m.state.story})"
            )
            for find in ("fortress-watch-token", "sawmill-shift-tag"):
                q.locator(f'[data-activity-action="story:find:{find}"]').click()
                assert q.evaluate(
                    f"m.state.exploration.discussedFinds.includes('{find}')"
                )
            assert (
                q.evaluate(
                    "JSON.stringify({coins:m.state.coins,cargo:m.state.cargo,items:m.state.exploration.items,chapter:m.state.story})"
                )
                == before
            )
            q.locator('[data-activity-action="story:find:sawmill-shift-tag"]').click()
            assert q.evaluate("m.state.exploration.discussedFinds.length===2")
            close_activity(q)
            q.locator("#journalButton").click()
            q.wait_for_function("document.querySelector('#journalDialog').open")
            assert q.locator("[data-discovery-talk]").count() == 2
            assert q.locator("[data-discovery-connection]").count() == 1
            if not mobile:
                q.locator("[data-discovery-connection]").scroll_into_view_if_needed()
                q.locator("#journalDialog").screenshot(
                    path=str(ROOT / "docs/discovery-dialogues.png")
                )
            q.locator("[data-journal-close]").click()
            q.wait_for_function("!m.paused")
            q.evaluate("window.old=m;w.scene.restart();void 0")
            q.wait_for_function("lumberPhaser.core!==old&&lumberPhaser.scene.hudReady")
            assert q.evaluate(
                "lumberPhaser.core.state.exploration.discussedFinds.length===0&&lumberPhaser.core.state.readClues.length===0"
            )
            assert not errors, errors
            print(
                "PASS regional hunt",
                "mobile Canvas/dist" if mobile else "WebGL",
                "native axe, boss, fence, projectiles/dodge, grouped journal, merchant, reset",
                flush=True,
            )
            ctx.close()
            browser.close()
finally:
    server.shutdown()
