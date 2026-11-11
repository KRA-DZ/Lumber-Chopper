import test from "node:test";
import assert from "node:assert/strict";
import {createSimulation} from "../game/simulation.js";
import {createLocalCoop} from "../game/local-coop.js";
import {RECORD_BOARD,DECORATIONS} from "../game/camp-custom.js";
import {createRecordBook} from "../game/record-book.js";
import {dayOverview} from "../game/first-days.js";

const make=()=>createSimulation({regional:true,survival:false});
function spot(c,id="flowers"){
  for(let x=1856;x<2400;x+=32)for(let y=1952;y<2400;y+=32){
    Object.assign(c.player,c.nav.nearestGround(x,y),{path:[]});
    if(!c.custom.reason(id,{x,y}))return{x,y};
  }throw Error("No placement spot");
}
test("decoration payment is atomic; protected plots, roads, terrain and distant points reject without charges",()=>{
  const c=make();c.state.coins=100;const p=spot(c);const before=c.state.coins;
  for(const q of [{x:1600,y:1600},{x:1680,y:1455},{x:1600,y:2200},{x:5000,y:5000},{x:NaN,y:1}])assert.equal(c.custom.place("flowers",q),false);
  assert.equal(c.state.coins,before);assert.ok(c.custom.place("flowers",p));assert.equal(c.state.coins,88);
  assert.equal(c.custom.place("flowers",p),false);assert.equal(c.state.coins,88);
  assert.ok(c.nav.isWalkable(p.x,p.y));assert.equal(c.state.campLevel,0);
});
test("moving or storing owned decor does not charge twice; locked rewards and pause reject",()=>{
  const c=make();c.state.coins=100;let p=spot(c);c.custom.place("flowers",p);const o=c.state.campCustom.objects[0];
  c.paused=true;assert.equal(c.custom.remove(o.uid),false);c.paused=false;
  assert.equal(c.custom.place("seal",p),false);assert.equal(c.state.coins,88);
  assert.ok(c.custom.place("flowers",p,o.uid));assert.equal(c.state.coins,88);
  assert.ok(c.custom.remove(o.uid));assert.equal(c.state.campCustom.stock.flowers,1);
  assert.equal(c.custom.remove(o.uid),false);assert.ok(c.custom.place("flowers",p));assert.equal(c.state.coins,88);
  c.state.health=0;assert.equal(c.custom.remove(c.state.campCustom.objects[0].uid),false);
});
test("co-op shares the placed field but charges only its owner, and supplies have distance and effect limits",()=>{
  const c=createLocalCoop({survival:false}),[a,b]=c.actors;a.state.coins=b.state.coins=100;
  const p=spot(b);assert.ok(b.custom.place("flowers",p));assert.equal(a.state.campCustom,b.state.campCustom);assert.equal(a.state.coins,100);assert.equal(b.state.coins,79);
  b.state.health=20;assert.equal(b.custom.supply("heal"),false);Object.assign(b.player,RECORD_BOARD);assert.ok(b.custom.supply("heal"));assert.equal(b.state.health,55);
  b.state.health=b.state.maxHealth;assert.equal(b.custom.supply("heal"),false);
  assert.ok(b.custom.supply("coal"));assert.equal(a.state.campIndustry.materials.coal,1);
});
test("records survive a new book, one run updates once, modes stay separate, corrupted/blocked storage is safe",()=>{
  let raw=null;const storage={getItem:()=>raw,setItem:(k,v)=>{raw=v;}};let book=createRecordBook(storage);const c=make();
  c.state.nightsSurvived=1;c.state.runStats.kills=2;book.record("run","<b>A</b>","solo",c.state);
  c.state.nightsSurvived=2;book.record("run","A","solo",c.state);assert.equal(book.data.rows.length,1);
  c.state.cycleSpeed=2.5;c.state.nightsSurvived=7;book.record("fast","B","solo",c.state);
  book=createRecordBook(storage);assert.equal(book.best("solo",1).nights,2);assert.equal(book.best("solo",2.5).nights,7);assert.equal(book.best("coop",1),null);
  assert.ok(book.data.goals.includes("seven-nights"));assert.ok(DECORATIONS.every(i=>!i.goal||typeof i.goal==="string"));
  raw="broken";book=createRecordBook(storage);assert.equal(book.data.rows.length,0);assert.equal(book.available,true);
  const blocked=createRecordBook({getItem(){throw Error();},setItem(){throw Error();}});blocked.record("x","X","coop",c.state);assert.equal(blocked.available,false);assert.equal(blocked.data.rows.length,1);
});
test("fast calendar is optional, counts dawn once and does not accelerate fuel consumption",()=>{
  const c=make();c.state.worldTime=0;c.state.cycleSpeed=2.5;
  c.state.campBuildings={fire:true};c.state.campFuel=300;c.update(10);assert.ok(Math.abs(c.state.campFuel-290)<1e-6);
  c.update(170);assert.ok(Math.abs(c.state.worldTime-450)<1e-6);assert.equal(c.state.nightsSurvived,0);assert.equal(dayOverview(c.state).boundarySeconds,60);
  c.update(60);assert.equal(c.state.calendarDay,1);assert.equal(c.state.nightsSurvived,1);
  assert.equal(make().state.cycleSpeed,1);assert.equal(make().state.campCustom.objects.length,0);
});
