import {captureSession,createSaveStore} from '../game/session-save.js';

export function sessionStore(){
  let storage;try{storage=window.localStorage;}catch{/* Storage may be disabled. */}
  return createSaveStore(storage);
}
// Wall time is metadata only. The world clock advances exclusively inside the simulation.
export class SessionPersistence{
  constructor(scene){
    this.scene=scene;this.store=sessionStore();this.lastElapsed=scene.core.elapsed;this.stopped=false;
    this.status=document.querySelector('[data-save-status]');
    this.button=document.querySelector('[data-session-save]');this.newButton=document.querySelector('[data-session-new]');
    this.onSave=()=>this.save();
    this.onNew=()=>{
      if(!window.confirm('Начать новую игру? Сохранённый забег будет удалён. Рекорды останутся.'))return;
      if(!this.store.clear()){this.status.textContent='Не удалось удалить сохранение. Проверьте доступ к хранилищу браузера.';return;}
      this.stopped=true;window.location.reload();
    };
    this.onHide=()=>{if(document.hidden)this.save();};this.onLeave=()=>this.save();
    this.button.addEventListener('click',this.onSave);this.newButton.addEventListener('click',this.onNew);
    document.addEventListener('visibilitychange',this.onHide);window.addEventListener('pagehide',this.onLeave);
    this.save();
  }
  save(){
    if(this.stopped)return false;
    const s=this.scene,c=s.core;
    if(c.state.gameOver){this.finish();return false;}
    let ok=false;
    try{ok=this.store.write(captureSession(c,{name:s.registry.get('runName'),runId:s.registry.get('runId')}));}catch{/* Preserve the last good snapshot. */}
    this.lastElapsed=c.elapsed;
    this.status.textContent=ok?'Прогресс сохранён на этом устройстве.':'Не удалось сохранить прогресс. Хранилище недоступно или заполнено.';
    return ok;
  }
  update(){if(this.scene.core.state.gameOver)this.finish();else if(!this.scene.core.paused&&this.scene.core.elapsed-this.lastElapsed>=20)this.save();}
  finish(){if(this.stopped)return;this.stopped=true;const ok=this.store.clear();this.status.textContent=ok?'Забег завершён. Рекорды сохранены.':'Не удалось удалить завершённый забег: хранилище недоступно.';}
  destroy(){
    this.stopped=true;
    this.button.removeEventListener('click',this.onSave);this.newButton.removeEventListener('click',this.onNew);
    document.removeEventListener('visibilitychange',this.onHide);window.removeEventListener('pagehide',this.onLeave);
  }
}
