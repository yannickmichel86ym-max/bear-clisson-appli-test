'use strict';
/*
 * V14 · Miel le long du parcours : gouttes dorées sur la trace, ramassées en marchant.
 * - Position lue passivement (GPS réel fiable ou position de la démo), aucune nouvelle demande de position.
 * - Stockage local : seuls les identifiants des gouttes ramassées. Aucune position enregistrée, aucun envoi.
 * - Pas d'arrêt requis : ramasser se fait en marchant normalement.
 */
(function(root){
  const PICK_M=25, MAX_ACCURACY_M=30, MAX_AGE_MS=15000, POLL_MS=2000, KEY='bear-miel-v2', MAX_STORED=500;
  const finite=(n,min,max)=>typeof n==='number'&&Number.isFinite(n)&&n>=min&&n<=max;

  function haversine(a,b){
    const R=6371008.8,rad=Math.PI/180,dLat=(b.latitude-a.latitude)*rad,dLon=(b.longitude-a.longitude)*rad;
    const h=Math.sin(dLat/2)**2+Math.cos(a.latitude*rad)*Math.cos(b.latitude*rad)*Math.sin(dLon/2)**2;
    return 2*R*Math.asin(Math.min(1,Math.sqrt(h)));
  }
  // Position exploitable : valide, précise (≤ 30 m) et récente. Sinon null, jamais estimée.
  function readFix(fix,now=Date.now()){
    if(!fix||!finite(fix.latitude,-90,90)||!finite(fix.longitude,-180,180))return null;
    if(!finite(fix.accuracy,0,MAX_ACCURACY_M)||fix.accuracy===0)return null;
    if(!finite(fix.timestamp,0,Infinity)||now-fix.timestamp>MAX_AGE_MS||fix.timestamp-now>5000)return null;
    return fix;
  }
  // Ramassage : la goutte est à moins de 25 m, marge d'incertitude de la position comprise.
  function collectable(drop,fix,now=Date.now()){
    const ok=readFix(fix,now);
    return !!ok&&haversine(ok,drop)+ok.accuracy/2<=PICK_M;
  }
  function dropsFrom(list){
    return (Array.isArray(list)?list:[]).filter(g=>Array.isArray(g)&&g.length>=3&&finite(g[0],46.9,47.3)&&finite(g[1],-1.6,-1.0))
      .map((g,i)=>({id:'miel-'+String(i).padStart(3,'0'),latitude:g[0],longitude:g[1],metres:g[2]}));
  }
  function loadPicked(storage){
    try{
      const v=JSON.parse(storage?.getItem(KEY)||'null');
      const ids=Array.isArray(v?.ids)?v.ids.filter(x=>typeof x==='string'&&/^miel-\d{3}$/.test(x)):[];
      return new Set(ids.slice(-MAX_STORED));
    }catch{return new Set();}
  }
  function savePicked(storage,picked){
    try{storage?.setItem(KEY,JSON.stringify({ids:[...picked].slice(-MAX_STORED)}));return true;}catch{return false;}
  }
  function toFeatures(drops,picked){
    return {type:'FeatureCollection',features:drops.filter(d=>!picked.has(d.id))
      .map(d=>({type:'Feature',properties:{id:d.id},geometry:{type:'Point',coordinates:[d.longitude,d.latitude]}}))};
  }

  function attach(ui,{map,document:doc,window:win=root,storage=null,getFix=()=>win.bearRallyeFix?.()||win.bearDemoFix?.(),drops=root.BearMielGouttes?.GOUTTES}={}){
    const el=id=>doc.getElementById(id);
    const list=dropsFrom(drops),picked=loadPicked(storage),byId=new Map(list.map(d=>[d.id,d]));
    const SOURCE='bear-miel';
    const toast=msg=>{const t=el('decouverte-toast');if(!t)return;t.textContent=msg;t.hidden=false;};
    // Réserve disponible = gouttes ramassées moins le miel déjà offert aux oursons.
    const spent=()=>{try{const n=Number(storage?.getItem('bear-miel-spent-v1')||0);return Number.isFinite(n)&&n>0?Math.floor(n):0;}catch{return 0;}};
    const available=()=>Math.max(0,picked.size-spent());
    const count=()=>{const c=el('miel-count');if(c)c.textContent=(available()<=1?'🍯 '+available()+' goutte de miel':'🍯 '+available()+' gouttes de miel')+' dans ta réserve';};
    function draw(){
      try{
        const data=toFeatures(list,picked);
        if(!map.getSource?.(SOURCE)){
          map.addSource(SOURCE,{type:'geojson',data});
          map.addLayer({id:SOURCE+'-halo',source:SOURCE,type:'circle',paint:{'circle-radius':11,'circle-color':'#F4D77A','circle-opacity':0.45,'circle-blur':0.6}});
          map.addLayer({id:SOURCE+'-goutte',source:SOURCE,type:'circle',paint:{'circle-radius':5.5,'circle-color':'#E8A317','circle-stroke-color':'#FFF9F3','circle-stroke-width':2}});
        }
        map.getSource(SOURCE)?.setData?.(data);
      }catch{ /* style en cours de chargement : le ramassage reste possible */ }
    }
    // Son discret « ring » à chaque goutte, synthétisé (aucun fichier). Débloqué au premier toucher (iOS).
    let audioCtx=null;
    function unlockSound(){
      try{
        const AC=win.AudioContext||win.webkitAudioContext;if(!AC)return;
        audioCtx=audioCtx||new AC();
        if(audioCtx.state==='suspended')audioCtx.resume?.();
      }catch{/* Son indisponible : le ramassage reste visible. */}
    }
    function chime(){
      try{
        if(!audioCtx||audioCtx.state!=='running')return;
        const t=audioCtx.currentTime;
        for(const [freq,delay] of [[1318,0],[1760,0.07]]){
          const o=audioCtx.createOscillator(),g=audioCtx.createGain();
          o.type='sine';o.frequency.setValueAtTime(freq,t+delay);
          g.gain.setValueAtTime(0.0001,t+delay);
          g.gain.exponentialRampToValueAtTime(0.14,t+delay+0.01);
          g.gain.exponentialRampToValueAtTime(0.0001,t+delay+0.18);
          o.connect(g).connect(audioCtx.destination);o.start(t+delay);o.stop(t+delay+0.2);
        }
      }catch{/* Son indisponible : rien à faire. */}
    }
    function tick(fix=getFix(),now=Date.now()){
      const ok=readFix(fix,now);
      if(!ok||doc.hidden)return [];
      const got=[];
      for(const d of list){
        if(picked.has(d.id))continue;
        if(collectable(d,ok,now)){picked.add(d.id);got.push(d.id);}
      }
      if(got.length){
        savePicked(storage,picked);
        toast(got.length===1?'🍯 Une goutte de miel ramassée !':'🍯 '+got.length+' gouttes de miel ramassées !');
        chime();
        try{win.navigator?.vibrate?.(30);}catch{}
        count();draw();
      }
      return got;
    }
    count();draw();
    doc.addEventListener?.('pointerdown',unlockSound,{passive:true});
    map.on?.('style.load',draw);
    const timer=win.setInterval?.(()=>{if(!doc.hidden)tick();},POLL_MS);
    return {tick,picked:()=>new Set(picked),remaining:()=>list.length-picked.size,refresh:count,available,stop(){win.clearInterval?.(timer);}};
  }
  function start(ui,{map}){
    const doc=root.document;let storage=null;try{storage=root.localStorage;}catch{}
    const controller=attach(ui,{map,document:doc,window:root,storage});
    api.controller=controller;return controller;
  }
  const api={PICK_M,MAX_ACCURACY_M,KEY,haversine,readFix,collectable,dropsFrom,loadPicked,savePicked,toFeatures,attach,start};
  if(typeof module!=='undefined')module.exports=api;else root.BearMiel=api;
})(typeof window==='undefined'?globalThis:window);
