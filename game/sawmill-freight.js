import { MILL } from "./sawmill-production-config.js";
import { campStorageLimit, materialLimit } from "./camp-industry-config.js";

// One real vehicle, with exact log values. Board hand cargo occupies the same carry slots as logs.
export function createSawmillFreight({state,player,forestry,nav,nearSite,living}){
  const data=state.sawmill,cart=data.cart;
  const free=()=>MILL.cartLimit-cart.logs.length-cart.boards;
  const near=()=>cart.built&&Math.hypot(player.x-cart.x,player.y-cart.y)<90&&nav.hasLineOfSight(player,cart);
  const accessible=()=>living()&&near()&&(cart.owner===null||cart.owner===(player.id??0));
  const towing=()=>cart.built&&cart.owner===(player.id??0);
  function attach(){if(!accessible()||cart.owner!==null)return false;cart.owner=player.id??0;cart.x=player.x;cart.y=player.y;return true;}
  function detach(){if(!living()||!towing())return false;cart.owner=null;return true;}
  function sync(){if(towing()){cart.x=player.x;cart.y=player.y;if(state.health<=0||player.room||state.gameOver)cart.owner=null;}}
  function load(){
    if(!living()||!nearSite("camp-freight")||!accessible())return false;
    let count=0;while(state.logStore.length&&free()>0){cart.logs.push(state.logStore.pop());count++;}return count>0;
  }
  function unload(){
    if(!living()||!nearSite("camp-freight"))return false;
    const bank=state.campIndustry.materials;let count=0;
    while(state.boardCargo>0&&bank.boards<materialLimit(state)){state.boardCargo--;bank.boards++;count++;}
    if(accessible()){
      while(cart.boards>0&&bank.boards<materialLimit(state)){cart.boards--;bank.boards++;count++;}
      while(cart.logs.length&&state.logStore.length<campStorageLimit(state)){state.logStore.push(cart.logs.pop());count++;}
    }return count>0;
  }
  function deposit(){
    if(!living()||data.stage<1||!(nearSite("sawmill-loading")||nearSite("sawmill-production")))return false;
    let count=0;while(state.wood&&data.input.length<MILL.inputLimit){data.input.push(forestry.takeCargo());count++;}
    if(accessible())while(cart.logs.length&&data.input.length<MILL.inputLimit){data.input.push(cart.logs.pop());count++;}
    return count>0;
  }
  function collect(){
    if(!living()||data.stage<3||!(nearSite("sawmill-loading")||nearSite("sawmill-production")))return false;
    let count=0;
    // Load the vehicle first when present; otherwise carry boards in the freed personal slots.
    if(accessible())while(data.output>0&&free()>0){data.output--;cart.boards++;count++;}
    while(data.output>0&&state.cargo.length+state.boardCargo<state.maxWood){data.output--;state.boardCargo++;count++;}
    return count>0;
  }
  function takeInput(){
    if(!living()||!(nearSite("sawmill-loading")||nearSite("sawmill-production")))return false;
    let count=0;while(data.input.length&&forestry.addCargo(data.input.at(-1))){data.input.pop();count++;}return count>0;
  }
  return {cart,free,near,accessible,towing,attach,detach,sync,load,unload,deposit,collect,takeInput};
}
