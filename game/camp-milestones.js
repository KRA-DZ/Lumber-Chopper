import { hasCampBuilding } from "./camp-projects.js";

// Optional shared landmarks. Event-set flags survive spending resources/extinguishing the fire, within this run only.
export function campMilestones(c) {
  const s=c.state,flags=s.campMilestones,actors=c.actors||[c];
  return [
    {id:"fire",name:"Построить костёр",done:hasCampBuilding(s,"fire"),action:"build",hint:"Выберите костёр на голубой платформе, затем сойдите и вернитесь для сдачи брёвен."},
    {id:"light",name:"Зажечь костёр",done:flags.lit,action:"stoke",hint:"Подойдите с бревном к построенному костру и нажмите E/Enter. Топливо можно добавлять днём."},
    {id:"sale",name:"Продать древесину",done:flags.sold||actors.some(a=>a.tutorial.sold),action:"sell",hint:"Покупатели ждут на золотой площадке до ночи."},
    {id:"carry",name:"Улучшить переноску",done:actors.some(a=>a.state.carryLevel>0),action:"shop",hint:"Купите силу переноски в личной лавке: 2 → 4 бревна за рейс."},
    {id:"region",name:"Открыть соседний регион",done:(s.unlockedRegions?.length||1)>1,action:hasCampBuilding(s,"fire")&&hasCampBuilding(s,"fence")?"region":"build",hint:"Костёр и забор автоматически откроют рощу древнего дуба без платы. Другие соседние регионы требуют брёвна на границе."},
    {id:"stone",name:"Добыть первый камень",done:flags.mined,action:"stone",hint:"В соседнем регионе подойдите к большому валуну: герой добывает камень автоматически. Нужны свободные места в сумке."},
  ];
}
