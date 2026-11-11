// Shared by the modal and each player's private shop; no game state is changed here.
export function shopProgress(offer) {
  const root=document.createElement("span");root.className="shop-progress";
  root.setAttribute("role","progressbar");root.setAttribute("aria-label",offer.name);
  root.setAttribute("aria-valuemin","0");root.setAttribute("aria-valuemax",offer.maxLevel);
  root.setAttribute("aria-valuenow",offer.level);
  root.setAttribute("aria-valuetext",`${offer.level} из ${offer.maxLevel}`);
  const cells=document.createElement("span");cells.className="shop-progress-cells";cells.setAttribute("aria-hidden","true");
  cells.style.gridTemplateColumns=`repeat(${Math.min(10,offer.maxLevel)},minmax(0,1fr))`;
  for(let i=0;i<offer.maxLevel;i++){const cell=document.createElement("i");cell.dataset.filled=String(i<offer.level);cells.append(cell);}
  const text=document.createElement("small");text.textContent=offer.maxed?`${offer.level}/${offer.maxLevel} · максимум`:`${offer.level}/${offer.maxLevel} · осталось ${offer.maxLevel-offer.level}`;
  root.append(cells,text);return root;
}
