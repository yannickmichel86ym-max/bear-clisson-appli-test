import * as maplibregl from './vendor/maplibre-gl.mjs';
maplibregl.setWorkerUrl(new URL('./vendor/maplibre-gl-worker.mjs', import.meta.url).href);
const $=id=>document.getElementById(id);
const STYLE='https://tiles.openfreemap.org/styles/liberty';
const GPS={maxAccuracy:45,maxAge:15000,offThreshold:75,clearThreshold:50,confirmMs:3000,senseMeters:35};
// Parcouru : tout ce qui est réellement marché (détours compris). Bruit au repos et sauts impossibles exclus.
const WALK={maxSpeed:3,jitter:4};
let styleTimer=null;
let rallyeFix=null;
// Bouton « Partir à l'aventure » de l'accueil : démarre le GPS, sans bouton sur la carte.
window.bearStartGps=()=>{if(active&&!gpsRunning&&!demoRunning)startGps();};
// Lecture seule du GPS réel existant : aucun second suivi, aucune position de démo.
window.bearRallyeFix=()=>gpsRunning&&!demoRunning&&!document.hidden?rallyeFix:null;
// Démo : même lecture passive, sur le point de la démo affiché (aucun GPS réel). Ne sert qu'au halo de découverte.
window.bearDemoFix=()=>{if(!demoRunning||document.hidden)return null;const p=atDistance(demoAlong).point;return {latitude:p[0],longitude:p[1],accuracy:5,timestamp:Date.now()};};
let wakeEnabled=false,wakeLock=null,wakePending=null,wakeEpoch=0;
function wakeStatus(message){$('wake-status').textContent=message;}
function releaseWakeLock(){
 wakeEpoch++;
 const lock=wakeLock;wakeLock=null;
 if(lock)Promise.resolve().then(()=>lock.release()).catch(()=>{});
}
async function requestWakeLock(){
 if(!wakeEnabled||!gpsRunning||document.hidden||wakeLock||wakePending)return;
 if(!navigator.wakeLock?.request){wakeStatus('Maintien écran indisponible dans ce navigateur.');return;}
 const epoch=wakeEpoch;
 const pending=Promise.resolve().then(()=>epoch===wakeEpoch&&wakeEnabled&&gpsRunning&&!document.hidden?navigator.wakeLock.request('screen'):null);
 wakePending=pending;
 try{
  const lock=await pending;
  if(!lock)return;
  if(epoch!==wakeEpoch||!wakeEnabled||!gpsRunning||document.hidden){await lock.release();return;}
  wakeLock=lock;
  lock.addEventListener('release',()=>{
   if(wakeLock!==lock)return;
   wakeLock=null;wakeStatus('Maintien écran interrompu par le système.');
  });
  if(lock.released){wakeLock=null;wakeStatus('Maintien écran interrompu par le système.');}
  else wakeStatus('Maintien écran demandé et actif · sans garantie.');
 }catch{if(epoch===wakeEpoch&&wakeEnabled&&gpsRunning)wakeStatus('Maintien écran indisponible ou refusé · suivi GPS conservé.');}
 finally{
  if(wakePending===pending)wakePending=null;
  // Une ancienne demande peut se terminer après arrêt/reprise ou masquage.
  if(epoch!==wakeEpoch&&wakeEnabled&&gpsRunning&&!document.hidden)void requestWakeLock();
 }
}
function toggleWakeLock(){
 wakeEnabled=!wakeEnabled;
 $('wake').setAttribute('aria-pressed',String(wakeEnabled));
 $('wake').textContent=wakeEnabled?'Maintien écran : activé':'Maintien écran : désactivé';
 if(!wakeEnabled){releaseWakeLock();wakeStatus('Option désactivée.');}
 else{wakeStatus(gpsRunning?'Tentative de maintien écran…':'Sera tenté uniquement pendant le suivi GPS.');void requestWakeLock();}
}
const FALLBACK_STYLE={version:8,sources:{},layers:[{id:"background",type:"background",paint:{"background-color":"#FFF9F3"}}]};
let map, active, marker, segLengths=[], cumul=[], totalMeters=0;
let loopRoute=null, loopSession=null, entryCandidate=null;
let matched=null, lastFix=null, follow=true, heading=null, mapReady=false;
let gpsReliable=false, minFixTime=0;
let walked=0, walkedSinceAnchor=0, countedFix=null, userMoveAt=0, userZoom=null;
let paused=false, track=[], lastOffAlert=-Infinity, reanchorPending=false, keepPaused=false, balade=null;
let gpsRunning=false, gpsSession=0, watch=null, freshnessTimer=null, lastSampleTime=0;
let offSince=null,lastOffSample=null,offRoute=false,audioEnabled=false,audioChosen=false;
let demoRunning=false,demoPaused=false,demoAlong=0,demoTimer=null,demoLast=0;
let milestoneFloor=null, milestonePending=null, lastVoiceTime=-Infinity, speechBusy=false, speechToken=0;
const VOICE_GAP=12000;
const VOICE_TIMEOUT=20000;
const DEMO_SPEED=14; // Marche accélérée ×10 ; interpolation uniquement sur les segments source.
function rad(d){return d*Math.PI/180;}
function metres(a,b){
 const p=rad(a[0]),q=rad(b[0]),dp=q-p,dl=rad(b[1]-a[1]);
 const h=Math.sin(dp/2)**2+Math.cos(p)*Math.cos(q)*Math.sin(dl/2)**2;
 return 12742017.6*Math.atan2(Math.sqrt(h),Math.sqrt(Math.max(0,1-h)));
}
const fmtKm=m=>(m/1000).toLocaleString('fr-FR',{maximumFractionDigits:2,minimumFractionDigits:2})+' km';
const fmtM=m=>Math.round(m).toLocaleString('fr-FR')+' m';
function computeProgress(positions,here,previous=null,timestamp=Date.now(),accuracy=5){
 return LoopNavigation.project(loopRoute,here,previous,timestamp,accuracy,walkedSinceAnchor);
}
// Ajoute au parcouru la distance réellement marchée entre deux mesures fiables, et enregistre le tracé.
function countWalk(lat,lon,accuracy,timestamp){
 if(paused){countedFix=null;return;}
 if(!countedFix){countedFix={lat,lon,t:timestamp};recordPoint(lat,lon,timestamp,track.length>0);return;}
 if(timestamp<=countedFix.t)return;
 const d=metres([countedFix.lat,countedFix.lon],[lat,lon]);
 const dt=(timestamp-countedFix.t)/1000;
 // Bruit de mesure à l'arrêt : sous ce seuil, on ne bouge pas la référence.
 if(d<Math.max(WALK.jitter,accuracy*.5))return;
 // Saut impossible (téléportation, longue interruption) : on repart de la nouvelle mesure, sans compter.
 if(d>WALK.maxSpeed*dt+2*accuracy+10){countedFix={lat,lon,t:timestamp};return;}
 walked+=d;walkedSinceAnchor+=d;countedFix={lat,lon,t:timestamp};
 recordPoint(lat,lon,timestamp);
}
// Enregistre un point du parcours ; afterGap marque la reprise après une interruption (pas de droite fictive).
function recordPoint(lat,lon,t,afterGap=false){
 track.push(afterGap?{lat,lon,t,gap:1}:{lat,lon,t});
 refreshTrack();
 saveBalade();
}
function refreshTrack(){
 const segs=[[]];
 for(const p of track){if(p.gap&&segs.at(-1).length)segs.push([]);segs.at(-1).push([p.lat,p.lon]);}
 map?.getSource('track')?.setData({type:'Feature',properties:{},geometry:{type:'MultiLineString',coordinates:segs.filter(s=>s.length>1).map(s=>s.map(([la,lo])=>[lo,la]))}});
}
// Alerte vocale hors trace : à la détection, puis une fois par minute tant que l'écart dure.
function speakAlert(){
 if(!audioEnabled||!gpsRunning||demoRunning||document.hidden)return;
 speak('Attention. Vous êtes éloigné de la trace. Vérifiez la carte.',true);
}
// Distance restante estimée hors trace, à partir du point du tracé le plus proche : le compteur ne se fige pas.
function offTraceDisplay(nearest){
 if(!loopSession||demoRunning)return;
 const d=LoopNavigation.delta(nearest.along,loopSession.previous.along,totalMeters);
 if(Math.abs(d)>walkedSinceAnchor+60)return;
 const travelled=Math.max(0,Math.min(totalMeters,loopSession.unwrapped+d*loopSession.direction));
 $('metres-left').textContent=fmtKm(totalMeters-travelled);
}
// Pause : l'écran pause propose CARNET / REPRENDRE / TERMINER.
function resumeRecording(){
 if(!paused)return;
 paused=false;countedFix=null;walkedSinceAnchor=0;matched=null;reanchorPending=true;saveBalade();
 speak('Reprise',true);
 $('pause-open').textContent='❚❚ Pause';
}
function openPauseSheet(){
 const wasPaused=paused;
 paused=true;keepPaused=false;saveBalade();
 if(!wasPaused)speak('Mise en pause',true);
 $('pause-open').textContent='● En pause';
 const sheet=$('pause-sheet');
 if(!sheet.open){try{sheet.showModal();}catch{sheet.setAttribute('open','');}}
}
// Balade : mémoire locale (fichier balade-memoire.js), identifiant unique horodaté.
// Reprise après fermeture de l'appli, batterie vide, appel…
function newBalade(){balade={id:globalThis.BaladeMemoire?.newId()??'balade-'+Date.now(),startedAt:Date.now()};walked=0;walkedSinceAnchor=0;countedFix=null;track=[];paused=false;loopSession=null;saveBalade();}
function saveBalade(){
 if(!balade)return;
 globalThis.BaladeMemoire?.saveActive({...balade,walked,track,loop:loopSession,updatedAt:Date.now()});
}
function loadSavedBalade(){return globalThis.BaladeMemoire?.loadActive()??null;}
function restoreBalade(saved){
 balade={id:saved.id,startedAt:saved.startedAt};walked=Number(saved.walked)||0;track=saved.track;
 loopSession=saved.loop||null;walkedSinceAnchor=0;countedFix=null;paused=false;matched=null;reanchorPending=!!loopSession;
}
// Démarrer ou reprendre : une balade enregistrée reprend là où elle s'est arrêtée.
function beginBalade(){
 if(balade)return;
 const saved=loadSavedBalade();
 if(saved)restoreBalade(saved);else newBalade();
}
// Réinitialiser le GPS : l'ancienne balade part dans l'historique, une nouvelle commence.
function restartBalade(){
 if(balade&&track.length)globalThis.BaladeMemoire?.archive({id:balade.id,startedAt:balade.startedAt,endedAt:Date.now(),walked:Math.round(walked),points:track.length});
 globalThis.globalThis.BaladeMemoire?.clearActive();balade=null;milestoneFloor=null;newBalade();
}
function finishBalade(){
 paused=false;if(gpsRunning)stopGps();
 if(!balade)return;
 const summary={id:balade.id,startedAt:balade.startedAt,endedAt:Date.now(),walked:Math.round(walked),points:track.length};
 try{
  globalThis.BaladeMemoire?.archive(summary);globalThis.BaladeMemoire?.clearActive();
 }catch{/* Sans stockage, la fin reste affichée à l'écran. */}
 balade=null;loopSession=null;track=[];walked=0;walkedSinceAnchor=0;countedFix=null;reanchorPending=false;
 refreshTrack();
 const when=new Date(summary.startedAt).toLocaleString('fr-FR',{dateStyle:'short',timeStyle:'short'});
 $('end-summary').textContent=`${fmtKm(summary.walked)} parcourus · ${summary.points} points · démarrée le ${when} · identifiant ${summary.id}`;
 const sheet=$('end-sheet');
 if(!sheet.open){try{sheet.showModal();}catch{sheet.setAttribute('open','');}}
}
// Bandeau hors trace et mode démo : seuls ces deux états affichent du texte en haut de l'écran.
function syncMode(){
 const body=document.body;if(!body)return;
 body.classList.toggle('is-off',!!offRoute);
 body.classList.toggle('is-demo',!!demoRunning);
}
// Zoom + / − : le niveau choisi reste jusqu'à ce que l'utilisateur le change.
function zoomBy(step){
 if(!mapReady)return;
 const z=Math.max(map.getMinZoom(),Math.min(map.getMaxZoom(),map.getZoom()+step));
 userZoom=z;follow=true;userMoveAt=0;
 map.easeTo({zoom:z,duration:300});
}
function status(message,warn=false){$('guidance').textContent=message;$('guidance').classList.toggle('warn',warn);}
function line(points){return {type:'Feature',properties:{},geometry:{type:'LineString',coordinates:points.map(p=>[p[1],p[0]])}};}
function atDistance(distance){
 const along=Math.max(0,Math.min(totalMeters,distance));
 let lo=0,hi=cumul.length-1;
 while(lo+1<hi){const mid=(lo+hi)>>1;if(cumul[mid]<=along)lo=mid;else hi=mid;}
 const index=Math.min(lo,active.points.length-2),f=segLengths[index]?Math.min(1,(along-cumul[index])/segLengths[index]):0;
 const a=active.points[index],b=active.points[index+1];
 return {along,index,fraction:f,point:[a[0]+f*(b[0]-a[0]),a[1]+f*(b[1]-a[1])]};
}
// Trace entre deux positions (mètres le long de la boucle), sans confondre avec le raccord du zéro.
function trailBetween(a,b){
 const s=atDistance(a),e=atDistance(b);
 return [s.point,...active.points.slice(s.index+1,e.index+1),e.point];
}
// Partie parcourue quand l'utilisateur marche à contre-sens : de sa position jusqu'au point d'entrée.
function reverseParts(projection){
 const entry=loopSession.entry.along,here=projection.along;
 if(loopSession.unwrapped>=totalMeters)return [trailBetween(0,totalMeters)];
 return here<=entry?[trailBetween(here,entry)]:[trailBetween(here,totalMeters),trailBetween(0,entry)];
}
function bearing(a,b){
 const p=rad(a[0]),q=rad(b[0]),d=rad(b[1]-a[1]);
 return Math.atan2(Math.sin(d)*Math.cos(q),Math.cos(p)*Math.sin(q)-Math.sin(p)*Math.cos(q)*Math.cos(d))*180/Math.PI;
}
function routeHeading(projection){
 const a=atDistance(LoopNavigation.modulo(projection.along-10,totalMeters)).point,b=atDistance(LoopNavigation.modulo(projection.along+30,totalMeters)).point;
 if(metres(a,b)<8)return heading??0;
 const target=bearing(a,b);
 heading=heading===null?target:heading+(((target-heading+540)%360)-180)*.25;
 return heading;
}
function camera(point,course,duration=650){
 // Sans bouton « Me suivre » : la carte revient suivre le marcheur après 8 s sans geste.
 if(!follow&&userMoveAt&&Date.now()-userMoveAt>8000)follow=true;
 if(!follow||!mapReady)return;
 // V7 : garder la position au-dessus du panneau flottant, y compris petit écran.
 const height=map.getContainer().clientHeight;
 const dock=$('navigation').getBoundingClientRect?.();
 const rect=map.getContainer().getBoundingClientRect?.();
 const offset=dock&&rect?Math.max(-height*.1,Math.min(height*.19,dock.top-rect.top-72-height/2)):height*.19;
 const view=window.BearImmersion?.camera?.()||{zoom:17.3,pitch:58};
 map.easeTo({center:[point[1],point[0]],zoom:userZoom??view.zoom,pitch:view.pitch,bearing:course,
   offset:[0,offset],duration,essential:false});
}
function positionMarker(point,reliable,course=0){
 marker.setLngLat([point[1],point[0]]).setRotation(reliable?course:0);
 marker.getElement().classList.toggle('uncertain',!reliable);
 marker.getElement().hidden=false;
}
function relativeProjection(projection){return {...projection,along:loopSession&&!demoRunning?loopSession.travelled:projection.along};}
function entryDisplay(){
 // Plus de confirmation manuelle : le sens se déduit du déplacement GPS (voir updateGpsDisplay).
 $('confirm-entry').hidden=true;
 $('entry-status').textContent=loopSession?(loopSession.direction<0?'Km 0 fixé ici · sens détecté à contre-sens de la flèche':'Km 0 fixé ici · sens détecté dans le sens de la flèche')+' · retour au point d’entrée':entryCandidate?'Sur la boucle · le sens se détecte en marchant quelques dizaines de mètres':'Départ libre · attends une position fiable sur la boucle';
}
function startLoop(candidate,direction){
 loopSession=LoopNavigation.advance(loopRoute,null,candidate,candidate.timestamp,direction);
 matched=candidate;map.getSource('start')?.setData({type:'Feature',properties:{},geometry:{type:'Point',coordinates:[matched.point[1],matched.point[0]]}});entryCandidate=null;entryDisplay();renderProgress(matched,lastFix);announceProgress(relativeProjection(matched),matched.timestamp);
 status(direction<0?'Sens détecté : tu marches à contre-sens de la flèche. Km 0 ici · suis la trace.':'Sens détecté : dans le sens de la flèche. Km 0 ici · suis la trace.');
}
function renderProgress(projection,point=projection.point){
 const relative=relativeProjection(projection);
 const pct=Math.max(0,Math.min(100,100*relative.along/totalMeters));
 if(demoRunning)nextMilestone(projection.along);
 $('progressbar').style.width=pct+'%';$('progressbar').setAttribute('aria-valuenow',Math.round(pct));
 $('progress').textContent=fmtKm(relative.along);$('remaining').textContent=fmtKm(totalMeters-relative.along);
 // Bandeau sans bouton : parcouru = distance marchée (détours compris), reste = trace restante.
 $('metres-walked').textContent=fmtKm(demoRunning?relative.along:walked);$('metres-left').textContent=fmtKm(totalMeters-relative.along);
 let done=[...active.points.slice(0,projection.index+1),projection.point];
 if(loopSession&&!demoRunning&&loopSession.direction<0){
  map.getSource('progress')?.setData({type:'Feature',properties:{},geometry:{type:'MultiLineString',coordinates:reverseParts(projection).map(p=>p.map(v=>[v[1],v[0]]))}});
  done=null;
 }else if(loopSession&&!demoRunning){
  const entry=loopSession.entry;
  done=[entry.point,...active.points.slice(entry.index+1,projection.index+1),projection.point];
  if(loopSession.unwrapped<=0)done=[entry.point,entry.point];
  else if(loopSession.complete||loopSession.unwrapped>=totalMeters||projection.along<entry.along){
   const end=loopSession.unwrapped>=totalMeters?entry:projection;
   const parts=[[entry.point,...active.points.slice(entry.index+1)],[...active.points.slice(0,end.index+1),end.point]];
   map.getSource('progress')?.setData({type:'Feature',properties:{},geometry:{type:'MultiLineString',coordinates:parts.map(p=>p.map(v=>[v[1],v[0]]))}});
   done=null;
  }else if(projection.along<entry.along)done=[entry.point,entry.point];
 }
 if(done){
 if(done.length===1)done.push(done[0]);
 map.getSource('progress')?.setData(line(done));
 }
 const course=routeHeading(projection)+(loopSession&&!demoRunning&&loopSession.direction<0?180:0);
 positionMarker(point,demoRunning||gpsReliable,course);camera(point,course,demoRunning?100:650);
}
function suspendProgress(message){
 rallyeFix=null;
 gpsReliable=false;entryCandidate=null;entryDisplay();cancelSpeech();
 $('off-alert').hidden=true;
 $('next-announcement').textContent='Annonces km suspendues · attente GPS fiable';
 milestonePending=null;
 offSince=null;lastOffSample=null;
 $('confidence').textContent='Progression suspendue · distances figées';
 if(lastFix)positionMarker(lastFix,false);
 status(message,true);
}
function resetSession(keepLoop=false){
 rallyeFix=null;
 if(!keepLoop)loopSession=null;
 // Balade reprise : le premier point retrouvé devient la nouvelle ancre (pas de saut compté).
 if(keepLoop&&loopSession)reanchorPending=true;
 entryCandidate=null;entryDisplay();
 map.getSource('start')?.setData({type:'Feature',properties:{},geometry:{type:'Point',coordinates:[active.points[0][1],active.points[0][0]]}});
 gpsReliable=false;
 if(!keepLoop)milestoneFloor=null;milestonePending=null;lastVoiceTime=-Infinity;
 $('next-announcement').textContent='Prochaine annonce : —';
 matched=null;heading=null;lastFix=null;lastSampleTime=0;offSince=null;lastOffSample=null;offRoute=false;
 $('off-alert').hidden=true;marker.getElement().hidden=true;
 $('progress').textContent='—';$('remaining').textContent=fmtKm(totalMeters);$('offset').textContent='—';$('accuracy').textContent='—';
 $('progressbar').style.width='0%';$('progressbar').setAttribute('aria-valuenow','0');
 map.getSource('progress')?.setData(line([active.points[0],active.points[0]]));
}
function audioLabel(){
 const on=audioEnabled&&gpsRunning&&!demoRunning;
 $('audio').textContent=on?'🔊 Annonces actives':'🔇 Annonces coupées';
 $('audio').setAttribute('aria-pressed',String(on));
}
function cancelSpeech(){
 speechToken++;speechBusy=false;
 try{window.speechSynthesis?.cancel();}catch{/* Audio facultatif. */}
 $('audio-status').textContent='Parole interrompue ou inactive · son selon Safari et volume.';
}
function voiceOccupied(){
 // Certains navigateurs ne rendent ni onend ni onerror : ne pas bloquer toute la marche.
 if(Date.now()-lastVoiceTime>=VOICE_TIMEOUT&&(speechBusy||window.speechSynthesis?.speaking))cancelSpeech();
 return speechBusy||!!window.speechSynthesis?.speaking||Date.now()-lastVoiceTime<VOICE_GAP;
}
function speak(text,priority=false,{test=false,onFailure=()=>{}}={}){
 if((!test&&(!audioEnabled||!gpsRunning))||demoRunning||document.hidden)return false;
 if(!window.speechSynthesis||typeof SpeechSynthesisUtterance==='undefined'){
  $('audio-status').textContent='Synthèse vocale indisponible · consulte le guidage visuel.';return false;
 }
 if(!priority&&voiceOccupied())return false;
 if(priority)cancelSpeech();
 const token=++speechToken;
 try{
  const u=new SpeechSynthesisUtterance(text);u.lang='fr-FR';
  const voices=window.speechSynthesis.getVoices?.()||[];
  const voice=voices.find(v=>/^fr[-_]/i.test(v.lang))||voices.find(v=>/^fr/i.test(v.lang));
  if(voice)u.voice=voice;
  speechBusy=true;lastVoiceTime=Date.now();
  $('audio-status').textContent='Parole demandée · écoute selon Safari et volume.';
  u.onend=()=>{if(token===speechToken){speechBusy=false;$('audio-status').textContent='Synthèse terminée · audibilité à vérifier à l’oreille.';}};
  u.onerror=()=>{if(token===speechToken){speechBusy=false;$('audio-status').textContent='Échec vocal · consulte le guidage visuel et teste le son.';onFailure();}};
  window.speechSynthesis.speak(u);return true;
 }catch{speechBusy=false;$('audio-status').textContent='Échec vocal · consulte le guidage visuel et teste le son.';return false;}
}
function toggleAudio(){
 audioChosen=true;audioEnabled=!audioEnabled;cancelSpeech();audioLabel();
  if(audioEnabled&&gpsRunning)speak('Annonces activées');
}
function testAudio(){
 if(demoRunning){$('audio-status').textContent='Démo silencieuse · arrête la démo pour tester le son.';return;}
 if(offRoute){$('audio-status').textContent='Priorité à l’alerte hors trace · test son différé.';return;}
 // Appel direct depuis le clic, sans attendre une promesse : geste explicite pour Safari.
 speak('Test du son. Les annonces sont en français.',false,{test:true});
}
function nextMilestone(along){
 const next=demoRunning?Math.floor(along/1000)+1:(milestoneFloor===null?Math.floor(along/1000)+1:milestoneFloor+1);
 $('next-announcement').textContent=next*1000<=totalMeters?'Prochaine annonce : '+next+' km':'Dernier kilomètre atteint';
}
function announceProgress(projection,timestamp){
 const km=Math.floor(projection.along/1000);
 if(milestoneFloor===null){milestoneFloor=km;milestonePending=null;nextMilestone(projection.along);return;}
 if(km<=milestoneFloor){milestonePending=null;nextMilestone(projection.along);return;}
 // Un franchissement doit être retrouvé dans deux mesures cohérentes espacées de 3 s.
 if(!milestonePending||milestonePending.km!==km||timestamp-milestonePending.last>GPS.maxAge){milestonePending={km,since:timestamp,last:timestamp};return;}
 milestonePending.last=timestamp;
 if(timestamp-milestonePending.since<3000)return;
 if(audioEnabled&&voiceOccupied())return;
 milestoneFloor=km;milestonePending=null;nextMilestone(projection.along);
 const number=new Intl.NumberFormat('fr-FR',{style:'unit',unit:'kilometer',unitDisplay:'long',maximumFractionDigits:0});
 const distance=number.format(km);
 const left=Math.max(0,totalMeters-projection.along);
 const remaining=left<1000?new Intl.NumberFormat('fr-FR',{style:'unit',unit:'meter',unitDisplay:'long',maximumFractionDigits:0}).format(Math.round(left/10)*10):number.format(Math.round(left/1000));
 speak(distance+' '+(km===1?'parcouru':'parcourus')+'. Il reste environ '+remaining+' sur la trace.');
}
function updateGpsDisplay(lat,lon,accuracy,timestamp=Date.now()){
 if(!gpsRunning||document.hidden)return;
 const now=Date.now();
 if(![lat,lon,accuracy,timestamp].every(Number.isFinite)||Math.abs(lat)>90||Math.abs(lon)>180||accuracy<=0){suspendProgress('Mesure GPS invalide. Attente du signal.');return;}
 if(now-timestamp>GPS.maxAge||timestamp>now+5000||timestamp<=lastSampleTime||timestamp<minFixTime){suspendProgress('Position GPS ancienne ou désordonnée ignorée.');return;}
 rallyeFix={latitude:lat,longitude:lon,accuracy,timestamp};
 gpsReliable=false;
 lastSampleTime=timestamp;clearTimeout(freshnessTimer);
 freshnessTimer=setTimeout(()=>{if(gpsRunning){$('signal').textContent='GPS sans mesure récente';suspendProgress('Signal GPS perdu. Attends une mesure récente.');}},Math.max(1,GPS.maxAge-(now-timestamp)));
 lastFix=[lat,lon];positionMarker(lastFix,false);
 $('accuracy').textContent=fmtM(accuracy);$('signal').textContent=accuracy>GPS.maxAccuracy?'GPS peu précis':'GPS actif';
 // Pause : la flèche reste visible, rien n'est compté ni enregistré.
 if(paused){positionMarker(lastFix,true,heading??0);camera(lastFix,heading??0);return;}
 if(accuracy<=GPS.maxAccuracy)countWalk(lat,lon,accuracy,timestamp);
 const {nearest,projection}=computeProgress(active.points,lastFix,matched,timestamp,accuracy);
 $('offset').textContent=fmtM(nearest.gap);
 if(accuracy>GPS.maxAccuracy){suspendProgress('Précision GPS insuffisante. Progression suspendue.');return;}
 const lowerGap=Math.max(0,nearest.gap-accuracy);
 if(lowerGap>GPS.offThreshold){
  milestonePending=null;
  if(offSince===null||lastOffSample===null||timestamp-lastOffSample>GPS.maxAge)offSince=timestamp;
  lastOffSample=timestamp;
  if(!offRoute&&timestamp-offSince>=GPS.confirmMs){offRoute=true;lastOffAlert=timestamp;$('off-alert').hidden=false;syncMode();speakAlert();}
 }else{
  offSince=null;lastOffSample=null;
  if(offRoute&&nearest.gap+accuracy<GPS.clearThreshold){offRoute=false;$('off-alert').hidden=true;syncMode();}
 }
 // Hors trace : le parcours continue d'être enregistré et suivi ; aucune progression n'est figée.
 if(offRoute){
  entryCandidate=null;entryDisplay();
  if(timestamp-lastOffAlert>=60000){lastOffAlert=timestamp;speakAlert();}
  $('off-alert').hidden=false;
  $('rejoin-text').textContent='Rejoins le tracé · '+fmtM(nearest.gap)+' de la ligne';
  $('confidence').textContent='Hors trace · parcours enregistré';
  offTraceDisplay(nearest);
  positionMarker(lastFix,true,heading??0);camera(lastFix,heading??0);
  status('Ton parcours est enregistré. Reprise automatique dès que tu rejoins le tracé.',true);
  return;
 }
 if(lowerGap>GPS.offThreshold){entryCandidate=null;entryDisplay();offTraceDisplay(nearest);positionMarker(lastFix,true,heading??0);camera(lastFix,heading??0);$('confidence').textContent='Écart à confirmer';return;}
 // Zone incertaine (proche de la trace sans projection nette) : on attend une mesure nette, sans message d'erreur.
 if(nearest.gap+accuracy>GPS.clearThreshold||!projection){offTraceDisplay(nearest);positionMarker(lastFix,false);camera(lastFix,heading??0);status(nearest.gap+accuracy>GPS.clearThreshold?'Proximité de la trace incertaine. Attends une meilleure mesure.':'Position ambiguë à un croisement. Le suivi reprend dès que la trace est nette.');return;}
 gpsReliable=true;
 if(!loopSession){
  entryCandidate=entryCandidate||{...projection,timestamp};
  // Sens déduit du déplacement réel depuis le premier point fiable : aucun bouton à toucher.
  const moved=LoopNavigation.delta(projection.along,entryCandidate.along,totalMeters);
  if(Math.abs(moved)<GPS.senseMeters){
   entryDisplay();
   const course=routeHeading(projection);positionMarker(lastFix,true,course);camera(lastFix,course);
   $('confidence').textContent='Départ à confirmer';status('Sur la boucle · marche quelques dizaines de mètres, le sens se détecte seul.');return;
  }
  startLoop(entryCandidate,moved>0?1:-1);
 }
 // Reprise après pause : le premier point retenu devient la nouvelle ancre, sans saut compté.
 if(reanchorPending){loopSession={...loopSession,previous:{...projection,timestamp}};reanchorPending=false;}
 loopSession=LoopNavigation.advance(loopRoute,loopSession,projection,timestamp);walkedSinceAnchor=0;
 matched={...projection,timestamp};renderProgress(matched,lastFix);
 announceProgress(relativeProjection(matched),timestamp);
 $('confidence').textContent='Projection indicative';
 status(loopSession.complete?'Tour terminé · retour au point d’entrée':loopSession.remaining<30?'Point d’entrée à proximité · retour en cours':'Suivre la trace');
}
function stopGps(){
 rallyeFix=null;
 entryCandidate=null;entryDisplay();gpsReliable=false;
 gpsRunning=false;releaseWakeLock();wakeStatus(wakeEnabled?'En attente du suivi GPS.':'Option désactivée.');gpsSession++;clearTimeout(freshnessTimer);freshnessTimer=null;
 cancelSpeech();milestonePending=null;audioLabel();
 if(watch!==null){navigator.geolocation.clearWatch(watch);watch=null;}
 $('toggle').textContent='Démarrer le GPS';$('toggle').setAttribute('aria-pressed','false');
 offSince=null;lastOffSample=null;$('off-alert').hidden=true;
 if(lastFix)positionMarker(lastFix,false);
 $('signal').textContent='GPS arrêté';$('confidence').textContent='Suivi arrêté';status('Suivi GPS arrêté. Démarrer le GPS réinitialise les distances et reprend une nouvelle session.');
}
function startGps(){
 if(gpsRunning||!active)return;
 if(!('geolocation' in navigator)){status('Géolocalisation non disponible dans ce navigateur.',true);return;}
 if(!window.isSecureContext){status('GPS : une adresse HTTPS ou localhost est nécessaire.',true);return;}
 stopDemo(false);beginBalade();resetSession(true);if(loopSession&&mapReady){try{renderProgress(loopSession.previous,loopSession.previous.point);}catch{/* Affichage rétabli au prochain relevé. */}}follow=true;gpsRunning=true;minFixTime=Date.now();const session=++gpsSession;
 if(!audioChosen)audioEnabled=true;
 void requestWakeLock();
 // Amorçage explicite après geste utilisateur ; la disponibilité audio dépend de Safari.
 audioLabel();speak('Suivi GPS démarré',true);
 $('toggle').textContent='Arrêter le GPS';$('toggle').setAttribute('aria-pressed','true');
 $('signal').textContent='GPS en attente';status('Recherche du signal GPS…');
 try{
  const id=navigator.geolocation.watchPosition(
   p=>{if(gpsRunning&&session===gpsSession)updateGpsDisplay(p.coords.latitude,p.coords.longitude,p.coords.accuracy,p.timestamp);},
   e=>{if(!gpsRunning||session!==gpsSession)return;
    if(e.code===1){stopGps();status('Autorisation GPS refusée. Autorise la localisation dans Safari puis redémarre le GPS.',true);}
    else{$('signal').textContent='GPS en attente';suspendProgress(e.code===2?'Position GPS introuvable. Attente du signal.':'Délai GPS dépassé. Attente du signal.');}},
   {enableHighAccuracy:true,maximumAge:0,timeout:25000});
  if(gpsRunning&&session===gpsSession)watch=id;else navigator.geolocation.clearWatch(id);
 }catch{stopGps();status('Impossible de démarrer le GPS. Vérifie les permissions du navigateur.',true);}
}
function stopDemo(message=true){
 clearInterval(demoTimer);demoTimer=null;demoRunning=false;demoPaused=false;syncMode();
 $('demo-banner').hidden=true;$('demo-pause').hidden=true;$('demo-stop').hidden=true;
 $('demo').setAttribute('aria-pressed','false');
 if(message){resetSession(true);$('signal').textContent='GPS inactif';$('confidence').textContent='Démo arrêtée';status('Démo arrêtée. Démarre le GPS pour marcher.');}
}
function demoTick(now=performance.now()){
 if(!demoRunning)return;
 const elapsed=Math.max(0,Math.min(1000,now-demoLast));demoLast=now;
 if(demoPaused)return;
 demoAlong=Math.min(totalMeters,demoAlong+elapsed/1000*DEMO_SPEED);
 renderProgress(atDistance(demoAlong));
 if(demoAlong>=totalMeters){demoPaused=true;clearInterval(demoTimer);demoTimer=null;$('demo-pause').textContent='Rejouer';$('demo-banner').textContent='DÉMONSTRATION · TERMINÉE';status('Fin de la démonstration — aucun GPS utilisé');}
}
function startDemo(){
 if(!active)return;
 if(gpsRunning)stopGps();stopDemo(false);resetSession(true);
 cancelSpeech();demoRunning=true;syncMode();audioLabel();demoAlong=0;demoLast=performance.now();follow=true;
 $('demo-banner').hidden=false;$('demo-banner').textContent='DÉMONSTRATION · ×10 · GPS INACTIF';
 $('demo-pause').hidden=false;$('demo-pause').textContent='Pause';$('demo-stop').hidden=false;
 $('demo').setAttribute('aria-pressed','true');$('signal').textContent='GPS inactif · Démo';
 $('confidence').textContent='Simulation sur la trace';status('Suivre la trace');
 renderProgress(atDistance(0));demoTimer=setInterval(demoTick,100);
}
function overview(){
 follow=false;
 const bounds=new maplibregl.LngLatBounds();active.points.forEach(p=>bounds.extend([p[1],p[0]]));
 const dock=$('navigation').getBoundingClientRect?.();
 const rect=map.getContainer().getBoundingClientRect?.();
 const padding=dock&&rect?{top:210,bottom:Math.max(45,rect.bottom-dock.top+20),left:36,right:36}:45;
 map.fitBounds(bounds,{padding,pitch:0,bearing:0,duration:700});
}
function resumeFollow(){
 follow=true;
 const projection=demoRunning?atDistance(demoAlong):matched;
 const point=lastFix||projection?.point||active.points[0];
 camera(point,projection?routeHeading(projection):bearing(active.points[0],atDistance(35).point));
}
function updateConnection(){
 $('connection').textContent=navigator.onLine===false?'Hors ligne : fond indisponible. Coque + trace seulement.':'Fond OpenFreeMap · connexion Internet nécessaire';
}
async function prepareOffline(){
 if(!('serviceWorker' in navigator)||!window.isSecureContext){$('offline-status').textContent='Cache PWA indisponible : HTTPS ou localhost requis.';return;}
 try{
  navigator.serviceWorker.addEventListener('message',e=>{if(e.data?.type==='SHELL_STATUS')$('offline-status').textContent=e.data.ready?'Coque + trace hors ligne prêtes · aucune tuile cachée':'Cache incomplet : recharge avec Internet';});
  const check=()=>navigator.serviceWorker.controller?.postMessage({type:'CHECK_SHELL'});
  navigator.serviceWorker.addEventListener('controllerchange',check);
  await navigator.serviceWorker.register('./sw.js');
  const registration=await navigator.serviceWorker.ready;registration.active?.postMessage({type:'CHECK_SHELL'});
 }catch{$('offline-status').textContent='Cache hors ligne indisponible. Reste connecté.';}
}
async function main(){
 updateConnection();prepareOffline();
 try{
  const response=await fetch('./data/parcours.json');if(!response.ok)throw Error('Trace indisponible');
  const bytes=await response.arrayBuffer();
  const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
  if(hash!=='ea1e3ff2c2cc3d260df96eedc6ca8b1b6b2b76ffbbcfd3f5583fcefd3599e0f3')throw Error('Empreinte de la trace incorrecte');
  const data=JSON.parse(new TextDecoder().decode(bytes));
  if(data.parcours?.id!=='clisson-2026-11-01'||data.points?.length!==1686)throw Error('Identité de trace incorrecte');
  active={...data,points:data.points.map(p=>[p[0],p[1]])};
  loopRoute=LoopNavigation.prepare(active.points);
  cumul=[0];segLengths=[];
  for(let i=1;i<active.points.length;i++){const d=metres(active.points[i-1],active.points[i]);segLengths.push(d);cumul.push(cumul[i-1]+d);}
  totalMeters=cumul.at(-1);$('total').textContent=fmtKm(totalMeters);$('remaining').textContent=fmtKm(totalMeters);
  const first=active.points[0];
  map=new maplibregl.Map({container:'map',style:FALLBACK_STYLE,
   center:[first[1],first[0]],zoom:17.3,pitch:58,bearing:bearing(first,atDistance(35).point),attributionControl:{compact:false}});
  const el=document.createElement('div');el.className='user-arrow';el.setAttribute('aria-label','Position indicative');el.hidden=true;
  marker=new maplibregl.Marker({element:el,rotationAlignment:'map',pitchAlignment:'viewport'}).setLngLat([first[1],first[0]]).addTo(map);
  const addTrace=()=>{
   if(map.getSource('route'))return;
   map.addSource('route',{type:'geojson',data:line(active.points)});
   map.addSource('progress',{type:'geojson',data:line([first,first])});
   map.addSource('track',{type:'geojson',data:line([first,first])});
   for(const [id,source,color,width] of [['route-halo','route','#FFF9F3',13],['route-bright','route','#1F4E79',8],['progress-halo','progress','#FFF9F3',10],['progress-bright','progress','#8EC9F3',5],['track-line','track','#C96E4B',4]]){
    map.addLayer({id,type:'line',source,layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':color,'line-width':width}});
   }
   for(const [id,p,color] of [['start',loopSession?.entry.point||first,'#C96E4B'],['end',active.points.at(-1),'#7FA36A']]){
    map.addSource(id,{type:'geojson',data:{type:'Feature',properties:{},geometry:{type:'Point',coordinates:[p[1],p[0]]}}});
    map.addLayer({id,type:'circle',source:id,paint:{'circle-radius':6,'circle-color':color,'circle-stroke-color':'#fff','circle-stroke-width':2}});
   }
  };
  map.on('style.load',()=>{clearTimeout(styleTimer);addTrace();mapReady=true;
   if(demoRunning)renderProgress(atDistance(demoAlong));else if(matched)renderProgress(matched,lastFix||matched.point);
   else if(follow)camera(first,bearing(first,atDistance(35).point));
  });
  map.on('error',()=>{$('connection').textContent='Fond indisponible ou incomplet · trace conservée';});
  map.on('resize',()=>{if(follow&&mapReady)resumeFollow();});
  map.on('dragstart',e=>{if(e.originalEvent){follow=false;userMoveAt=Date.now();}});
  map.on('zoomstart',e=>{if(e.originalEvent){follow=false;userMoveAt=Date.now();}});
  map.on('zoomend',e=>{if(e.originalEvent)userZoom=map.getZoom();});
  // Coque + trace prêtes même sans réseau : ne jamais attendre le style distant pour le GPS.
  await new Promise(resolve=>map.on('load',resolve));addTrace();mapReady=true;refreshTrack();
  window.BearPhotoSpots?.start(map,maplibregl.Marker);
  window.BearPlacesMap?.start(map,maplibregl.Marker);
  // Dézoom minimal : la trace entière tient à l'écran (vue d'ensemble), sans bouton dédié.
  try{const b=new maplibregl.LngLatBounds();active.points.forEach(p=>b.extend([p[1],p[0]]));const cam=map.cameraForBounds(b,{padding:40,pitch:0,bearing:0});if(cam?.zoom)map.setMinZoom(Math.max(10,cam.zoom-.1));}catch{/* Bornes de zoom par défaut. */}
  $('fit').onclick=overview;$('center').onclick=resumeFollow;
  $('zoom-in').onclick=()=>zoomBy(1);$('zoom-out').onclick=()=>zoomBy(-1);
  $('pause-open').onclick=openPauseSheet;
  $('pause-resume').onclick=()=>{$('pause-sheet').close();};
  $('pause-carnet').onclick=()=>{keepPaused=true;$('pause-sheet').close();$('rallye-open')?.click();};
  $('pause-end').onclick=()=>{$('pause-sheet').close();finishBalade();};
  $('pause-sheet').onclose=()=>{if(!keepPaused&&paused)resumeRecording();};
  $('end-close').onclick=()=>$('end-sheet').close();
  // Balade en cours trouvée à l'ouverture : reprendre ou terminer, jamais de reprise silencieuse.
  $('resume-continue').onclick=()=>{$('resume-sheet').close();$('enter')?.click?.();};
  $('resume-finish').onclick=()=>{$('resume-sheet').close();const pending=loadSavedBalade();if(pending){restoreBalade(pending);finishBalade();}};
  const pendingBalade=loadSavedBalade();
  if(pendingBalade){
   $('resume-summary').textContent=`Identifiant ${pendingBalade.id} · ${fmtKm(Number(pendingBalade.walked)||0)} parcourus · démarrée le ${new Date(pendingBalade.startedAt).toLocaleString('fr-FR',{dateStyle:'short',timeStyle:'short'})}`;
   const sheet=$('resume-sheet');if(!sheet.open){try{sheet.showModal();}catch{sheet.setAttribute('open','');}}
  }
    $('audio').onclick=toggleAudio;
  $('audio-test').onclick=testAudio;
  $('wake').onclick=toggleWakeLock;
 $('reset-gps').onclick=()=>{if(gpsRunning)stopGps();restartBalade();startGps();};
 $('toggle').onclick=()=>gpsRunning?stopGps():startGps();$('demo').onclick=startDemo;
  $('demo-stop').onclick=()=>stopDemo();
  $('demo-pause').onclick=()=>{
   if(demoAlong>=totalMeters){startDemo();return;}
   demoPaused=!demoPaused;demoLast=performance.now();$('demo-pause').textContent=demoPaused?'Reprendre':'Pause';
   clearInterval(demoTimer);demoTimer=demoPaused?null:setInterval(demoTick,100);
   $('demo-banner').textContent=demoPaused?'DÉMONSTRATION · EN PAUSE':'DÉMONSTRATION · ×10 · GPS INACTIF';
  };
  for(const id of ['fit','center','toggle','demo','reset-gps'])$(id).disabled=false;
  entryDisplay();status('Départ libre sur la boucle · GPS ou Démo au choix.');resumeFollow();
  // Échec distant : le style local et les couches de trace restent disponibles.
  fetch(STYLE,{cache:'no-store'}).then(r=>{if(!r.ok)throw Error();return r.json();}).then(style=>{
   // Le style officiel fournit ses sources, sprites et glyphes.
   mapReady=false;
   styleTimer=setTimeout(()=>{
    if(mapReady)return;
    $('connection').textContent='Fond distant indisponible · trace seule disponible';
    map.setStyle(FALLBACK_STYLE);
   },12000);
   map.setStyle(style); // OpenFreeMap Liberty inclut building-3d.
  }).catch(()=>{$('connection').textContent='Fond indisponible · trace seule disponible';});
 }catch(error){status('Navigation indisponible : '+error.message,true);$('confidence').textContent='Erreur de chargement';}
}
window.addEventListener('online',updateConnection);window.addEventListener('offline',updateConnection);
window.addEventListener('pagehide',()=>{saveBalade();if(gpsRunning)stopGps();if(demoRunning)stopDemo();});
document.addEventListener('visibilitychange',()=>{if(document.hidden)saveBalade();});
document.addEventListener('visibilitychange',()=>{
 if(document.hidden){
  releaseWakeLock();
  if(wakeEnabled)wakeStatus('Application masquée : maintien écran suspendu.');
  cancelSpeech();milestonePending=null;
  if(gpsRunning){$('signal').textContent='GPS possiblement interrompu';suspendProgress('Application masquée : GPS possiblement perdu, alertes non garanties.');}
  if(demoRunning&&!demoPaused)$('demo-pause').click();
 }else if(gpsRunning){
  minFixTime=Date.now();clearTimeout(freshnessTimer);
  suspendProgress('Retour au premier plan : attente d’une mesure GPS récente.');
  $('signal').textContent='GPS en attente';status('Retour au premier plan : attente d’une mesure GPS récente.',true);
  void requestWakeLock();
 }
});
main();
