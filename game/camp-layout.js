export const CAMP = Object.freeze({
  hut: { x: 1775, y: 1370 },
  tent: { x: 1400, y: 1370 },
  merchant: { x: 1945, y: 1465 },
  stall: { x: 1350, y: 1580 },
  fenceRX: 350,
  fenceRY: 350,
});
// Camp hubs: move the building, NPC and receiving counter together through these coordinates.
export const CAMP_HUB=Object.freeze({
  workshop:{x:1800,y:1680},master:{x:1780,y:1715},counter:{x:1780,y:1770,radius:48},
  store:{x:1340,y:1830},storagePad:{x:1340,y:1885,radius:30},
});
// The same square defines ground, service access and the perimeter; corners stay usable.
export const inCamp = (p, margin = 0) => Math.abs(p.x-1600)<=CAMP.fenceRX+margin && Math.abs(p.y-1600)<=CAMP.fenceRY+margin;
