import {HERO_APPEARANCES,normalizeAppearance} from '../game/appearances.js';
import {HERO_PALETTES,HERO_MATERIALS,normalizeHeroColors,heroColorKey} from '../game/hero-colors.js';
import {heroPreviewFrame} from './hero-color-art.js';

export function createHeroCustomizer(scene,form){
  const root=form.querySelector('[data-hero-customizer]'),pack=scene.registry.get('peoplePack');
  const playerNav=form.querySelector("[data-hero-player-nav]");
  const heroLegend=form.querySelector("[data-hero-legend]");
  let activePlayer=0;
  root.replaceChildren();let secondTouched=false,request=0,last=-Infinity;
  const panels=[0,1].map(i=>{
    const field=document.createElement('fieldset');field.dataset.heroPlayer=String(i);
    field.setAttribute("aria-label", `Цвета игрока ${i+1}`);
    const settings=document.createElement("div");settings.className="hero-color-settings";
    let appearance=null;
    if(i){const label=document.createElement('label');label.textContent='Персонаж ';
      appearance=document.createElement('select');appearance.name='appearance2';
      for(const [id,data] of Object.entries(HERO_APPEARANCES))appearance.add(new Option(data.name,id));
      appearance.value='woodcutter';label.append(appearance);settings.append(label);
    }
    const canvas=document.createElement('canvas');canvas.width=192;canvas.height=208;canvas.className='hero-live-preview';canvas.dataset.heroPreview=String(i);canvas.setAttribute('role','img');canvas.setAttribute('aria-label',`Предпросмотр героя игрока ${i+1}`);field.append(canvas);
    const controls=document.createElement('div');controls.className='hero-preview-controls';
    const turn=document.createElement('button');turn.type='button';turn.dataset.heroTurn=String(i);turn.textContent='Повернуть';
    const motion=document.createElement('select');motion.dataset.heroMotion=String(i);motion.setAttribute('aria-label','Действие в предпросмотре');
    for(const [id,name] of [['idle','Покой'],['walk','Ходьба'],['carry','Переноска'],['strike','Рубка']])motion.add(new Option(name,id));
    motion.value=matchMedia('(prefers-reduced-motion: reduce)').matches?'idle':'walk';controls.append(turn,motion);settings.append(controls);
    const presets=document.createElement('div');presets.className='hero-presets';
    for(const [id,palette] of Object.entries(HERO_PALETTES)){const b=document.createElement('button');b.type='button';b.dataset.heroPreset=id;b.dataset.heroOwner=String(i);b.textContent=palette.name;presets.append(b);}settings.append(presets);
    const selects={};
    for(const [k,name] of [['hair','Волосы'],['jacket','Куртка'],['pants','Брюки']]){
      const label=document.createElement('label');label.textContent=name+' ';const select=document.createElement('select');select.name=`${k}${i}`;select.dataset.heroMaterial=k;
      for(const [id,p] of Object.entries(HERO_PALETTES))select.add(new Option(p.name,id));
      label.append(select);settings.append(label);selects[k]=select;
    }
    field.append(settings);
    root.append(field);return {field,appearance,canvas,motion,selects,direction:0,cache:new Map(),signature:''};
  });
  function choices(){return panels.map((p,i)=>({appearance:normalizeAppearance(i?p.appearance.value:new FormData(form).get('appearance')),colors:normalizeHeroColors(Object.fromEntries(HERO_MATERIALS.map(k=>[k,p.selects[k].value])))}));}
  const update=event=>{
    if(event?.target.name==='appearance2')secondTouched=true;
    if(event?.target.name==='appearance'&&!secondTouched)panels[1].appearance.value=new FormData(form).get('appearance')==='woodcutter'?'traveler':'woodcutter';
    const coop=new FormData(form).get("players")==="2";
    if(!coop)activePlayer=0;
    playerNav.hidden=!coop;
    heroLegend.textContent=coop?"Персонаж игрока 1":"Персонаж";
    for(const button of playerNav.querySelectorAll("button"))
      button.setAttribute("aria-pressed",String(+button.dataset.customizePlayer===activePlayer));
    for(const [i,panel] of panels.entries())panel.field.hidden=i!==activePlayer;
    last=-Infinity;
  };
  const click=event=>{
    const preset=event.target.closest('[data-hero-preset]'),turn=event.target.closest('[data-hero-turn]');
    if(preset){for(const select of Object.values(panels[+preset.dataset.heroOwner].selects))select.value=preset.dataset.heroPreset;last=-Infinity;}
    if(turn){panels[+turn.dataset.heroTurn].direction=(panels[+turn.dataset.heroTurn].direction+1)%4;last=-Infinity;}
  };
  const switchPlayer=event=>{
    const button=event.target.closest("[data-customize-player]");
    if(!button)return;
    activePlayer=Number(button.dataset.customizePlayer);
    update();
  };
  playerNav.addEventListener("click",switchPlayer);
  function draw(time){
    if(time-last>=125&&!document.hidden){last=time;const profiles=choices();
      panels.forEach((p,i)=>{
        if(p.field.hidden)return;
        const profile=profiles[i],role=HERO_APPEARANCES[profile.appearance].role,dir=['down','side','up','side'][p.direction],action=p.motion.value;
        const signature=role+heroColorKey(profile.colors);if(signature!==p.signature){p.cache.clear();p.signature=signature;}
        const frame=action==='idle'?3:Math.floor(time/125)%(action==='strike'?3:4);
        const id=action==='strike'?`${role}-strike-${dir}-${frame}-tier0`:`${role}-${action==='carry'?'carry':'walk'}-${dir}-${frame}`;
        if(!p.cache.has(id)){p.cache.set(id,heroPreviewFrame(pack,id,profile.colors));if(p.cache.size>48)p.cache.delete(p.cache.keys().next().value);}
        const canvas=p.canvas,ctx=canvas.getContext('2d'),f=pack.manifest.frames[id];ctx.clearRect(0,0,canvas.width,canvas.height);ctx.imageSmoothingEnabled=false;
        ctx.save();ctx.translate(canvas.width/2,canvas.height-12);ctx.scale(p.direction===3?-3:3,3);ctx.drawImage(p.cache.get(id),-f.anchor[0],-f.anchor[1]);ctx.restore();
        canvas.dataset.frame=id;canvas.dataset.colors=heroColorKey(profile.colors);canvas.dataset.direction=['down','right','up','left'][p.direction];
      });
    }
    request=requestAnimationFrame(draw);
  }
  form.addEventListener('change',update);root.addEventListener('click',click);update();request=requestAnimationFrame(draw);
  return {choices,dispose(){cancelAnimationFrame(request);form.removeEventListener('change',update);root.removeEventListener('click',click);playerNav.removeEventListener('click',switchPlayer);for(const p of panels)p.cache.clear();}};
}
