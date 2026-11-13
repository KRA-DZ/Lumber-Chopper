import test from "node:test";
import assert from "node:assert/strict";
import { createSimulation } from "../game/simulation.js";
import { createLocalCoop } from "../game/local-coop.js";
import { createInitialState } from "../game/config.js";
import { campMilestones } from "../game/camp-milestones.js";
import { guideDestination } from "../game/first-days.js";
import { raidReadiness } from "../game/raid-readiness.js";
import { raidPlan, raidRoster } from "../game/raid-plans.js";
import { createSurvival } from "../game/survival.js";
import { createRaiderAI } from "../game/raiders.js";
import { createRaidProjectiles, RAID_SHOTS } from "../game/raid-projectiles.js";

const make=()=>createSimulation({regional:true});
const place=(c,p)=>Object.assign(c.player,p,{path:[],autoTimer:10000});
function build(c,ids){c.state.campBuildings=Object.fromEntries(ids.map(id=>[id,true]));c.state.campLevel=ids.length;c.refreshWorld();}

test("early goals are optional, shared and keep actual lighting/mining after resources are spent",()=>{
  const g=createLocalCoop(),[a,b]=g.actors;build(a,["fire"]);b.refreshWorld();
  assert.equal(campMilestones(g).filter(x=>x.done).length,1);
  place(b,{x:1600,y:1665});assert.equal(b.camp.stoke(),false);assert.equal(a.state.campMilestones.lit,false);
  b.forestry.addCargo(8);assert.ok(b.camp.stoke());a.state.campFuel=0;
  assert.ok(campMilestones(g).find(x=>x.id==="light").done);
  const gate=a.regions.frontiers().find(x=>x.region.id==="1:0");
  build(a,["fire","fence"]);g.update(.01);
  a.world.generate(gate.region);a.refreshWorld();b.refreshWorld();
  const rock=a.world.boulders.find(r=>r.regionId===gate.region.id);
  place(b,b.nav.nearestGround(rock.x,rock.y+rock.radius+35));
  for(let i=0;i<12;i++){b.player.clickTimer=0;assert.ok(b.mining.hit(rock.id));}
  b.state.stone=0;assert.ok(campMilestones(g).find(x=>x.id==="stone").done);
  assert.equal(a.state.coins,0);assert.equal(b.state.coins,0);
  assert.ok(g.state.campBuildings.fire&&!g.state.campBuildings.tent);
  const snapshot=JSON.stringify(g.state.campMilestones);campMilestones(g);campMilestones(g);
  assert.equal(JSON.stringify(g.state.campMilestones),snapshot);
  assert.ok(Object.values(make().state.campMilestones).every(x=>!x));
});
test("cold fire guidance and on-demand routes lead to actionable fire, border and rock positions",()=>{
  const c=make();build(c,["fire"]);c.tutorial.cut=c.tutorial.sold=true;c.state.carryLevel=1;
  c.forestry.addCargo(8);assert.equal(c.guide.id,"light");assert.equal(c.guide.action,"stoke");
  place(c,guideDestination(c,"stoke"));assert.ok(c.camp.stoke());
  const border=guideDestination(c,"region");assert.ok(border&&border.region.campRequired<=c.state.campLevel);
  const r=border.region;for(let i=0;i<r.cost;i++)c.regions.deposit(r.id);c.world.generate(r);c.refreshWorld();
  const p=guideDestination(c,"stone");assert.ok(p);place(c,c.nav.nearestGround(p.x,p.y));
  const rock=c.world.boulders.find(r=>Math.hypot(r.x-p.x,r.y-p.y)<90);
  assert.ok(c.mining.hit(rock.id));assert.equal(c.player.x,p.x);assert.equal(c.player.y,p.y);
});
test("readiness uses current fuel, actual HP and finite shared coal without spending or declaring guaranteed safety",()=>{
  const c=make();build(c,["fire","fence","tower-west","tower-east"]);
  c.state.calendarDay=4;c.state.worldTime=400;c.state.campFuel=199;
  c.state.campIndustry.materials.coal=1;
  let r=raidReadiness(c);assert.equal(r.ready,2);assert.equal(r.fuelNeeded,200);assert.match(r.extra,/вооружено 1\/2/);
  c.state.campFuel=200;assert.equal(raidReadiness(c).ready,3);
  const fence=c.defenses.all().find(d=>d.kind==="fence");c.defenses.damage(fence.id,999);
  r=raidReadiness(c);assert.equal(r.ready,2);assert.match(r.checks.find(x=>x.id==="fence").text,/проломов 1/);
  const snap=JSON.stringify(c.state);raidReadiness(c);assert.equal(JSON.stringify(c.state),snap);
  c.paused=true;c.update(100);assert.equal(raidReadiness(c).fuelNeeded,200);
});
function director(){
  const state=createInitialState(),player={x:2500,y:2500},events=[];
  const nav={nearestGround:(x,y)=>({x,y}),clearSegment:()=>true,findPath:()=>[],followPath:()=>0};
  return {state,events,d:createSurvival({state,player,nav,accessible:()=>true,emit:(t,e)=>events.push([t,e]),defeat:()=>{}})};
}
test("forecasts and actual rosters agree, rotate after the introductory raid and keep the eight-enemy cap",()=>{
  const {d,events}=director();
  assert.deepEqual(raidRoster(5,3).map(e=>e.role),["attacker","thief","breaker"]);
  for(const night of [1,5,10,15,20,25,30,100]){
    d.nightStarted({night});d.update(12.1);
    if(night%5){assert.equal(d.raiders.length,0);assert.equal(d.wave,null);continue;}
    const count=Math.min(8,2+night/5),plan=raidPlan(night);
    assert.equal(d.wave.planId,plan.id);assert.equal(d.raiders.length,count);
    assert.deepEqual(d.raiders.map(e=>({role:e.role,fast:e.fast})),raidRoster(night,count));
    assert.equal(events.findLast(([t])=>t==="wave-started")[1].planId,plan.id);
    assert.ok(d.monster.invulnerable);d.dawn();assert.equal(d.projectiles.length,0);
  }
  assert.equal(raidPlan(10).id,"runners");assert.equal(raidPlan(15).id,"breakers");assert.equal(raidPlan(20).id,"throwers");assert.equal(raidPlan(25).id,"runners");
});
test("runner movement is actually faster under the same route budget",()=>{
  const speeds=[],ai=createRaiderAI({state:{health:100},player:{x:3000,y:3000},
    nav:{clearSegment:()=>true,findPath:()=>[],followPath:(e,dt,speed)=>{speeds.push(speed);return 1;}},emit:()=>{},hurtPlayer:()=>{},defeat:()=>{},hit:()=>{},escaped:()=>{}});
  const enemy={role:"attacker",x:2000,y:1600,hp:4,path:[],cooldown:0};
  ai.tick({...enemy},.05,true);ai.tick({...enemy,fast:true},.05,true);
  assert.equal(speeds[1],speeds[0]*1.25);
});
test("throwers telegraph a fixed landing point across a fence and the hero can dodge",()=>{
  const state=createInitialState(),player={x:1600,y:1700},hits=[],events=[];
  const shots=createRaidProjectiles({state,player,hurt:n=>hits.push(n),emit:(t,e)=>events.push([t,e])});
  const ai=createRaiderAI({state,player,nav:{clearSegment:()=>false,followPath:()=>0},launch:shots.launch,emit:()=>{},hurtPlayer:()=>{},defeat:()=>{},hit:()=>{},escaped:()=>{}});
  const enemy={role:"thrower",x:1870,y:1700,hp:4,cooldown:0,windup:0,path:[]};
  ai.tick(enemy,.2,false);assert.ok(enemy.attack);assert.equal(shots.shots.length,0);
  player.y=1710;ai.tick(enemy,.26,false);assert.equal(shots.shots.length,1);
  assert.equal(shots.shots[0].y,1700);assert.equal(hits.length,0);
  player.y=1800;shots.update(.76);assert.equal(hits.length,0);assert.equal(shots.shots.length,0);assert.equal(events[0][0],"minion-projectile-impact");
  enemy.cooldown=0;enemy.x=1840;ai.tick(enemy,.46,false);shots.update(.76);assert.deepEqual(hits,[RAID_SHOTS.damage]);
  player.room={};enemy.cooldown=0;ai.tick(enemy,.01,false);assert.equal(shots.shots.length,0);
});
test("raid projectile cap, private rooms, once-only co-op blast and dawn cleanup bound ranged pressure",()=>{
  const state=createInitialState(),player={x:0,y:0},blasts=[];
  const shots=createRaidProjectiles({state,player,party:{blast:(...args)=>blasts.push(args)},hurt:()=>{},emit:()=>{}});
  for(let i=0;i<10;i++)shots.launch({x:100,y:100},player);
  assert.equal(shots.shots.length,4);shots.update(.2);assert.equal(blasts.length,0);
  shots.update(.6);assert.equal(blasts.length,4);shots.update(10);assert.equal(blasts.length,4);
  shots.launch({x:100,y:100},player);shots.clear();assert.equal(shots.shots.length,0);
});
test("an actual co-op blast hurts each nearby living player once and leaves room occupants safe",()=>{
  const events=[],g=createLocalCoop({emit:(type,e)=>events.push([type,e])}),[a,b]=g.actors;
  place(a,{x:1600,y:1720});place(b,{x:1600,y:1720});
  const shots=createRaidProjectiles({state:a.state,player:a.player,party:g.party,hurt:()=>{},emit:()=>{}});
  shots.launch({x:1850,y:1720},a.player);shots.update(.76);
  assert.equal(a.state.health,90);assert.equal(b.state.health,90);shots.update(1);
  assert.equal(events.filter(([t])=>t==="player-hurt").length,2);
  assert.ok(events.filter(([t])=>t==="player-hurt").every(([,e])=>e.source==="raider"));
  a.player.hitCooldown=b.player.hitCooldown=0;b.player.room={x:240,y:280};
  shots.launch({x:1850,y:1720},a.player);shots.update(.76);
  assert.equal(a.state.health,80);assert.equal(b.state.health,90);
});
