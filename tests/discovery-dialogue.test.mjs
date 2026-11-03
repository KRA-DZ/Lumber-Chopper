import test from "node:test";
import assert from "node:assert/strict";
import { createSimulation } from "../game/simulation.js";
import { DISCOVERY_DIALOGUES, discoveryReply, discoveryConnection, locationJournalGroups } from "../game/discovery-dialogue.js";

const MERCHANT="mysterious-merchant";
const create=()=>createSimulation({regional:true,survival:false});
function unlock(g,id) {
  const r=g.regions.all.find(r=>r.id===id);
  g.regions.unlocked.add(id);g.world.generate(r);g.nav.rebuildObstacles();
}
function inspect(g) {
  const site=g.exploration.get(MERCHANT);
  Object.assign(g.player,{x:site.x,y:site.y+35,path:[]});
  assert.ok(g.exploration.request(MERCHANT));
}
const resources=g=>JSON.stringify({coins:g.state.coins,cargo:g.state.cargo,value:g.state.cargoValue,items:g.state.exploration.items,chapter:g.state.story});

test("only collected personal finds unlock optional merchant topics, independent of the chapter",()=>{
  const g=create();unlock(g,"0:1");inspect(g);
  for(const d of DISCOVERY_DIALOGUES) {
    assert.equal(g.exploration.perform(MERCHANT,`story:find:${d.id}`),false);
    assert.equal(discoveryReply(g.state,d.id),"");
  }
  assert.equal(g.exploration.perform(MERCHANT,"story:find:forged"),false);
  const d=DISCOVERY_DIALOGUES[0];g.state.exploration.discoveries.push(d.id);
  const before=resources(g);
  g.paused=true;
  assert.ok(g.exploration.perform(MERCHANT,`story:find:${d.id}`));
  assert.equal(resources(g),before);
  assert.equal(g.state.story.phase,0);
  assert.ok(g.story.conversation(MERCHANT).includes("Дозорные"));
  assert.equal(discoveryConnection(g.state),"");
});

test("merchant replies require a genuine nearby inspection, reject death and leave full inventories intact",()=>{
  const g=create();unlock(g,"0:1");
  const d=DISCOVERY_DIALOGUES[1], action=`story:find:${d.id}`;
  g.state.exploration.discoveries.push(d.id);
  assert.equal(g.exploration.perform(MERCHANT,action),false);
  inspect(g);
  g.player.x+=400;
  assert.equal(g.exploration.perform(MERCHANT,action),false);
  inspect(g);
  const s=g.exploration.get(MERCHANT);
  assert.equal(g.story.performAt({...s},action),false);
  g.state.gameOver=true;
  assert.equal(g.exploration.perform(MERCHANT,action),false);
  g.state.gameOver=false;
  g.forestry.addCargo(10);g.forestry.addCargo(15);
  Object.assign(g.state.exploration.items,{key:3,fish:12,resin:6,relic:12,salve:3});
  const before=resources(g);
  assert.ok(g.exploration.perform(MERCHANT,action));
  assert.equal(resources(g),before);
  assert.deepEqual(g.state.exploration.discoveries,[d.id]);
});

test("both discussions reveal a connection once, can be recalled, and reset in a new game",()=>{
  const g=create();unlock(g,"0:1");inspect(g);
  for(const d of DISCOVERY_DIALOGUES)g.state.exploration.discoveries.push(d.id);
  for(const d of DISCOVERY_DIALOGUES)assert.ok(g.exploration.perform(MERCHANT,`story:find:${d.id}`));
  assert.ok(discoveryConnection(g.state).includes("Седьмая смена"));
  const before=resources(g);
  for(const d of DISCOVERY_DIALOGUES)assert.ok(g.exploration.perform(MERCHANT,`story:find:${d.id}`));
  assert.equal(g.state.exploration.discussedFinds.length,2);
  assert.equal(resources(g),before);
  const fresh=create();
  assert.deepEqual(fresh.state.exploration.discussedFinds,[]);
  assert.equal(discoveryConnection(fresh.state),"");
});

test("location cards contain read notes only, return copies and preserve undiscovered places",()=>{
  const g=create();assert.deepEqual(locationJournalGroups(g),[]);
  unlock(g,"0:-1");unlock(g,"1:0");unlock(g,"1:1");
  let groups=locationJournalGroups(g);
  assert.equal(groups.length,2);
  assert.ok(groups.every(l=>l.notes.length===0&&l.found===0));
  g.state.readClues.push("fortress-ledger","sawmill-order");
  g.state.exploration.discoveries.push("sawmill-shift-tag");
  groups=locationJournalGroups(g);
  assert.deepEqual(groups.map(l=>l.notes.length),[1,1]);
  assert.equal(groups[1].found,1);
  const old=g.world.clues.find(n=>n.id==="sawmill-order").text;
  groups[1].notes[0].text="UI mutation";
  assert.equal(g.world.clues.find(n=>n.id==="sawmill-order").text,old);
});

test("journal routes reach an open entrance, guide to a locked frontier, and never unlock or teleport",()=>{
  const g=create(), location=g.world.locations[0], before={x:g.player.x,y:g.player.y};
  const target={kind:"location",id:location.id};
  assert.ok(g.navigateStory(target));
  assert.deepEqual({x:g.player.x,y:g.player.y},before);
  const gate=g.regions.frontiers().find(g=>g.region.id===location.regionId);
  assert.deepEqual([g.player.targetX,g.player.targetY],[gate.x,gate.y]);
  assert.equal(g.regions.unlocked.size,1);
  unlock(g,location.regionId);
  assert.ok(g.navigateStory(target));
  assert.deepEqual([g.player.targetX,g.player.targetY],[location.entrance.x,location.entrance.y]);
  g.paused=true;assert.equal(g.navigateStory(target),false);
  g.paused=false;assert.equal(g.navigateStory({kind:"location",id:"forged"}),false);
});

test("optional conversations do not suppress the existing first-chapter merchant dialogue",()=>{
  const g=create();unlock(g,"0:1");inspect(g);
  g.state.story.phase=2;g.state.readClues.push("merchant-note");
  const d=DISCOVERY_DIALOGUES[0];g.state.exploration.discoveries.push(d.id);
  assert.ok(g.exploration.perform(MERCHANT,`story:find:${d.id}`));
  assert.equal(g.state.story.phase,2);
  assert.ok(g.exploration.perform(MERCHANT,"story:ask-watcher"));
  assert.equal(g.state.story.phase,3);
  assert.ok(g.story.conversation(MERCHANT).includes("трёх свидетелей"));
});
