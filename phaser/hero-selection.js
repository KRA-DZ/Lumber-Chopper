import { HERO_APPEARANCES } from "../game/appearances.js";
import {createHeroCustomizer} from './hero-customizer.js';
import {touchOnlyControls} from './device-profile.js';
import {sessionStore} from './session-persistence.js';
// The player explicitly chooses a new run or resumes the saved roster.
export function selectHero(scene, start) {
  const dialog = document.querySelector("#heroDialog"),
    form = dialog.querySelector("form"),
    error = dialog.querySelector("[data-hero-error]");
  const touchOnly=touchOnlyControls(),mode=form.querySelector('[name=players][value="2"]');
  mode.disabled=touchOnly;mode.closest('fieldset').hidden=touchOnly;
  if(touchOnly)form.querySelector('[name=players][value="1"]').checked=true;
  const customizer=createHeroCustomizer(scene,form);
  const store=sessionStore(),saved=store.read(),resume=form.querySelector('[data-session-continue]'),info=form.querySelector('[data-session-info]');
  const previous=saved.exists;
  info.textContent=scene.registry.get('saveLoadError')||saved.message;
  scene.registry.remove('saveLoadError');
  resume.hidden=!saved.data;
  if(saved.data){
    const s=saved.data.actors[0].state,count=saved.data.actors.length;
    info.textContent+=(info.textContent?' ':'')+`${saved.data.name} · день ${s.calendarDay+1} · ${count===2?'вдвоём':'один игрок'} · ${new Date(saved.data.savedAt).toLocaleString('ru-RU')}.`;
    resume.disabled=touchOnly&&count===2;
    if(resume.disabled)info.textContent+=' Для продолжения вдвоём откройте игру на компьютере.';
    form.querySelector('[data-hero-start]').textContent='Начать новую игру';
  }
  function begin(){cleanup();dialog.close();document.body.classList.add('game-live');start();}
  const continueRun=()=>{
    if(!saved.data||resume.disabled)return;
    const data=saved.data,actors=data.actors;
    scene.registry.set('resumeSave',data);scene.registry.set('runId',data.runId);
    scene.registry.set('runName',data.name);scene.registry.set('playerCount',actors.length);
    scene.registry.set('heroAppearance',actors[0].state.appearance);
    scene.registry.set('heroChoices',actors.map(a=>({appearance:a.state.appearance,colors:a.state.heroColors})));
    scene.registry.set('cycleSpeed',actors[0].state.cycleSpeed);begin();
  };
  const prevent = (event) => event.preventDefault();
  const submit = (event) => {
    event.preventDefault();
    const id = new FormData(form).get("appearance");
    if (!Object.hasOwn(HERO_APPEARANCES, id)) {
      error.textContent = "Выберите персонажа.";
      return;
    }
    if(previous&&!window.confirm('Начать новую игру и заменить сохранённый забег? Рекорды останутся.'))return;
    if(previous&&!store.clear()){error.textContent='Не удалось удалить старое сохранение. Проверьте доступ к хранилищу браузера.';return;}
    scene.registry.remove('resumeSave');scene.registry.set('runId',`${Date.now()}-${Math.random()}`);
    scene.registry.set("heroAppearance", id);
    scene.registry.set('heroChoices',customizer.choices());
    scene.registry.set("playerCount", !touchOnly&&new FormData(form).get("players") === "2" ? 2 : 1);
    scene.registry.set("runName",String(new FormData(form).get("runName")||"Лесоруб").trim().slice(0,32));
    scene.registry.set("cycleSpeed",new FormData(form).get("tempo")==="quick"?2.5:1);
    begin();
  };
  function cleanup() {
    customizer.dispose();
    resume.removeEventListener('click',continueRun);
    form.removeEventListener("submit", submit);
    dialog.removeEventListener("cancel", prevent);
  }
  form.addEventListener("submit", submit);
  resume.addEventListener('click',continueRun);
  dialog.addEventListener("cancel", prevent);
  scene.events.once("shutdown", cleanup);
  dialog.showModal();
}
