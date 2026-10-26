"""Анимации и новые тестовые сессии: python tests/animations_smoke.py."""

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
    q.wait_for_function("!!window.lumberGame", polling=50)
    q.evaluate("window.g=lumberGame")


def screenshot(q, path):
    # Считываем буфер перед снимком: тест намеренно останавливает requestAnimationFrame.
    colors = q.evaluate(
        """()=>{g.draw();const c=document.querySelector('canvas'),d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;return new Set(Array.from(d).filter((_,i)=>i%4===0)).size;}"""
    )
    assert colors > 100, colors
    q.evaluate("()=>new Promise(done=>paintFrame(()=>paintFrame(done)))")
    q.screenshot(path=path, full_page=True)


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
                "window.paintFrame=requestAnimationFrame.bind(window);window.requestAnimationFrame=()=>0"
            )
            q = c.new_page()
            errors = []
            q.on("pageerror", lambda e: errors.append(str(e)))
            q.on(
                "console",
                lambda e: errors.append(e.text) if e.type == "error" else None,
            )
            q.goto(url)
            ready(q)
            cut = q.evaluate(
                """()=>{const t=g.trees.find(t=>t.hp>0&&t.type==='oak'&&Math.hypot(t.x-1600,t.y-1600)<800&&g.isWalkable(t.x+46,t.y+38));g.player.x=t.x+46;g.player.y=t.y+38;g.player.path=[];g.update(0);while(t.hp>0)g.hitTree(t);g.forestry.collect(.01,g.player);return {id:t.id,wood:g.state.wood,value:g.state.cargoValue,treeValue:t.value,fall:g.visualEffects.falls.length,fly:g.visualEffects.logs.length};}"""
            )
            assert (
                cut["wood"] == 1
                and cut["value"] == cut["treeValue"]
                and cut["fall"] == 1
                and cut["fly"] == 1
            ), cut
            assert q.evaluate("g.visualEffects.cargoHidden(0)")
            q.evaluate("g.visualEffects.update(.3,g.player,g.state.wood);g.draw()")
            assert q.evaluate("g.visualEffects.falls[0].age") == 0.3
            screenshot(
                q,
                "/tmp/pixel-felling-mobile.png" if mobile else "/tmp/pixel-felling.png",
            )
            # Перезагрузка в момент падения начинает новую сессию.
            q.evaluate("g.update(0)")
            q.reload()
            ready(q)
            assert q.evaluate(
                "g.state.wood===0&&g.visualEffects.logs.length===0&&g.visualEffects.falls.length===0&&!g.visualEffects.cargoHidden(0)"
            )
            assert q.evaluate(
                "id=>{const t=g.trees.find(t=>t.id===id);return t.hp===t.maxHp;}",
                cut["id"],
            )
            q.evaluate("g.state.campLevel=4;g.state.buildWood=0;g.rebuildObstacles()")
            assert q.evaluate("g.isWalkable(g.camp.tent.x,g.camp.tent.y-10)")
            q.evaluate(
                "g.player.x=1600;g.player.y=1800;g.player.path=[];g.state.worldTime=120;for(let i=0;i<220;i++)g.update(.1)"
            )
            assert q.evaluate("!!g.activeBuyer()")
            prior = q.evaluate("g.state.coins")
            q.evaluate(
                "g.state.cargo=[14,13];g.state.wood=2;g.state.cargoValue=27;g.player.x=g.sale.x;g.player.y=g.sale.y;g.player.swing=0;g.update(.1)"
            )
            assert q.evaluate(
                'g.state.wood===1&&g.state.cargoValue===14&&g.visualEffects.logs.some(l=>l.kind==="sell")&&g.getPlayerMood()==="happy"'
            )
            assert q.evaluate("g.state.coins") == prior + 13
            q.evaluate("g.update(0)")
            q.reload()
            ready(q)
            assert q.evaluate(
                "g.state.wood===0&&g.state.cargoValue===0&&g.visualEffects.logs.length===0"
            )
            assert q.evaluate("g.state.coins") == 0
            # Перелёт на стройку не является дополнительным списанием материала.
            q.evaluate(
                "g.state.campLevel=3;g.state.buildWood=24;g.state.maxWood=6;g.state.cargo=[10,10,10,10,10];g.state.wood=5;g.state.cargoValue=50;g.player.x=g.build.x;g.player.y=g.build.y;g.player.path=[];g.player.swing=0;g.rebuildObstacles();g.construction.update(g.state,0);g.update(.1)"
            )
            assert q.evaluate(
                'g.state.buildWood===25&&g.state.wood===4&&g.state.cargoValue===40&&g.visualEffects.logs.some(l=>l.kind==="build")'
            )
            q.evaluate(
                "g.visualEffects.update(.25,g.player,g.state.wood);g.refreshUI();g.draw()"
            )
            screenshot(
                q,
                (
                    "/tmp/pixel-building-mobile.png"
                    if mobile
                    else "/tmp/pixel-building.png"
                ),
            )
            q.evaluate("g.update(0)")
            assert q.evaluate(
                "g.state.campLevel===3&&g.state.buildWood===25&&g.state.wood===4&&g.state.cargoValue===40&&g.construction.ratio===.5"
            )
            # Проверяем пиксели постройки в начале, середине и перед завершением.
            pixels = q.evaluate(
                """()=>{const old=g.state.buildWood,result=[];for(const paid of [1,25,49]){g.state.buildWood=paid;g.construction.update(g.state,0);const c=document.createElement('canvas');c.width=400;c.height=320;const x=c.getContext('2d');x.translate(200-g.camp.hut.x,280-g.camp.hut.y);for(const e of g.construction.previewEntities(g.state))e.draw(x);const d=x.getImageData(0,0,400,320).data;let n=0;for(let i=3;i<d.length;i+=4)if(d[i])n++;result.push(n);}g.state.buildWood=old;g.construction.update(g.state,0);return result;}"""
            )
            assert pixels[0] < pixels[1] < pixels[2], pixels
            q.evaluate("g.state.campLevel=2;g.state.buildWood=9;g.rebuildObstacles()")
            count = q.evaluate("g.campFencePosts().length")
            assert count > 0
            assert q.evaluate("g.campFencePosts().every(p=>!g.isWalkable(p.x,p.y))")
            assert q.evaluate(
                """()=>{const a=g.art,normal=a.person('player','down',0),tired=a.person('player','down',0,'tired'),wave=a.person('buyerA','down',0,'happy','wave');return normal.bitmap.toDataURL()!==tired.bitmap.toDataURL()&&normal.bitmap.toDataURL()!==wave.bitmap.toDataURL()&&a.merchantPose('peek').bitmap.toDataURL()!==a.merchantPose('read').bitmap.toDataURL();}"""
            )
            q.evaluate(
                "g.state.wood=g.state.maxWood;g.player.swing=0;g.player.celebration=0"
            )
            assert q.evaluate("g.getPlayerMood()") == "tired"
            q.evaluate(
                """const live=g.trees.find(t=>t.hp>0&&t.type==='oak');g.player.x=live.x+50;g.player.y=live.y+60;g.player.path=[];for(let i=0;i<600;i++){g.environment.update(.1,i*.1,g.trees,g.player);if(i%20===0)g.environment.treeSprite(live,g.art.sprites.trees.oak[0],i*.1);}g.draw();"""
            )
            assert q.evaluate(
                "g.environment.leaves.length>0&&g.environment.leaves.length<=24&&g.environment.cachedSwaySets<=16&&g.visualEffects.cachedFrameSets<=4"
            )
            assert q.evaluate(
                "g.state.maxWood===6&&g.player.speed===200&&document.documentElement.scrollWidth<=innerWidth"
            )
            assert not errors, errors
            print(
                "PASS",
                "mobile" if mobile else "desktop",
                "fall/pickup/sale/build transactions, reload resets, partial build pixels",
                pixels,
                "solid partial fence",
                count,
                "emotions, wind/leaves, bounded caches, no page errors",
                flush=True,
            )
            c.close()
        # Настоящий цикл requestAnimationFrame должен обновлять и очищать эффекты сам.
        c = b.new_context(viewport={"width": 1360, "height": 1050})
        q = c.new_page()
        errors = []
        q.on("pageerror", lambda e: errors.append(str(e)))
        q.goto(url)
        ready(q)
        started = q.evaluate(
            """()=>{const t=g.trees.find(t=>t.hp>0&&t.type==='oak');while(t.hp>0)g.hitTree(t);return g.state.worldTime;}"""
        )
        q.wait_for_function(
            "g.visualEffects.falls.length===0&&g.visualEffects.logs.length===0",
            timeout=10000,
        )
        assert q.evaluate("g.state.worldTime") > started + 1
        assert not errors, errors
        print(
            "PASS live animation loop: time advances, falling tree and log flights finish without manual steps",
            flush=True,
        )
        c.close()
        b.close()
finally:
    server.shutdown()
