'use strict';
/* Prototype local Bear is BacK, GPS navigateur : aucun envoi de positions vers un serveur. */
const $=id=>document.getElementById(id);
let map,routeLine,startMarker,endMarker,meMarker,accuracyCircle,doneLine;
let active=null,watch=null,lastFix=null;
let gpsRunning=false,gpsSession=0,freshnessTimer=null,lastSampleTime=0;
let matched=null,offSince=null,lastOffSample=null,offRoute=false;
const GPS={maxAccuracy:45,maxAge:15000,offThreshold:75,clearThreshold:50,confirmMs:3000};
let segLengths=[],cumul=[],totalMeters=0;

function rad(d){return d*Math.PI/180;}
function metres(a,b){
 const p=rad(a[0]),q=rad(b[0]),dp=q-p,dl=rad(b[1]-a[1]);
 const h=Math.sin(dp/2)**2+Math.cos(p)*Math.cos(q)*Math.sin(dl/2)**2;
 return 12742017.6*Math.atan2(Math.sqrt(h),Math.sqrt(Math.max(0,1-h)));
}
const fmtKm=m=>(m/1000).toLocaleString('fr-FR',{maximumFractionDigits:2,minimumFractionDigits:2})+' km';
const fmtM=m=>Math.round(m).toLocaleString('fr-FR')+' m';
function computeProgress(positions,here,previous=null,timestamp=Date.now(),accuracy=5){
 // Projections locales sur les segments du seul tracé fourni, sans routage.
 const candidates=[];
 const kx=111195*Math.cos(rad(here[0])),ky=111195;
 for(let i=0;i<positions.length-1;i++){
   const a=positions[i],b=positions[i+1];
   const ax=(a[1]-here[1])*kx,ay=(a[0]-here[0])*ky;
   const dx=(b[1]-a[1])*kx,dy=(b[0]-a[0])*ky,den=dx*dx+dy*dy;
   const f=den?Math.max(0,Math.min(1,-(ax*dx+ay*dy)/den)):0;
   candidates.push({gap:Math.hypot(ax+f*dx,ay+f*dy),along:cumul[i]+segLengths[i]*f,index:i,fraction:f,
     point:[a[0]+f*(b[0]-a[0]),a[1]+f*(b[1]-a[1])]});
 }
 const nearest=candidates.reduce((a,b)=>a.gap<=b.gap?a:b);
 const plausible=candidates.filter(c=>c.gap<=nearest.gap+Math.max(8,accuracy));
 let choice;
 if(previous){
   // Marche : 2,5 m/s, marge GPS bornée ; un long silence ne permet pas un saut de boucle.
   const reach=25+Math.min(30,Math.max(0,(timestamp-previous.timestamp)/1000))*2.5+Math.min(20,accuracy);
   const nearby=plausible.filter(c=>Math.abs(c.along-previous.along)<=reach);
   // Le sens ordonné est privilégié à qualité GPS comparable ; un recul reste possible
   // lorsque les mesures l’appuient. Cela stabilise les portions aller/retour voisines.
   const score=c=>c.gap+Math.abs(c.along-previous.along)*(c.along<previous.along?.8:.15);
   choice=nearby.sort((a,b)=>score(a)-score(b))[0];
 }else{
   // Au départ commun à l'arrivée, une nouvelle session commence au début du tracé.
   if(metres(here,positions[0])<=30){
     choice=plausible.filter(c=>c.along<=60).sort((a,b)=>a.along-b.along)[0];
   }else if(!plausible.some(c=>Math.abs(c.along-nearest.along)>100))choice=nearest;
 }
 return {nearest,projection:choice||null};
}
function status(msg,isWarn=false){
 if($('guidance').textContent!==msg)$('guidance').textContent=msg;
 $('guidance').classList.toggle('warn',isWarn);
}
function suspendProgress(message){
 $('confidence').textContent='Progression suspendue';
 offSince=null;lastOffSample=null; // Une interruption ne confirme jamais à elle seule un éloignement.
 status(message,true);
}
function updateGpsDisplay(lat,lon,accuracy,timestamp=Date.now()){
 if(!gpsRunning)return;
 const now=Date.now();
 if(![lat,lon,accuracy,timestamp].every(Number.isFinite)||Math.abs(lat)>90||Math.abs(lon)>180||accuracy<=0){
   suspendProgress('Mesure GPS invalide. En attente d’une nouvelle position.');return;
 }
 if(now-timestamp>GPS.maxAge||timestamp>now+5000||timestamp<=lastSampleTime){
   suspendProgress('Position GPS ancienne ou désordonnée ignorée. En attente d’une mesure récente.');return;
 }
 lastSampleTime=timestamp;
 clearTimeout(freshnessTimer);
 freshnessTimer=setTimeout(()=>{
   if(!gpsRunning)return;
   $('signal').textContent='GPS sans mesure récente';
   suspendProgress('Aucune mesure GPS récente. Progression conservée, en attente du signal.');
 },Math.max(1,GPS.maxAge-(now-timestamp)));
 lastFix=[lat,lon];
 if(!meMarker){meMarker=L.circleMarker(lastFix,{radius:9,color:'#fff',weight:3,fillColor:'#3179bd',fillOpacity:1}).addTo(map).bindTooltip('Ma position GPS');}
 else meMarker.setLatLng(lastFix);
 if(!accuracyCircle){accuracyCircle=L.circle(lastFix,{radius:accuracy,color:'#327eb5',weight:1,fillColor:'#7bb4d5',fillOpacity:.1,interactive:false}).addTo(map);}
 else accuracyCircle.setLatLng(lastFix).setRadius(accuracy);
 $('accuracy').textContent=fmtM(accuracy);
 $('signal').textContent=accuracy>GPS.maxAccuracy?'GPS peu précis':'GPS actif';
 if(!active)return;
 const {nearest,projection}=computeProgress(active.points,lastFix,matched,timestamp,accuracy);
 $('offset').textContent=fmtM(nearest.gap);
 if(accuracy>GPS.maxAccuracy){
   suspendProgress('Précision GPS faible ('+fmtM(accuracy)+'). Progression conservée ; écart incertain.');return;
 }
 // Écart minimal compte tenu du rayon de précision annoncé par le navigateur.
 const lowerGap=Math.max(0,nearest.gap-accuracy);
 if(lowerGap>GPS.offThreshold){
   if(offSince===null||lastOffSample===null||timestamp-lastOffSample>GPS.maxAge)offSince=timestamp;
   lastOffSample=timestamp;
   if(timestamp-offSince>=GPS.confirmMs)offRoute=true;
 }else{
   offSince=null;lastOffSample=null;
   if(lowerGap<=GPS.clearThreshold)offRoute=false;
 }
 if(offRoute){
   $('confidence').textContent='Éloignement possible';
   status('Écart possible à la trace : '+fmtM(nearest.gap)+' (précision '+fmtM(accuracy)+'). Vérifie la carte ; progression conservée.',true);return;
 }
 if(lowerGap>GPS.offThreshold){
   $('confidence').textContent='Écart à confirmer';
   status('Écart en cours de vérification. Progression conservée.',true);return;
 }
 if(!projection){
   suspendProgress('Projection incertaine (boucle, croisement ou déplacement trop grand). Progression conservée ; poursuis le tracé pour retrouver une position cohérente.');return;
 }
 matched={...projection,timestamp};
 const pct=totalMeters?Math.max(0,Math.min(100,100*matched.along/totalMeters)):0;
 $('progressbar').style.width=pct.toFixed(2)+'%';
 $('progressbar').setAttribute('aria-valuenow',pct.toFixed(0));
 $('altposition').setAttribute('d','M'+(pct*6).toFixed(1)+' 5 V89');
 $('progress').textContent=fmtKm(matched.along);
 $('remaining').textContent=fmtKm(Math.max(0,totalMeters-matched.along));
 $('confidence').textContent='Projection indicative sur la trace';
 if(doneLine)doneLine.setLatLngs([...active.points.slice(0,matched.index+1),matched.point]);
 if(pct>98&&nearest.gap<40)status('Tu es proche de la fin du parcours.');
 else status('Suivi indicatif. La ligne verte montre la progression projetée sur la trace.');
}
function stopGps(){
 gpsRunning=false;gpsSession++;
 clearTimeout(freshnessTimer);freshnessTimer=null;
 if(watch!==null){navigator.geolocation.clearWatch(watch);watch=null;}
 $('toggle-label').textContent='Démarrer le suivi GPS';$('toggle').classList.remove('is-active');
 $('toggle').setAttribute('aria-pressed','false');
 $('signal').textContent=lastFix?'GPS arrêté':'GPS inactif';
 $('confidence').textContent='Suivi arrêté';
 offSince=null;lastOffSample=null;
 status('Suivi GPS arrêté. La dernière position et la progression sont conservées.');
}
function startGps(){
 if(gpsRunning||!active)return;
 if(!('geolocation' in navigator)){status('Géolocalisation non disponible dans ce navigateur.',true);return;}
 if(!window.isSecureContext){status('Pour accéder au GPS, ouvrir l’application sur une adresse HTTPS ou localhost.',true);return;}
 gpsRunning=true;const session=++gpsSession;
 lastSampleTime=0;offSince=null;lastOffSample=null;
 $('toggle-label').textContent='Arrêter le suivi GPS';$('toggle').classList.add('is-active');
 $('toggle').setAttribute('aria-pressed','true');
 $('confidence').textContent='Recherche du signal…';$('signal').textContent='GPS en attente';
 status('Recherche du signal GPS. Tu peux arrêter le suivi à tout moment.');
 try{
   const id=navigator.geolocation.watchPosition(
     p=>{if(gpsRunning&&session===gpsSession)updateGpsDisplay(p.coords.latitude,p.coords.longitude,p.coords.accuracy,p.timestamp);},
     e=>{
       if(!gpsRunning||session!==gpsSession)return;
       if(e.code===1){stopGps();status('Autorisation GPS refusée. Autorise la localisation dans le navigateur si souhaité, puis redémarre explicitement le suivi.',true);}
       else{
         $('signal').textContent='GPS en attente';
         suspendProgress(e.code===2?'Position GPS introuvable. Suivi maintenu en attente du signal.':'Délai GPS dépassé. Suivi maintenu en attente du signal.');
       }
     },
     {enableHighAccuracy:true,maximumAge:0,timeout:25000}
   );
   if(gpsRunning&&session===gpsSession)watch=id;
   else navigator.geolocation.clearWatch(id);
 }catch(e){stopGps();status('Impossible de démarrer le GPS dans ce navigateur. Réessaie explicitement après vérification des permissions.',true);}
}
function buildProfile(data){
 const alts=data.points.map(p=>p[2]).filter(Number.isFinite);
 $('profile-end').textContent='Arrivée · '+fmtKm(totalMeters);
 if(alts.length<2){
   $('elevrange').textContent='Non disponible';
   $('profile-summary').textContent='Altitudes insuffisantes dans la source.';
   $('altfill').setAttribute('d','');$('altline').setAttribute('d','');return;
 }
 const min=Math.min(...alts),max=Math.max(...alts),span=Math.max(10,max-min);
 // L’axe horizontal suit les distances cumulées du seul tracé. Une altitude absente coupe la courbe.
 const segments=[];let segment=[];
 data.points.forEach((p,i)=>{
   if(Number.isFinite(p[2]))segment.push([totalMeters?cumul[i]/totalMeters*600:0,83-(p[2]-min)/span*70]);
   else if(segment.length){segments.push(segment);segment=[];}
 });
 if(segment.length)segments.push(segment);
 const paths=segments.map(points=>'M'+points.map(p=>p[0].toFixed(1)+' '+p[1].toFixed(1)).join(' L'));
 $('altline').setAttribute('d',paths.join(' '));
 $('altfill').setAttribute('d',segments.map((points,i)=>paths[i]+' L'+points[points.length-1][0].toFixed(1)+' 89 L'+points[0][0].toFixed(1)+' 89 Z').join(' '));
 $('elevrange').textContent=Math.round(min)+' à '+Math.round(max)+' m';
 const summary='Altitude de '+fmtM(min)+' à '+fmtM(max)+' sur '+fmtKm(totalMeters)+'. Axe horizontal : distance depuis le départ. Trait orange : progression projetée, si disponible.';
 $('elevation').setAttribute('aria-label',summary);
 $('profile-summary').textContent=summary;
}
async function loadUniqueRoute(){
 const response=await fetch('./data/parcours.json',{cache:'no-store'});
 if(!response.ok)throw new Error('Données GPS manquantes');
 const data=await response.json();
 if(data?.parcours?.id!=='clisson-2026-11-01'||data.parcours.titre!=='La Méditation de Papa Ours')throw new Error('Identité du parcours inattendue.');
 if(!data||!Array.isArray(data.points)||data.points.length<2)throw new Error('Parcours vide.');
 const positions=data.points.map(p=>[p[0],p[1]]);
 if(positions.some(p=>!Number.isFinite(p[0])||!Number.isFinite(p[1])||Math.abs(p[0])>90||Math.abs(p[1])>180))throw new Error('Coordonnées invalides.');
 active={...data,points:positions};
 segLengths=[];cumul=[0];
 for(let i=1;i<positions.length;i++){
   const m=metres(positions[i-1],positions[i]);segLengths.push(m);cumul.push(cumul[i-1]+m);
 }
 totalMeters=cumul[cumul.length-1];
 routeLine=L.polyline(positions,{weight:6,color:'#cb702b',opacity:.9,lineJoin:'round'}).addTo(map);
 doneLine=L.polyline([],{color:'#27724d',weight:7,opacity:.9}).addTo(map);
 startMarker=L.circleMarker(positions[0],{radius:8,color:'#fff',weight:3,fillColor:'#2b8556',fillOpacity:1}).addTo(map).bindPopup('Départ');
 endMarker=L.circleMarker(positions[positions.length-1],{radius:8,color:'#fff',weight:3,fillColor:'#b45840',fillOpacity:1}).addTo(map).bindPopup('Arrivée');
 map.fitBounds(routeLine.getBounds().pad(.10));
 const info=data.parcours||{};
 $('rtitle').textContent=info.titre;
 $('rplace').textContent=info.lieu;
 $('total').textContent=fmtKm(totalMeters);
 $('gain').textContent=info.denivele_positif_estime_m==null?'—':fmtM(info.denivele_positif_estime_m);
 $('points').textContent=positions.length.toLocaleString('fr-FR');
 $('progressbar').style.width='0';$('progress').textContent='—';$('remaining').textContent=fmtKm(totalMeters);
 $('offset').textContent='—';buildProfile(data);
 status('Tu peux démarrer le suivi GPS. La trace du 1er novembre 2026 est chargée.');
 for(const id of ['fit','center','toggle','download'])$(id).disabled=false;
}
function safeXml(s){return String(s).replace(/[<>&"']/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[c]));}
function exportGpx(){
 if(!active)return;
 const body=active.points.map(p=>'<trkpt lat="'+p[0]+'" lon="'+p[1]+'"/>').join('\n');
 const xml='<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="BearIsBack-Rando" xmlns="http://www.topografix.com/GPX/1/1"><trk><name>'+safeXml($('rtitle').textContent)+'</name><trkseg>\n'+body+'\n</trkseg></trk></gpx>';
 const url=URL.createObjectURL(new Blob([xml],{type:'application/gpx+xml'}));
 const a=document.createElement('a');a.href=url;a.download='bearisback-parcours.gpx';a.click();
 setTimeout(()=>URL.revokeObjectURL(url),1500);
}
function bootMap(){
 map=L.map('map',{zoomControl:false});
 L.control.zoom({position:'topleft',zoomInTitle:'Zoom avant',zoomOutTitle:'Zoom arrière'}).addTo(map);
 let tileFailed=false;
 L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{
   attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributeurs',
   maxZoom:19,updateWhenIdle:true
 }).on('loading',()=>{tileFailed=false;}).on('tileerror',()=>{
   tileFailed=true;
   $('mapinfo').textContent='Fond indisponible · trace conservée';
 }).on('load',()=>{
   $('mapinfo').textContent=navigator.onLine===false?'Hors ligne · fond indisponible':tileFailed?'Fond partiellement indisponible · trace conservée':'Fond OpenStreetMap · Internet requis';
 }).addTo(map);
 L.control.scale({metric:true,imperial:false}).addTo(map);
 $('fit').onclick=()=>active&&map.fitBounds(routeLine.getBounds().pad(.10));
 $('center').onclick=()=>{if(lastFix)map.setView(lastFix,16);else status('Active le GPS pour te recentrer.',true);};
 $('toggle').onclick=()=>gpsRunning?stopGps():startGps();
 $('download').onclick=exportGpx;

}
function updateConnection(){
 const offline=navigator.onLine===false;
 $('connection').textContent=offline?'Hors ligne · trace et GPS utilisables si chargés ; fond de carte indisponible.':'Réseau annoncé disponible · le fond de carte nécessite Internet.';
 $('connection').classList.toggle('warn',offline);
 $('mapinfo').textContent=offline?'Hors ligne · fond indisponible':'Fond OpenStreetMap · Internet requis';
}
async function prepareOffline(){
 if(!('serviceWorker' in navigator)||!window.isSecureContext){
   $('offline-status').textContent='Coque hors ligne indisponible ici : HTTPS ou localhost requis.';return;
 }
 try{
   navigator.serviceWorker.addEventListener('message',event=>{
     if(event.data?.type==='SHELL_STATUS')$('offline-status').textContent=event.data.ready?
       'Coque hors ligne prête · tracé inclus, aucune tuile. Safari peut effacer ce cache.':
       'Coque hors ligne incomplète · reste connecté et rouvre l’application.';
   });
   const check=()=>navigator.serviceWorker.controller?.postMessage({type:'CHECK_SHELL'});
   navigator.serviceWorker.addEventListener('controllerchange',check);
   const pending=await navigator.serviceWorker.register('./sw.js');
   $('offline-status').textContent='Coque hors ligne : installation ou vérification en cours. Garde la connexion.';
   const observe=()=>{
     const worker=pending.installing;
     worker?.addEventListener('statechange',()=>{
       if(worker.state==='redundant')$('offline-status').textContent='Installation hors ligne interrompue. Rouvre l’application avec Internet.';
     });
   };
   pending.addEventListener('updatefound',observe);observe();
   const registration=await navigator.serviceWorker.ready;
   registration.active?.postMessage({type:'CHECK_SHELL'});
 }catch(e){$('offline-status').textContent='Coque hors ligne non disponible : ouverture connectée nécessaire.';}
}
async function main(){
 updateConnection();
 if(typeof L==='undefined'){status('Bibliothèque cartographique indisponible.',true);return;}
 bootMap();
 try{
   await loadUniqueRoute();
 }catch(ex){map.setView([47.087,-1.28],14);status('Impossible de charger le parcours : '+ex.message,true);}
 await prepareOffline();
}
window.addEventListener('load',main);
window.addEventListener('pagehide',stopGps);

window.addEventListener('online',updateConnection);
window.addEventListener('offline',updateConnection);
