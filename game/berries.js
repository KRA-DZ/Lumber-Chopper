export const BERRIES=Object.freeze({yield:2,limit:12,heal:6,range:100});
export function createBerries({state,player,world,regions,nav,canAct,navigate,emit=()=>{}}){
  let pending=null;
  const get=id=>world.berryBushes.find(b=>b.id===id);
  const ready=b=>!!b&&!b.decorative&&(state.exploration.berryDays[b.id]??-1)<state.calendarDay;
  function reason(id){const b=get(id);
    if(!canAct())return "Герой недоступен";
    if(!b||!regions.isOpen(b))return "Куст недоступен";
    if(!ready(b))return "Новый урожай на следующий день";
    if(state.exploration.items.berry>BERRIES.limit-BERRIES.yield)return "Сумка ягод заполнена";
    if(Math.hypot(player.x-b.x,player.y-b.y)>BERRIES.range||!nav.hasLineOfSight(player,b))return "Подойдите к кусту";
    return "";
  }
  function harvest(id){if(reason(id))return false;const bush=get(id);state.exploration.berryDays[id]=state.calendarDay;state.exploration.items.berry+=BERRIES.yield;if(pending){player.path=[];player.targetX=player.x;player.targetY=player.y;}pending=null;emit("berries-picked",{bush,count:BERRIES.yield});return true;}
  function order(id){const b=get(id);if(!canAct()||!b||!regions.isOpen(b)||!ready(b))return false;
    if(harvest(id))return true;
    if(state.exploration.items.berry>BERRIES.limit-BERRIES.yield)return false;
    navigate(b.x,b.y+38);if(!player.path.length)return false;pending={id,x:player.targetX,y:player.targetY,left:20};return true;
  }
  function update(dt){if(!pending)return;pending.left-=dt;
    if(!canAct()||pending.left<=0||Math.hypot(player.targetX-pending.x,player.targetY-pending.y)>8){pending=null;return;}
    if(!harvest(pending.id)&&!player.path.length)pending=null;
  }
  return {get,ready,reason,harvest,order,update,cancel:()=>{pending=null;},frame:b=>b.decorative?(b.flowering?"flower":"empty"):ready(b)?"ripe":"empty"};
}
