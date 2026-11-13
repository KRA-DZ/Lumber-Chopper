import {itemShopIcon} from './item-assets.js';
export function upgradeCell(button,offer){
  const previous=button.dataset.upgradeLevel;button.dataset.upgradeLevel=offer.level;
  if(previous!==undefined&&Number(previous)<offer.level)button.animate([{transform:"scale(1)"},{transform:"scale(1.06)"},{transform:"scale(1)"}],{duration:260});
  button.replaceChildren();button.classList.add('upgrade-cell');button.title=offer.description;
  const icon=itemShopIcon(offer.id,offer),image=document.createElement(icon?'img':'span'),name=document.createElement('strong'),price=document.createElement('small'),level=document.createElement('meter');
  if(icon){image.src=icon;image.alt='';image.width=image.height=40;}else image.textContent=offer.id==='lantern'?'☼':'➟';
  name.textContent=offer.name;price.textContent=offer.maxed?'Максимум':`${offer.price} монет · ${offer.level}/${offer.maxLevel}`;level.min=0;level.max=offer.maxLevel;level.value=offer.level;level.setAttribute('aria-label',`${offer.name}: ${offer.level}/${offer.maxLevel}`);
  button.append(image,name,price,level);button.setAttribute('aria-label',`${offer.name}, ${price.textContent}, уровень ${offer.level}/${offer.maxLevel}`);
}
