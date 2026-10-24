import * as THREE from './vendor/three.module.min.js';
const materials=new Map();
export function mat(color,extra={}){const key=color+JSON.stringify(extra);if(!materials.has(key))materials.set(key,new THREE.MeshStandardMaterial({color,flatShading:true,roughness:1,...extra}));return materials.get(key);}
export function mesh(geo,color,parent,x=0,y=0,z=0,extra={}){const m=new THREE.Mesh(geo,mat(color,extra));m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;if(parent)parent.add(m);return m;}
export function box(parent,color,x,y,z,w,h,d){return mesh(new THREE.BoxGeometry(w,h,d),color,parent,x,y,z);}
export function rock(parent,x,z,size=1,color='#89948b'){const m=mesh(new THREE.DodecahedronGeometry(size,0),color,parent,x,size*.3,z);m.scale.set(1,.65,.8);m.rotation.set(.2,x*3,z);return m;}
export function log(parent,x,y,z,scale=1){const g=new THREE.Group();g.position.set(x,y,z);parent.add(g);const bark=mesh(new THREE.CylinderGeometry(.18,.2,1.03,7), '#956742',g);bark.rotation.z=Math.PI/2;const end=mesh(new THREE.CylinderGeometry(.155,.155,.02,7),'#dfba7e',g,.522,0,0);end.rotation.z=Math.PI/2;g.scale.setScalar(scale);return g;}
export function tree(type,x,z,index){const root=new THREE.Group();root.position.set(x,0,z);const canopy=new THREE.Group();root.add(canopy);let hp=4;
 const trunk=mesh(new THREE.CylinderGeometry(type==='birch'?.11:.18,.25,type==='birch'?2.4:2.1,6),type==='birch'?'#e6dfbf':'#79593c',root,0,1.05,0);
 if(type==='pine'){hp=4;for(let i=0;i<3;i++)mesh(new THREE.ConeGeometry(1.15-i*.25,1.9-i*.15,5),['#3e6755','#4d7b5e','#638767'][i],canopy,0,2.1+i*.75,0).rotation.y=index*.4;}
 else{hp=3;const shades=type==='birch'?['#8eaa6b','#a7bd7e','#c0cd96']:['#5d855b','#759a65','#90ab73'];for(let i=0;i<3;i++){const leaf=mesh(new THREE.IcosahedronGeometry(.93,0),shades[i],canopy,Math.sin(i*2.8)*.5,2.5+i*.45,Math.cos(i*2.8)*.4);leaf.scale.set(1.12,1.1,1);}
 if(type==='birch')for(let i=0;i<5;i++){const mark=box(canopy,'#61695a',.08, .5+i*.35,.105,.16,.045,.1);mark.rotation.y=i;}}
 const stump=mesh(new THREE.CylinderGeometry(.23,.27,.27,7),'#c8a46b',root,0,.135,0);stump.visible=false;
 return {id:index,root,canopy,trunk,stump,x,z,hp,maxHp:hp,shake:0,scale:1};
}
export function character(){const root=new THREE.Group(),body=new THREE.Group();root.add(body);const shirt=mesh(new THREE.CylinderGeometry(.26,.3,.55,6),'#b85c3b',body,0,.87,0);const head=mesh(new THREE.IcosahedronGeometry(.27,1),'#dcb78c',body,0,1.4,0);mesh(new THREE.CylinderGeometry(.3,.3,.12,8),'#b99d65',body,0,1.61,0);mesh(new THREE.CylinderGeometry(.39,.39,.04,8),'#d3b57a',body,0,1.55,0);
 box(body,'#486666',0,.75,.22,.36,.42,.08);for(const x of [-.13,.13])box(body,'#c1b68b',x,.92,.265,.035,.35,.02);
 const legs=[];for(const x of [-.14,.14]){const p=new THREE.Group();p.position.set(x,.64,0);body.add(p);box(p,'#394940',0,-.21,0,.18,.42,.2);box(p,'#493f30',0,-.5,.07,.22,.15,.31);legs.push(p);}
 const arm=new THREE.Group();arm.position.set(-.32,1.05,0);body.add(arm);box(arm,'#b85c3b',0,-.18,0,.17,.38,.19);mesh(new THREE.IcosahedronGeometry(.12,0),'#e6c99e',arm,0,-.4,0);
 const axe=new THREE.Group();axe.position.set(.34,1.05,0);body.add(axe);box(axe,'#b85c3b',0,-.14,0,.17,.32,.19);mesh(new THREE.IcosahedronGeometry(.12,0),'#e6c99e',axe,0,-.3,.1);box(axe,'#8a633d',0,-.26,.32,.055,.065,.72);const blade=box(axe,'#b8c6bd',.12,-.26,.64,.27,.32,.075);blade.rotation.z=.2;
 const cargo=new THREE.Group();cargo.position.set(0,1.05,-.22);body.add(cargo);return {root,body,legs,arm,axe,cargo};}
function trianglePrism(width,height,depth){const shape=new THREE.Shape();shape.moveTo(-width/2,0);shape.lineTo(0,height);shape.lineTo(width/2,0);shape.closePath();return new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:false,steps:1});}
export function camp(parent){const tent=new THREE.Group();parent.add(tent);tent.position.set(0,0,-3.5);mesh(trianglePrism(3.9,2.6,3.3),'#b69c6e',tent,0,0,-1.65);const door=mesh(new THREE.PlaneGeometry(1.35,1.85),'#394e43',tent,0,.94,1.66);const opening=mesh(trianglePrism(1.65,2.15,.015),'#344b40',tent,0,0,1.665);door.visible=false;for(const x of [-2.3,2.3])box(tent,'#796642',x,.15,1.9,.12,.3,.12);
 const fire=new THREE.Group();parent.add(fire);for(let i=0;i<9;i++){const a=i/9*Math.PI*2;rock(fire,Math.cos(a)*.85,Math.sin(a)*.85,.23,'#8a9181');}log(fire,0,.17,0,1.2);const l=log(fire,0,.24,0,1.15);l.rotation.y=1.5;
 const flames=[];for(let i=0;i<3;i++){const f=mesh(new THREE.ConeGeometry(.36-i*.09,.95-i*.16,5),['#e98f3c','#f4b348','#ffe1a0'][i],fire,i*.08,.7+i*.08,0,{emissive:['#c65b20','#f39a32','#ffcd70'][i],emissiveIntensity:.8});flames.push(f);}
 const pad=mesh(new THREE.CylinderGeometry(1.35,1.4,.12,8),'#d3bf85',parent,-3.8,.06,4.4);const stall=new THREE.Group();stall.position.set(-4.2,0,1.7);parent.add(stall);box(stall,'#926c44',0,.6,0,2.8,1.2,1.2);for(const x of [-1.3,1.3])box(stall,'#745c3e',x,1.55,0,.12,2,.12);const roof=mesh(trianglePrism(3.4,.9,1.9),'#c2a15f',stall,0,2.2,-.95);
 return {tent,flames,pad};}
