"""Repeatable frame/CPU sampling; no FPS assertions tied to the CI machine.
python tests/phaser_performance.py --baseline /path/to/previous-checkout
Headless WebGL uses software rendering. Viewport emulation is not a real phone.
"""

import argparse
import json
from functools import partial
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from shutil import which
from threading import Thread
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument("--baseline", type=Path)
parser.add_argument("--output", type=Path, default=Path("/tmp/lumber-performance.json"))
args = parser.parse_args()


class Handler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def serve(root):
    server = ThreadingHTTPServer(
        ("127.0.0.1", 0), partial(Handler, directory=str(root))
    )
    Thread(target=server.serve_forever, daemon=True).start()
    return server, f"http://127.0.0.1:{server.server_port}/phaser.html"


servers = []
sources = []
for label, root in ([("baseline", args.baseline)] if args.baseline else []) + [
    ("current", ROOT)
]:
    server, url = serve(root)
    servers.append(server)
    sources.append((label, url))
report = {
    "method": "Headless Chromium, software WebGL; 1s warmup + 3s RAF sampling per case; CPU is World.update (simulation + view, GPU work excluded), frame interval includes browser rendering. No screenshot during sampling. Mobile viewport is emulated, not a device benchmark.",
    "samples": [],
}
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
        for label, url in sources:
            context = browser.new_context(
                viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True
            )
            q = context.new_page()
            errors = []
            q.on("pageerror", lambda e: errors.append(str(e)))
            q.goto(url)
            q.wait_for_function("!!window.lumberPhaser?.scene.hudReady", timeout=30000)
            q.evaluate(
                """()=>{window.g=lumberPhaser;window.w=g.scene;window.m=g.core;const original=w.sys.sceneUpdate.bind(w);window.samples={cpu:[],frames:[],phases:new Set(),on:false};w.sys.sceneUpdate=(time,delta)=>{const t=performance.now();original(time,delta);if(samples.on&&samples.cpu.length<2000)samples.cpu.push(performance.now()-t);if(samples.on&&m.survival?.monster)samples.phases.add(m.survival.monster.phase)};let last=performance.now();function frame(now){if(samples.on&&samples.frames.length<2000)samples.frames.push(now-last);last=now;requestAnimationFrame(frame)}requestAnimationFrame(frame);m.state.maxWood=40;while(m.state.wood<40)m.forestry.addCargo(10);m.player.x=1600;m.player.y=1760;window.route={a:1580,b:1740,y:1760};window.destination=route.b;w.events.on('postupdate',()=>{if(Math.abs(m.player.x-destination)<12)destination=destination===route.b?route.a:route.b;if(!m.player.path.length)m.setDestination(destination,route.y)})}"""
            )
            for name, time, light in [
                ("day-cargo", 120, False),
                ("rain-cargo", 220, False),
                ("night-cargo", 450, False),
                ("night-light", 450, True),
                ("fifth-night-82", 450, False),
                ("watcher-chase", 450, False),
                ("watcher-chase-warm", 450, False),
            ]:
                if name == "fifth-night-82":
                    q.evaluate(
                        "m.state.maxWood=82;while(m.state.wood<82)m.forestry.addCargo(10);m.state.calendarDay=4;m.state.worldTime=299.95;g.step(.1);g.step(16.1)"
                    )
                if name.startswith("watcher-chase") and not q.evaluate(
                    "!!m.survival?.hear"
                ):
                    continue
                if name == "watcher-chase":
                    q.evaluate(
                        "m.state.worldTime=599.99;g.step(.02);m.state.calendarDay=0;m.state.worldTime=299.99;g.step(.02);g.step(12.1);route={a:1500,b:1850,y:2000};destination=route.b;m.player.x=1600;m.player.y=2000;m.player.path=[];m.player.autoTimer=1000;Object.assign(m.survival.monster,m.nav.nearestGround(1800,2000),{path:[],repath:0,senseTimer:0})"
                    )
                if name == "watcher-chase-warm":
                    q.evaluate("m.state.health=100")
                q.evaluate(
                    """([time,light])=>{samples.on=false;m.state.worldTime=time;if(w.effectsLight!==light)document.querySelector('#effectsBtn').click()}""",
                    [time, light],
                )
                q.wait_for_timeout(1000)
                q.evaluate(
                    "samples.cpu=[];samples.frames=[];samples.phases=new Set();samples.on=true"
                )
                q.wait_for_timeout(3000)
                result = q.evaluate(
                    """()=>{samples.on=false;if(!samples.cpu.length)throw new Error("No CPU samples from scene update");const stats=a=>{a=a.slice().sort((a,b)=>a-b);return {count:a.length,median:Math.round(a[Math.floor(a.length*.5)]*100)/100,p95:Math.round(a[Math.floor(a.length*.95)]*100)/100,max:Math.round(a.at(-1)*100)/100}};const atlas=w.textures.get('forest').getSourceImage();return {renderer:g.renderer,cpuMs:stats(samples.cpu),frameMs:stats(samples.frames),atlas:[atlas.width,atlas.height],objects:w.children.length,textures:w.textures.getTextureKeys().length,chunks:w.terrain.images.size,visibleChunks:[...w.terrain.images.values()].filter(i=>i.visible).length,cargo:w.cargo.length,flights:w.flights.size,enemies:w.enemyView?.objects.size||0,watcher:m.survival?.monster?.phase||null,observedWatcher:[...samples.phases],health:m.state.health}}"""
                )
                assert not errors, errors
                entry = {"version": label, "scenario": name, **result}
                report["samples"].append(entry)
                print(json.dumps(entry), flush=True)
            context.close()
        browser.close()
finally:
    for server in servers:
        server.shutdown()
args.output.write_text(json.dumps(report, indent=2) + "\n")
print("Report:", args.output, flush=True)
