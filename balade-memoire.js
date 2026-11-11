/* Mémoire locale de la balade : seul fichier de l'appli qui touche au stockage du navigateur.
   Données sur l'appareil uniquement ; rien n'est envoyé. Chaque balade a un identifiant unique horodaté. */
(function(root){
 'use strict';
 const BALADE_KEY='bear-balade-v1',BALADES_KEY='bear-balades-v1';
 const store=()=>{try{return root.localStorage||null;}catch{return null;}};
 function read(key){try{const s=store();return s?JSON.parse(s.getItem(key)||'null'):null;}catch{return null;}}
 function write(key,value){try{const s=store();if(!s)return false;s.setItem(key,JSON.stringify(value));return true;}catch{return false;}}
 function remove(key){try{store()?.removeItem(key);}catch{/* Stockage indisponible : rien à effacer. */}}
 function newId(now=new Date()){
  const p=n=>String(n).padStart(2,'0');
  const stamp=`${now.getFullYear()}${p(now.getMonth()+1)}${p(now.getDate())}-${p(now.getHours())}${p(now.getMinutes())}${p(now.getSeconds())}`;
  return `balade-${stamp}-${Math.random().toString(36).slice(2,6)}`;
 }
 function loadActive(){const d=read(BALADE_KEY);return d&&d.id&&Array.isArray(d.track)?d:null;}
 function saveActive(d){return write(BALADE_KEY,d);}
 function clearActive(){remove(BALADE_KEY);}
 // Historique léger (sans le tracé) : identifiant, dates, distance et nombre de points.
 function archive(summary){const list=read(BALADES_KEY)||[];list.unshift(summary);return write(BALADES_KEY,list.slice(0,30));}
 const api={newId,loadActive,saveActive,clearActive,archive};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.BaladeMemoire=api;
})(globalThis);
