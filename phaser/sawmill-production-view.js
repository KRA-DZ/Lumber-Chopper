import { MILL, MILL_SITES, MILL_STAGES } from "../game/sawmill-production-config.js";
import { LAYERS } from "./layers.js";

// Existing PNGs only: fixed stage props and six symbolic vehicle bundles, no per-frame textures.
export class SawmillProductionView{
  constructor(scene){this.scene=scene;this.parts=[];
    for(const site of MILL_SITES){const image=scene.addImage("camp.gateSign",site.x,site.y,site.y-10).setScale(1).setInteractive().setData("site",site.id),
      label=scene.text("",site.x,site.y+30,11,"#ead4a2",LAYERS.hints);this.parts.push({site,image,label});}
    this.ready=[scene.addImage("camp.crate",MILL.operator.x+60,MILL.operator.y+90),scene.addImage("sawmill.drive.open",MILL.operator.x+36,MILL.operator.y-16),scene.addImage("sawmill.bench",MILL.operator.x+72,MILL.operator.y+32)];
    this.cart=scene.addImage("cart",0,0).setInteractive().setData("site","freight-cart");
    this.cartLabel=scene.text("",0,0,11,"#ead4a2",LAYERS.hints);
    this.bundles=Array.from({length:6},()=>scene.addImage("log",0,0));this.bar=scene.add.graphics().setDepth(LAYERS.hints);
  }
  render(){const s=this.scene,c=s.core,d=c.state.sawmill;
    for(const p of this.parts){const visible=c.regions.isOpen(p.site)&&s.nearView(p.site,s.camera.worldView,240);
      p.image.setVisible(visible);p.label.setText(p.site.id==="camp-freight"?`Грузовая площадка\nДоски в руках: ${c.state.boardCargo}`:
        p.site.id==="sawmill-restoration"?`Восстановление ${d.stage}/3\n${MILL_STAGES[d.stage]?.name||"Готово"}`:
        `${p.site.name}\nБрёвна ${d.input.length}/48 · доски ${d.output}/24${d.job?` · ${Math.ceil(d.job.remaining)} с`:""}`);
      s.worldHints.offer(p.label,p.site,{eligible:visible,range:230,priority:65});}
    const atMachine=c.regions.unlocked.has("1:1")&&s.nearView(MILL.operator,s.camera.worldView,260),working=d.enabled&&!c.sawmill.status();
    this.ready.forEach((image,i)=>image.setVisible(atMachine&&d.stage>i));
    this.ready[1].setAngle(working?Math.sin(c.elapsed*12)*8:0);
    this.bar.clear();if(atMachine&&d.job)this.bar.fillStyle(0x293d31).fillRect(MILL.operator.x-40,MILL.operator.y+34,80,7).fillStyle(d.nightWork?0xd0a069:0xb8cf8d).fillRect(MILL.operator.x-39,MILL.operator.y+35,78*(1-d.job.remaining/MILL.seconds),5);
    const cart=d.cart,visible=cart.built&&s.nearView(cart,s.camera.worldView,200),y=cart.y+(cart.owner===null?0:36);
    this.cart.setVisible(visible).setPosition(cart.x,y).setDepth(cart.y-5);
    this.cartLabel.setPosition(cart.x,y+36).setText(`Тележка · ${cart.logs.length} бр. · ${cart.boards} досок\n${cart.owner===null?"Свободна":`Игрок ${cart.owner+1}`}`);
    s.worldHints.offer(this.cartLabel,cart,{eligible:visible,range:200,priority:60});
    this.bundles.forEach((image,i)=>{const board=i>=Math.ceil(cart.logs.length/4);s.assets.setFrame(image,board?"sawmill.woodRack":"log");
      image.setVisible(visible&&i<Math.ceil((cart.logs.length+cart.boards)/4)).setDisplaySize(32,13).setPosition(cart.x-18+(i%2)*28,y-18-Math.floor(i/2)*12).setDepth(cart.y-.1+i*.001);});
  }
  destroy(){for(const p of this.parts){p.image.destroy();p.label.destroy();}for(const image of [...this.ready,...this.bundles,this.cart])image.destroy();this.cartLabel.destroy();this.bar.destroy();}
}
