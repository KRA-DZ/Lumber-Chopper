import * as THREE from './vendor/three.module.min.js';
import {mesh,mat,rock,tree,camp,box} from './models.js';
export function createScene(canvas){
 const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.08;
 const scene=new THREE.Scene();scene.background=new THREE.Color('#b9c6b6');scene.fog=new THREE.Fog('#b9c6b6',60,110);
 const camera=new THREE.OrthographicCamera(-20,20,16,-16,.1,150);camera.position.set(28,34,32);camera.lookAt(0,0,0);
 scene.add(new THREE.HemisphereLight('#ecedcf','#456459',2.1));const sun=new THREE.DirectionalLight('#fff1ca',3.1);sun.position.set(-15,28,10);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);Object.assign(sun.shadow.camera,{left:-26,right:26,top:26,bottom:-26,near:1,far:70});sun.shadow.normalBias=.04;sun.shadow.bias=-.00015;scene.add(sun);
 const earth=mesh(new THREE.CylinderGeometry(23,23.2,1.9,64),'#768b60',scene,0,-1,0);earth.receiveShadow=true;
 const grass=mesh(new THREE.CylinderGeometry(22.9,22.9,.06,64),'#6f945f',scene,0,-.015,0);
 const clearing=mesh(new THREE.CircleGeometry(7.4,17),'#a5ad78',scene,0,.022,0);clearing.rotation.x=-Math.PI/2;
 const center=mesh(new THREE.CircleGeometry(5.8,13),'#b5ac7f',scene,0,.03,0);center.rotation.x=-Math.PI/2;center.rotation.z=.3;
 // A faceted pool is a real surface, with shallows and gently animated highlights.
 const pond={x:-9,z:4,rx:3.9,rz:2.8};const bank=mesh(new THREE.CylinderGeometry(1,1,.08,14),'#b8b188',scene,pond.x,.015,pond.z);bank.scale.set(pond.rx+.3,1,pond.rz+.3);
 const water=mesh(new THREE.CircleGeometry(1,14),'#658f8e',scene,pond.x,.065,pond.z,{roughness:.36,metalness:.1});water.rotation.x=-Math.PI/2;water.scale.set(pond.rx,pond.rz,1);
 const ripples=[];for(let i=0;i<6;i++){const r=mesh(new THREE.RingGeometry(.23,.25,16),'#bdd5bd',scene,pond.x+Math.sin(i*4)*2.4,.075,pond.z+Math.cos(i*3)*1.5,{transparent:true,opacity:.45,side:THREE.DoubleSide});r.rotation.x=-Math.PI/2;ripples.push(r);}
 const bridge=new THREE.Group();bridge.position.set(-9.2,.05,6.5);bridge.rotation.y=.15;scene.add(bridge);for(let i=0;i<12;i++)box(bridge,i%2?'#ae8856':'#bc9964',-2.2+i*.4,.18,0,.36,.16,1.4);for(const x of [-2.4,2.4])for(const z of [-.7,.7])box(bridge,'#836641',x,.5,z,.16,.95,.16);
 const fireLight=new THREE.PointLight('#ffb64e',12,9,2);fireLight.position.set(0,1.1,0);scene.add(fireLight);const campsite=camp(scene);
 let seed=834;const rnd=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};const trees=[];
 for(let i=0;i<150&&trees.length<50;i++){const a=rnd()*Math.PI*2,r=8+rnd()*13,x=Math.cos(a)*r,z=Math.sin(a)*r;if(((x-pond.x)/5)**2+((z-pond.z)/4)**2<1||trees.some(t=>Math.hypot(x-t.x,z-t.z)<1.9)||Math.abs(x+3)<2&&z>6)continue;const t=tree(['pine','birch','oak'][i%3],x,z,trees.length);t.scale=.85+rnd()*.4;t.root.scale.setScalar(t.scale);t.root.rotation.y=rnd()*6;scene.add(t.root);t.root.traverse(m=>{m.userData.tree=t;});trees.push(t);}
 for(let i=0;i<24;i++){const a=rnd()*Math.PI*2,r=6+rnd()*15;rock(scene,Math.cos(a)*r,Math.sin(a)*r,.18+rnd()*.45,['#929c87','#818f83','#a6ad95'][i%3]);}
 // Reeds and flowers stay decorative and never obstruct feet.
 for(let i=0;i<22;i++){const a=i/22*Math.PI*2,x=pond.x+Math.cos(a)*4.25,z=pond.z+Math.sin(a)*3.15;const reed=box(scene,'#6d8657',x,.3,z,.055,.6,.055);reed.rotation.z=.1;}
 for(let i=0;i<28;i++){const a=rnd()*Math.PI*2,r=5+rnd()*15,x=Math.cos(a)*r,z=Math.sin(a)*r;if(((x-pond.x)/4.5)**2+((z-pond.z)/3.5)**2<1)continue;const stem=box(scene,'#789459',x,.12,z,.03,.24,.03);mesh(new THREE.IcosahedronGeometry(.07,0),i%3?'#e1d4a2':'#c9a382',scene,x,.27,z);}
 const marker=mesh(new THREE.RingGeometry(.28,.34,24),'#f5e6b5',scene,0,.1,0,{transparent:true,opacity:.8,side:THREE.DoubleSide});marker.rotation.x=-Math.PI/2;marker.visible=false;
 let height=25;function resize(){const rect=canvas.getBoundingClientRect();renderer.setSize(rect.width,rect.height,false);const aspect=rect.width/rect.height;const h=height*(aspect<.9?1.1:1);camera.left=-h*aspect/2;camera.right=h*aspect/2;camera.top=h/2;camera.bottom=-h/2;camera.updateProjectionMatrix();}
 function zoom(delta){height=THREE.MathUtils.clamp(height+delta,18,42);resize();}
 const observer=new ResizeObserver(resize);observer.observe(canvas);resize();
 function setDusk(dusk){scene.background.set(dusk?'#657e83':'#b9c6b6');scene.fog.color.copy(scene.background);sun.intensity=dusk?.7:3.1;sun.color.set(dusk?'#a6b9cd':'#fff1ca');scene.children.find(o=>o.isHemisphereLight).intensity=dusk?1.15:2.1;}
 return {setDusk,THREE,renderer,scene,camera,trees,pond,campsite,fireLight,ripples,marker,resize,zoom,observer};
}
