import { WORKS_PROJECTS } from "../game/world-works-layout.js";
export function appendWorldWorks(container,c,route){
  const section=document.createElement("section"),h=document.createElement("h3");section.dataset.worldWorks="";h.textContent="Река, плотина и старые дороги";section.append(h);
  const intro=document.createElement("p");intro.textContent=`Вода: ${c.state.worldWorks.level==="low"?"опущена — доступны брод и гидростанция":"высокая — начните с ремонта западной плотины"}. Переходы не открывают закрытые регионы. Платите частями: брёвна из рук, доски/блоки из общего запаса.`;section.append(intro);
  for(const project of WORKS_PROJECTS){const card=document.createElement("article"),p=document.createElement("p"),b=document.createElement("button");
    card.dataset.worldWork=project.id;p.textContent=`${project.name} · ${c.state.worldWorks.built[project.id]?"восстановлено":c.worldWorks.progress(project.id)}. ${project.description}`;
    b.type="button";b.textContent="К объекту";b.dataset.worldWorkRoute=project.id;
    b.onclick=()=>route({kind:"site",id:project.requiresLow&&c.state.worldWorks.level!=="low"?"old-dam":project.id});card.append(p,b);section.append(card);
  }container.append(section);
}
