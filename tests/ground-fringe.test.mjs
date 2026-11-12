import test from "node:test";
import assert from "node:assert/strict";
import { pathGrassWeight } from "../phaser/art/ground-art.js";

function mask(origin,width=24) {
  const pixels=new Uint8ClampedArray(width*width*4);
  for(let y=0;y<width;y++)for(let x=0;x<width;x++)
    if(x+origin>=0) pixels[(y*width+x)*4+3]=255;
  return pixels;
}
test("path fringe fades toward solid dirt and has no effect away from grass",()=>{
  const pixels=mask(-8);
  for(const hash of [0,1,4,2153]) {
    const edge=pathGrassWeight(pixels,24,8,12,hash),inner=pathGrassWeight(pixels,24,11,12,hash);
    assert.ok(edge>inner&&inner>0&&edge<1);
    assert.equal(pathGrassWeight(pixels,24,15,12,hash),0);
  }
});
test("mask padding makes a boundary pixel independent of the chunk containing it",()=>{
  for(const hash of [0,4,578]) {
    assert.equal(pathGrassWeight(mask(-8),24,8,12,hash),pathGrassWeight(mask(-12),24,12,12,hash));
  }
});
