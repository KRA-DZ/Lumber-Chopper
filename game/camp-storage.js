import {CARGO_MATERIALS,cargoAmount,changeMaterialCargo,occupiedHands} from './material-cargo.js';
import {campStorageLimit,materialLimit} from './camp-industry-config.js';
import {CAMP_SERVICE,ROOM} from './camp-services.js';

// Every transfer moves existing quantities; log prices remain attached to individual logs.
export function createCampStorage({state,player,forestry,nav,emit=()=>{}}){
  const near=()=>!state.gameOver&&state.health>0&&!player.menuOpen&&(player.room?
    Math.hypot(player.room.x-ROOM.chest.x,player.room.y-ROOM.chest.y)<90:
    Math.hypot(player.x-CAMP_SERVICE.store.x,player.y-CAMP_SERVICE.store.y)<110&&nav.hasLineOfSight(player,CAMP_SERVICE.store));
  const stored=id=>id==='logs'?state.logStore.length:state.campIndustry.materials[id]||0;
  const free=id=>id==='stone'?Math.max(0,40+state.carryLevel*10-state.stone):Math.max(0,state.maxWood-occupiedHands(state));
  let unloadTimer=0;
  const atPad=()=>!player.room&&Math.hypot(player.x-CAMP_SERVICE.storagePad.x,player.y-CAMP_SERVICE.storagePad.y)<CAMP_SERVICE.storagePad.radius;
  function update(dt){
    if(!Number.isFinite(dt)||dt<=0)return;
    if(!near()||!atPad()){unloadTimer=0;return;}
    unloadTimer+=dt;if(unloadTimer<.25)return;unloadTimer=0;
    // Each material gets a turn: a full log warehouse cannot block stone or boards.
    for(const id of CARGO_MATERIALS)if(cargoAmount(state,id)>0)transfer(id,1,'deposit');
  }
  function transfer(id,count,direction='withdraw'){
    if(!near()||!CARGO_MATERIALS.includes(id)||!Number.isInteger(count)||count<1||!['withdraw','deposit'].includes(direction))return 0;
    const take=direction==='withdraw',available=take?stored(id):cargoAmount(state,id),
      room=take?free(id):(id==='logs'?campStorageLimit(state):materialLimit(state))-stored(id);
    const amount=Math.max(0,Math.min(count,available,room));
    for(let i=0;i<amount;i++){
      if(id==='logs'){
        if(take){if(!forestry.addCargo(state.logStore.at(-1)))return i;state.logStore.pop();}
        else state.logStore.push(forestry.takeCargo());
      }else{changeMaterialCargo(state,id,take?1:-1);state.campIndustry.materials[id]+=take?-1:1;}
    }
    if(amount)emit('storage-changed',{kind:id,count:amount,action:direction});
    return amount;
  }
  return {near,stored,free,transfer,atPad,update};
}
