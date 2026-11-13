export function menuStep(index,code,count,columns=1){
  if(!count)return 0;
  const step=['KeyW','ArrowUp'].includes(code)?-columns:['KeyS','ArrowDown'].includes(code)?columns:['KeyA','ArrowLeft'].includes(code)?-1:['KeyD','ArrowRight'].includes(code)?1:0;
  return (index+step+count)%count;
}
export const MENU_DIRECTIONS=['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowLeft','ArrowDown','ArrowRight'];
export function ownerKey(code,owner){return owner==null||String(owner)===(code.startsWith('Arrow')||['Enter','Backspace'].includes(code)?'1':'0');}
export function visibleMenuActions(root){
  const all=[...root.querySelectorAll('button,summary')].filter(b=>b.offsetParent!==null);
  const back=b=>b.matches('[data-close],[data-activity-close],[data-journal-close],[data-menu-close],[data-build-close],[data-camp-close],[data-worker-close]');
  return [...all.filter(b=>!back(b)),...all.filter(back)];
}
