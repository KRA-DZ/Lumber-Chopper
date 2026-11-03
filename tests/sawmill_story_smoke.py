"""Only sawmill PNGs, roofs, debris, notes, drive, discovery and journal."""

from functools import partial
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from threading import Thread
from shutil import which
from playwright.sync_api import sync_playwright
from helpers.browser_start import choose_hero

ROOT = Path(__file__).resolve().parents[1]
DRIVE = "sawmill-hand-drive"
TAG = "sawmill-shift-tag"


class Handler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def focus(q, expr):
    q.evaluate(
        "p=>{m.clearKeys();Object.assign(m.player,{x:p.x,y:p.y+42,path:[],moving:false,autoTimer:10000});w.camera.stopFollow();w.camera.centerOn(p.x,p.y-60);g.step(0)}",
        q.evaluate(expr),
    )
    q.wait_for_timeout(150)
    q.evaluate("g.step(0)")


def tap(q, expr, mobile):
    q.locator("#game-frame").scroll_into_view_if_needed()
    x, y = q.evaluate(
        "p=>{const r=document.querySelector('canvas').getBoundingClientRect(),v=w.camera.worldView;return[r.x+(p.x-v.x)/v.width*r.width,r.y+(p.y-v.y)/v.height*r.height]}",
        q.evaluate(expr),
    )
    q.touchscreen.tap(x, y) if mobile else q.mouse.click(x, y)


def close_activity(q):
    q.locator("[data-activity-close]").click()
    q.wait_for_function("!m.paused")


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
            q.goto(
                f"http://127.0.0.1:{server.server_port}/"
                + ("dist/" if mobile else "phaser.html")
            )
            choose_hero(q, "woodcutter" if mobile else "traveler")
            q.evaluate(
                "window.g=lumberPhaser;window.w=g.scene;window.m=g.core;window.e=m.exploration;w.manual=true"
            )
            # Reuse the real border transaction; clearing itself is covered separately.
            q.evaluate("""()=>{
                for(const id of ['1:0','1:1']) {
                    const gate=m.regions.frontiers().find(p=>p.region.id===id);
                    Object.assign(m.player,{x:gate.x,y:gate.y,path:[],autoTimer:10000});
                    m.state.maxWood=gate.region.cost;
                    for(let i=0;i<gate.region.cost;i++)m.forestry.addCargo(10);
                    for(let i=0;i<gate.region.cost+1;i++)g.step(.2);
                }
                m.state.maxWood=2;
            }""")
            print(
                "READY sawmill story",
                "mobile Canvas/dist" if mobile else "WebGL",
                flush=True,
            )
            assert q.evaluate(
                "w.assets.sawmill.variant===1&&!w.textures.exists('sawmill.source')&&!w.textures.exists('sawmill.floors')&&w.textures.get('forest').getSourceImage().height<=2048"
            )
            # Same scaled PNG pixels must arrive in the common atlas unchanged.
            assert q.evaluate(
                """()=>{const pack=w.registry.get('sawmillPack');for(const key of ['wall.h.0','roof.store','bench','niche.closed','niche.open','niche.empty','debris.light']){const f=pack.manifest.frames[key],c=document.createElement('canvas');c.width=f.width;c.height=f.height;c.getContext('2d').drawImage(pack.image,f.x,f.y,f.width,f.height,0,0,f.width,f.height);const a=c.getContext('2d').getImageData(0,0,f.width,f.height).data,t=w.textures.getFrame('forest','sawmill.'+key),b=w.textures.get('forest').getSourceImage().getContext('2d').getImageData(t.cutX,t.cutY,t.cutWidth,t.cutHeight).data;if(a.length!==b.length||!a.every((v,i)=>v===b[i]))return false;}return true;}"""
            )

            focus(q, "({x:3536,y:3330})")
            if not mobile:
                assert q.evaluate(
                    "[...w.regionView.locations.objects.values()].some(im=>im.frame.name==='sawmill.roof.store')"
                )
                q.locator("#game-frame").screenshot(
                    path=str(ROOT / "docs/sawmill-art-yard.png")
                )

            focus(q, f"e.get('{TAG}')")
            assert q.evaluate(
                f"!w.regionView.locations.objects.has('{TAG}')&&!e.request('{TAG}')&&e.nearest()?.id!=='{TAG}'"
            )
            assert q.evaluate(
                "w.regionView.locations.objects.get('abandoned-sawmill/niche-closed').frame.name==='sawmill.niche.closed'&&w.regionView.locations.objects.get('abandoned-sawmill/roof/Машинный зал').alpha<0.25"
            )
            # Floor sampling is periodic across the terrain chunk boundary.
            assert q.evaluate(
                """()=>{const x=3952,y=3200,cx=Math.floor(x/256),cy=Math.floor(y/256),pixel=w.terrain.source.getChunk(cx,cy).getContext('2d').getImageData((x-cx*256)/2,(y-cy*256)/2,1,1).data,data=w.registry.get('sawmillPack').floors.hall,i=(((y/2)%64)*64+(x/2)%64)*4;return pixel[0]===data[i]&&pixel[1]===data[i+1]&&pixel[2]===data[i+2];}"""
            )
            focus(q, f"e.get('{DRIVE}')")
            tap(q, f"e.get('{DRIVE}')", mobile)
            q.wait_for_function("document.querySelector('#activityDialog').open")
            assert q.locator('[data-activity-action="open-passage"]').is_disabled()
            assert "Памятку" in q.locator("[data-activity-content]").inner_text()
            close_activity(q)

            for site in ("sawmill-unshipped-load", "sawmill-empty-crate"):
                focus(q, f"e.get('{site}')")
                tap(q, f"e.get('{site}')", mobile)
                q.wait_for_function("document.querySelector('#activityDialog').open")
                assert q.locator("[data-activity-action]").count() == 0
                assert (
                    "смен" in q.locator("[data-activity-content]").inner_text().lower()
                    or "семь"
                    in q.locator("[data-activity-content]").inner_text().lower()
                )
                close_activity(q)

            for note in ("sawmill-order", "sawmill-ledger", "sawmill-last-shift"):
                expr = f"m.world.clues.find(n=>n.id==='{note}')"
                focus(q, expr)
                tap(q, expr, mobile)
                q.wait_for_function("document.querySelector('#clueDialog').open")
                assert q.evaluate(f"m.state.readClues.includes('{note}')")
                if note == "sawmill-last-shift" and not mobile:
                    q.locator("#clueDialog").screenshot(
                        path=str(ROOT / "docs/sawmill-instruction.png")
                    )
                q.locator("#clueClose").click()
                q.wait_for_function("!m.paused")

            focus(q, f"e.get('{DRIVE}')")
            if mobile:
                tap(q, f"e.get('{DRIVE}')", True)
            else:
                q.keyboard.press("e")
            q.wait_for_function("document.querySelector('#activityDialog').open")
            assert q.locator('[data-activity-action="open-passage"]').is_enabled()
            q.locator('[data-activity-action="open-passage"]').click()
            assert q.locator('[data-activity-action="open-passage"]').is_disabled()
            assert q.evaluate(
                "m.state.exploration.openedPassages.includes('sawmill-machine-cache')&&m.state.coins===0&&m.state.wood===0"
            )
            close_activity(q)
            q.evaluate("g.step(0)")
            assert q.evaluate(f"w.regionView.locations.objects.has('{TAG}')")
            assert q.evaluate(
                "!w.regionView.locations.objects.has('abandoned-sawmill/niche-closed')&&w.regionView.locations.objects.get('sawmill-hand-drive').frame.name==='sawmill.drive.open'"
            )

            focus(q, f"e.get('{TAG}')")
            if not mobile:
                assert q.evaluate(
                    "w.regionView.locations.objects.get('abandoned-sawmill/work-bench').alpha===0.35"
                )
                q.locator("#game-frame").screenshot(
                    path=str(ROOT / "docs/sawmill-cache.png")
                )
            tap(q, f"e.get('{TAG}')", mobile)
            q.wait_for_function("document.querySelector('#activityDialog').open")
            q.locator('[data-activity-action="collect-discovery"]').click()
            assert q.locator('[data-activity-action="collect-discovery"]').is_disabled()
            close_activity(q)
            q.evaluate("g.step(0)")
            assert q.evaluate(
                f"!w.regionView.locations.objects.has('{TAG}')&&e.discoveries().length===1&&m.state.coins===0&&m.state.wood===0&&Object.keys(m.state.exploration.debrisHP).length===0&&m.state.story.phase===0"
            )
            assert q.evaluate(
                "w.regionView.locations.objects.get('abandoned-sawmill/niche-empty').frame.name==='sawmill.niche.empty'"
            )

            q.locator("#journalButton").click()
            q.wait_for_function("document.querySelector('#journalDialog').open")
            entry = q.locator(f'[data-discovery="{TAG}"]')
            q.wait_for_function(
                "(()=>{const im=document.querySelector('[data-discovery=\"sawmill-shift-tag\"] img');return im?.complete&&im.naturalWidth===32})()"
            )
            assert entry.count() == 1 and "Бирка седьмой смены" in entry.inner_text()
            assert "Ведомость пустых телег" in q.locator("[data-journal]").inner_text()
            if not mobile:
                entry.scroll_into_view_if_needed()
                q.locator("#journalDialog").screenshot(
                    path=str(ROOT / "docs/sawmill-shift-journal.png")
                )
            q.locator("[data-journal-close]").click()
            q.wait_for_function("!m.paused")
            q.locator("#mapButton").click()
            cell = q.locator('[data-region="1:1"]')
            assert (
                "Записки: 3/3" in cell.inner_text()
                and "Находки: 1/1" in cell.inner_text()
            )
            cell.click()
            q.wait_for_function("!m.paused")
            assert q.evaluate(
                "m.player.targetY===m.world.locations.find(l=>l.regionId==='1:1').entrance.y"
            )
            focus(q, "({x:1600,y:1720})")
            assert q.evaluate("w.regionView.locations.objects.size===0")
            focus(q, f"e.get('{TAG}')")
            assert q.evaluate(
                f"!w.regionView.locations.objects.has('{TAG}')&&e.discoveries().length===1"
            )
            # The new single PNG pile keeps native chopping and finite ground stock.
            focus(q, "(()=>{const d=m.clearing.all[0];return {x:d.x+48,y:d.y-42}})()")
            assert q.evaluate(
                "w.regionView.clearing.objects.get(m.clearing.all[0].id).images[0].frame.name==='sawmill.debris.light'"
            )
            tap(q, "m.clearing.all[0]", mobile)
            assert q.evaluate("m.clearing.hp(m.clearing.all[0])===5")
            q.evaluate(
                "m.player.autoTimer=0;for(let i=0;i<120;i++)m.update(.05);g.step(0)"
            )
            assert q.evaluate(
                "m.clearing.hp(m.clearing.all[0])===0&&m.state.wood===2&&m.forestry.piles.get(m.clearing.all[0].id).count===1&&!w.regionView.clearing.objects.has(m.clearing.all[0].id)"
            )
            q.evaluate("window.old=m;w.scene.restart();void 0")
            q.wait_for_function("lumberPhaser.core!==old&&lumberPhaser.scene.hudReady")
            assert q.evaluate(
                "lumberPhaser.core.state.exploration.openedPassages.length===0&&lumberPhaser.core.exploration.discoveries().length===0&&lumberPhaser.core.state.readClues.length===0"
            )
            if not mobile:
                q.goto(
                    f"http://127.0.0.1:{server.server_port}/phaser.html?art=procedural"
                )
                choose_hero(q)
                assert q.evaluate(
                    "!lumberPhaser.scene.assets.sawmill&&!lumberPhaser.scene.registry.has('sawmillPack')"
                )
            assert not errors, errors
            print(
                "PASS sawmill story",
                "mobile Canvas/dist" if mobile else "WebGL",
                "notes, clues, local drive, finite cache, journal, map, streaming, reset",
                flush=True,
            )
            ctx.close()
            browser.close()
finally:
    server.shutdown()
