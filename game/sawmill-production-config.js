import { SAWMILL } from "./sawmill.js";
const point=(dx,dy)=>({x:SAWMILL.bounds.x+640+dx,y:SAWMILL.bounds.y+512+dy});
export const MILL=Object.freeze({logs:8,boards:4,seconds:12,inputLimit:48,outputLimit:24,noiseRadius:600,noiseInterval:1.5,noiseMemory:2,
  operator:point(400,96),cartLimit:24,cartSpeed:.8,camp:{x:1450,y:1790},
  cartCost:{logs:12,boards:6,blocks:2}});
export const MILL_STAGES=Object.freeze([
  {name:"Рабочая площадка",cost:{logs:12,boards:6,blocks:4},debris:"sawmill-fallen-beams",description:"Открывает погрузочную площадку и восстановление грузовой тележки."},
  {name:"Привод",cost:{logs:20,boards:10,blocks:8},debris:"sawmill-heavy-collapse",passage:"sawmill-machine-cache",description:"Требует расчистить тяжёлый завал и открыть старую нишу ручным приводом."},
  {name:"Пильный станок",cost:{logs:16,boards:12,blocks:6},discovery:"sawmill-shift-tag",description:"После изучения ниши открывает переработку с оператором. Старая находка сохраняется в дневнике."},
]);
export const MILL_SITES=Object.freeze([
  {id:"sawmill-restoration",kind:"sawmill-service",name:"Восстановление лесопилки",regionId:SAWMILL.regionId,...point(-64,304),description:"Площадка → привод → станок. Вносите брёвна из рук и готовые материалы из общего запаса частями. Старые проходы и находки остаются."},
  {id:"sawmill-loading",kind:"sawmill-service",name:"Погрузочная площадка лесопилки",regionId:SAWMILL.regionId,x:SAWMILL.entrance.x+64,y:SAWMILL.entrance.y,description:"Сырьё привозят вручную или тележкой; готовые доски нужно отвезти в лагерь. Переработка: 8 брёвен → 4 доски за 12 с, только с оператором."},
  {id:"sawmill-production",kind:"sawmill-service",name:"Пульт восстановленного станка",regionId:SAWMILL.regionId,...point(304,176),description:"Назначьте одного из нанятых работников. Дождитесь его прибытия. Ночная смена разрешается отдельно: шум слышен ближайшим монстрам на расстоянии до 600."},
  {id:"camp-freight",kind:"sawmill-service",name:"Грузовая площадка лагеря",regionId:"0:0",...MILL.camp,description:"Восстановите одну общую тележку после первого этапа лесопилки. Груз 24 единицы; тягач идёт на 20% медленнее. Здесь доски поступают в общий запас."},
]);
