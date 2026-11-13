import {ITEMS} from '../game/exploration.js';
import {lootItemIcon} from './loot-item-assets.js';

// Stack cells describe real model quantities; inspecting a slot never spends an item.
export function inventoryGrid(state){
  const root=document.createElement('section'),grid=document.createElement('div'),detail=document.createElement('p');
  grid.className='inventory-grid';grid.setAttribute('aria-label','Предметы и снаряжение');detail.className='inventory-detail';detail.textContent='Выберите ячейку, чтобы узнать о предмете.';
  const slots=[
    {id:'axe',name:'Топор',count:state.axeLevel+1,icon:`./src/assets/items/icons/axe-${state.axeLevel}.png`,note:`Урон ${state.axePower}. Автоматический удар каждые ${state.autoInterval} с.`},
    {id:'logs',name:'Брёвна',count:state.wood,limit:state.maxWood,icon:'./src/assets/items/icons/wood-bundle.png',note:'Переносятся за спиной. Продайте покупателям, вложите в стройку или сложите на склад.'},
    {id:'stone',name:'Камень',count:state.stone,glyph:'◆',note:'Добывается из валунов. Нужен для строительства и дальних регионов.'},
    {id:'boards',name:'Доски',count:state.boardCargo,glyph:'▰',note:'Доски в пути занимают места переносимого груза. Разгрузите на площадке лагеря.'},
    ...Object.entries(ITEMS).map(([id,item])=>({id,name:item.name,count:state.exploration.items[id],limit:item.limit,icon:lootItemIcon(id),
      note:({berry:'Восстанавливает 6 HP. Используйте кнопку еды ниже.',salve:'Восстанавливает 35 HP. Используйте кнопку лечения ниже.',key:'Открывает запечатанный сундук и расходуется.',fish:'Можно продать торговцу или приготовить у костра.',resin:'Материал для полезных покупок и обмена.',relic:'Находка из руин. Можно продать загадочному торговцу.'})[id]})),
    {id:'rod',name:'Удочка',count:state.exploration.rod?1:0,icon:lootItemIcon('rod'),note:'Снасть для рыбалки у пруда. Не расходуется после улова.'},
  ];
  for(const slot of slots){
    const cell=document.createElement('button'),name=document.createElement('strong'),count=document.createElement('span');
    cell.type='button';cell.className='inventory-slot';cell.dataset.bagItem=slot.id;cell.dataset.empty=String(!slot.count);
    cell.setAttribute('aria-label',`${slot.name}: ${slot.count}${slot.limit?'/'+slot.limit:''}`);
    if(slot.icon){const img=document.createElement('img');img.src=slot.icon;img.alt='';img.width=img.height=40;img.dataset.itemIcon=slot.id;cell.append(img);}
    else{const icon=document.createElement('span');icon.className='inventory-glyph';icon.textContent=slot.glyph;cell.append(icon);}
    name.textContent=slot.name;count.textContent=slot.limit?`${slot.count}/${slot.limit}`:String(slot.count);count.className='inventory-count';cell.append(name,count);
    cell.onclick=()=>{for(const c of grid.children)c.setAttribute('aria-pressed',String(c===cell));detail.textContent=`${slot.name}. ${slot.note}`;};
    grid.append(cell);
  }
  const empty=document.createElement('div');empty.className='inventory-slot inventory-unused';empty.setAttribute('aria-hidden','true');grid.append(empty);
  root.append(grid,detail);
  const heading=document.createElement('h3'),stock=document.createElement('div');heading.textContent='Общий склад лагеря';stock.className='inventory-grid shared-stock';
  for(const [id,label] of Object.entries({stone:'Камень',boards:'Доски',blocks:'Блоки',coal:'Уголь',kits:'Ремнаборы'})){
    const cell=document.createElement('div'),name=document.createElement('strong'),count=document.createElement('span');cell.className='inventory-slot';cell.dataset.sharedItem=id;
    name.textContent=label;count.textContent=state.campIndustry.materials[id];cell.append(name,count);stock.append(cell);
  }
  root.append(heading,stock);return root;
}
