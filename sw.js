'use strict';
const PREFIX='bear-v05-'+self.registration.scope;
const VERSION=PREFIX+'-13-decouverte-1';
const SHELL=['./partner-offers.mjs','./commerces-partenaires.mjs','./photo-spots.js','./places-map.js','./nearby-me.js','./fiches-monuments.js','./decouverte.js','./rallye-points.js','./data/lieux-carte.json','./photo-preparation.json','./partners-v7.js','./rallye.mjs','./loop-navigation.js','./interface-v7.js','./assets/brand/logo.jpg','./assets/brand/clisson-photo-fournie.jpg','./assets/brand/clisson-sevre-photo-fournie.jpg','./timeline.html','./timeline.mjs','./histoire-canonique.mjs','./carnet.html','./carnet.mjs','./carnet-souvenirs.mjs','./aventures.html','./aventures.mjs','./adventure-catalogue.mjs','./','./index.html','./navigation.js','./style.css','./data/parcours.json','./manifest.webmanifest','./vendor/maplibre-gl.mjs','./vendor/maplibre-gl-worker.mjs','./vendor/maplibre-gl.css','./assets/icon.svg','./assets/icon-192.png','./assets/icon-512.png'];
self.addEventListener('install',e=>{
 // Installation complète avant activation : aucun mélange entre deux versions de la coque.
 e.waitUntil(caches.open(VERSION).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',e=>{
 e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith(PREFIX)&&k!==VERSION).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('message',e=>{
 if(e.data?.type!=='CHECK_SHELL'||!e.source)return;
 e.waitUntil(caches.open(VERSION).then(async cache=>{
   const entries=await Promise.all(SHELL.map(p=>cache.match(new URL(p,self.registration.scope).href)));
   e.source.postMessage({type:'SHELL_STATUS',ready:entries.every(Boolean)});
 }).catch(()=>e.source.postMessage({type:'SHELL_STATUS',ready:false})));
});
self.addEventListener('fetch',e=>{
 const u=new URL(e.request.url);
 // Aucun traitement ni stockage des requêtes externes, en particulier des tuiles.
 if(u.origin!==self.location.origin||e.request.method!=='GET') return;
 // Liste fermée : seuls les fichiers locaux de la coque, sans paramètres, sont pris en charge.
 if(u.search||!SHELL.some(p=>new URL(p,self.registration.scope).pathname===u.pathname))return;
 e.respondWith(caches.open(VERSION).catch(()=>null).then(async cache=>{
   const cached=cache?await cache.match(e.request).catch(()=>null):null;
   if(cached)return cached;
   const response=await fetch(e.request);
   // Un quota dépassé ne doit pas rendre inutilisable une réponse réseau reçue.
   if(response.ok&&cache){try{await cache.put(e.request,response.clone());}catch(error){/* Cache incomplet : CHECK_SHELL le signalera. */}}
   return response;
 }));
});
