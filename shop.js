import {SHOP_IDS,upgradeOffer,buyUpgrade} from './economy.js';
import {upgradeCell} from './phaser/upgrade-cell.js';
export function createShop(state,{onChange,onOpen,purchase=id=>buyUpgrade(state,id),currencyIcon=null}){
  const dialog=document.querySelector('#shopDialog'),balance=dialog.querySelector('[data-balance]'),items=dialog.querySelector('[data-items]'),message=dialog.querySelector('[data-message]');
  const cards=new Map();items.replaceChildren();items.classList.add('upgrade-grid');
  const detail=document.createElement('p');detail.dataset.upgradeDetail='';items.after(detail);
  for(const id of SHOP_IDS){
    const card=document.createElement('article'),button=document.createElement('button');card.className='shop-item';button.type='button';button.dataset.buy=id;card.append(button);items.append(card);cards.set(id,{card,button});
    const inspect=()=>detail.textContent=upgradeOffer(state,id).description;button.addEventListener('focus',inspect);button.addEventListener('pointerenter',inspect);
    button.onclick=()=>{const offer=upgradeOffer(state,id);if(!purchase(id)){message.textContent='Не хватает монет или достигнут максимум.';return;}message.textContent=`Куплено: ${offer.name}`;onChange(id);refresh();};
  }
  function refresh(){
    balance.textContent=`Монеты: ${state.coins}`;
    if(currencyIcon){const img=document.createElement('img');img.src=currencyIcon;img.width=img.height=24;img.alt='';balance.prepend(img);}
    for(const [id,c] of cards){const offer=upgradeOffer(state,id);upgradeCell(c.button,offer);c.button.disabled=!offer.canBuy;}
  }
  function open(){onOpen();message.textContent='';detail.textContent='Выберите улучшение.';refresh();if(!dialog.open)dialog.showModal();}
  const close=()=>dialog.close();dialog.querySelector('[data-close]').addEventListener('click',close);
  return {open,refresh,get isOpen(){return dialog.open;},destroy(){detail.remove();dialog.querySelector('[data-close]').removeEventListener('click',close);items.replaceChildren();dialog.close();}};
}
