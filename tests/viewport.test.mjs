import test from "node:test";
import assert from "node:assert/strict";
import { viewportSize } from "../phaser/viewport.js";

test("viewport fills desktop, portrait and landscape without stretching world coordinates", () => {
  for (const [w,h] of [[1280,720],[1920,1080],[390,844],[375,667],[844,390],[2560,1080],[3840,2160]]) {
    const size=viewportSize(w,h);
    assert.ok(Math.abs(size.width/size.height-w/h)<.004);
    assert.ok(size.width<=1600&&size.height<=1024);
  }
  assert.equal(viewportSize(1920,1080).height,720);
  assert.equal(viewportSize(390,844).height,1024);
});

test("larger desktop displays retain world scale instead of rendering additional backing pixels", () => {
  assert.deepEqual(viewportSize(1920,1080),viewportSize(3840,2160));
  assert.ok(viewportSize(1920,1080).width>viewportSize(1024,768).width);
});
