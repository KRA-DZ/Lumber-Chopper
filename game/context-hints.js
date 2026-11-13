import {DAY_SECONDS} from './config.js';
import {EVENING_START,NIGHT_START} from './cycle.js';
import {hasCampBuilding} from './camp-projects.js';
import {CAMP_SERVICE} from './camp-services.js';
import {BERRIES} from './berries.js';

const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
// One personal invitation per run. No rewards, new objectives or persistent progress.
export function createContextHints(c){
  let target=null,explored=false,scan=2;
  const available=()=>!c.paused&&!c.state.gameOver&&c.state.health>0&&!c.player.room&&!c.player.menuOpen;
  const preparing=()=>c.state.worldTime>=EVENING_START&&c.state.worldTime<NIGHT_START;
  const open=p=>c.regions?.isOpen(p);
  const berryValid=p=>c.berries?.ready(p)&&open(p);
  const noteValid=p=>open(p)&&!c.state.readClues.includes(p.id);
  function candidates(){
    return [...(c.world.berryBushes||[]).filter(berryValid).map(p=>({kind:'berry',point:p})),
      ...(c.world.clues||[]).filter(p=>p.id!=='note'&&noteValid(p)).map(p=>({kind:'note',point:p}))]
      .filter(t=>distance(c.player,t.point)<=1200&&(t.kind!=='berry'||c.state.exploration.items.berry<=BERRIES.limit-BERRIES.yield))
      .sort((a,b)=>distance(c.player,a.point)-distance(c.player,b.point)||a.point.id.localeCompare(b.point.id));
  }
  function update(dt){
    if(!available()||explored)return;
    if(target){
      const p=target.point;
      if(!(target.kind==='berry'?berryValid(p):noteValid(p))||distance(c.player,p)<100&&c.nav.hasLineOfSight(c.player,p)){
        explored=true;target=null;
      }
      return;
    }
    if(c.state.worldTime>=EVENING_START||!c.tutorial.cut)return;
    scan+=dt;if(scan<2)return;scan=0;
    for(const candidate of candidates().slice(0,3)){
      const p=candidate.point,goal=c.nav.nearestGround(p.x,p.y+30);
      if(distance(c.player,p)<100&&c.nav.hasLineOfSight(c.player,p)){explored=true;break;}
      if(c.nav.findPath(c.player,goal).length){target=candidate;break;}
    }
  }
  const hint=(id,title,text,button,extra={})=>({id,title,text,button,action:'context',...extra});
  function preparation(){
    const s=c.state;
    if(!hasCampBuilding(s,'fire'))return hint('prep-fire','До ночи нужен костёр',
      s.buildProject&&s.buildProject!=='fire'?'Сейчас выбран другой проект. Его можно завершить; костёр выбирается на платформе стройки отдельно.':'Выберите костёр на платформе стройки. Только зажжённый костёр защищает лагерь от Смотрителя.', 'К стройке');
    // Advice only: enough real-time fuel until dawn, plus a small walking reserve.
    const needed=(DAY_SECONDS-s.worldTime)/(s.cycleSpeed||1)+15;
    if(s.campFuel<needed){
      const logs=Math.ceil((needed-s.campFuel)/CAMP_SERVICE.fuelPerLog);
      if(s.wood>0)return hint('prep-fuel','Добавьте топлива до ночи',`До рассвета нужно ещё примерно ${logs} бр. На площадке топливо добавляется из рук; возле костра также работает E/Enter.`, 'К площадке топлива');
      if(s.logStore.length)return hint('prep-store','Для костра есть брёвна на складе','Заберите брёвна со склада через E/Enter и отнесите на площадку топлива.', 'К складу');
      return hint('prep-logs','Соберите дрова для ночи',`Запас огня мал. Нужно ещё примерно ${logs} бр. Подберите оставшиеся брёвна или срубите ближайшее дерево.`, 'К дровам');
    }
    if(s.health<s.maxHealth*.6){
      if(s.exploration.items.berry||s.exploration.items.salve)return hint('prep-heal','Восстановите здоровье','В сумке есть лечение. Используйте ягоды или мазь перед выходом в темноту.', 'Открыть сумку');
      const bush=(c.world.berryBushes||[]).filter(berryValid).sort((a,b)=>distance(c.player,a)-distance(c.player,b))[0];
      if(bush&&distance(c.player,bush)<1200)return hint('prep-forage','Найдите лечение перед ночью','На ближайшем кусте есть ягоды. После сбора их можно съесть через сумку.', 'К ягодам',{targetId:bush.id});
      return hint('prep-return','Здоровья мало для ночной вылазки','Завершите вылазку и вернитесь в лагерь. Для лечения нужны ягоды или мазь.', 'К лагерю');
    }
    if(c.survival&&!c.survival.isSafe(c.player))return hint('prep-return','Костёр готов — возвращайтесь к свету','Топлива достаточно. Завершите вылазку: от Смотрителя защищает свет горящего костра, а не только высокий запас здоровья.', 'К лагерю');
    return null;
  }
  function current(){
    if(!available()||c.state.worldTime>=NIGHT_START)return null;
    if(preparing())return preparation();
    if(!target||explored||distance(c.player,target.point)>1200)return null;
    return target.kind==='berry'?hint('explore-berry','Рядом ягодная поляна','Соберите 2 ягоды: каждая лечит 6 HP через сумку. Брёвна остаются в руках.', 'К ягодной поляне',{targetId:target.point.id}):
      hint('explore-note','В лесу есть находка','Старая записка поможет узнать историю леса. Подойдите и прочитайте через E/Enter.', 'К находке',{targetId:target.point.id});
  }
  function activate(quoted){
    const h=current();if(!h||h.id!==quoted?.id||h.targetId!==quoted.targetId)return false;
    if(h.id==='prep-heal')return 'bag';
    if(h.id==='explore-berry'||h.id==='prep-forage')return c.berries.order(h.targetId);
    if(h.id==='explore-note'){const p=target.point;c.setDestination(p.x,p.y+30);return true;}
    if(h.id==='prep-fuel'){const p=CAMP_SERVICE.fuelPad;c.setDestination(p.x,p.y);return true;}
    if(h.id==='prep-store'){const p=CAMP_SERVICE.store;c.setDestination(p.x,p.y);return true;}
    return c.navigateGuide(h.id==='prep-fire'?'build':h.id==='prep-logs'?'trees':'camp');
  }
  return {update,activate,get current(){return current();},get preparing(){return preparing();},get explored(){return explored;}};
}
