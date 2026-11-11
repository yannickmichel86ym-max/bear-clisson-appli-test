/* API pure : aucune géolocalisation, horloge, carte ou mutation des données source. */
(function(root){
 'use strict';
 const rad=d=>d*Math.PI/180;
 const metres=(a,b)=>{const h=Math.sin(rad(b[0]-a[0])/2)**2+Math.cos(rad(a[0]))*Math.cos(rad(b[0]))*Math.sin(rad(b[1]-a[1])/2)**2;return 12742017.6*Math.atan2(Math.sqrt(h),Math.sqrt(Math.max(0,1-h)));};
 const modulo=(x,l)=>((x%l)+l)%l;
 const delta=(a,b,l)=>modulo(a-b+l/2,l)-l/2;
 function prepare(points){
  if(!Array.isArray(points)||points.length<2||points.some(p=>!Array.isArray(p)||!p.slice(0,2).every(Number.isFinite)))throw Error('Trace invalide');
  const lengths=[],cumul=[0];
  for(let i=1;i<points.length;i++){lengths.push(metres(points[i-1],points[i]));cumul.push(cumul[i-1]+lengths[i-1]);}
  const total=cumul[cumul.length-1];if(!total)throw Error('Trace vide');
  return {points:points.map(p=>p.slice(0,2)),lengths,cumul,total,seamGap:metres(points[0],points[points.length-1])};
 }
 // walkBound : distance réellement marchée depuis la dernière position retenue sur le tracé.
 // On ne peut pas se retrouver plus loin sur le tracé que ce chemin marché (+ marge de précision).
 function project(route,here,previous,timestamp,accuracy,walkBound=0){
  const {points,cumul,lengths,total}=route,candidates=[];
  const kx=111195*Math.cos(rad(here[0]));
  for(let i=0;i<points.length-1;i++){
   const a=points[i],b=points[i+1],ax=(a[1]-here[1])*kx,ay=(a[0]-here[0])*111195,dx=(b[1]-a[1])*kx,dy=(b[0]-a[0])*111195,den=dx*dx+dy*dy;
   const f=den?Math.max(0,Math.min(1,-(ax*dx+ay*dy)/den)):0;
   candidates.push({gap:Math.hypot(ax+f*dx,ay+f*dy),along:cumul[i]+lengths[i]*f,index:i,fraction:f,point:[a[0]+f*(b[0]-a[0]),a[1]+f*(b[1]-a[1])]});
  }
  const nearest=candidates.reduce((a,b)=>a.gap<=b.gap?a:b);
  if(!Number.isFinite(accuracy)||accuracy<=0||accuracy>45)return {nearest,projection:null,reason:'accuracy'};
  if(nearest.gap+accuracy>50)return {nearest,projection:null,reason:'outside'};
  const plausible=candidates.filter(c=>c.gap<=nearest.gap+Math.max(8,accuracy));
  const unambiguous=()=>!plausible.some(c=>Math.abs(delta(c.along,nearest.along,total))>100);
  let choice;
  if(previous){
   const reach=25+Math.min(30,Math.max(0,(timestamp-previous.timestamp)/1000))*2.5+Math.min(20,accuracy);
   const nearby=plausible.filter(c=>Math.abs(delta(c.along,previous.along,total))<=reach);
   const score=c=>{const d=delta(c.along,previous.along,total);return c.gap+Math.abs(d)*(d<0?.8:.15);};
   choice=nearby.sort((a,b)=>score(a)-score(b))[0];
   if(choice&&nearby.some(c=>Math.abs(delta(c.along,choice.along,total))>100))choice=null;
   // Reprise après un détour : accepté seulement si le chemin marché depuis l'ancre le permet.
   // Une téléportation (saut sans marche) reste refusée.
   const jump=Math.abs(delta(nearest.along,previous.along,total));
   if(!choice&&unambiguous()&&jump<=walkBound+2*accuracy+20)choice={...nearest,reacquired:true};
  }else if(unambiguous())choice=nearest;
  return {nearest,projection:choice||null,reason:choice?(choice.reacquired?'reacquired':'ok'):'ambiguous'};
 }
 // direction : +1 = sens de la flèche, -1 = à contre-sens. Déduit du déplacement GPS par navigation.js.
 function advance(route,state,projection,timestamp,direction=state?.direction??1){
  if(!state)return {entry:projection,previous:{...projection,timestamp},unwrapped:0,travelled:0,remaining:route.total,complete:false,direction};
  const raw=state.unwrapped+delta(projection.along,state.previous.along,route.total)*direction;
  // Une reprise après détour ne fait jamais reculer l'avancement sur le tracé.
  const unwrapped=projection.reacquired&&raw<state.unwrapped?state.unwrapped:raw;
  const travelled=Math.max(0,Math.min(route.total,unwrapped));
  const atReturn=unwrapped>=route.total&&Math.abs(delta(projection.along,state.entry.along,route.total))<=25;
  const returnSince=atReturn?(state.returnSince!=null&&timestamp-state.previous.timestamp<=15000?state.returnSince:timestamp):null;
  const complete=state.complete||(returnSince!=null&&timestamp-returnSince>=3000);
  return {...state,unwrapped,returnSince,previous:{...projection,timestamp},travelled:state.complete?route.total:travelled,remaining:state.complete?0:route.total-travelled,complete,direction};
 }
 const api={prepare,project,advance,delta,modulo};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.LoopNavigation=api;
})(globalThis);
