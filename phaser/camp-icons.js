import {MATERIAL_NAMES} from '../game/camp-industry-config.js';
export const MATERIAL_FRAMES={logs:'log',stone:'details.rock.0',boards:'sawmill.woodRack',blocks:'details.rock.0',coal:'details.rock.0',kits:'world.supplies'};
// Small DOM canvases reuse the loaded PNG atlas; no downloads or per-frame textures.
export function campIcon(scene,key,size=56){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=size;canvas.className='camp-icon';canvas.setAttribute('aria-hidden','true');
  Object.assign(canvas.style,{width:`${size}px`,height:`${size}px`,maxWidth:'none',background:'transparent',border:'none',borderRadius:'0',boxShadow:'none'});
  const texture=scene.textures.get('forest'),frame=texture.get(key)||texture.get('camp.crate');
  const ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=false;
  const scale=Math.min((size-8)/frame.cutWidth,(size-8)/frame.cutHeight),w=Math.round(frame.cutWidth*scale),h=Math.round(frame.cutHeight*scale);
  ctx.drawImage(texture.getSourceImage(),frame.cutX,frame.cutY,frame.cutWidth,frame.cutHeight,Math.floor((size-w)/2),Math.floor((size-h)/2),w,h);
  return canvas;
}
export function materialChips(scene,cost,paid={}){
  const root=document.createElement('div');root.className='material-chips';
  for(const [id,n] of Object.entries(cost||{})){
    const chip=document.createElement('span');chip.dataset.material=id;const text=document.createElement('span');
    text.textContent=`${MATERIAL_NAMES[id]} ${Object.hasOwn(paid,id)?`${paid[id]}/${n}`:n}`;chip.append(campIcon(scene,MATERIAL_FRAMES[id],28),text);root.append(chip);
  }return root;
}
