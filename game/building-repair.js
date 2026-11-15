export const REPAIR_HP = 40; // One common resource restores 40 HP, twice the former log efficiency.
export const repairResource = section => section.material==='stone'?'stone':'logs';
export const campRepairTarget = state => ({id:'camp-core',kind:'camp',material:'wood',x:1600,y:1645,hp:state.campHealth,maxHP:state.maxCampHealth});
export function repairFromStock(state,defenses,section){
  if(!section||section.hp>=section.maxHP)return false;
  const material=repairResource(section),bank=state.campIndustry.materials;
  if(material==='logs'?!state.logStore.length:!(bank.stone>0))return false;
  if(section.kind==='camp')state.campHealth=Math.min(state.maxCampHealth,state.campHealth+REPAIR_HP);
  else if(!defenses.restore(section.id,REPAIR_HP))return false;
  if(material==='logs')state.logStore.pop();else bank.stone--;
  return true;
}
