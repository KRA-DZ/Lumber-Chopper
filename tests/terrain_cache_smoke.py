"""A return trip reuses GPU chunks; a longer trip evicts old hidden images at the cap."""

from helpers.browser_start import choose_hero

from functools import partial
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from threading import Thread
from pathlib import Path
from shutil import which
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]


class H(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


s = ThreadingHTTPServer(("127.0.0.1", 0), partial(H, directory=str(ROOT)))
Thread(target=s.serve_forever, daemon=True).start()
try:
    with sync_playwright() as p:
        for canvas in (False, True):
            b = p.chromium.launch(
                headless=True,
                args=["--no-sandbox"]
                + (
                    ["--disable-webgl"]
                    if canvas
                    else ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"]
                ),
                **({"executable_path": which("chromium")} if which("chromium") else {}),
            )
            q = b.new_page()
            errors = []
            q.on("pageerror", lambda e: errors.append(str(e)))
            q.goto(
                f"http://127.0.0.1:{s.server_port}/"
                + ("dist/" if canvas else "phaser.html")
            )
            choose_hero(q)
            q.wait_for_function("!!window.lumberPhaser?.scene.hudReady", timeout=60000)
            data = q.evaluate(
                """()=>{const w=lumberPhaser.scene;w.manual=true;const t=w.terrain,a={x:1000,y:1320,width:960,height:688},b={...a,x:1256};let loads=0;const source=t.source.getChunk.bind(t.source);t.source.getChunk=(...args)=>{loads++;return source(...args)};t.update(a);const key='terrain/3/5',image=t.images.get(key);t.update(b);const before=loads;t.update(a);const reused=t.images.get(key)===image&&loads===before;for(let i=1;i<=8;i++)t.update({...a,x:a.x+i*256});const bounded=t.images.size<=24&&t.source.cachedChunks<=28,visible=[...t.images.values()].filter(i=>i.visible).length,evicted=!w.textures.exists(key);return {reused,bounded,visible,evicted,cache:t.images.size,textures:w.textures.getTextureKeys().filter(k=>k.startsWith('terrain/')).length}}"""
            )
            assert (
                data["reused"]
                and data["bounded"]
                and data["evicted"]
                and data["visible"] <= 20
                and data["textures"] == data["cache"]
            ), data
            assert not errors, errors
            print(
                "PASS terrain cache", "Canvas" if canvas else "WebGL", data, flush=True
            )
            b.close()
finally:
    s.shutdown()
