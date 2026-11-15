import test from 'node:test';
import assert from 'node:assert/strict';
import {placeHintBox} from '../phaser/interaction-hints.js';
import {padGlow,onPad} from '../phaser/interaction-pad.js';
test('caption placement avoids top HUD and another caption while remaining above the dock',()=>{
  const view={x:0,y:0,width:512,height:650},hud={x:14,y:12,width:265,height:150};
  const first=placeHintBox({x:240,y:230},220,64,view,[hud]);
  const second=placeHintBox({x:250,y:235},220,64,view,[hud,first]);
  const overlaps=(a,b)=>a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;
  assert.equal(overlaps(first,hud)||overlaps(second,hud)||overlaps(first,second),false);
  for(const b of [first,second])assert.ok(b.x>=view.x&&b.x+b.width<=512&&b.y>=0&&b.y+b.height<=650);
});
test('split-screen caption stays inside its own viewport',()=>{
  const view={x:500,y:0,width:500,height:600};
  const box=placeHintBox({x:510,y:570},260,70,view);
  assert.ok(box.x>=510&&box.x+box.width<=990&&box.y+box.height<=590);
});
test('platform glow fades monotonically and either living outdoor player can activate it',()=>{
  let glow=0;const first=padGlow(glow,true,.016);assert.ok(first>0&&first<1);
  for(let i=0;i<40;i++)glow=padGlow(glow,true,.016);assert.ok(glow>.97);
  const falling=padGlow(glow,false,.016);assert.ok(falling<glow&&falling>0);
  const point={x:100,y:100},actors=[{state:{health:100},player:{x:300,y:100}},{state:{health:100},player:{x:100,y:100}}];
  assert.equal(onPad(point,actors,68,46),true);actors[1].player.room={};assert.equal(onPad(point,actors,68,46),false);
});
