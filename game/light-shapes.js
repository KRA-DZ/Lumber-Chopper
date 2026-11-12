const level=n=>Math.max(0,Math.min(4,Math.floor(Number(n)||0)));
export const lanternRange=n=>240+level(n)*48;
export const lanternHalfAngle=n=>.38+level(n)*.045;
export function playerLights(state,player){
  if(state.health<=0||player.room)return [];
  const angle={right:0,down:Math.PI/2,left:Math.PI,up:-Math.PI/2}[player.direction]??(player.facing===-1?Math.PI:0),
    x=player.x,y=player.y-24;
  return [{x,y,r:lanternRange(state.lanternLevel),angle,halfAngle:lanternHalfAngle(state.lanternLevel),level:level(state.lanternLevel),kind:"player",shape:"cone"},
    {x,y,r:56,kind:"player-glow"}];
}
// Shared by eyes, fireflies and loot markers: a cone must not behave like a large circle.
export function lightContains(light,x,y){
  const dx=x-light.x,dy=y-light.y;if(Math.hypot(dx,dy)>=light.r*.9)return false;
  if(light.shape!=="cone")return true;
  const delta=Math.atan2(Math.sin(Math.atan2(dy,dx)-light.angle),Math.cos(Math.atan2(dy,dx)-light.angle));
  return Math.abs(delta)<light.halfAngle*.9;
}
