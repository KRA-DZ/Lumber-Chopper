"""Only colour selection/preview, independent co-op art, atlas frames, restart and reset."""
from functools import partial
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from pathlib import Path
from threading import Thread
from shutil import which
from playwright.sync_api import sync_playwright
from helpers.browser_start import choose_hero
ROOT=Path(__file__).resolve().parents[1]
class Handler(SimpleHTTPRequestHandler):
    def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Handler,directory=str(ROOT)))
Thread(target=server.serve_forever,daemon=True).start()
try:
    with sync_playwright() as p:
        for mobile in [False,True]:
            browser=p.chromium.launch(headless=True,executable_path=which('chromium'),args=['--no-sandbox']+(['--disable-webgl'] if mobile else ['--use-angle=swiftshader','--enable-unsafe-swiftshader']))
            q=browser.new_page(viewport={'width':390 if mobile else 1280,'height':844 if mobile else 900},is_mobile=mobile,has_touch=mobile);errors=[]
            q.on('pageerror',lambda e:errors.append(str(e)))
            q.goto(f'http://127.0.0.1:{server.server_port}/'+('dist/' if mobile else ''))
            q.wait_for_selector('#heroDialog[open]');q.wait_for_function("!!document.querySelector('[data-hero-preview]')?.dataset.frame")
            assert q.evaluate('!window.lumberPhaser')
            assert not q.locator('[data-hero-player="1"]').is_visible()
            q.locator('[data-hero-player="0"] [data-hero-preset=forest]').click()
            q.select_option('[name=pants0]','burgundy');q.select_option('[data-hero-motion="0"]','carry')
            q.locator('[data-hero-turn="0"]').click()
            q.wait_for_function("document.querySelector('[data-hero-preview]').dataset.colors==='forest/forest/burgundy'&&document.querySelector('[data-hero-preview]').dataset.direction==='right'")
            if mobile:q.locator('[name=appearance][value=woodcutter]').check()
            else:
                q.locator('[name=players][value="2"]').check();q.wait_for_selector('[data-hero-player="1"]')
                q.select_option('[name=appearance2]','traveler')
                q.locator('[data-hero-player="1"] [data-hero-preset=mist]').click()
                q.select_option('[data-hero-motion="1"]','strike')
            q.locator('[data-hero-customizer]').screenshot(path=str(ROOT/f'docs/hero-colors-selection-{ "mobile" if mobile else "desktop"}.png'))
            choose_hero(q,'woodcutter' if mobile else 'traveler')
            q.evaluate('window.g=lumberPhaser;window.w=g.scene;window.m=g.core;w.manual=true;g.step(0)')
            assert q.evaluate('m.state.heroColors.hair==="forest"&&m.state.heroColors.pants==="burgundy"')
            if not mobile:assert q.evaluate('m.actors[0].state.appearance===m.actors[1].state.appearance&&m.actors[1].state.heroColors.hair==="mist"')
            # Compare final atlas aliases against separately painted raw source frames.
            assert q.evaluate('''async()=>{const {heroPreviewFrame}=await import('./phaser/hero-color-art.js'),pack=w.registry.get('peoplePack');
              for(const [i,actor] of (m.actors||[m]).entries()){const prefix=i?'coop2.':'',role=actor.state.appearance==='woodcutter'?'hero3':'hero2';
                const cases=[...['down','up','side'].flatMap(d=>[[`characters.player.${d}.0`,`${role}-walk-${d}-0`],[`hero.carry.${d}.0`,`${role}-carry-${d}-0`]]),
                  ...[0,3,5].flatMap(tier=>['down','up','side'].map(d=>[`hero.strike.${tier}.${d}.0`,`${role}-strike-${d}-0-tier${tier}`]))];
                for(const [alias,id] of cases){const f=w.textures.getFrame('forest',prefix+alias),image=w.textures.get('forest').getSourceImage(),a=image.getContext('2d').getImageData(f.cutX,f.cutY,f.cutWidth,f.cutHeight).data,
                  b=heroPreviewFrame(pack,id,actor.state.heroColors).getContext('2d').getImageData(0,0,f.cutWidth,f.cutHeight).data;
                  if(a.some((v,j)=>v!==b[j]))throw Error(prefix+alias+' has wrong colours');}}
              return w.textures.get('forest').getSourceImage().height<=2048&&!w.textures.exists('people.materials')}''')
            q.keyboard.down('d');q.evaluate('g.step(.25)');q.keyboard.up('d')
            q.screenshot(path=str(ROOT/f'docs/hero-colors-game-{ "mobile" if mobile else "desktop"}.png'))
            q.evaluate('window.previous=m;w.scene.restart();void 0');q.wait_for_function('lumberPhaser.core!==previous&&lumberPhaser.scene.hudReady')
            assert q.evaluate('lumberPhaser.core.state.heroColors.pants==="burgundy"&&lumberPhaser.core.state.coins===0')
            q.reload();q.wait_for_selector('#heroDialog[open]')
            assert q.evaluate('!window.lumberPhaser&&[...document.querySelectorAll("[data-hero-material]")].every(s=>s.value==="original")')
            assert not errors,errors
            print('PASS hero palettes, live preview, coloured aliases, private co-op, restart and fresh load',mobile,flush=True)
            browser.close()
finally:server.shutdown()
