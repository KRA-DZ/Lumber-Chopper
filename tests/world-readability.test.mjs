import test from "node:test";
import assert from "node:assert/strict";
import { crownCut, coversHero } from "../phaser/tree-occlusion.js";
import { playerHint, WorldHints } from "../phaser/world-hints.js";

test("crown boundary preserves the narrow trunk; hero overlap excludes carried logs and trees behind him", () => {
  const w = 20, h = 40, pixels = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = y < 26 ? 2 : 9; x < (y < 26 ? 18 : 11); x++)
      pixels[(y * w + x) * 4 + 3] = 255;
  assert.equal(crownCut(pixels, w, h), 26);
  const image = { visible: true, depth: 300, x: 100, y: 300,
    displayOriginX: 10, displayOriginY: 40, scaleX: 2, scaleY: 2,
    displayWidth: 40, displayHeight: 80 };
  assert.equal(coversHero(image, 26, { x: 100, y: 290 }), true);
  assert.equal(coversHero(image, 26, { x: 100, y: 320 }), false);
  assert.equal(coversHero(image, 26, { x: 100, y: 200 }), false);
  assert.equal(coversHero(image, 26, { x: 180, y: 290 }), false);
  image.visible = false;
  assert.equal(coversHero(image, 26, { x: 100, y: 290 }), false);
});

test('nearest eligible caption wins per player; immediate danger overrides scenery',()=>{
  const view={x:0,y:0,width:300,height:200},p={x:30,y:30};
  const entry=(id,x,priority=10,range=100)=>({id,point:{x,y:30},priority,range});
  const choices=[entry('near',35),entry('far',90,90),entry('outside',500,120,Infinity)];
  assert.equal(playerHint(choices,p,view).id,'near');
  choices.push(entry('danger',100,110));assert.equal(playerHint(choices,p,view).id,'danger');
  assert.equal(playerHint(choices,{...p,room:{}},view),null);
});

test('each co-op actor gets one local caption; source text and old speech bubbles stay hidden',()=>{
  const object=text=>({text,visible:true,setVisible(v){this.visible=v;return this;},getBounds(){return {left:0,right:20,top:0,bottom:20};}});
  const actors=[{state:{health:100},player:{x:10,y:0}},{state:{health:100},player:{x:250,y:0}}];
  const scene={core:{actors},camera:{worldView:{x:0,y:0,width:300,height:200}}};
  const hints=new WorldHints(scene),first=object('Костёр'),second=object('Склад'),bubble=object('');
  hints.begin();hints.offer(first,{x:15,y:0},{range:80,companions:[bubble]});hints.offer(second,{x:245,y:0},{range:80});hints.flush();
  assert.deepEqual(hints.active.map(e=>e.entry.label.text),['Костёр','Склад']);assert.equal(hints.visibleCount,2);
  assert.equal(first.visible||second.visible||bubble.visible,false);
  hints.offer(object('Личная подсказка P2'),{x:15,y:0},{range:80,priority:999,actor:1});hints.flush();
  assert.deepEqual(hints.active.map(e=>e.entry.label.text),['Костёр','Склад']);
  actors[0].player.x=900;hints.begin();hints.offer(first,{x:15,y:0},{range:80});hints.offer(second,{x:245,y:0},{range:80});hints.flush();
  assert.equal(hints.visibleCount,1);assert.equal(hints.active[0].index,1);
  actors[1].player.room={};hints.begin();hints.offer(second,{x:245,y:0},{range:80});hints.flush();assert.equal(hints.visibleCount,0);
});
