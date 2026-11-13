"""Only automatic attacks, HP/impact presentation, mobile solo and feedback lifecycle."""
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
SETUP='''window.g=lumberPhaser;window.w=g.scene;window.m=g.core;window.a=m.actors?.[0]||m;w.manual=true;
 window.targets=[];for(const [i,actor] of (m.actors||[m]).entries()){
  Object.assign(actor.player,actor.nav.nearestGround(1700+i*300,2010),{path:[],autoTimer:10000,clickTimer:0});
  const p=Array.from({length:8},(_,n)=>({x:actor.player.x+Math.cos(n*Math.PI/4)*35,y:actor.player.y+Math.sin(n*Math.PI/4)*35})).find(p=>actor.nav.clearSegment(actor.player,p));if(!p)throw Error('No clear attack target');
  const e={id:'feedback-'+i,kind:'raider',role:'attacker',...p,home:p,hp:6,maxHP:6,path:[],windup:0,cooldown:1000,stun:1000,repath:0};m.survival.raiders.push(e);targets.push(e);
 }g.step(0)'''
try:
    with sync_playwright() as p:
        for mobile in [False,True]:
            browser=p.chromium.launch(headless=True,executable_path=which('chromium'),args=['--no-sandbox']+(['--disable-webgl'] if mobile else ['--use-angle=swiftshader','--enable-unsafe-swiftshader']))
            q=browser.new_page(viewport={'width':390 if mobile else 1360,'height':844 if mobile else 1000},is_mobile=mobile,has_touch=mobile);errors=[]
            q.on('pageerror',lambda e:errors.append(str(e)))
            q.goto(f'http://127.0.0.1:{server.server_port}/'+('dist/' if mobile else ''))
            q.wait_for_selector('#heroDialog[open]')
            if mobile:
                assert q.locator('[name=players][value="2"]').is_disabled()
                assert not q.locator('[name=players][value="2"]').is_visible()
            else:q.locator('[name=players][value="2"]').check()
            choose_hero(q);q.evaluate(SETUP)
            q.evaluate("for(const [i,a] of (m.actors||[m]).entries()){a.player.autoTimer=0;a.tryAttack(targets[i].id)};void 0")
            if not mobile:
                q.evaluate("for(const [i,a] of m.actors.entries()){a.player.autoTimer=0;a.tryAttack(targets[i].id)};void 0")
            assert not q.locator('#attackButton').count()
            q.evaluate('g.step(0)')
            assert q.evaluate('w.combatView.labels.get("enemy:feedback-0").text.includes(targets[0].hp+"/6 HP")')
            assert q.evaluate('!w.scene.get("Hud").clock.text.includes("♥")')
            if not mobile:
                q.evaluate('m.party.focus(a);m.party.hurt(8,"minion",{x:a.player.x-40,y:a.player.y});g.step(0)')
                assert q.evaluate('a.state.health===92&&m.actors[1].state.health===100')
            else:
                q.evaluate('''for(const e of m.survival.raiders)e.stun=1000;const e=targets[0];const p=Array.from({length:8},(_,n)=>({x:a.player.x+Math.cos(n*Math.PI/4)*30,y:a.player.y+Math.sin(n*Math.PI/4)*30})).find(p=>a.nav.clearSegment(a.player,p));Object.assign(e,p,{stun:0,cooldown:0,windup:0,path:[]});for(let i=0;i<30&&a.state.health===100;i++)m.survival.update(.05);g.step(0)''')
                assert q.evaluate('a.state.health===80')
            assert q.evaluate('w.combatView.labels.get("player:0").text.includes(a.state.health+"/100 HP")&&a.nav.isWalkable(a.player.x,a.player.y)')
            q.evaluate('g.step(.05)')
            assert q.evaluate('w.combatView.numbers.some(n=>n.text.visible&&n.text.text.includes("HP"))&&w.combatView.reactions.has("player:0")')
            q.screenshot(path=str(ROOT/f'docs/combat-feedback-{ "mobile" if mobile else "desktop"}.png'))
            assert q.evaluate('''()=>{const v=w.combatView,textures=w.textures.getTextureKeys().length,hp=targets[0].hp;for(let i=0;i<30;i++)v.hit('enemy-hit',{enemy:targets[0],damage:1,actualDamage:1,push:{x:0,y:0}});v.render();return v.numbers.length===12&&targets[0].hp===hp&&w.textures.getTextureKeys().length===textures}''')
            q.evaluate('m.state.worldTime=449.99;g.step(.02);const e=m.survival.monster;Object.assign(e,{x:a.player.x+170,y:a.player.y-40});g.step(0)')
            assert q.evaluate('!w.combatView.labels.has("enemy:watcher")&&w.enemyView.objects.get("watcher").label.text.includes("НЕУЯЗВИМ")')
            q.evaluate('window.old=m;w.scene.restart();void 0');q.wait_for_function('lumberPhaser.core!==old&&lumberPhaser.scene.hudReady')
            q.evaluate(SETUP)
            q.keyboard.press('f');assert q.evaluate('targets[0].hp===6')
            q.evaluate('a.player.autoTimer=0;a.tryAttack(targets[0].id);void 0')
            assert q.evaluate('targets[0].hp===5');assert not q.locator('#attackButton').count()
            assert not errors,errors
            print('PASS attacks, overhead HP, hit reactions, bounded pool, watcher and restart',mobile,flush=True)
            browser.close()
finally:server.shutdown()
