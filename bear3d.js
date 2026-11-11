// V14 · Ours 3D : modèle original construit en code (sans fichier externe), animé, prêt hors ligne.
// Chargé à la demande depuis la fiche de rencontre. Bibliothèque : vendor/three.module.min.js (three.js 0.160.0, MIT).
import * as THREE from './vendor/three.module.min.js';

const PALETTE=[
 {fur:0x8a5a33,belly:0xd9b48a,accent:0xc96e4b},  // brun classique
 {fur:0xc08a4a,belly:0xf2dcae,accent:0x4f90c2},  // miel
 {fur:0xa8562e,belly:0xe8b58f,accent:0x7fa36a},  // cannelle
 {fur:0x5a3a26,belly:0xc9a27a,accent:0xd4af37},  // chocolat
 {fur:0xd8c7b0,belly:0xf7efe3,accent:0xc96e4b},  // crème
 {fur:0xb8743a,belly:0xeccba0,accent:0x8ec9f3},  // roux
 {fur:0x7d7468,belly:0xd6cfc4,accent:0x4f90c2},  // gris taupe (LouLou, TiTi, LyLy)
 {fur:0xb89466,belly:0xf0e0c4,accent:0x7fa36a},  // sable
 {fur:0x4a3224,belly:0xb8906c,accent:0xd4af37},  // noyer foncé
 {fur:0xd4aa72,belly:0xf8ecd6,accent:0xc96e4b},  // blond
 {fur:0x9b4a32,belly:0xe9bfa2,accent:0x4f90c2},  // brun rouge
 {fur:0x6e6a4a,belly:0xd9d2b0,accent:0x8ec9f3},  // olive grisé
 {fur:0xc99c86,belly:0xf5e1d6,accent:0x7fa36a},  // beige rosé
 {fur:0x3b2a20,belly:0x9c7a5c,accent:0xd4af37}   // brun très foncé
];

// Variante stable par ours (index dans la liste des 14), pour que chaque ours garde son apparence.
// Même famille, même apparence : LouLou (6), TiTi (7) et LyLy (9) partagent le même modèle.
const FAMILY_LOOK={6:6,7:6,9:6};
export function lookFor(index){return FAMILY_LOOK[index]??index;}
export function paletteFor(index){return PALETTE[((index%PALETTE.length)+PALETTE.length)%PALETTE.length];}

function mat(color,extra={}){return new THREE.MeshStandardMaterial({color,roughness:0.75,metalness:0.0,...extra});}

// Fourrure et peluche : surface douce (reflets de velours) et petites stries de poils, sans géométrie en plus.
let furMap=null;
function furTexture(){
 if(furMap)return furMap;
 try{
  const c=document.createElement('canvas');c.width=c.height=256;const g=c.getContext('2d');
  g.fillStyle='#808080';g.fillRect(0,0,256,256);
  for(let i=0;i<2600;i++){
   const x=Math.random()*256,y=Math.random()*256,l=3+Math.random()*7,a=Math.random()*Math.PI;
   g.strokeStyle=Math.random()<.5?'#a8a8a8':'#5c5c5c';g.lineWidth=1+Math.random()*1.2;
   g.beginPath();g.moveTo(x,y);g.lineTo(x+Math.cos(a)*l,y+Math.sin(a)*l);g.stroke();
  }
  furMap=new THREE.CanvasTexture(c);furMap.wrapS=furMap.wrapT=THREE.RepeatWrapping;furMap.repeat.set(3,3);
 }catch{furMap=null;}
 return furMap;
}
function fur(color,{belly=false}={}){
 const c=new THREE.Color(color);
 return new THREE.MeshPhysicalMaterial({color,roughness:0.92,metalness:0,sheen:1,sheenRoughness:0.5,
  sheenColor:c.clone().lerp(new THREE.Color(0xffffff),0.35),bumpMap:furTexture(),bumpScale:belly?0.5:1.1});
}
// Tissu de l'écharpe : mat, légèrement duveteux.
function cloth(color){return new THREE.MeshPhysicalMaterial({color,roughness:0.85,sheen:0.6,sheenRoughness:0.4,sheenColor:new THREE.Color(0xffffff)});}

export function buildBear(index){
 const look=lookFor(index);const p=paletteFor(look);
 const root=new THREE.Group();
 const F=c=>fur(c), B=c=>fur(c,{belly:true});
 // Corps et ventre : formes arrondies qui se recouvrent, sans jointure marquée.
 const body=new THREE.Mesh(new THREE.SphereGeometry(0.62,40,30),F(p.fur));
 body.scale.set(1,1.1,0.9);body.position.y=0.62;root.add(body);
 const belly=new THREE.Mesh(new THREE.SphereGeometry(0.42,32,24),B(p.belly));
 belly.scale.set(1,1.15,0.5);belly.position.set(0,0.6,0.42);root.add(belly);
 // Cou : relie la tête au corps.
 const neck=new THREE.Mesh(new THREE.SphereGeometry(0.52,32,24),F(p.fur));
 neck.scale.set(1,0.55,0.85);neck.position.set(0,1.12,0);root.add(neck);
 const head=new THREE.Group();head.position.y=1.5;root.add(head);
 head.add(new THREE.Mesh(new THREE.SphereGeometry(0.5,40,30),F(p.fur)));
 const ears=[];
 for(const side of [-1,1]){
  const ear=new THREE.Mesh(new THREE.SphereGeometry(0.2,28,20),F(p.fur));ear.position.set(side*0.36,0.42,0);head.add(ear);ears.push(ear);
  const inner=new THREE.Mesh(new THREE.SphereGeometry(0.11,20,16),B(p.belly));inner.position.set(side*0.36,0.42,0.07);head.add(inner);
 }
 const muzzle=new THREE.Mesh(new THREE.SphereGeometry(0.25,32,24),B(p.belly));
 muzzle.scale.set(1.15,0.85,0.9);muzzle.position.set(0,-0.12,0.36);head.add(muzzle);
 const nose=new THREE.Mesh(new THREE.SphereGeometry(0.08,16,12),mat(0x2f2a26,{roughness:0.4}));
 nose.position.set(0,0.0,0.56);head.add(nose);
 const eyes=[];
 for(const side of [-1,1]){
  // Œil = blanc + pupille + reflet : le clignement replie le groupe entier.
  const eye=new THREE.Group();eye.position.set(side*0.2,0.1,0.4);
  eye.add(new THREE.Mesh(new THREE.SphereGeometry(0.11,20,16),mat(0xfff9f3,{roughness:0.3})));
  const pupil=new THREE.Mesh(new THREE.SphereGeometry(0.065,16,12),mat(0x2f2a26,{roughness:0.3}));
  pupil.position.set(0,0,0.06);eye.add(pupil);
  const shine=new THREE.Mesh(new THREE.SphereGeometry(0.024,10,8),mat(0xffffff,{roughness:0.1,emissive:0xffffff,emissiveIntensity:0.7}));
  shine.position.set(0.03,0.03,0.11);eye.add(shine);
  head.add(eye);eyes.push(eye);
 }
 // Joues roses : une douceur qui rend l'ours plus touchant.
 for(const side of [-1,1]){
  const cheek=new THREE.Mesh(new THREE.SphereGeometry(0.09,16,12),mat(0xe7998a,{roughness:0.9,transparent:true,opacity:0.55}));
  cheek.scale.set(1,0.7,0.5);cheek.position.set(side*0.3,-0.05,0.42);head.add(cheek);
 }
 // Bras et pattes : formes ovales qui se fondent dans le corps.
 for(const side of [-1,1]){
  const arm=new THREE.Mesh(new THREE.SphereGeometry(0.2,28,20),F(p.fur));
  arm.scale.set(0.8,1.5,0.85);arm.position.set(side*0.6,0.82,0.1);arm.rotation.z=side*0.35;root.add(arm);
  const paw=new THREE.Mesh(new THREE.SphereGeometry(0.17,24,18),B(p.belly));
  paw.scale.set(1,0.8,1);paw.position.set(side*0.78,0.5,0.24);root.add(paw);
  const leg=new THREE.Mesh(new THREE.SphereGeometry(0.22,28,20),F(p.fur));
  leg.scale.set(1,0.7,1.1);leg.position.set(side*0.3,0.14,0.2);root.add(leg);
  const foot=new THREE.Mesh(new THREE.SphereGeometry(0.15,20,16),B(p.belly));
  foot.scale.set(1,0.6,1.2);foot.position.set(side*0.3,0.08,0.36);root.add(foot);
 }
 // Ombre douce au sol : l'ours tient en place.
 const shadow=new THREE.Mesh(new THREE.CircleGeometry(0.9,32),new THREE.MeshBasicMaterial({color:0x2f2a26,transparent:true,opacity:0.16,depthWrite:false}));
 shadow.rotation.x=-Math.PI/2;shadow.position.y=0.001;root.add(shadow);
 // Écharpe en tissu : anneau doux, avec deux pans qui pendent devant pour qu'on la reconnaisse.
 const scarf=new THREE.Mesh(new THREE.TorusGeometry(0.44,0.11,20,48),cloth(p.accent));
 scarf.rotation.x=Math.PI/2;scarf.scale.set(1,1,0.85);scarf.position.y=1.08;root.add(scarf);
 for(const side of [-1,1]){
  const tail=new THREE.Mesh(new THREE.CapsuleGeometry(0.1,0.42,8,16),cloth(p.accent));
  tail.scale.set(1,1,0.45);tail.position.set(side*0.14,0.8,0.5);tail.rotation.z=side*-0.12;tail.rotation.x=0.15;root.add(tail);
 }
 // Goutte de miel, cachée tant que l'ours ne mange pas.
 const drop=new THREE.Mesh(new THREE.SphereGeometry(0.09,16,12),mat(0xe8a317,{roughness:0.2,metalness:0.1,emissive:0x5a3a00,emissiveIntensity:0.3}));
 drop.position.set(0,-0.05,0.68);drop.visible=false;head.add(drop);
 // Variation stable par ours : taille du corps, de la tête et des oreilles, pour que chacun soit reconnaissable.
 const k=((look%PALETTE.length)+PALETTE.length)%PALETTE.length;
 root.scale.setScalar(0.9+((k*5)%7)*0.03);
 head.scale.setScalar(0.92+((k*3)%5)*0.04);
 for(const e of ears)e.scale.setScalar(0.85+((k*7)%4)*0.1);
 return {root,head,body,belly,eyes,drop,muzzle};
}

export function createBearScene(canvas,index,{size=240}={}){
 const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true,preserveDrawingBuffer:true});
 renderer.setPixelRatio(Math.min(2,(globalThis.devicePixelRatio||1)));
 renderer.setSize(size,size,false);
 renderer.setClearColor(0x000000,0);
 const scene=new THREE.Scene();
 const camera=new THREE.PerspectiveCamera(32,1,0.1,50);
 camera.position.set(0,1.7,5.2);camera.lookAt(0,1.05,0);
 scene.add(new THREE.HemisphereLight(0xfff9f3,0x6d4a2b,1.6));
 const sun=new THREE.DirectionalLight(0xffffff,1.4);sun.position.set(3,5,4);scene.add(sun);
 const bear=buildBear(index);scene.add(bear.root);
 let t=0,eating=0,blinkAt=2,raf=null,running=false,last=performance.now();

 function frame(now){
  const dt=Math.min(0.1,(now-last)/1000);last=now;t+=dt;
  // Respiration et balancement de tête
  const breath=Math.sin(t*1.6);
  bear.body.scale.y=1.1+breath*0.035;
  bear.belly.scale.y=1.15+breath*0.05;
  bear.head.rotation.y=Math.sin(t*0.5)*0.12;
  bear.head.rotation.z=Math.sin(t*0.7)*0.06;
  bear.head.rotation.x=Math.sin(t*1.1)*0.03;
  // Clignement toutes les 3 à 4 s
  if(t>blinkAt){bear.eyes.forEach(e=>e.scale.y=0.02);if(t>blinkAt+0.15){bear.eyes.forEach(e=>e.scale.y=1);blinkAt=t+3+Math.random()*1.2;}}
  // Repas : la goutte disparaît dans la bouche, l'ours se dandine
  if(eating>0){
   eating=Math.max(0,eating-dt);
   bear.drop.visible=eating>0.4;
   bear.drop.position.y=-0.05-(1-eating/2.5)*0.2;
   bear.head.position.y=1.5+Math.abs(Math.sin(t*12))*0.05;
   bear.muzzle.scale.set(1.15,0.85+Math.abs(Math.sin(t*10))*0.12,0.9);
  }else{bear.drop.visible=false;bear.head.position.y=1.5;bear.muzzle.scale.set(1.15,0.85,0.9);}
  renderer.render(scene,camera);
  if(running)raf=requestAnimationFrame(frame);
 }
 return {
  start(){if(running)return;running=true;last=performance.now();raf=requestAnimationFrame(frame);},
  stop(){running=false;if(raf)cancelAnimationFrame(raf);raf=null;},
  eat(seconds=2.5){eating=seconds;},
  isEating(){return eating>0;},
  // Photo de l'ours : PNG 240 px, rendu juste avant la capture (le buffer est conservé).
  snapshot(){renderer.render(scene,camera);return canvas.toDataURL('image/png');},
  dispose(){this.stop();renderer.dispose();scene.traverse(o=>{o.geometry?.dispose?.();o.material?.dispose?.();});}
 };
}
