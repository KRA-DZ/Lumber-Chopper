export const RAID_SHOTS=Object.freeze({max:4,range:280,flight:.75,radius:28,damage:10,cooldown:1.6});

// Fixed landing points let players dodge. Fences do not block arcs; room occupants are never targets.
export function createRaidProjectiles({state,player,party,hurt,emit}) {
  const shots=[];let sequence=0;
  return {
    shots,
    launch(enemy,target) {
      if(state.gameOver||shots.length>=RAID_SHOTS.max)return false;
      shots.push({id:`raid-shot:${sequence++}`,x:target.x,y:target.y,fromX:enemy.x,fromY:enemy.y-25,
        age:0,duration:RAID_SHOTS.flight,radius:RAID_SHOTS.radius});return true;
    },
    update(dt) {
      if(state.gameOver||!Number.isFinite(dt)||dt<=0)return;
      for(let i=shots.length-1;i>=0;i--){
        const shot=shots[i];shot.age+=dt;if(shot.age<shot.duration)continue;
        shots.splice(i,1);
        if(party)party.blast(shot,shot.radius,RAID_SHOTS.damage,"raider");
        else if(state.health>0&&!player.room&&Math.hypot(player.x-shot.x,player.y-shot.y)<shot.radius)hurt(RAID_SHOTS.damage,"raider");
        emit("minion-projectile-impact",{x:shot.x,y:shot.y,radius:shot.radius});
        if(state.gameOver)return;
      }
    },
    clear(){shots.length=0;},
  };
}
