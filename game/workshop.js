import {CAMP_HUB} from './camp-layout.js';
// One receiving counter; selecting a project never spends resources.
export function createWorkshop({state,player,builder,industry,defenses,forestry,canAct,emit=()=>{}}){
  let timer=0;
  const near=()=>!player.room&&Math.hypot(player.x-CAMP_HUB.counter.x,player.y-CAMP_HUB.counter.y)<100;
  const canOrder=()=>near()&&!state.gameOver&&state.health>0&&!player.menuOpen;
  const busy=()=>!!(state.buildProject||state.workshopUpgrade||state.workshopDefense);
  function chooseBuild(id){
    if(!canOrder())return false;
    if(state.buildProject===id){state.workshopBuild=true;state.buildBlockedPlayers=[];return true;}
    if(busy())return false;
    return builder.choose(id,true);
  }
  function chooseUpgrade(id){return canOrder()&&industry.selectUpgrade(id);}
  function chooseDefense(id){
    const d=defenses?.get(id);
    if(!canOrder()||busy()||!d||!['trap','barricade'].includes(d.kind)||d.hp>0)return false;
    state.workshopDefense=id;emit('workshop-order',{id});return true;
  }
  function update(dt){
    if(!canAct()||!near()||!state.workshopDefense||Math.hypot(player.x-CAMP_HUB.counter.x,player.y-CAMP_HUB.counter.y)>=CAMP_HUB.counter.radius){timer=0;return;}
    const d=defenses?.get(state.workshopDefense);
    if(!d||d.hp>0){state.workshopDefense=null;return;}
    timer+=dt;if(timer<.25||!state.wood)return;timer=0;
    if(defenses.deposit(d.id)){forestry.takeCargo();emit('workshop-delivered',{id:d.id});}
    if(defenses.get(d.id)?.hp>0)state.workshopDefense=null;
  }
  return {near,canOrder,busy,chooseBuild,chooseUpgrade,chooseDefense,update};
}
