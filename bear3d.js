// V14 · Ours 3D : modèle original construit en code (sans fichier externe), animé, prêt hors ligne.
// Chargé à la demande depuis la fiche de rencontre. Bibliothèque : vendor/three.module.min.js (three.js 0.160.0, MIT).
import * as THREE from './vendor/three.module.min.js';

const PALETTE=[
 {fur:0x8a5a33,belly:0xd9b48a,accent:0xc96e4b},
 {fur:0x6d4a2b,belly:0xe0c39b,accent:0x4f90c2},
 {fur:0x9c6a3f,belly:0xf0d6ad,accent:0x7fa36a},
 {fur:0x5e3d22,belly:0xcfa978,accent:0xd4af37},
 {fur:0xa2734a,belly:0xead0a3,accent:0x8ec9f3},
 {fur:0x7a4d2a,belly:0xd8b184,accent:0xc96e4b},
 {fur:0x8f5f36,belly:0xe6c596,accent:0x4f90c2},
 {fur:0x6a4327,belly:0xd3ab7c,accent:0xd4af37},
 {fur:0xa67349,belly:0xf1dcb7,accent:0x7fa36a},
 {fur:0x5a3920,belly:0xc9a071,accent:0x8ec9f3},
 {fur:0x84552e,belly:0xe2bd8f,accent:0xc96e4b},
 {fur:0x714627,belly:0xd6b085,accent:0x4f90c2},
 {fur:0x97643a,belly:0xeed1a6,accent:0xd4af37},
 {fur:0x66402a,belly:0xd0a777,accent:0x7fa36a}
];

// Variante stable par ours (index dans la liste des 14), pour que chaque ours garde son apparence.
export function paletteFor(index){return PALETTE[((index%PALETTE.length)+PALETTE.length)%PALETTE.length];}

function mat(color,extra={}){return new THREE.MeshStandardMaterial({color,roughness:0.75,metalness:0.0,...extra});}

export function buildBear(index){
 const p=paletteFor(index);
 const root=new THREE.Group();
 const body=new THREE.Mesh(new THREE.SphereGeometry(0.62,32,24),mat(p.fur));
 body.scale.set(1,1.1,0.9);body.position.y=0.62;root.add(body);
 const belly=new THREE.Mesh(new THREE.SphereGeometry(0.42,24,18),mat(p.belly));
 belly.scale.set(1,1.15,0.5);belly.position.set(0,0.6,0.42);root.add(belly);
 const head=new THREE.Group();head.position.y=1.5;root.add(head);
 head.add(Object.assign(new THREE.Mesh(new THREE.SphereGeometry(0.5,32,24),mat(p.fur)),{}));
 for(const side of [-1,1]){
  const ear=new THREE.Mesh(new THREE.SphereGeometry(0.2,20,16),mat(p.fur));ear.position.set(side*0.36,0.42,0);head.add(ear);
  const inner=new THREE.Mesh(new THREE.SphereGeometry(0.11,16,12),mat(p.belly));inner.position.set(side*0.36,0.42,0.07);head.add(inner);
 }
 const muzzle=new THREE.Mesh(new THREE.SphereGeometry(0.25,24,18),mat(p.belly));
 muzzle.scale.set(1.15,0.85,0.9);muzzle.position.set(0,-0.12,0.36);head.add(muzzle);
 const nose=new THREE.Mesh(new THREE.SphereGeometry(0.08,16,12),mat(0x2f2a26,{roughness:0.4}));
 nose.position.set(0,0.0,0.56);head.add(nose);
 const eyes=[];
 for(const side of [-1,1]){
  const white=new THREE.Mesh(new THREE.SphereGeometry(0.1,18,14),mat(0xfff9f3,{roughness:0.3}));
  white.position.set(side*0.2,0.1,0.4);head.add(white);
  const pupil=new THREE.Mesh(new THREE.SphereGeometry(0.055,14,10),mat(0x2f2a26,{roughness:0.3}));
  pupil.position.set(side*0.2,0.1,0.48);head.add(pupil);
  const lid=new THREE.Mesh(new THREE.SphereGeometry(0.105,18,14),mat(p.fur));
  lid.position.set(side*0.2,0.1,0.4);lid.scale.set(1,0.02,1);head.add(lid);
  eyes.push(lid);
 }
 for(const side of [-1,1]){
  const arm=new THREE.Mesh(new THREE.CapsuleGeometry(0.14,0.4,8,14),mat(p.fur));
  arm.position.set(side*0.62,0.82,0.1);arm.rotation.z=side*0.5;root.add(arm);
  const paw=new THREE.Mesh(new THREE.SphereGeometry(0.16,16,12),mat(p.belly));
  paw.position.set(side*0.8,0.5,0.22);root.add(paw);
  const leg=new THREE.Mesh(new THREE.SphereGeometry(0.2,18,14),mat(p.fur));
  leg.scale.set(1,0.7,1.1);leg.position.set(side*0.3,0.14,0.2);root.add(leg);
 }
 // Écharpe de la couleur d'accent : repère visuel propre à chaque ours.
 const scarf=new THREE.Mesh(new THREE.TorusGeometry(0.4,0.07,12,32),mat(p.accent));
 scarf.rotation.x=Math.PI/2;scarf.position.y=1.12;root.add(scarf);
 // Goutte de miel, cachée tant que l'ours ne mange pas.
 const drop=new THREE.Mesh(new THREE.SphereGeometry(0.09,16,12),mat(0xe8a317,{roughness:0.2,metalness:0.1,emissive:0x5a3a00,emissiveIntensity:0.3}));
 drop.position.set(0,-0.05,0.68);drop.visible=false;head.add(drop);
 return {root,head,body,eyes,drop,muzzle};
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
  bear.body.scale.y=1.1+Math.sin(t*2.2)*0.02;
  bear.head.rotation.y=Math.sin(t*0.9)*0.25;
  bear.head.rotation.x=Math.sin(t*1.3)*0.04;
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
