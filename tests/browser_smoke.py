"""Проверка игры в Chromium: python tests/browser_smoke.py. Нужен Python Playwright."""

from functools import partial
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from threading import Thread
from shutil import which
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


server = ThreadingHTTPServer(
    ("127.0.0.1", 0), partial(QuietHandler, directory=str(ROOT))
)
Thread(target=server.serve_forever, daemon=True).start()
url = f"http://127.0.0.1:{server.server_port}/"


def ready(page):
    page.wait_for_function("!!window.lumberGame", polling=50)
    page.evaluate("window.g=window.lumberGame")


def point(page, x, y):
    return page.evaluate(
        """([x,y])=>{const c=document.querySelector('canvas'),r=c.getBoundingClientRect(),b=c.clientLeft;return [r.left+b+(x-g.camera.x)*(r.width-b*2)/g.view.width,r.top+b+(y-g.camera.y)*(r.height-b*2)/g.view.height]}""",
        [x, y],
    )


try:
    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=True,
            args=["--no-sandbox"],
            **({"executable_path": which("chromium")} if which("chromium") else {}),
        )
        context = browser.new_context(viewport={"width": 1360, "height": 1050})
        context.add_init_script("window.requestAnimationFrame=()=>0")
        page = context.new_page()
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.on(
            "console", lambda e: errors.append(e.text) if e.type == "error" else None
        )
        page.goto(url)
        ready(page)
        # Непрозрачные края состоят из целых пикселей, палитра ограничена.
        sizes = page.evaluate(
            """()=>{function bounds(s){let min=s.height,max=0;for(let y=0;y<s.height;y++)for(let x=0;x<s.width;x++)if(s.mask[y*s.width+x]){min=Math.min(min,y);max=Math.max(max,y);}return max-min+1;}const a=g.art.sprites;return {hero:bounds(a.characters.player.down[0]),oak:bounds(a.trees.oak[0]),birch:bounds(a.trees.birch[0]),spruce:bounds(a.trees.spruce[0]),house:bounds(a.house),fence:bounds(a.fence),binary:[a.characters.player.down[0],a.trees.oak[0],a.house].every(s=>s.mask.every(v=>v===0||v===255))}}"""
        )
        assert sizes["binary"], sizes
        assert (
            2.6 < sizes["oak"] / sizes["hero"] < 3.6
            and 3.4 < sizes["house"] / sizes["hero"] < 4.3
        ), sizes
        assert 0.4 < sizes["fence"] / sizes["hero"] < 0.65, sizes
        assert page.evaluate(
            'g.view.width===960&&!document.querySelector("canvas").getContext("2d").imageSmoothingEnabled'
        )
        # Клавиатура и нажатие по земле управляют настоящим персонажем.
        page.evaluate("g.player.x=1620;g.player.y=1760;g.player.path=[];g.update(0)")
        page.keyboard.down("d")
        page.evaluate("g.update(.2)")
        page.keyboard.up("d")
        assert page.evaluate("g.player.x>1650&&Math.abs(g.player.y-1760)<.1")
        target = page.evaluate("g.nearestGround(1700,1770)")
        page.mouse.click(*point(page, target["x"], target["y"]))
        page.evaluate("for(let i=0;i<100;i++)g.update(.03)")
        assert page.evaluate("p=>Math.hypot(g.player.x-p.x,g.player.y-p.y)<2", target)
        # Выбор по пикселям ствола, авторубка и проходимый пень в текущей сессии.
        tree = page.evaluate(
            """()=>{const t=g.trees.find(t=>t.hp>0&&Math.hypot(t.x-1600,t.y-1600)<800&&g.isWalkable(t.x+46,t.y+38));g.player.x=t.x+46;g.player.y=t.y+38;g.player.path=[];g.player.clickTimer=0;g.update(0);g.draw();window.selected=t;return {x:t.x,y:t.y-20,hp:t.hp,id:t.id}}"""
        )
        page.mouse.click(*point(page, tree["x"], tree["y"]))
        assert page.evaluate("selected.hp") == tree["hp"] - 1
        page.evaluate(
            "for(let i=0;i<250&&selected.hp>0;i++)g.update(.05);g.refreshUI()"
        )
        assert page.evaluate(
            "selected.hp===0&&g.state.wood>=1&&g.isWalkable(selected.x,selected.y)"
        )
        coins = page.evaluate("g.state.coins")
        wood = page.evaluate("g.state.wood")
        page.reload()
        ready(page)
        assert page.evaluate(
            "id=>{const t=g.trees.find(t=>t.id===id);return t.hp===t.maxHp}", tree["id"]
        )
        assert page.evaluate(
            'g.state.wood===0&&g.state.coins===0&&g.state.campLevel===0&&localStorage.getItem("lumber-chopper-v1")===null'
        )
        # Нулевой шаг на стройке не расходует дерево; перезагрузка сбрасывает этап.
        page.evaluate(
            "g.state.campLevel=2;g.state.buildWood=7;g.state.maxWood=4;g.state.cargo=[10,10,10,10];g.state.wood=4;g.state.cargoValue=40;g.player.x=g.build.x;g.player.y=g.build.y;g.player.path=[];g.rebuildObstacles();g.refreshUI()"
        )
        page.evaluate("g.update(0)")
        assert page.evaluate(
            "g.state.campLevel===2&&g.state.buildWood===7&&g.state.wood===4&&g.state.cargoValue===40"
        )
        # Все стадии и проход в лагерь, реальные основания зданий и сплошной забор.
        page.evaluate("g.state.campLevel=0;g.state.buildWood=0;g.rebuildObstacles()")
        for level, cost in enumerate([10, 20, 35, 50], 1):
            page.evaluate(
                """cost=>{g.state.maxWood=cost;g.state.cargo=Array(cost).fill(10);g.state.wood=cost;g.state.cargoValue=cost*10;g.player.x=g.build.x;g.player.y=g.build.y;g.player.path=[];for(let i=0;i<cost*3+5;i++)g.update(.1)}""",
                cost,
            )
            assert page.evaluate("g.state.campLevel") == level
            page.evaluate(
                "g.setDestination(1600,1810);for(let i=0;i<300;i++)g.update(.03)"
            )
            assert page.evaluate("Math.hypot(g.player.x-1600,g.player.y-1810)<3")
        assert page.evaluate(
            "!g.isWalkable(g.camp.hut.x,g.camp.hut.y-16)&&g.isWalkable(1600,1835)"
        )
        assert page.evaluate(
            "g.campFenceSegments().every(([a,b])=>!g.isWalkable((a.x+b.x)/2,(a.y+b.y)/2))"
        )
        # Очередь ждёт днём, принимает смешанный груз и уходит вечером.
        page.evaluate(
            "g.state.worldTime=40;g.player.x=1600;g.player.y=1800;g.player.path=[];for(let i=0;i<2400;i++)g.update(.1)"
        )
        assert page.evaluate("g.buyers.filter(b=>b.phase!=='leaving').length") == 5
        prior = page.evaluate("g.state.coins")
        page.evaluate(
            "g.player.x=g.sale.x;g.player.y=g.sale.y;g.state.cargo=[14,13];g.state.wood=2;g.state.cargoValue=27;for(let i=0;i<5;i++)g.update(.2)"
        )
        assert page.evaluate("g.state.wood===0&&g.state.cargoValue===0")
        assert page.evaluate("g.state.coins") == prior + 27
        page.evaluate("g.state.worldTime=300;for(let i=0;i<400;i++)g.update(.1)")
        assert page.evaluate("g.buyers.length") == 0
        # Кеш поверхности ограничен при путешествии по карте.
        page.evaluate(
            """for(let i=0;i<16;i++){const a=i*Math.PI/8,p=g.nearestGround(1600+Math.cos(a)*1100,1600+Math.sin(a)*1100);g.player.x=p.x;g.player.y=p.y;g.player.path=[];g.update(0);g.draw()}"""
        )
        assert page.evaluate("g.terrain.cachedChunks<=g.terrain.maxChunks")
        page.evaluate(
            "g.player.x=1600;g.player.y=1680;g.player.path=[];g.state.worldTime=120;g.update(0);g.refreshUI();g.draw()"
        )
        page.screenshot(path="/tmp/pixel-world-desktop.png", full_page=True)
        page.evaluate("g.state.worldTime=450;g.update(0);g.refreshUI();g.draw()")
        page.screenshot(path="/tmp/pixel-world-night.png", full_page=True)
        assert not errors, errors
        print(
            "PASS desktop: pixel proportions",
            sizes,
            "input, harvest/stumps, fresh sessions, all stages/routes/fence, queue/sales/evening, bounded terrain cache",
            flush=True,
        )
        # Мобильный экран использует меньший обзор, сохраняя читаемый размер героя.
        mobile = browser.new_context(
            viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True
        )
        mobile.add_init_script("window.requestAnimationFrame=()=>0")
        q = mobile.new_page()
        q.on("pageerror", lambda e: errors.append(str(e)))
        q.goto(url)
        ready(q)
        assert q.evaluate(
            "g.view.width===512&&g.view.height===704&&document.documentElement.scrollWidth<=innerWidth"
        )
        pos = q.evaluate("g.nearestGround(g.player.x+70,g.player.y+20)")
        q.touchscreen.tap(*point(q, pos["x"], pos["y"]))
        q.evaluate("for(let i=0;i<100;i++)g.update(.03)")
        assert q.evaluate("p=>Math.hypot(g.player.x-p.x,g.player.y-p.y)<3", pos)
        q.evaluate(
            "g.state.campLevel=4;g.rebuildObstacles();g.player.x=1600;g.player.y=1680;g.player.path=[];g.update(0);g.refreshUI();g.draw()"
        )
        q.screenshot(path="/tmp/pixel-world-mobile.png", full_page=True)
        # Прежняя запись игры удаляется при загрузке; прогресс не восстанавливается.
        legacy = browser.new_context()
        legacy.add_init_script(
            """window.requestAnimationFrame=()=>0;if(!sessionStorage.seed){sessionStorage.seed='1';localStorage.setItem('lumber-chopper-v1',JSON.stringify({version:4,daySeconds:1200,worldTime:900,wood:7,maxWood:40,coins:321,cargoValue:84,campLevel:2,buildWood:11,upgradeCost:50,x:1600,y:1720,trees:[]}));}"""
        )
        old = legacy.new_page()
        old.goto(url)
        ready(old)
        assert old.evaluate(
            'g.state.wood===0&&g.state.maxWood===2&&g.state.coins===0&&g.state.worldTime===120&&g.state.campLevel===0&&g.state.buildWood===0&&localStorage.getItem("lumber-chopper-v1")===null'
        )
        assert not errors, errors
        print(
            "PASS mobile: touch input, readable viewport/no overflow; old save cleared; starts from zero; no page errors",
            flush=True,
        )
        browser.close()
finally:
    server.shutdown()
