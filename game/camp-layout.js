export const CAMP = Object.freeze({
  hut: { x: 1775, y: 1370 },
  tent: { x: 1400, y: 1370 },
  merchant: { x: 1945, y: 1465 },
  stall: { x: 1420, y: 1618 },
  fenceRX: 350,
  fenceRY: 350,
});
// The same square defines ground, service access and the perimeter; corners stay usable.
export const inCamp = (p, margin = 0) => Math.abs(p.x-1600)<=CAMP.fenceRX+margin && Math.abs(p.y-1600)<=CAMP.fenceRY+margin;
export const CAMP_STATIONS = Object.freeze([
  {id:'fire',name:'Костёр',building:'fire',upgrade:'fire',x:1490,y:1560,icon:'unlitFire'},
  {id:'house',name:'Дом',building:'house',upgrade:'house',x:1775,y:1460,icon:'house'},
  {id:'fence',name:'Ограда',building:'fence',upgrade:'fence',x:1850,y:1900,icon:'fence'},
  {id:'towers',name:'Западная башня',building:'tower-west',upgrade:'towers',x:1310,y:1450,icon:'camp.crate'},
  {id:'towers-east',name:'Восточная башня',building:'tower-east',upgrade:'towers',x:1900,y:1740,icon:'camp.crate'},
  {id:'workbench',name:'Верстак',building:'workbench',x:1340,y:1540,icon:'camp.crate'},
  {id:'kiln',name:'Угольная яма',building:'kiln',x:1850,y:1550,icon:'unlitFire'},
]);
