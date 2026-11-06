import assert from "node:assert/strict";
export function reenterBuildPad(core) {
  const point={x:core.player.x,y:core.player.y};
  core.player.x=core.build.x+core.build.radius+30;core.builder.update();
  Object.assign(core.player,point);core.builder.update();
}
export function chooseBuildProject(core,id) {
  core.builder.update();
  if(!core.builder.project)assert.ok(core.builder.choose(id));
  assert.equal(core.builder.project.id,id);
  reenterBuildPad(core);
}
