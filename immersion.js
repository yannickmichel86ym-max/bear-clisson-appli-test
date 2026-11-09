'use strict';
/*
 * V14 · Carte immersive et mode soleil.
 * - Immersion : vue plus proche et plus inclinée, pour lire le chemin qui arrive. Par défaut, la vue actuelle.
 * - Soleil : contraste et saturation renforcés sur la carte, pour la lisibilité en plein jour.
 * Choix mémorisés localement (aucun envoi). Aucun effet sur le calcul GPS ni sur la trace.
 */
(function(root){
  const KEY='bear-immersion-v1';
  const NORMAL={zoom:17.3,pitch:58};
  const IMMERSIVE={zoom:18.1,pitch:68};
  const SUN_FILTER='contrast(1.22) saturate(1.18) brightness(1.04)';

  function load(storage){
    try{
      const v=JSON.parse(storage?.getItem(KEY)||'null');
      return {immersive:v?.immersive===true,sun:v?.sun===true};
    }catch{return {immersive:false,sun:false};}
  }
  function save(storage,state){
    try{storage?.setItem(KEY,JSON.stringify({immersive:!!state.immersive,sun:!!state.sun}));return true;}catch{return false;}
  }
  // Réglages de caméra utilisés par navigation.js : toujours des valeurs bornées.
  function cameraFor(state){
    const s=state?.immersive?IMMERSIVE:NORMAL;
    return {zoom:Math.min(18.5,Math.max(16,s.zoom)),pitch:Math.min(70,Math.max(0,s.pitch))};
  }

  function attach(doc,{window:win=root,storage=null}={}){
    const el=id=>doc.getElementById(id);
    let state=load(storage);
    const imm=el('immersion-toggle'),sun=el('sun-toggle');
    function paint(){
      if(imm){imm.setAttribute('aria-pressed',String(state.immersive));imm.textContent=state.immersive?'Vue immersive : activée':'Vue immersive : désactivée';}
      if(sun){sun.setAttribute('aria-pressed',String(state.sun));sun.textContent=state.sun?'Mode soleil : activé':'Mode soleil : désactivé';}
      doc.body?.classList?.toggle('sun-mode',state.sun);
      if(imm)imm.closest?.('details')&&(imm.closest('details').open=true);
    }
    function recamera(){
      // Reprend le suivi avec la nouvelle caméra (bouton « Me suivre » existant, sans logique dupliquée).
      const center=el('center');if(center&&!center.disabled)center.click();
    }
    imm&&(imm.onclick=()=>{state={...state,immersive:!state.immersive};save(storage,state);paint();recamera();});
    sun&&(sun.onclick=()=>{state={...state,sun:!state.sun};save(storage,state);paint();});
    paint();
    return {state:()=>({...state}),cameraFor:()=>cameraFor(state),paint};
  }
  function start(){
    const controller=attach(root.document,{window:root,storage:(()=>{try{return root.localStorage;}catch{return null;}})()});
    api.controller=controller;return controller;
  }
  const api={KEY,NORMAL,IMMERSIVE,SUN_FILTER,load,save,cameraFor,attach,start,
    camera:()=>api.controller?api.controller.cameraFor():NORMAL};
  if(typeof module!=='undefined')module.exports=api;else root.BearImmersion=api;
})(typeof window==='undefined'?globalThis:window);
