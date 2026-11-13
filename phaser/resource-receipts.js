import {lootItemIcon} from './loot-item-assets.js';
const names={logs:'брёвна',boards:'доски',stone:'камень',blocks:'блоки',coal:'уголь',kits:'ремнаборы',berry:'ягоды',fish:'рыба',key:'ключи',salve:'мазь',resin:'смола',relic:'реликвии'};
export class ResourceReceipts{
  constructor(scene){this.scene=scene;this.previous=new Map();this.nodes=[];}
  sample(){
    const s=this.scene,actors=s.core.actors||[s.core];
    actors.forEach((a,i)=>{
      const values={logs:a.state.wood,boards:a.state.boardCargo,stone:a.state.stone,...a.state.exploration.items};
      for(const [id,n] of Object.entries(values)){const key=i+':'+id,old=this.previous.get(key);if(old!==undefined&&n>old)this.show(a,i,id,n-old,false);this.previous.set(key,n);}
    });
    for(const [id,n] of Object.entries(actors[0].state.campIndustry.materials)){const key='stock:'+id,old=this.previous.get(key);if(old!==undefined&&n>old)this.show(actors[0],0,id,n-old,true);this.previous.set(key,n);}
  }
  show(actor,i,id,count,shared){
    const s=this.scene,cam=s.coopCamera?.split&&i===1?s.coopCamera.second:s.camera,rect=s.game.canvas.getBoundingClientRect(),ratio=rect.width/s.scale.width;
    const x=rect.left+(cam.x+(actor.player.x-cam.worldView.x)*cam.zoom)*ratio,y=rect.top+(cam.y+(actor.player.y-cam.worldView.y)*cam.zoom-70)*ratio;
    const node=document.createElement('div');node.className='resource-receipt';node.dataset.resource=id;node.dataset.actor=i;
    node.style.left=`${Math.max(40,Math.min(innerWidth-100,x))}px`;node.style.top=`${Math.max(50,Math.min(innerHeight-100,y))}px`;
    const src=lootItemIcon(id)||(id==='logs'?'./src/assets/items/icons/wood-bundle.png':null);
    if(src){const img=document.createElement('img');img.src=src;img.alt='';node.append(img);}
    const text=document.createElement('span');text.textContent=`+${count} ${names[id]||id}${shared?' · склад':''}`;node.append(text);document.body.append(node);
    node.addEventListener('animationend',()=>{node.remove();this.nodes=this.nodes.filter(n=>n!==node);},{once:true});
    this.nodes.push(node);if(this.nodes.length>8)this.nodes.shift().remove();
  }
  destroy(){for(const node of this.nodes)node.remove();this.nodes=[];}
}
