import {FOREST_CAMP as CAMP,LOOKOUT} from "../game/forest-tasks-layout.js";
import {LAYERS} from "./layers.js";
// Prototype structures reuse approved PNGs; dedicated tower artwork is a separate approval step.
export class ForestTasksView{
  constructor(scene){this.scene=scene;this.parts=[];
    const add=(key,x,y,ready=false,scale=2)=>{const image=scene.addImage(key,x,y).setScale(scale);this.parts.push({image,x,y,ready});return image;};
    this.chest=add("fortress.chest.closed",CAMP.x,CAMP.y,false,2.2).setInteractive().setData("site",CAMP.id);
    this.tent=add("tent",CAMP.x-180,CAMP.y-140,false,2.2);
    add("camp.crate",CAMP.x+150,CAMP.y+40,false,2.2);add("world.supplies",CAMP.x-155,CAMP.y+40,false,2);
    this.campLabel=scene.text("",CAMP.x,CAMP.y+40,11,"#eed59d",LAYERS.hints);
    this.tower=[];
    for(const x of [-36,36])for(const y of [-70,-120,-170])this.tower.push(add("fence",LOOKOUT.x+x,LOOKOUT.y+y,true,2));
    for(const x of [-28,0,28])this.tower.push(add("world.log",LOOKOUT.x+x,LOOKOUT.y-172,true,2));
    this.flag=add("camp.gateSign",LOOKOUT.x,LOOKOUT.y-215,true,1.3);
    this.broken=add("world.log",LOOKOUT.x,LOOKOUT.y-70,false,2);this.broken.setAngle(-22);
  }
  render(){const s=this.scene,state=s.core.state,built=state.worldWorks.built[LOOKOUT.id],campOpen=s.core.regions.isOpen(CAMP);
    for(const p of this.parts){const tower=p.y<LOOKOUT.y&&Math.abs(p.x-LOOKOUT.x)<100&&p.y>LOOKOUT.y-250;
      p.image.setVisible((tower?s.core.regions.isOpen(LOOKOUT):campOpen)&&s.nearView(p,s.camera.worldView,300)&&(!p.ready||built));}
    this.broken.setVisible(!built&&s.core.regions.isOpen(LOOKOUT)&&s.nearView(LOOKOUT,s.camera.worldView,300));
    s.assets.setFrame(this.chest,state.forestTasks.claimed?"fortress.chest.open":"fortress.chest.closed");
    this.campLabel.setText(s.core.forestTasks.summary());s.worldHints.offer(this.campLabel,CAMP,{eligible:campOpen,range:300,priority:80});
  }
  destroy(){for(const p of this.parts)p.image.destroy();this.campLabel.destroy();}
}
