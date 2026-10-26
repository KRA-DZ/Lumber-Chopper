"""Живой лес, погода, кольца и отсутствие сохранений: python tests/world_smoke.py."""

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


def ready(page):
    page.wait_for_function("!!window.lumberGame", polling=50)
    page.evaluate("window.g=lumberGame")


def shot(page, name):
    page.evaluate("g.refreshUI();g.draw()")
    page.evaluate("()=>new Promise(done=>paintFrame(()=>paintFrame(done)))")
    page.screenshot(path=f"/tmp/living-{name}.png", full_page=True)


try:
    with sync_playwright() as p:
        b = p.chromium.launch(
            headless=True,
            args=["--no-sandbox"],
            **({"executable_path": which("chromium")} if which("chromium") else {}),
        )
        for mobile in (False, True):
            c = b.new_context(
                viewport={
                    "width": 390 if mobile else 1360,
                    "height": 844 if mobile else 1050,
                },
                is_mobile=mobile,
                has_touch=mobile,
            )
            c.add_init_script(
                """window.paintFrame=requestAnimationFrame.bind(window);window.requestAnimationFrame=()=>0;
                localStorage.setItem('lumber-chopper-v1','old test progress');localStorage.setItem('unrelated-test-key','keep');
                window.storageWrites=0;const set=Storage.prototype.setItem;Storage.prototype.setItem=function(...args){storageWrites++;return set.apply(this,args);};"""
            )
            page = c.new_page()
            errors = []
            page.on("pageerror", lambda e: errors.append(str(e)))
            page.on(
                "console",
                lambda e: errors.append(e.text) if e.type == "error" else None,
            )
            page.goto(url)
            ready(page)
            assert page.evaluate(
                "g.daySeconds===600&&g.state.worldTime===120&&g.state.wood===0&&g.state.coins===0&&g.state.campLevel===0"
            )
            assert page.evaluate(
                'localStorage.getItem("lumber-chopper-v1")===null&&localStorage.getItem("unrelated-test-key")==="keep"&&storageWrites===0'
            )
            assert page.evaluate(
                "g.landmarks.length===9&&g.dressing.plants.length>50&&g.dressing.ground.length>100"
            )
            # Первое расширение запускается настоящим последним взносом в костёр.
            scale = page.evaluate("g.mapTransform().scale")
            assert page.evaluate("!g.isWalkable(2590,1600)")
            page.evaluate(
                "g.state.buildWood=9;g.state.cargo=[];g.state.wood=0;g.state.cargoValue=0;g.forestry.addCargo(10);g.player.x=g.build.x;g.player.y=g.build.y;g.player.path=[];g.rebuildObstacles();g.update(.1)"
            )
            assert page.evaluate(
                "g.state.campLevel===1&&g.state.wood===0&&g.forestRadius()===1040&&g.expansion.banner.from===900&&g.expansion.radius>900&&g.expansion.radius<1040"
            )
            assert "Открыта новая территория" in page.locator("#status").inner_text()
            assert page.evaluate("g.mapTransform().scale") == scale
            assert page.evaluate("g.nearestGround(2590,1600).x>2500")
            page.evaluate(
                "const p=g.nearestGround(2490,1600);g.player.x=p.x;g.player.y=p.y;g.player.path=[];g.update(1.2)"
            )
            shot(page, "expansion-mobile" if mobile else "expansion")
            # Декор появляется по стадиям; проём каменных ворот проходим.
            page.evaluate("g.state.campLevel=4;g.rebuildObstacles();g.update(0)")
            assert page.evaluate(
                "g.isWalkable(630,1400)&&!g.isWalkable(560,1390)&&!g.isWalkable(700,1390)"
            )
            page.evaluate(
                "g.player.x=630;g.player.y=1470;g.player.path=[];g.setDestination(630,1335);for(let i=0;i<200;i++)g.update(.03)"
            )
            assert page.evaluate("Math.hypot(g.player.x-630,g.player.y-1335)<3")
            # Новые поляны гарантированно не заняты живыми стволами.
            assert page.evaluate(
                "g.landmarks.every(s=>g.trees.every(t=>Math.hypot(t.x-s.x,t.y-s.y)>=s.clearing))"
            )
            page.evaluate(
                "g.player.x=1630;g.player.y=1690;g.player.path=[];g.state.worldTime=450;g.update(0)"
            )
            shot(page, "camp-night-mobile" if mobile else "camp-night")
            # Утренний туман и родник видимы в собственной поляне.
            page.evaluate(
                "g.player.x=1030;g.player.y=1205;g.player.path=[];g.state.worldTime=33;g.update(0)"
            )
            assert page.evaluate(
                "g.weather.profile.mist>.9&&g.weather.profile.rain===0"
            )
            shot(page, "spring-mobile" if mobile else "spring")
            # Дождь не начисляет ресурсы и не влияет на скорость героя.
            page.evaluate(
                "g.player.x=1600;g.player.y=1720;g.player.path=[];g.state.worldTime=235;g.update(0)"
            )
            economy = page.evaluate(
                "[g.state.wood,g.state.coins,g.state.buildWood,g.player.speed]"
            )
            assert page.evaluate("g.weather.profile.rain===1&&g.weather.rainCount===80")
            page.keyboard.down("d")
            page.evaluate("for(let i=0;i<10;i++)g.update(.03)")
            page.keyboard.up("d")
            assert page.evaluate('g.weather.tracks.some(t=>t.kind==="dust")')
            shot(page, "rain-mobile" if mobile else "rain")
            assert (
                page.evaluate(
                    "[g.state.wood,g.state.coins,g.state.buildWood,g.player.speed]"
                )
                == economy
            )
            page.evaluate(
                'const t=g.trees.find(t=>t.type==="oak"&&t.hp>0);const p=g.nearestGround(t.x+90,t.y+90);g.player.x=p.x;g.player.y=p.y;g.player.path=[];g.player.autoTimer=100;g.state.worldTime=290;for(let i=0;i<30;i++)g.update(.05)'
            )
            assert page.evaluate("g.weather.drips.length>0&&g.weather.drips.length<=16")
            page.locator("#effectsBtn").click()
            assert page.evaluate(
                'g.weather.quality==="light"&&g.weather.rainCount===28&&g.weather.tracks.length<=16&&g.weather.drips.length<=5'
            )
            assert page.locator("#effectsBtn").get_attribute("aria-pressed") == "true"
            page.locator("#effectsBtn").click()
            assert page.evaluate('g.weather.quality==="full"&&g.weather.rainCount===80')
            # Прогулка прогревает разные участки, но размеры кешей ограничены.
            stats = page.evaluate(
                """()=>{g.state.worldTime=235;for(let i=0;i<18;i++){const a=i*Math.PI/9,p=g.nearestGround(1600+Math.cos(a)*1250,1600+Math.sin(a)*1250);g.player.x=p.x;g.player.y=p.y;g.update(.03);g.draw();}
                g.player.x=1600;g.player.y=1720;g.update(0);for(let i=0;i<20;i++)g.draw();
                const samples=[];for(let i=0;i<180;i++){const t=performance.now();g.update(.016);g.draw();samples.push(performance.now()-t);}samples.sort((a,b)=>a-b);
                return {rain:g.weather.profile.rain,median:samples[90],p95:samples[171],terrain:g.terrain.cachedChunks,sway:g.environment.cachedSwaySets,leaves:g.environment.leaves.length,tracks:g.weather.tracks.length,drips:g.weather.drips.length};}"""
            )
            assert (
                stats["rain"] == 1
                and stats["terrain"] <= 28
                and stats["sway"] <= 16
                and stats["leaves"] <= 24
                and stats["tracks"] <= 36
                and stats["drips"] <= 16
            ), stats
            assert page.evaluate(
                'storageWrites===0&&localStorage.getItem("lumber-chopper-v1")===null&&document.documentElement.scrollWidth<=innerWidth'
            )
            # Переход через полночь не удлиняет цикл и снимает дождь на следующие сутки.
            page.evaluate("g.state.worldTime=599.95;g.update(.1)")
            assert page.evaluate("g.state.worldTime<.1")
            page.evaluate("g.state.worldTime=235;g.update(0)")
            assert page.evaluate("g.weather.profile.rain===0")
            page.reload()
            ready(page)
            assert page.evaluate(
                "g.state.wood===0&&g.state.coins===0&&g.state.maxWood===2&&g.state.campLevel===0&&g.state.buildWood===0&&g.discovered.size===0&&g.trees.every(t=>t.hp===t.maxHp)&&g.weather.tracks.length===0&&g.expansion.rings.length===0"
            )
            assert not errors, errors
            print(
                "PASS",
                "mobile" if mobile else "desktop",
                "sites, gate passage, expansion/reveal/fixed map, weather, tracks, quality, 600s cycle, fresh reload/no storage writes; headless frame ms and caps:",
                stats,
                flush=True,
            )
            c.close()
        # Игра работает даже при полностью запрещённом localStorage.
        c = b.new_context()
        c.add_init_script(
            'Object.defineProperty(window,"localStorage",{get(){throw new Error("storage disabled")}})'
        )
        page = c.new_page()
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.goto(url)
        ready(page)
        page.wait_for_function("g.state.worldTime>120.5")
        assert not errors, errors
        print("PASS live loop with storage disabled", flush=True)
        b.close()
finally:
    server.shutdown()
