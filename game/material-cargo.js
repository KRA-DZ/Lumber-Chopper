export const CARGO_MATERIALS = ['logs','stone','boards','blocks','coal','kits'];
export const cargoAmount = (state,id) => id==='logs'?state.wood:id==='stone'?state.stone:id==='boards'?state.boardCargo:(state.materialCargo?.[id]||0);
// Stone retains its existing sack capacity; other goods share the log/board carry slots.
export const occupiedHands = state => state.wood+(state.boardCargo||0)+Object.values(state.materialCargo||{}).reduce((a,b)=>a+b,0);
export const carriedAmount = state => occupiedHands(state)+(state.stone||0);
export function changeMaterialCargo(state,id,delta){
  if(id==='stone')state.stone+=delta;
  else if(id==='boards')state.boardCargo+=delta;
  else { state.materialCargo??={blocks:0,coal:0,kits:0};state.materialCargo[id]+=delta; }
}
