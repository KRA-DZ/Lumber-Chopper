import { WORKS_PROJECTS, WORKS_WALLS, WORKS_SITES } from "../game/world-works-layout.js";
import { LAYERS } from "./layers.js";

// Fixed PNG parts, streamed around both cameras. Water itself uses the bounded terrain cache.
export class WorldWorksView{
  constructor(scene){this.scene=scene;this.objects=new Map();this.parts=[];
    for(const p of WORKS_SITES)this.parts.push({id:`site:${p.id}`,x:p.x,y:p.y,regionId:p.regionId,key:p.kind==="chest"?"camp.chest":p.id==="waterworks-archive"?"world.rune":"camp.gateSign",site:p.id,required:p.requiredWorks,low:p.requiresLow});
    for(const w of WORKS_WALLS){const count=Math.ceil(Math.hypot(w.b.x-w.a.x,w.b.y-w.a.y)/48);for(let i=0;i<=count;i++)this.parts.push({id:`wall:${w.id}:${i}`,x:w.a.x+(w.b.x-w.a.x)*i/count,y:w.a.y+(w.b.y-w.a.y)*i/count,regionId:w.regionId,key:"biomeprop.ruins",until:w.project});}
    for(const p of WORKS_PROJECTS.filter(p=>p.deck)){
      const d=p.deck,horizontal=d.width>d.height,count=Math.ceil((horizontal?d.width:d.height)/32);
      for(let i=0;i<count;i++)this.parts.push({id:`deck:${p.id}:${i}`,x:d.x+(horizontal?(i+.5)*d.width/count:d.width/2),y:d.y+(horizontal?d.height/2:(i+.5)*d.height/count),regionId:p.regionId,key:"world.log",required:p.id,deck:true,width:horizontal?32:d.width,height:horizontal?d.height:32});
    }
    for(let i=0;i<5;i++)this.parts.push({id:`dam:${i}`,x:-432+i*56,y:1384,regionId:"-1:0",key:"fence"});
  }
  render(){const s=this.scene,state=s.core.state,wanted=new Set();
    for(const p of this.parts){
      if(!s.core.regions.unlocked.has(p.regionId)||(p.required&&!state.worldWorks.built[p.required])||(p.low&&state.worldWorks.level!=="low")||(p.until&&state.worldWorks.built[p.until])||!s.nearView(p,s.camera.worldView,240))continue;
      wanted.add(p.id);let o=this.objects.get(p.id);
      if(!o){const image=s.addImage(p.key,p.x,p.y,p.deck?LAYERS.ground+25:p.y);if(p.deck)image.setOrigin(.5).setDisplaySize(p.width,p.height);
        if(p.site){image.setInteractive().setData("site",p.site);if(p.key==="camp.gateSign")image.setScale(1).setDepth(p.y-10);}
        const label=p.site?s.text("",p.x,p.y+32,11,"#e4d3a2",LAYERS.hints):null;o={image,label};this.objects.set(p.id,o);}
      if(o.label){const project=WORKS_PROJECTS.find(x=>x.id===p.site),site=WORKS_SITES.find(x=>x.id===p.site);
        const opened=site.kind==="chest"&&state.exploration.openedChests.includes(site.id);
        if(site.kind==="chest")s.assets.setFrame(o.image,opened?"exploration.chestOpen":"camp.chest");
        const status=project?(state.worldWorks.built[p.site]?"готово":s.core.worldWorks.progress(p.site)):opened?"Открыт":"E/Enter";
        o.label.setText(`${site.name}\n${status}${p.site==="old-dam"?` · вода ${state.worldWorks.level==="low"?"опущена":"высокая"}`:""}`);
        s.worldHints.offer(o.label,p,{range:230,priority:65});}
    }
    for(const [id,o] of this.objects)if(!wanted.has(id)){o.image.destroy();o.label?.destroy();this.objects.delete(id);}
  }
  destroy(){for(const o of this.objects.values()){o.image.destroy();o.label?.destroy();}this.objects.clear();}
}
