"""Only crown/base compositing, native crown input, caption budgets and streaming cleanup."""
from functools import partial
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from threading import Thread
from shutil import which
from playwright.sync_api import sync_playwright
from helpers.browser_start import choose_hero

ROOT = Path(__file__).resolve().parents[1]


class Handler(SimpleHTTPRequestHandler):
    def log_message(self, *args): pass


server = ThreadingHTTPServer(("127.0.0.1", 0), partial(Handler, directory=str(ROOT)))
Thread(target=server.serve_forever, daemon=True).start()
try:
    with sync_playwright() as p:
        for mobile in (False, True):
            browser = p.chromium.launch(headless=True, executable_path=which("chromium"),
                args=["--no-sandbox"] + (["--disable-webgl"] if mobile else ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"]))
            context = browser.new_context(viewport={"width": 390 if mobile else 1360, "height": 844 if mobile else 1050}, is_mobile=mobile, has_touch=mobile)
            q = context.new_page(); errors = []
            q.on("pageerror", lambda e: errors.append(str(e)))
            q.goto(f"http://127.0.0.1:{server.server_port}/" + ("dist/" if mobile else "index.html"))
            choose_hero(q)
            q.evaluate("""()=>{
              window.g=lumberPhaser;window.w=g.scene;window.m=g.core;w.manual=true;
              window.tree=m.world.trees.filter(t=>t.hp>0&&t.type==='oak'&&m.treeAccessible(t)&&t.y>950&&t.y<2200)
                .sort((a,b)=>Math.hypot(a.x-2020,a.y-1780)-Math.hypot(b.x-2020,b.y-1780))[0];
              Object.assign(m.player,{x:tree.x,y:tree.y-75,path:[],autoTimer:10000,moving:false});
              w.camera.stopFollow();w.camera.centerOn(tree.x,tree.y-85);g.step(0);
              for(let i=0;i<12;i++)g.step(.05);
              window.image=w.treeObjects.get(tree.id).image;
              window.entry=w.crownOcclusion.entries.get(image);
            }""")
            assert q.evaluate("!!entry&&entry.alpha<.3&&image.alpha===1&&image.isCropped&&entry.crown.isCropped&&entry.crown.getData('tree')===tree&&entry.crown.input.enabled")
            # A paused game freezes the transition as well as the gameplay.
            q.evaluate("m.paused=true;window.alpha=entry.alpha;g.step(2)")
            assert q.evaluate("entry.alpha===alpha")
            q.evaluate("m.paused=false;g.step(.1)")
            q.locator("#game-frame").screenshot(path=str(ROOT / f"docs/crown-visibility-{'mobile' if mobile else 'desktop'}.png"))
            # Native mouse/touch on an opaque crown texel must still route to this tree.
            point = q.evaluate("""()=>{
              const f=entry.crown.frame,src=w.textures.get('forest').getSourceImage(),
                pixels=src.getContext('2d').getImageData(f.cutX,f.cutY,f.width,f.height).data,
                cut=w.assets.meta.get(f.name).crownCut;
              for(let y=Math.floor(cut*.45);y<cut;y++)for(let x=Math.floor(f.width*.4);x<f.width*.6;x++)
                if(pixels[(y*f.width+x)*4+3]===255){
                  const a=entry.crown,b=w.game.canvas.getBoundingClientRect(),cam=w.camera;
                  const wx=a.x+(x-a.displayOriginX)*a.scaleX,wy=a.y+(y-a.displayOriginY)*a.scaleY;
                  const sx=b.x+(wx-cam.worldView.x)*cam.zoom*b.width/w.scale.width,
                    sy=b.y+(wy-cam.worldView.y)*cam.zoom*b.height/w.scale.height;
                  if(sx>b.x+5&&sx<b.right-5&&sy>b.y+5&&sy<b.bottom-5)return {x:sx,y:sy};
                }
              throw Error('No visible crown texel');
            }""")
            q.evaluate("window.hitTree=null;const original=m.setDestination.bind(m);m.setDestination=(x,y)=>{hitTree={x,y};return original(x,y)};for(const o of w.treeObjects.values())if(o.image!==image)o.image.input.enabled=false;void 0")
            q.touchscreen.tap(**point) if mobile else q.mouse.click(**point)
            assert q.evaluate("hitTree?.x===tree.x&&hitTree?.y===tree.y+42")
            q.evaluate("Object.assign(m.player,{x:tree.x+350,y:tree.y+100,path:[]});for(let i=0;i<35;i++)g.step(.05)")
            assert q.evaluate("!w.crownOcclusion.entries.has(image)&&!image.isCropped")
            # The ancient tree uses the same mechanism and restores after streaming away.
            q.evaluate("""()=>{const a=m.world.ancientTree,r=m.regions.all.find(r=>a.x>=r.x&&a.x<r.x+r.width&&a.y>=r.y&&a.y<r.y+r.height);
              m.regions.unlocked.add(r.id);m.world.generate(r);m.nav.rebuildObstacles();
              Object.assign(m.player,{x:a.x,y:a.y-140,path:[],autoTimer:10000});w.camera.centerOn(a.x,a.y-150);
              for(let i=0;i<12;i++)g.step(.05)}""")
            assert q.evaluate("w.crownOcclusion.entries.has(w.ancient)&&w.ancient.alpha===1")
            q.evaluate("m.state.worldTime=299.99;g.step(.02);g.step(3.1);const p=m.player;for(const [i,e] of m.survival.residents.entries())Object.assign(e,{x:p.x-70+i*40,y:p.y+20,warning:0});Object.assign(m.survival.monster,{x:p.x+600,y:p.y+600});m.selectEnemy(m.survival.residents[0].id);g.step(0)")
            assert q.evaluate("w.worldHints.visibleCount<=4&&w.enemyView.objects.get(m.selectedEnemyId).label.visible")
            q.evaluate("w.effectsLight=true;g.step(0)")
            assert q.evaluate("w.worldHints.visibleCount<=2&&w.enemyView.objects.get(m.selectedEnemyId).label.visible")
            q.evaluate("m.setDestination(1600,1780);Object.assign(m.player,{x:1600,y:1780,path:[]});w.camera.centerOn(1600,1700);for(let i=0;i<12;i++)g.step(.05)")
            assert q.evaluate("!w.crownOcclusion.entries.has(w.ancient)&&w.crownOcclusion.entries.size<=8")
            assert not errors, errors
            print("PASS crowns/input/streaming and hint priority/caps", "mobile Canvas/dist" if mobile else "desktop WebGL", flush=True)
            context.close(); browser.close()
finally:
    server.shutdown()
