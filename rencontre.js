'use strict';
/*
 * V14 · Rencontre avec un ours : fiche 3D, miel offert à l'arrêt, fuite si l'enfant court.
 * - Vitesse calculée sur les positions déjà lues (GPS réel fiable, ou démo). Aucune position stockée.
 * - Capture seulement à l'arrêt. Si l'enfant court, l'ours s'enfuit (sans sanction).
 * - La photo de l'ours (rendu 3D) est gardée localement : seul l'ours rencontré a une photo.
 */
(function(root){
  const CALM_MPS=0.3, FLEE_MPS=2.2, WINDOW_MS=5000, POLL_MS=500, FEED_S=2.5, TIMEOUT_MS=60000, PHOTOS_KEY='bear-photos-v1', SPENT_KEY='bear-miel-spent-v1';
  const SAFETY='Attention à votre sécurité : ne laissez pas l’appli vous faire perdre votre vigilance. Restez attentif à ce qui vous entoure. Vous restez responsable de vos enfants.';

  function haversine(a,b){
    const R=6371008.8,rad=Math.PI/180,dLat=(b.latitude-a.latitude)*rad,dLon=(b.longitude-a.longitude)*rad;
    const h=Math.sin(dLat/2)**2+Math.cos(a.latitude*rad)*Math.cos(b.latitude*rad)*Math.sin(dLon/2)**2;
    return 2*R*Math.asin(Math.min(1,Math.sqrt(h)));
  }
  // Vitesse moyenne sur la fenêtre récente : distance parcourue / durée. Moins de 2 points : null.
  function speedFrom(samples,now=Date.now()){
    const recent=(samples||[]).filter(s=>s&&now-s.t<=WINDOW_MS&&now-s.t>=0).sort((a,b)=>a.t-b.t);
    if(recent.length<2)return null;
    const a=recent[0],b=recent[recent.length-1],dt=(b.t-a.t)/1000;
    if(dt<=0)return null;
    return haversine(a,b)/dt;
  }
  function stateFor(speed){
    if(speed===null)return 'wait';
    if(speed>=FLEE_MPS)return 'flee';
    if(speed<CALM_MPS)return 'calm';
    return 'moving';
  }
  function loadNumber(storage,key){try{const n=Number(storage?.getItem(key)||0);return Number.isFinite(n)&&n>=0?Math.floor(n):0;}catch{return 0;}}
  function saveNumber(storage,key,n){try{storage?.setItem(key,String(Math.max(0,Math.floor(n))));return true;}catch{return false;}}
  function disponible(picked,spent){return Math.max(0,(picked||0)-(spent||0));}

  function loadPhotos(storage){
    try{
      const v=JSON.parse(storage?.getItem(PHOTOS_KEY)||'{}');
      const out={};
      for(const [id,url] of Object.entries(v||{}))if(/^ourson-[a-z-]+$/.test(id)&&typeof url==='string'&&url.startsWith('data:image/png;base64,')&&url.length<200000)out[id]=url;
      return out;
    }catch{return {};}
  }
  function savePhotos(storage,photos){try{storage?.setItem(PHOTOS_KEY,JSON.stringify(photos));return true;}catch{return false;}}

  // Session de rencontre : machine à états simple, testable sans DOM.
  function session({now=()=>Date.now()}={}){
    let phase='approach',since=now();
    return {
      phase:()=>phase,
      tick(speed){
        const s=stateFor(speed);
        if(phase==='feeding'||phase==='done'||phase==='fled'||phase==='timeout')return phase;
        if(s==='flee'){phase='fled';return phase;}
        if(now()-since>TIMEOUT_MS){phase='timeout';return phase;}
        phase=s==='calm'?'calm':'approach';
        return phase;
      },
      feed(honey){
        if(phase!=='calm'||honey<=0)return false;
        phase='feeding';return true;
      },
      finish(){if(phase==='feeding')phase='done';return phase;}
    };
  }

  const api={CALM_MPS,FLEE_MPS,WINDOW_MS,FEED_S,TIMEOUT_MS,SAFETY,PHOTOS_KEY,SPENT_KEY,haversine,speedFrom,stateFor,loadNumber,saveNumber,disponible,loadPhotos,savePhotos,session};

  // ---- Interface (navigateur uniquement) ----
  function mount(doc,win,deps){
    const el=id=>doc.getElementById(id);
    const dlg=el('rencontre');if(!dlg)return null;
    let current=null,poll=null,scene=null,samples=[],sess=null,sceneLoader=null;
    const storage=deps.storage;
    const status=t=>{const s=el('rencontre-status');if(s)s.textContent=t;};
    const honeyLeft=()=>disponible(deps.picked(),loadNumber(storage,SPENT_KEY));
    function paint(speed){
      const left=honeyLeft(),phase=sess?sess.phase():'approach';
      const feed=el('rencontre-feed');
      if(feed){feed.disabled=!(phase==='calm'&&left>0);feed.textContent='Offrir du miel 🍯 ('+left+')';}
      const st=stateFor(speed);
      const msg={calm:'Il s’approche doucement. Offre-lui du miel !',moving:'Arrête-toi un instant, il approche…',flee:'Tu cours trop vite : il s’enfuit. Reste calme pour le revoir.',wait:'L’Ours te regarde…'}[st];
      if(phase==='feeding')status('Il mange le miel…');
      else if(left===0&&phase==='calm')status('Tu n’as plus de miel. Ramasse les gouttes dorées sur le chemin, puis reviens !');
      else status(msg);
    }
    async function loadScene(){
      if(scene)return scene;
      if(!sceneLoader)sceneLoader=import('./bear3d.js');
      const mod=await sceneLoader;
      const canvas=el('rencontre-canvas');
      scene=mod.createBearScene(canvas,current.index,{size:240});
      return scene;
    }
    function close(reason){
      clearInterval(poll);poll=null;
      try{scene?.stop?.();}catch{}
      if(dlg.open)try{dlg.close();}catch{}
      if(reason)deps.toast(reason);
      current=null;
    }
    async function open(bear,{index,onCaught}){
      current={bear,index,onCaught};samples=[];sess=session();
      el('rencontre-title').textContent=bear.nom;
      el('rencontre-safety').textContent=SAFETY;
      if(!dlg.open)try{dlg.showModal();}catch{dlg.setAttribute('open','');}
      status('L’Ours te regarde…');
      try{const s=await loadScene();s.start();}catch{status('L’Ours ne peut pas apparaître sur cet appareil pour l’instant.');}
      poll=setInterval(()=>tick(),POLL_MS);tick();
    }
    function tick(){
      if(!current)return;
      const fix=deps.getFix();
      if(fix){samples.push({lat:fix.latitude,lon:fix.longitude,t:Date.now()});samples=samples.filter(s=>Date.now()-s.t<=WINDOW_MS*2);}
      const speed=speedFrom(samples.map(s=>({latitude:s.lat,longitude:s.lon,t:s.t})),Date.now());
      const phase=sess.tick(speed);
      if(phase==='fled'){deps.onFled?.(current.bear);close(current.bear.nom+' s’est enfui. Reste calme : il reviendra.');return;}
      if(phase==='timeout'){close(current.bear.nom+' est reparti. Il reviendra peut-être.');return;}
      paint(speed);
    }
    function feed(){
      const left=honeyLeft();
      if(!sess.feed(left))return;
      saveNumber(storage,SPENT_KEY,loadNumber(storage,SPENT_KEY)+1);
      deps.onHoneySpent?.();
      clearInterval(poll);poll=null;
      scene?.eat?.(FEED_S);
      paint(null);
      setTimeout(()=>{
        // Au moment où il part : photo du rendu 3D, puis entrée dans le carnet.
        const photo=scene?.snapshot?.()||null;
        sess.finish();
        const bear=current.bear,done=current.onCaught;
        close(null);
        if(photo){const photos=loadPhotos(storage);photos[bear.id]=photo;savePhotos(storage,photos);}
        done?.(photo);
      },FEED_S*1000);
    }
    el('rencontre-feed')&&(el('rencontre-feed').onclick=feed);
    el('rencontre-leave')&&(el('rencontre-leave').onclick=()=>{close('Tu laisses '+(current?current.bear.nom:'l’Ours')+' tranquille.');});
    dlg.addEventListener('close',()=>{clearInterval(poll);poll=null;try{scene?.stop?.();}catch{}current=null;});
    return {open,photo:id=>loadPhotos(storage)[id]||null,photos:()=>loadPhotos(storage)};
  }

  function start(deps){
    const doc=root.document;let storage=null;try{storage=root.localStorage;}catch{}
    const d={storage,picked:()=>root.BearMiel?.controller?.picked?.()?.size||0,getFix:()=>root.bearRallyeFix?.()||root.bearDemoFix?.()||null,
      toast:m=>{const t=doc.getElementById('decouverte-toast');if(t){t.textContent=m;t.hidden=false;}},
      onHoneySpent:()=>root.BearMiel?.controller?.refresh?.(),...deps};
    const controller=mount(doc,root,d);
    api.controller=controller;return controller;
  }
  api.start=start;
  if(typeof module!=='undefined')module.exports=api;else root.BearRencontre=api;
})(typeof window==='undefined'?globalThis:window);
