import {BERRIES} from "../game/berries.js";
import {LAYERS} from "./layers.js";
export class PlantsView{
  constructor(scene){this.scene=scene;this.objects=new Map();}
  render(){const s=this.scene,c=s.core,wanted=new Set();
    for(const bush of c.world.berryBushes){
      if(!c.regions.isOpen(bush)||!s.nearView(bush,s.camera.worldView,140))continue;
      wanted.add(bush.id);let o=this.objects.get(bush.id);
      if(!o){o={image:s.addImage(`plants.empty.${bush.variant}`,bush.x,bush.y).setScale(1.25),label:s.text("",bush.x,bush.y+20,11,"#e5d9b0",LAYERS.hints)};
        o.image.setInteractive({pixelPerfect:true}).setData("berry",bush.id);this.objects.set(bush.id,o);}
      const ripe=c.berries.ready(bush);s.assets.setFrame(o.image,`plants.${c.berries.frame(bush)}.${bush.variant}`);o.image.input.enabled=ripe;
      o.label.setText(c.state.exploration.items.berry>BERRIES.limit-BERRIES.yield?"Сумка ягод заполнена":ripe?"Собрать ягоды · E / Enter":"Ягод нет · новый урожай завтра");
      s.worldHints.offer(o.label,bush,{eligible:!bush.decorative,range:130,priority:65});
    }
    for(const [id,o] of this.objects)if(!wanted.has(id)){o.image.destroy();o.label.destroy();this.objects.delete(id);}
  }
  destroy(){for(const o of this.objects.values()){o.image.destroy();o.label.destroy();}this.objects.clear();}
}
