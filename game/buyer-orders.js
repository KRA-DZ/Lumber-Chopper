import { NIGHT_START } from "./cycle.js";
import { hasCampBuilding } from "./camp-projects.js";

export const BUYER_ORDERS=Object.freeze([
  {id:"logs",name:"Древесина для обоза",resource:"logs",amount:12,reward:180},
  {id:"boards",name:"Доски для ремонта моста",resource:"boards",amount:6,reward:210},
  {id:"blocks",name:"Камень для кладки",resource:"blocks",amount:5,reward:150},
]);
export function createBuyerOrders({state,player,site,forestry,canAct,onIncome,emit=()=>{}}){
  const data=state.buyerOrders;
  const near=()=>Math.hypot(player.x-site.x,player.y-site.y)<100&&!player.room;
  const living=()=>state.health>0&&!state.gameOver&&!player.menuOpen;
  const daytime=()=>state.worldTime<NIGHT_START;
  const current=()=>data.active&&BUYER_ORDERS.find(o=>o.id===data.active.id);
  function accept(id){
    const order=BUYER_ORDERS.find(o=>o.id===id);
    if(!order||!living()||!near()||!daytime()||data.active||data.refund.length||data.completedDay===state.calendarDay)return false;
    if(order.resource!=="logs"&&!hasCampBuilding(state,"workbench"))return false;
    data.active={id,day:state.calendarDay,logs:[]};emit("order-accepted",{order});return true;
  }
  function cancel(){
    if(!living()||!near()||!data.active)return false;
    data.refund.push(...data.active.logs);data.active=null;emit("order-cancelled",{});return true;
  }
  function takeRefund(){
    if(!living()||!near())return 0;
    let count=0;
    while(data.refund.length&&forestry.addCargo(data.refund.at(-1))){data.refund.pop();count++;}
    return count;
  }
  function deliver(quoted=false){
    const order=current(),active=data.active;
    if(!order||!(quoted?living():canAct())||!near()||!daytime()||active.day!==state.calendarDay)return false;
    if(order.resource==="logs"){
      const value=forestry.takeCargo();if(value===null)return false;active.logs.push(value);
      if(active.logs.length<order.amount){emit("order-delivery",{count:active.logs.length});return true;}
    }else{
      const bank=state.campIndustry.materials;if(bank[order.resource]<order.amount)return false;
      bank[order.resource]-=order.amount;
    }
    data.active=null;data.completedDay=state.calendarDay;data.completed++;
    onIncome(order.reward);emit("order-completed",{order});return true;
  }
  function update(){
    if(data.active&&(data.active.day!==state.calendarDay||!daytime())){
      data.refund.push(...data.active.logs);data.active=null;emit("order-expired",{});
    }
  }
  return {data,near,accept,cancel,takeRefund,deliver,update,get current(){return current();},
    get secondsLeft(){return Math.max(0,NIGHT_START-state.worldTime);}};
}
