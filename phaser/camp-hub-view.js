import {WORKERS} from '../game/workers.js';
import {CAMP,CAMP_HUB} from '../game/camp-layout.js';
import {CAMP_PROJECTS,hasCampBuilding} from '../game/camp-projects.js';
// Generated open canopy and workbench share the existing sprite atlas.
export class CampHubView{
  constructor(scene){
    this.scene=scene;this.parts=[scene.addImage('interior.workshop',CAMP_HUB.workshop.x,CAMP_HUB.workshop.y),
      scene.addImage('interior.bench',CAMP_HUB.counter.x,CAMP_HUB.counter.y-12),
      scene.addImage('world.tools',CAMP_HUB.workshop.x+45,CAMP_HUB.workshop.y+15).setScale(1.5)];
    this.master=scene.addImage('person.worker4-walk-down-0',CAMP_HUB.master.x,CAMP_HUB.master.y).setInteractive().setData('campService','workshop');
    this.label=scene.text('',CAMP_HUB.master.x,CAMP_HUB.master.y-90,12);
    this.foreman=scene.addImage('person.worker3-walk-down-0',CAMP.tent.x,CAMP.tent.y+65).setInteractive().setData('campService','workers');
  }
  render(){
    const s=this.scene,c=s.core,state=c.state,project=CAMP_PROJECTS.find(p=>p.id===state.buildProject);
    this.label.setText(project?`Мастер · ${project.name} · ${state.buildWood}/${project.cost} брёвен`:
      state.workshopUpgrade?'Мастер · принимает материалы улучшения':state.workshopDefense?'Мастер · принимает брёвна для обороны':'Мастер · выбрать заказ · E/Enter');
    s.worldHints.offer(this.label,CAMP_HUB.counter,{range:125,priority:80});
    const tent=c.workers.available()&&state.worldTime<WORKERS.recallTime,house=hasCampBuilding(state,'house');
    this.foreman.setVisible(tent&&!house);this.foreman.input.enabled=tent&&!house;
  }
  destroy(){for(const image of [...this.parts,this.master,this.foreman,this.label])image.destroy();}
}
