// Physical recoil uses normal collision resolution; never teleports through walls/water.
export function pushPlayer(nav,body,from,source){
  const before={x:body.x,y:body.y};
  if(!from||!Number.isFinite(from.x)||!Number.isFinite(from.y))return {x:0,y:0};
  const dx=body.x-from.x,dy=body.y-from.y,d=Math.hypot(dx,dy),force=source==='watcher'?22:source==='resident'?16:12;
  if(d>0)nav.moveBody?.(body,dx/d*force,dy/d*force);
  return {x:body.x-before.x,y:body.y-before.y};
}
