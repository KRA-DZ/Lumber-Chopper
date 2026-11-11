import {DECORATIONS,RECORD_BOARD} from "../game/camp-custom.js";
import {GOALS,createRecordBook} from "../game/record-book.js";

export class CampCustomView {
  constructor(scene){
    this.scene=scene;this.images=new Map();this.selection=null;
    let storage;try{storage=window.localStorage;}catch{storage={getItem(){throw Error();},setItem(){throw Error();}};}
    this.book=createRecordBook(storage);this.runId=`${Date.now()}-${Math.random()}`;
    scene.core.state.campCustom.unlocks=[...this.book.data.goals];
    this.sign=scene.addImage("camp.gateSign",RECORD_BOARD.x,RECORD_BOARD.y).setInteractive().setData("customBoard",true);
    this.label=scene.text("Рекорды и украшения · V",RECORD_BOARD.x,RECORD_BOARD.y-70,11,"#f4dea3",11003);
    this.ghost=scene.addImage("camp.flowers",0,0).setAlpha(.65).setVisible(false).setDepth(11002);
    this.dialog=document.createElement("dialog");this.dialog.id="customDialog";this.dialog.setAttribute("aria-label","Доска лагеря");document.body.append(this.dialog);
    this.toolbar=document.createElement("aside");this.toolbar.className="placement-toolbar";this.toolbar.hidden=true;
    this.hint=document.createElement("p");const place=document.createElement("button"),cancel=document.createElement("button");
    place.textContent="Поставить перед собой · E / Enter";place.onclick=()=>this.place(this.front());cancel.textContent="Отмена · Q";cancel.onclick=()=>this.cancel();this.toolbar.append(this.hint,place,cancel);document.querySelector("#game-frame").append(this.toolbar);
    this.closed=()=>scene.pause("custom",false);this.dialog.addEventListener("close",this.closed);
    this.key=e=>{
      if(e.target.closest?.("input,textarea,select")||e.repeat)return;
      if(this.selection&&["KeyE","Enter","KeyQ","Escape"].includes(e.code)&&!document.querySelector("dialog[open]")){
        if(scene.core.coop&&["KeyE","Enter"].includes(e.code)&&(e.code==="Enter"?1:0)!==this.selection.actor)return;
        e.preventDefault();e.stopImmediatePropagation();if(["KeyQ","Escape"].includes(e.code))this.cancel();else this.place(this.front());return;
      }
      if(e.code==="KeyV"&&!document.querySelector("dialog[open]")){e.preventDefault();this.open();}
    };
    document.addEventListener("keydown",this.key,true);
    this.pointer=p=>{if(this.selection){const camera=scene.coopCamera?.second?.visible&&this.selection.actor===1?scene.coopCamera.second:scene.camera;this.point=camera.getWorldPoint(p.x,p.y);}};
    scene.input.on("pointermove",this.pointer);
    this.syncRecord();
  }
  actor(){return this.scene.core.actors?.[this.selection?.actor??this.owner??this.scene.core.activeActor??0]||this.scene.core;}
  syncRecord(){const c=this.scene.core,s=c.state;
    this.book.record(this.runId,this.scene.registry.get("runName")||"Лесоруб",c.coop?"coop":"solo",s);
    s.campCustom.unlocks=[...this.book.data.goals];
  }
  onEvent(type){if(["day-started","enemy-defeated","game-over","region-open","mill-restored","wave-ended"].includes(type))this.syncRecord();}
  button(parent,text,fn,disabled=false){const b=document.createElement("button");b.type="button";b.textContent=text;b.disabled=disabled;b.onclick=fn;parent.append(b);return b;}
  mutate(fn){this.scene.pause("custom",false);const ok=fn();this.scene.pause("custom",true);this.message=ok?"Готово.":"Действие недоступно: подойдите ближе или проверьте запас монет.";this.renderMenu();}
  open(){const s=this.scene;if(s.core.state.gameOver||s.core.paused||s.core.player.room||s.core.state.health<=0||s.core.player.menuOpen||document.querySelector("dialog[open]"))return false;
    this.cancel();this.owner=s.core.activeActor||0;this.syncRecord();this.renderMenu();s.pause("custom",true);this.dialog.showModal();return true;
  }
  renderMenu(){const c=this.scene.core,a=this.actor(),s=c.state,d=s.campCustom;this.dialog.replaceChildren();
    const h=document.createElement("h2"),intro=document.createElement("p");h.textContent="Доска лагеря";
    intro.textContent=`Пережито ночей: ${s.nightsSurvived} · Побеждено врагов: ${s.runStats.kills} · Ваши монеты: ${a.state.coins}. Основные постройки остаются на своих местах.`;this.dialog.append(h,intro);
    this.button(this.dialog,"Закрыть",()=>this.dialog.close());
    const title=document.createElement("h3");title.textContent="Украшения — выберите место на поляне";this.dialog.append(title);
    for(const item of DECORATIONS){const row=document.createElement("article"),p=document.createElement("p"),locked=item.goal&&!d.unlocks.includes(item.goal);
      p.textContent=`${item.name} · ${Math.ceil(item.price*(a.state.priceMultiplier||1))} монет · в запасе ${d.stock[item.id]||0}${locked?` · цель: ${GOALS.find(g=>g.id===item.goal).name}`:""}`;
      row.append(p);this.button(row,"Разместить",()=>{this.selection={id:item.id,actor:this.owner};this.point=null;this.dialog.close();this.toolbar.hidden=false;},locked);this.dialog.append(row);
    }
    for(const o of d.objects){const row=document.createElement("article");row.textContent=`${DECORATIONS.find(i=>i.id===o.id).name} (${o.x}, ${o.y}) `;
      this.button(row,"Переставить бесплатно",()=>{this.selection={id:o.id,uid:o.uid,actor:this.owner};this.point=null;this.dialog.close();this.toolbar.hidden=false;});
      this.button(row,"Убрать в запас",()=>this.mutate(()=>a.custom.remove(o.uid)));this.dialog.append(row);}
    const supply=document.createElement("h3");supply.textContent="Припасы у доски лагеря";this.dialog.append(supply);
    const feedback=document.createElement("p");feedback.setAttribute("role","status");feedback.textContent=this.message||"Для покупки припасов подойдите к доске в юго-восточной части лагеря.";this.dialog.append(feedback);
    this.button(this.dialog,`Лечение +35 HP · ${Math.ceil(15*(a.state.priceMultiplier||1))} монет`,()=>this.mutate(()=>a.custom.supply("heal")));
    this.button(this.dialog,`Уголь для огня или башен · ${Math.ceil(25*(a.state.priceMultiplier||1))} монет`,()=>this.mutate(()=>a.custom.supply("coal")));
    const goals=document.createElement("h3");goals.textContent="Семь целей путешественника — без обязательного ежедневного входа";this.dialog.append(goals);
    for(const g of GOALS){const p=document.createElement("p");p.textContent=`${d.unlocks.includes(g.id)?"✓":"○"} ${g.name}`;this.dialog.append(p);}
    const records=document.createElement("h3");records.textContent="Рекорды на этом устройстве";this.dialog.append(records);
    const explanation=document.createElement("p");explanation.textContent=this.book.available?"Соло и кооператив, обычный и быстрый календарь сравниваются отдельно. Сохраняются только рекорды и открытые украшения; мир начинается заново. Общая интернет-таблица пока не подключена.":"Хранилище недоступно: рекорды останутся только до закрытия страницы.";this.dialog.append(explanation);
    const table=document.createElement("table");for(const r of this.book.data.rows){const tr=document.createElement("tr");for(const v of [r.name,`${r.mode==="coop"?"Вдвоём":"Соло"} · ${r.speed===2.5?"быстро":"обычно"}`,`${r.nights} ночей`,`${r.kills} побед`]){const td=document.createElement("td");td.textContent=v;tr.append(td);}table.append(tr);}this.dialog.append(table);
    // Separate long lists on small screens; all tabs keep their native keyboard buttons.
    const nav=document.createElement("nav"),groups={decor:document.createElement("section"),supplies:document.createElement("section"),records:document.createElement("section")};
    let group=null;for(const node of [...this.dialog.children]){
      if(node===title)group="decor";if(node===supply)group="supplies";if(node===goals||node===records)group="records";
      if(group)groups[group].append(node);
    }
    const choose=key=>{this.tab=key;for(const [id,section] of Object.entries(groups))section.hidden=id!==key;for(const b of nav.children)b.setAttribute("aria-pressed",String(b.dataset.customTab===key));};
    for(const [id,name] of [["decor","Украшения"],["supplies","Припасы"],["records","Рекорды и цели"]])this.button(nav,name,()=>choose(id)).dataset.customTab=id;
    this.dialog.append(nav,...Object.values(groups));choose(this.tab||"decor");
  }
  front(){const p=this.actor().player,delta={up:[0,-96],down:[0,96],left:[-96,0],right:[96,0]}[p.direction]||[0,96];return{x:p.x+delta[0],y:p.y+delta[1]};}
  place(point){if(!this.selection)return false;const a=this.actor(),s=this.selection,reason=a.custom.reason(s.id,point,s.uid);
    if(reason){this.scene.core.showNotice(reason);return false;}
    if(a.custom.place(s.id,point,s.uid)){this.scene.core.showNotice("Украшение установлено. Переставить или убрать — V.");this.cancel();return true;}return false;
  }
  cancel(){this.selection=null;this.point=null;this.ghost?.setVisible(false);if(this.toolbar)this.toolbar.hidden=true;}
  render(){const c=this.scene.core,d=c.state.campCustom;
    if(this.revision!==d.revision){this.revision=d.revision;for(const [id,img] of this.images)if(!d.objects.some(o=>o.uid===id)){img.destroy();this.images.delete(id);}
      for(const o of d.objects){let img=this.images.get(o.uid);if(!img){const item=DECORATIONS.find(i=>i.id===o.id);img=this.scene.addImage(item.key,o.x,o.y);if(item.tint)img.setTint(item.tint);this.images.set(o.uid,img);}img.setPosition(o.x,o.y).setDepth(o.y);}}
    for(const img of this.images.values())img.setVisible(this.scene.nearView(img,this.scene.camera.worldView,150));
    this.scene.worldHints.offer(this.label,RECORD_BOARD,{eligible:true,range:250,priority:65});
    if(this.selection){const a=this.actor();if(c.state.gameOver||a.state.health<=0||a.player.room){this.cancel();return;}const p=a.custom.snap(this.point||this.front()),r=a.custom.reason(this.selection.id,p,this.selection.uid);
      this.scene.assets.setFrame(this.ghost,DECORATIONS.find(i=>i.id===this.selection.id).key);this.ghost.setPosition(p.x,p.y).setVisible(true).setTint(r?0xe67665:0xa9e992);this.hint.textContent=r||"Нажмите на землю, чтобы поставить. Оплата только после установки.";
    }
  }
  destroy(){document.removeEventListener("keydown",this.key,true);this.scene.input.off("pointermove",this.pointer);this.dialog.removeEventListener("close",this.closed);this.dialog.remove();this.toolbar.remove();for(const img of this.images.values())img.destroy();this.ghost.destroy();this.sign.destroy();this.label.destroy();}
}
