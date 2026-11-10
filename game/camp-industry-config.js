// Fixed sites and bounded processing keep the expanded camp small in the browser.
export const INDUSTRY_PROJECTS = Object.freeze([
  { id:"workbench",stage:4,name:"Верстак",cost:18,kind:"workbench",site:{x:1510,y:1420},
    description:"Доски, каменные блоки и ремонтные наборы. Материалы и очередь общие для лагеря." },
  { id:"kiln",stage:5,name:"Угольная яма",cost:24,kind:"kiln",site:{x:1840,y:1550},requires:["workbench"],materials:{blocks:4},
    description:"Три бревна превращаются в два угля. Уголь даёт 180 с огня, питает фонари и башни." },
  { id:"tower-west",stage:6,name:"Западная башня",cost:20,kind:"tower",site:{x:1310,y:1390},requires:["workbench","fence"],materials:{boards:8,blocks:6},
    description:"Стреляет ночью по обычным врагам. Один уголь даёт 8 выстрелов. 120 HP, можно ремонтировать. Смотритель неуязвим." },
  { id:"tower-east",stage:7,name:"Восточная башня",cost:20,kind:"tower",site:{x:1910,y:1810},requires:["workbench","fence"],materials:{boards:8,blocks:6},
    description:"Вторая точка обороны. Нужен уголь в общем запасе; разрушенная башня перестаёт стрелять." },
  { id:"lamp-north",stage:8,name:"Северный фонарь",cost:6,kind:"lamp",site:{x:1600,y:1300},requires:["kiln"],materials:{boards:3,coal:1},
    description:"Освещает северный выход за уголь. Не создаёт защиты от Смотрителя. Заправляется отдельно." },
  { id:"lamp-south",stage:9,name:"Южный фонарь",cost:6,kind:"lamp",site:{x:1600,y:1910},requires:["kiln"],materials:{boards:3,coal:1},
    description:"Освещает южный выход. Один уголь даёт 180 с света, запас до 540 с." },
]);
export const MATERIAL_NAMES = Object.freeze({ logs:"брёвна", stone:"камень", boards:"доски", blocks:"блоки", coal:"уголь", kits:"ремнаборы" });
export const RECIPES = Object.freeze([
  {id:"boards",name:"Доска",station:"workbench",input:{logs:2},output:{boards:1},seconds:8},
  {id:"blocks",name:"Каменный блок",station:"workbench",input:{stone:3},output:{blocks:1},seconds:10},
  {id:"coal",name:"Два угля",station:"kiln",input:{logs:3},output:{coal:2},seconds:25},
  {id:"kits",name:"Ремонтный набор",station:"workbench",input:{boards:2,blocks:1},output:{kits:1},seconds:12},
]);
export const CAMP_UPGRADES = Object.freeze({
  fire:{name:"Запас и свет костра",building:"fire",costs:[{boards:6,blocks:4,coal:1},{boards:14,blocks:10,coal:3}],
    description:"Каждый уровень: +300 с к запасу топлива и +20 к защитному радиусу горящего костра."},
  fence:{name:"Усиление ограды",building:"fence",costs:[{boards:8,blocks:6},{boards:18,blocks:14}],
    description:"Ограда: 60 → 100 → 160 HP; калитки: 90 → 140 → 220. Проломы не восстанавливаются бесплатно."},
  house:{name:"Обустройство дома",building:"house",costs:[{boards:8,blocks:4},{boards:16,blocks:10,coal:2}],
    description:"Склад: 400 → 600 → 800; места помощников: 2 → 3 → 4. После 3 с отдыха в комнате восстанавливается 2/4 HP в секунду. Упавших не поднимает."},
  towers:{name:"Механизмы башен",building:"tower-west",costs:[{boards:10,blocks:6},{boards:20,blocks:12,coal:4}],
    description:"Обе башни: урон 1 → 2 → 3, интервал 1,8 → 1,4 → 1,1 с. Расходуется уголь, Смотритель не получает урон."},
});
export const industryLevel = (state,id) => state.campIndustry?.upgrades[id] || 0;
export const campFuelLimit = state => 600 + industryLevel(state,"fire") * 300;
export const campStorageLimit = state => 400 + industryLevel(state,"house") * 200;
export const materialLimit = state => 200 + industryLevel(state,"house") * 100;
export const materialCostText = cost => Object.entries(cost||{}).map(([id,n])=>`${n} ${MATERIAL_NAMES[id]}`).join(" · ");
export function initialIndustryState() {
  return {materials:{stone:0,boards:0,blocks:0,coal:0,kits:0},queue:[],nextJob:0,
    upgrades:{fire:0,fence:0,house:0,towers:0},lampFuel:{},towerAmmo:{},towerCooldown:{}};
}
