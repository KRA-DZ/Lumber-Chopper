// Shared platform palette and fade duration; changing these does not change interaction ranges.
export const PAD_STYLE=Object.freeze({border:0xd4a359,activeBorder:0xffe2a0,fill:0x494b3d,activeFill:0x99713e,fadeSeconds:.16});
const levels=new WeakMap();
export const padGlow=(previous,standing,dt)=>previous+((standing?1:0)-previous)*(1-Math.exp(-Math.max(0,Math.min(.1,dt))/PAD_STYLE.fadeSeconds));
export const onPad=(point,actors,width,height)=>actors.some(a=>!a.player.room&&a.state.health>0&&(point.radius?
  Math.hypot(a.player.x-point.x,a.player.y-point.y)<point.radius:Math.abs(a.player.x-point.x)<width/2&&Math.abs(a.player.y-point.y)<height/2));
function blend(a,b,t){return [16,8,0].reduce((n,s)=>n|(Math.round(((a>>s)&255)*(1-t)+((b>>s)&255)*t)<<s),0);}
export function drawInteractionPad(scene,graphics,point,width,height,standing){
  let pads=levels.get(graphics);if(!pads){pads=new Map();levels.set(graphics,pads);}
  const level=padGlow(pads.get(point)||0,standing,(scene.game.loop.delta||16.7)/1000);pads.set(point,level);
  graphics.fillStyle(blend(PAD_STYLE.fill,PAD_STYLE.activeFill,level),.48+level*.22).fillRoundedRect(point.x-width/2,point.y-height/2,width,height,8)
    .lineStyle(2+level,blend(PAD_STYLE.border,PAD_STYLE.activeBorder,level),.85+level*.15).strokeRoundedRect(point.x-width/2,point.y-height/2,width,height,8);
  return level;
}
