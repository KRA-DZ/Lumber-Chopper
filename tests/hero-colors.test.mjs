import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeHeroColors,heroColorKey,recolorHeroPixels,HERO_PALETTES} from '../game/hero-colors.js';
import {createSimulation} from '../game/simulation.js';
import {createLocalCoop} from '../game/local-coop.js';
test('only approved material colours are accepted and invalid input falls back independently',()=>{
  assert.equal(Object.keys(HERO_PALETTES).length,4);
  assert.deepEqual(normalizeHeroColors({hair:'forest',jacket:'__proto__',pants:'#ffffff'}),{hair:'forest',jacket:'original',pants:'original'});
  assert.equal(heroColorKey(null),'original/original/original');
  assert.equal(heroColorKey({pants:'mist',hair:'forest'}),'forest/original/mist');
});
test('appearance colours do not change any gameplay state or player geometry',()=>{
  const a=createSimulation({regional:true,survival:false}),b=createSimulation({regional:true,survival:false,colors:{hair:'forest',jacket:'mist',pants:'burgundy'}});
  const {heroColors:x,...left}=a.state,{heroColors:y,...right}=b.state;
  assert.deepEqual(left,right);assert.deepEqual(a.player,b.player);assert.notDeepEqual(x,y);
});
test('two players may use the same hero with independent colours and existing defaults stay compatible',()=>{
  const g=createLocalCoop({survival:false,heroChoices:[{appearance:'traveler',colors:{hair:'forest'}},{appearance:'traveler',colors:{hair:'mist'}}]});
  assert.equal(g.actors[0].state.appearance,g.actors[1].state.appearance);
  g.actors[0].state.heroColors.hair='burgundy';assert.equal(g.actors[1].state.heroColors.hair,'mist');
  const old=createLocalCoop({survival:false,appearance:'woodcutter'});assert.equal(old.actors[1].state.appearance,'traveler');
});
test('colouring changes only selected labelled RGB, preserving transparency and unlabelled gear',()=>{
  const original=new Uint8ClampedArray([80,60,40,255,40,70,70,255,65,60,40,255,230,180,130,255,0,0,0,0]);
  const labels=new Uint8Array([1,2,3,0,1]);
  assert.deepEqual(recolorHeroPixels(original.slice(),labels,'hero2',null),original);
  const result=recolorHeroPixels(original.slice(),labels,'hero2',{jacket:'mist'});
  assert.notDeepEqual(result.slice(4,7),original.slice(4,7));
  for(let i=0;i<5;i++){assert.equal(result[i*4+3],original[i*4+3]);if(i!==1)assert.deepEqual(result.slice(i*4,i*4+4),original.slice(i*4,i*4+4));}
});
