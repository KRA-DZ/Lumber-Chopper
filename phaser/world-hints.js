export const HINT_LIMITS = Object.freeze({ full: 1, light: 1 });

export function playerHint(candidates,player,view,index=0){
  if(player.room)return null;
  return candidates.map(entry=>({...entry,distance:Math.hypot(player.x-entry.point.x,player.y-entry.point.y)}))
    .filter(e=>(e.actor==null||e.actor===index)&&e.distance<=e.range&&e.point.x>=view.x-40&&e.point.x<=view.x+view.width+40&&e.point.y>=view.y-40&&e.point.y<=view.y+view.height+40)
    .sort((a,b)=>Number(b.priority>=100)-Number(a.priority>=100)||a.distance-b.distance||b.priority-a.priority)[0]||null;
}

// Only world captions share this budget. HUD, HP bars and attack warnings stay independent.
export class WorldHints {
  constructor(scene) {
    this.scene = scene;
    this.candidates = [];
    this.visibleCount = 0;
    this.active = [];
  }
  begin() {
    this.candidates.length = 0;
  }
  offer(label, point, { eligible = true, range = 180, priority = 10, companions = [], actor = null } = {}) {
    label.setVisible(false);
    for (const object of companions) object.setVisible(false);
    const players = (this.scene.core.actors||[this.scene.core]).filter(a=>!a.player.room&&a.state?.health!==0).map(a=>a.player),
      distance = Math.min(...players.map(p => Math.hypot(p.x - point.x, p.y - point.y)));
    if (!eligible || distance > range || !label.text) return;
    this.candidates.push({ label, point, range, companions, distance, priority, actor });
  }
  flush() {
    const actors=this.scene.core.actors||[this.scene.core];
    this.active=actors.flatMap((actor,index)=>{
      if(actor.state?.health===0||actor.player.menuOpen)return [];
      const camera=this.scene.coopCamera?.split?(index?this.scene.coopCamera.second:this.scene.camera):this.scene.camera;
      const entry=playerHint(this.candidates,actor.player,camera.worldView,index);
      return entry?[{entry,player:actor.player,index,camera}]:[];
    });
    // Source captions/old speech bubbles stay hidden; the HUD owns at most one panel per actor.
    this.visibleCount=this.active.length;
  }
}
