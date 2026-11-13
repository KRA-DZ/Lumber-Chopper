import {LAYERS} from './layers.js';

// Reuse labels and a bounded damage-number pool; no texture creation in the game loop.
export class CombatView{
  constructor(scene){
    this.scene=scene;this.labels=new Map();this.reactions=new Map();this.next=0;
    this.bars=scene.add.graphics().setDepth(LAYERS.health);
    this.sparks=scene.add.graphics().setDepth(LAYERS.floating);
    this.numbers=Array.from({length:12},()=>({text:scene.text('',0,0,14,'#ffe2a0',LAYERS.floating).setVisible(false),until:0}));
    this.button=document.querySelector('#attackButton');this.onAttack=()=>scene.core.attackNearby();this.button.addEventListener('click',this.onAttack);
  }
  hit(type,event){
    const s=this.scene,c=s.core,hero=type==='player-hurt';
    const actor=hero?(c.actors||[c]).find((a,i)=>(a.player.id??i)===(event.actor??0)):null;
    const body=hero?actor?.player:event.enemy;if(!body||event.enemy?.invulnerable)return;
    const damage=event.actualDamage??event.damage;if(!(damage>0))return;
    const key=hero?'player:'+(event.actor??0):'enemy:'+body.id;
    this.reactions.set(key,{time:c.elapsed,damage,push:event.push||{x:0,y:0}});
    const number=this.numbers[this.next++%this.numbers.length],image=hero?null:s.enemyView.objects.get(body.id)?.image;
    number.x=body.x;number.y=body.y-(hero?100:image?image.displayHeight*image.originY:200);number.until=c.elapsed+.65;
    number.text.setText(`−${Math.ceil(damage)} HP`).setColor(hero?'#ffb9a4':'#ffe1a0').setPosition(number.x,number.y).setAlpha(1).setVisible(true);
  }
  render(){
    const s=this.scene,c=s.core,g=this.bars.clear(),fx=this.sparks.clear(),seen=new Set();
    for(const label of this.labels.values())label.setVisible(false);
    const entries=(c.actors||[c]).map((actor,i)=>{
      const view=s.coopViews?.entries[i]||s;
      return {key:`player:${i}`,body:actor.player,hp:actor.state.health,max:actor.state.maxHealth,image:view.player,axe:view.axe,cargo:view.cargo,hero:true};
    });
    for(const enemy of [...(c.survival?.raiders||[]),...(c.survival?.residents||[])]){
      const image=s.enemyView.objects.get(enemy.id)?.image;
      if(image&&enemy.hp>0&&!enemy.invulnerable)entries.push({key:'enemy:'+enemy.id,body:enemy,hp:enemy.hp,max:enemy.maxHP,image,hero:false});
    }
    for(const entry of entries){
      const {key,body,image,hero,hp,max}=entry;seen.add(key);
      if(hero){image.setScale(2).setAngle(hp<=0?75:0).clearTint();}
      if(!image.visible||body.room)continue;
      const reaction=this.reactions.get(key),age=reaction?c.elapsed-reaction.time:Infinity,t=Math.min(1,age/.24);
      if(reaction&&t<1){
        const recoil=(1-t)*(1-t),dx=-reaction.push.x*recoil,dy=-reaction.push.y*recoil;
        image.setPosition(image.x+dx,image.y+dy).setScale(image.scaleX*(1+.07*Math.sin(t*Math.PI)),image.scaleY*(1-.06*Math.sin(t*Math.PI)));
        if(hp>0)image.setAngle((hero?-1:1)*7*(1-t));
        if(t<.55)image.setTintFill(hero?0xffb39a:0xffe9bd);
        if(hero){entry.axe.setPosition(entry.axe.x+dx,entry.axe.y+dy);for(const log of entry.cargo||[])if(log.visible)log.setPosition(log.x+dx,log.y+dy);}
        const y=image.y-(hero?45:Math.min(120,image.displayHeight*.5));fx.lineStyle(2,hero?0xe8a18c:0xf1d294,1-t);
        for(const sign of [-1,1]){fx.lineBetween(image.x+sign*14,y-8,image.x+sign*(24+t*10),y-14);fx.lineBetween(image.x+sign*14,y+8,image.x+sign*(24+t*10),y+14);}
      }else if(!hero)image.setAngle(0);
      let label=this.labels.get(key);if(!label){label=s.text('',0,0,11,'#f3e4bd',LAYERS.healthText);this.labels.set(key,label);}
      const width=hero?62:body.tier==='boss'?76:58,x=image.x,y=image.y-(hero?106:image.displayHeight*image.originY+13),ratio=Math.max(0,Math.min(1,hp/max));
      g.fillStyle(0x1a2422,.95).fillRect(x-width/2-1,y-1,width+2,8);
      if(reaction&&age<.4)g.fillStyle(0xe5ac7d).fillRect(x-width/2,y,width*Math.min(1,(hp+reaction.damage*(1-age/.4))/max),6);
      g.fillStyle(hero?0x7fb582:body.tier==='boss'?0xd3a366:0xc56f5e).fillRect(x-width/2,y,width*ratio,6);
      label.setText(`${Math.ceil(hp)}/${max} HP`).setPosition(x,y-10).setVisible(true);
    }
    for(const [key,label] of this.labels)if(!seen.has(key)){label.destroy();this.labels.delete(key);}
    for(const [key,r] of this.reactions)if(c.elapsed-r.time>.4)this.reactions.delete(key);
    for(const n of this.numbers){const left=n.until-c.elapsed;n.text.setVisible(left>0);if(left>0)n.text.setPosition(n.x,n.y-(.65-left)*36).setAlpha(Math.min(1,left/.2));}
    this.button.disabled=c.paused||c.state.health<=0||c.state.gameOver||!!c.player.menuOpen;
  }
  destroy(){this.button.removeEventListener('click',this.onAttack);this.bars.destroy();this.sparks.destroy();for(const l of this.labels.values())l.destroy();for(const n of this.numbers)n.text.destroy();this.reactions.clear();}
}
