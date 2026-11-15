import {dockInset} from './viewport.js';

// Tune bubble contrast here. This HUD scene renders above the world; depth -1 keeps it below HUD controls.
export const HINT_STYLE=Object.freeze({fill:0x000000,alpha:.75,border:0xd4a359,borderAlpha:.9,padding:10,radius:8,depth:-1});
const intersects=(a,b)=>a.x<b.x+b.width+6&&a.x+a.width>b.x-6&&a.y<b.y+b.height+6&&a.y+a.height>b.y-6;
export function placeHintBox(anchor,width,height,view,blocked=[]){
  const clamp=(v,min,max)=>Math.max(min,Math.min(Math.max(min,max),v));
  const options=[{x:anchor.x-width/2,y:anchor.y-height-110},{x:anchor.x+42,y:anchor.y-height-38},
    {x:anchor.x-width-42,y:anchor.y-height-38},{x:anchor.x-width/2,y:anchor.y+24},
    {x:view.x+12,y:view.y+164},{x:view.x+view.width-width-12,y:view.y+164}];
  for(const b of blocked)options.push({x:anchor.x-width/2,y:b.y+b.height+10},{x:anchor.x-width/2,y:b.y-height-10});
  const boxes=options.map(p=>({x:clamp(p.x,view.x+10,view.x+view.width-width-10),y:clamp(p.y,view.y+10,view.y+view.height-height-10),width,height}));
  return boxes.find(b=>!blocked.some(a=>intersects(a,b)))||boxes.sort((a,b)=>blocked.filter(p=>intersects(a,p)).length-blocked.filter(p=>intersects(b,p)).length)[0];
}
export class InteractionHints{
  constructor(hud){
    this.hud=hud;
    this.panels=Array.from({length:2},()=>{
      const background=hud.add.graphics(),text=hud.add.text(10,8,'',{fontFamily:'Arial, sans-serif',fontSize:'14px',color:'#ffffff',lineSpacing:3});
      const root=hud.add.container(0,0,[background,text]).setDepth(HINT_STYLE.depth).setVisible(false);
      return {root,background,text,key:'',bounds:null};
    });
    hud.events.once('shutdown',()=>this.destroy());
  }
  render(){
    const h=this.hud,w=h.world,c=w.core,blocked=[],seen=new Set();
    const inset=dockInset(h),bottom=h.scale.height-inset-12;
    // Keep captions away from the existing time HUD, minimap and the current quest action.
    blocked.push({x:14,y:12,width:h.scale.width<600?265:330,height:150});
    const mapSize=h.scale.width<600?100:144;blocked.push({x:h.scale.width-mapSize-16,y:16,width:mapSize,height:mapSize});
    if(h.guideButton?.visible)blocked.push(h.guideButton.getBounds());
    for(const p of this.panels){p.root.setVisible(false);p.bounds=null;}
    if(c.paused||c.state.gameOver)return;
    for(const {entry,player,index,camera} of w.worldHints.active){
      if(!w.coopCamera?.split&&seen.has(entry.label))continue;
      seen.add(entry.label);
      const panel=this.panels[index],view={x:camera.x||0,y:camera.y||0,width:camera.width,height:Math.min(camera.height,bottom-(camera.y||0))};
      if(view.height<80)continue;
      const width=Math.max(100,Math.min(280,view.width-40)),prefix=c.coop?`P${index+1} · `:'',key=prefix+entry.label.text+':'+width;
      if(panel.key!==key){
        panel.key=key;panel.text.setWordWrapWidth(width-20).setText(prefix+entry.label.text);
        const bw=Math.ceil(panel.text.width)+20,bh=Math.ceil(panel.text.height)+18;
        panel.background.clear().fillStyle(HINT_STYLE.fill,HINT_STYLE.alpha).fillRoundedRect(0,0,bw,bh,HINT_STYLE.radius)
          .lineStyle(1,HINT_STYLE.border,HINT_STYLE.borderAlpha).strokeRoundedRect(0,0,bw,bh,HINT_STYLE.radius);
      }
      const anchor={x:view.x+(player.x-camera.worldView.x)*(camera.zoom||1),y:view.y+(player.y-camera.worldView.y)*(camera.zoom||1)};
      const bounds=placeHintBox(anchor,panel.text.width+20,panel.text.height+18,view,blocked);
      panel.bounds=bounds;panel.root.setPosition(Math.round(bounds.x),Math.round(bounds.y)).setVisible(true);blocked.push(bounds);
    }
  }
  destroy(){for(const p of this.panels)p.root.destroy(true);this.panels=[];}
}
