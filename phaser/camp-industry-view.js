import { INDUSTRY_PROJECTS, RECIPES, materialCostText } from "../game/camp-industry-config.js";
import { hasCampBuilding } from "../game/camp-projects.js";
import { LAYERS } from "./layers.js";
import { countdown } from "../game/first-days.js";

// Reuse the approved PNG atlas. Fixed projects and eight short arrow effects at most.
export class CampIndustryView {
  constructor(scene){
    this.scene=scene;this.objects=new Map();this.shots=new Set();
    this.progress=scene.add.graphics().setDepth(LAYERS.hints);
    this.orderLabel=scene.text("",1420,1590,11,"#f3d7a0",LAYERS.hints);
    for(const project of INDUSTRY_PROJECTS){
      const {x,y}=project.site,images=[];
      const add=(frame,dx=0,dy=0,scale=2)=>{const image=scene.addImage(frame,x+dx,y+dy,y+dy).setScale(scale).setInteractive({pixelPerfect:true}).setData("industrySite",project.id);images.push(image);return image;};
      if(project.kind==="workbench"){add("camp.crate",-18);add("world.supplies",20,-10,1.5);}
      else if(project.kind==="kiln"){add("unlitFire",0,0,2.3);add("world.log",35,8,1.5);}
      else if(project.kind==="tower"){add("fence",-22,0,3);add("fence",22,0,3);add("camp.crate",0,-47,1.6);add("house",0,-60,.75);}
      else add("survival.startLantern",0,0,2);
      const label=scene.text("",x,y+34,11,"#ecdab3",LAYERS.hints);this.objects.set(project.id,{project,images,label});
    }
  }
  render(){
    const s=this.scene,c=s.core,bank=c.state.campIndustry,job=bank.queue[0],bars=this.progress.clear();
    for(const e of this.objects.values()){
      const p=e.project,built=hasCampBuilding(c.state,p.id),preview=c.state.buildProject===p.id,
        visible=(built||preview)&&s.nearView(p.site,s.camera.worldView,250);
      const hp=p.kind==="tower"?c.defenses?.get(p.id)?.hp:1;
      for(const image of e.images)image.setVisible(visible).setAlpha(!built ? .35 : hp===0 ? .4 : 1);
      let text=p.name;
      if(preview)text+=` · ${c.state.buildWood}/${p.cost} бр. · ${materialCostText(p.materials)}`;
      else if(p.kind==="tower")text+=` · ${hp||0}/120 · ${bank.towerAmmo[p.id]||0} выстр.`;
      else if(p.kind==="lamp")text+=` · ${Math.ceil(bank.lampFuel[p.id]||0)} с`;
      else if(job&&RECIPES.find(r=>r.id===job.recipe).station===p.id){
        text+=` · ${RECIPES.find(r=>r.id===job.recipe).name} ${Math.ceil(job.remaining)} с`;
        bars.fillStyle(0x263c30,.9).fillRect(p.site.x-40,p.site.y+22,80,6).fillStyle(0xe0c07d).fillRect(p.site.x-39,p.site.y+23,78*(1-job.remaining/job.total),4);
      }
      e.label.setText(text);s.worldHints.offer(e.label,p.site,{eligible:visible,range:230,priority:65});
    }
    const order=c.orders.current,active=c.orders.data.active;
    this.orderLabel.setText(order?`Заказ: ${order.name}\n${order.resource==="logs"?active.logs.length+"/"+order.amount:materialCostText({[order.resource]:order.amount})} · до ночи ${countdown(c.orders.secondsLeft)}`:"Заказы обоза · E/Enter у продажи");
    s.worldHints.offer(this.orderLabel,c.sale,{range:190,priority:65});
  }
  shot(event){
    if(this.shots.size>=8)return;
    const s=this.scene,image=s.addImage("chip",event.from.x,event.from.y,LAYERS.particles).setScale(2);this.shots.add(image);
    s.tweens.add({targets:image,x:event.to.x,y:event.to.y,duration:220,onComplete:()=>{this.shots.delete(image);image.destroy();}});
  }
  destroy(){for(const e of this.objects.values()){for(const image of e.images)image.destroy();e.label.destroy();}for(const image of this.shots){this.scene.tweens.killTweensOf(image);image.destroy();}this.shots.clear();this.progress.destroy();this.orderLabel.destroy();}
}
