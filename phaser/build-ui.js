import { projectLockReason } from '../game/camp-projects.js';
import { materialCostText } from '../game/camp-industry-config.js';

export function createBuildUi(scene) {
  const dialog=document.querySelector('#buildDialog'),list=dialog.querySelector('[data-build-options]'),cancel=dialog.querySelector('[data-build-close]');
  const panels=new Map();
  function choices(core,root,done){
    root.replaceChildren();
    for(const project of core.builder.choices){
      const card=document.createElement('article'),title=document.createElement('h3'),detail=document.createElement('p'),button=document.createElement('button');
      const lock=projectLockReason(core.state,project);
      card.className='build-option';
      title.textContent=`${project.name} · ${project.cost} брёвен${project.materials?' · '+materialCostText(project.materials):''}`;
      detail.textContent=project.description+(lock?` ${lock}.`:'')+(project.materials?' Материалы списываются из общего запаса после сдачи брёвен.':'');
      button.type='button';button.dataset.buildProject=project.id;button.textContent=`Выбрать: ${project.name}`;button.disabled=!!lock;
      button.onclick=()=>{
        if(!core.builder.choose(project.id))return;
        done();core.showNotice(`Проект: ${project.name}. Сойдите с платформы и вернитесь для стройки.`,8);scene.renderModel();
      };
      card.append(title,detail,button);root.append(card);
    }
  }
  function closePersonal(i){
    const entry=panels.get(i);if(!entry)return;
    entry.actor.player.menuOpen=false;entry.actor.clearKeys();entry.panel.remove();panels.delete(i);
  }
  function open(){
    const c=scene.core,i=c.activeActor||0,a=c.actors?.[i]||c;
    if(c.paused||a.state.gameOver||a.state.health<=0||!a.builder.choices.length||a.builder.project)return false;
    if(c.coop){
      if(panels.has(i)||a.player.menuOpen)return false;
      a.clearKeys();a.player.menuOpen=true;
      const panel=document.createElement('aside'),heading=document.createElement('h2'),help=document.createElement('p'),root=document.createElement('div'),close=document.createElement('button');
      panel.className='personal-builder';panel.dataset.playerBuild=i;panel.setAttribute('aria-label',`Стройка игрока ${i+1}`);
      heading.textContent=`Строительство · игрок ${i+1}`;
      help.textContent=i?'↑/↓ выбрать · Enter подтвердить · Backspace закрыть':'W/S выбрать · E подтвердить · Q закрыть';
      close.textContent='Закрыть';close.onclick=()=>closePersonal(i);panel.append(heading,help,root,close);
      const entry={panel,actor:a,root,index:0};panels.set(i,entry);choices(a,root,()=>closePersonal(i));
      root.firstElementChild.dataset.selected='true';document.querySelector('#game-frame').append(panel);return true;
    }
    scene.keyboardUi.modal=null;choices(a,list,()=>dialog.close());scene.pause('building',true);dialog.showModal();
    list.firstElementChild.dataset.selected='true';list.querySelector('button').focus({preventScroll:true});return true;
  }
  function key(e){
    const i=['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Enter','Backspace'].includes(e.code)?1:0,entry=panels.get(i);
    if(e.code==='Escape'&&panels.size){e.preventDefault();e.stopImmediatePropagation();for(const n of [...panels.keys()])closePersonal(n);return;}
    if(!entry||!['KeyW','KeyS','KeyA','KeyD','KeyE','KeyQ','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Enter','Backspace'].includes(e.code)||document.querySelector('dialog[open]'))return;
    e.preventDefault();e.stopImmediatePropagation();
    if(scene.core.paused||e.repeat&&!['KeyW','KeyS','ArrowUp','ArrowDown'].includes(e.code))return;
    if(['KeyQ','Backspace'].includes(e.code)){closePersonal(i);return;}
    const rows=[...entry.root.querySelectorAll('.build-option')];
    if(['KeyW','ArrowUp'].includes(e.code))entry.index=(entry.index+rows.length-1)%rows.length;
    if(['KeyS','ArrowDown'].includes(e.code))entry.index=(entry.index+1)%rows.length;
    rows.forEach((row,n)=>row.dataset.selected=String(n===entry.index));
    if(['KeyE','Enter'].includes(e.code))rows[entry.index].querySelector('button').click();
    else rows[entry.index].scrollIntoView({block:'nearest'});
  }
  const close=()=>scene.pause('building',false),dismiss=()=>dialog.close();
  dialog.addEventListener('close',close);cancel.addEventListener('click',dismiss);document.addEventListener('keydown',key,true);
  return {open,refresh(){for(const [i,e] of panels)if(e.actor.state.health<=0||e.actor.state.gameOver||e.actor.builder.project)closePersonal(i);},
    destroy(){for(const i of [...panels.keys()])closePersonal(i);document.removeEventListener('keydown',key,true);dialog.removeEventListener('close',close);cancel.removeEventListener('click',dismiss);dialog.close();list.replaceChildren();},
  };
}
