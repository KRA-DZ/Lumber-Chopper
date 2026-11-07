import { campMilestones } from "../game/camp-milestones.js";
import { raidReadiness } from "../game/raid-readiness.js";
import { countdown } from "../game/first-days.js";

function heading(section,text){const h=document.createElement("h3");h.textContent=text;section.append(h);}
function paragraph(section,text){const p=document.createElement("p");p.textContent=text;section.append(p);return p;}
export function appendCampMilestones(container,c){
  const goals=campMilestones(c),section=document.createElement("section");section.dataset.campMilestones="";
  heading(section,`Первые шаги лагеря · ${goals.filter(g=>g.done).length}/${goals.length}`);
  paragraph(section,"Необязательные цели, без наград и ограничений порядка. Открывать регионы и строить можно заранее; результаты общие для двоих.");
  for(const goal of goals){const row=paragraph(section,`${goal.done?"✓":"○"} ${goal.name}. ${goal.hint}`);row.dataset.campMilestone=goal.id;row.dataset.done=String(goal.done);}
  container.append(section);
}
export function appendRaidReadiness(container,c){
  const r=raidReadiness(c),section=document.createElement("section");section.dataset.raidReadiness="";
  heading(section,`Ночь ${r.time.nextRaid} · ${r.plan.name} · ${r.time.raidActive?"налёт идёт":`через ${countdown(r.time.raidSeconds)}`}`);
  paragraph(section,r.plan.hint);
  paragraph(section,`Основная подготовка: ${r.ready}/3. Проверены текущие запасы; материалы в руках и очереди ещё не использованы.`);
  for(const check of r.checks){const row=paragraph(section,`${check.ready?"✓":"○"} ${check.text}`);row.dataset.raidCheck=check.id;row.dataset.ready=String(check.ready);}
  paragraph(section,r.extra);paragraph(section,r.advice);container.append(section);
}
