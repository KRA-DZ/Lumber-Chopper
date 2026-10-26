"""Добыча → покупатель → монеты → лавка, рост и ночные тайны."""

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


def point(q, x, y):
    return q.evaluate(
        """([x,y])=>{const c=document.querySelector('canvas'),r=c.getBoundingClientRect(),b=c.clientLeft;return [r.left+b+(x-g.camera.x)*(r.width-b*2)/g.view.width,r.top+b+(y-g.camera.y)*(r.height-b*2)/g.view.height]}""",
        [x, y],
    )


def shot(q, name, mobile):
    q.evaluate("g.refreshUI();g.draw()")
    q.evaluate("()=>new Promise(done=>paintFrame(()=>paintFrame(done)))")
    q.screenshot(
        path=f'/tmp/progression-{name}{"-mobile" if mobile else ""}.png', full_page=True
    )


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
            assert q.evaluate(
                "g.state.maxWood===2&&g.state.coins===0&&g.state.cargo.length===0"
            )
            # Реальная крупная ель/дуб даёт три бревна, а поднять можно только два.
            tree = q.evaluate(
                """()=>{const t=g.trees.find(t=>t.size===2&&t.type==='oak'&&Math.hypot(t.x-1600,t.y-1600)<800&&g.isWalkable(t.x+46,t.y+38));window.cutTree=t;g.player.x=t.x+46;g.player.y=t.y+38;g.player.path=[];g.update(0);while(t.hp>0)g.hitTree(t);return {id:t.id,value:t.value};}"""
            )
            assert q.evaluate(
                "g.state.wood===0&&g.forestry.piles.get(cutTree.id).count===3"
            )
            q.evaluate("g.update(.05);g.update(.2);g.update(.2)")
            assert q.evaluate(
                "g.state.wood===2&&g.state.cargo.length===2&&g.forestry.piles.get(cutTree.id).count===1&&g.growthStage(cutTree,g.dayNumber)===0"
            )
            assert q.evaluate("g.state.cargoValue") == tree["value"] * 2
            q.evaluate("g.visualEffects.update(1,g.player,g.state.wood);g.update(0)")
            shot(q, "ground-logs", mobile)
            # Покупатель приходит сам. Первая продажа зарабатывает деньги на переноску.
            q.evaluate(
                "for(let i=0;i<220;i++)g.update(.1);window.walker=g.activeBuyer();g.player.x=g.sale.x;g.player.y=g.sale.y;g.player.path=[];g.update(.2);g.update(.2)"
            )
            assert q.evaluate(
                'walker.kind==="walker"&&walker.capacity===5&&walker.load===2&&g.state.wood===0&&g.state.coins===20'
            )
            q.evaluate("g.player.x=1600;g.player.y=1760;g.update(0)")
            px, py = point(q, 1420, 1580)
            (q.touchscreen.tap if mobile else q.mouse.click)(px, py)
            assert q.locator("#shopDialog").is_visible()
            before = q.evaluate("g.state.worldTime")
            q.evaluate("g.update(5)")
            assert q.evaluate("g.state.worldTime") == before
            q.locator('[data-buy="carry"]').click()
            assert q.evaluate(
                "g.state.coins===0&&g.state.maxWood===4&&g.state.carryLevel===1"
            )
            assert q.locator('[data-buy="carry"]').is_disabled()
            shot(q, "shop", mobile)
            q.keyboard.press("Escape")
            assert not q.locator("#shopDialog").is_visible()
            q.evaluate(
                "g.player.x=cutTree.x+46;g.player.y=cutTree.y+38;g.player.path=[];g.update(.2)"
            )
            assert q.evaluate("g.state.wood===1&&!g.forestry.piles.has(cutTree.id)")
            # Обычный покупатель не получает шестое бревно и уходит после заполнения.
            q.evaluate(
                "for(let i=0;i<3;i++)g.forestry.addCargo(10);g.player.x=g.sale.x;g.player.y=g.sale.y;g.player.path=[];for(let i=0;i<12;i++)g.update(.2)"
            )
            assert q.evaluate("walker.load===5&&g.state.wood===1&&g.state.coins===30")
            q.evaluate(
                "g.player.x=1600;g.player.y=1800;g.player.path=[];for(let i=0;i<600;i++)g.update(.1);window.cart=g.activeBuyer()"
            )
            assert q.evaluate('cart.kind==="cart"&&cart.capacity===15')
            # Отдельно проверяем потолок тележки с заранее подготовленной ношей.
            q.evaluate(
                "g.state.maxWood=20;g.state.cargo=[];g.state.wood=0;g.state.cargoValue=0;for(let i=0;i<16;i++)g.forestry.addCargo(10);g.player.x=g.sale.x;g.player.y=g.sale.y;g.player.path=[];for(let i=0;i<18;i++)g.update(.2)"
            )
            assert q.evaluate("cart.load===15&&g.state.wood===1&&g.state.coins===180")
            # Редкость действительно меняет спрайт/урон; остальные товары действуют на мир.
            q.evaluate("g.state.coins=2000;g.shop.open()")
            for _ in range(3):
                q.locator('[data-buy="axe"]').click()
            assert q.evaluate(
                "g.state.coins===935&&g.state.axeLevel===3&&g.state.axePower===4&&g.state.autoInterval===.68"
            )
            assert q.evaluate(
                "g.art.sprites.axes[0][0].bitmap.toDataURL()!==g.art.sprites.axes[3][0].bitmap.toDataURL()"
            )
            q.locator('[data-buy="lantern"]').click()
            q.locator('[data-buy="boots"]').click()
            q.locator('[data-buy="pickup"]').click()
            assert q.evaluate(
                "g.state.coins===675&&g.player.speed===216&&g.state.pickupRadius===80&&g.nightLights().at(-1).r===164"
            )
            shot(q, "upgrades", mobile)
            q.locator("#shopDialog [data-close]").click()
            # Три смены суток: росток, молодое дерево, зрелое дерево с коллизией.
            q.evaluate(
                "g.player.autoTimer=1000;g.player.x=1600;g.player.y=1760;g.player.path=[];g.state.worldTime=599.99;g.update(.02)"
            )
            assert q.evaluate(
                "g.dayNumber===1&&g.growthStage(cutTree,g.dayNumber)===1&&cutTree.hp===0"
            )
            q.evaluate(
                "g.state.worldTime=599.99;g.update(.02);g.player.x=cutTree.x+46;g.player.y=cutTree.y+38;g.update(0)"
            )
            assert q.evaluate(
                "g.dayNumber===2&&g.growthStage(cutTree,g.dayNumber)===2&&cutTree.hp===0"
            )
            shot(q, "young-tree", mobile)
            q.evaluate(
                "g.player.x=cutTree.x;g.player.y=cutTree.y;g.state.worldTime=599.99;g.update(.02)"
            )
            assert q.evaluate(
                "g.dayNumber===3&&cutTree.hp===cutTree.maxHp&&cutTree.cutDay===null&&!g.isWalkable(cutTree.x,cutTree.y)&&g.isWalkable(g.player.x,g.player.y)"
            )
            # Ночь в лесу: глаза появляются за пределами света и не превращаются в NPC.
            q.evaluate(
                "const p=g.nearestGround(1080,1220);g.player.x=p.x;g.player.y=p.y;g.player.path=[];g.state.worldTime=450;for(let i=0;i<200&&!g.mystery.eyes.length;i++)g.update(.1);for(let i=0;i<8;i++)g.update(.1)"
            )
            assert q.evaluate(
                "g.mystery.eyes.length>0&&g.mystery.eyes.length<=3&&g.mystery.eyes.every(e=>g.nightLights().every(l=>Math.hypot(e.x-l.x,e.y-l.y)>=l.r*.9))"
            )
            shot(q, "night-eyes", mobile)
            # Записка открывается с клавиатуры, чтение тоже останавливает время.
            q.evaluate(
                "g.player.x=1290;g.player.y=1400;g.player.path=[];g.state.worldTime=120;g.update(.1)"
            )
            assert q.evaluate("g.mystery.eyes.length===0")
            q.keyboard.press("e")
            assert q.locator("#clueDialog").is_visible()
            assert q.locator("#clueText").inner_text().startswith("«Если после заката")
            assert q.evaluate('g.mystery.read.has("note")')
            q.locator("#clueClose").click()
            assert q.evaluate(
                "document.documentElement.scrollWidth<=innerWidth&&g.dressing.details.length===230&&g.forestry.piles.size<=g.trees.length"
            )
            q.reload()
            ready(q)
            assert q.evaluate(
                'g.state.maxWood===2&&g.state.coins===0&&g.state.carryLevel===0&&g.state.axeLevel===0&&g.forestry.piles.size===0&&g.mystery.read.size===0&&g.trees.every(t=>t.hp===t.maxHp)&&localStorage.getItem("lumber-chopper-v1")===null'
            )
            assert not errors, errors
            print(
                "PASS",
                "mobile" if mobile else "desktop",
                "3-log harvest/2-hand limit/ground stock, exact sales, walker5/cart15, shop/touch/pause/upgrades, 3-day regrowth/collisions, dark eyes/clues, reset",
                flush=True,
            )
            c.close()
        b.close()
finally:
    server.shutdown()
