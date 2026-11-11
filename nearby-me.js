'use strict';
/*
 * « Autour de moi » : lieux déjà documentés les plus proches, à vol d'oiseau.
 * - Une seule demande de position (getCurrentPosition) après un clic explicite; jamais watchPosition.
 * - La position reste en mémoire le temps du calcul : ni localStorage, ni réseau, ni moteur GPS de la boucle.
 * - Aucun itinéraire, aucune preuve d'accès : distances en ligne droite sur repères OSM indicatifs.
 */
(function(root){
  const LIST_SIZE=5;
  const CLISSON={latitude:47.0865,longitude:-1.2810};
  const FAR_KM=15;              // au-delà : on n'affirme pas que les lieux sont proches
  const POOR_ACCURACY_M=500;    // précision au-delà de laquelle le classement est trompeur
  const MAX_AGE_MS=60000;       // position plus ancienne : rejetée
  const REQUEST={enableHighAccuracy:true,timeout:15000,maximumAge:0};
  const finite=(n,min,max)=>typeof n==='number'&&Number.isFinite(n)&&n>=min&&n<=max;

  function haversine(a,b){
    const R=6371008.8,rad=Math.PI/180,dLat=(b.latitude-a.latitude)*rad,dLon=(b.longitude-a.longitude)*rad;
    const h=Math.sin(dLat/2)**2+Math.cos(a.latitude*rad)*Math.cos(b.latitude*rad)*Math.sin(dLon/2)**2;
    return 2*R*Math.asin(Math.min(1,Math.sqrt(h)));
  }
  // Retourne {latitude,longitude,accuracy,ageMs} ou null. Aucune valeur n'est complétée ni inventée.
  function readPosition(raw,now=Date.now()){
    const c=raw?.coords;
    if(!c||!finite(c.latitude,-90,90)||!finite(c.longitude,-180,180))return null;
    if(!finite(c.accuracy,0,Infinity))return null;
    const ts=raw.timestamp;
    if(typeof ts!=='number'||!Number.isFinite(ts))return null;
    const ageMs=now-ts;
    if(ageMs>MAX_AGE_MS||ageMs<-5000)return null;
    return {latitude:c.latitude,longitude:c.longitude,accuracy:c.accuracy,ageMs:Math.max(0,ageMs)};
  }
  // Tri stable : distance, puis ordre du catalogue. Seuls les lieux déjà validés sont acceptés.
  function nearest(places,pos,type,n=LIST_SIZE){
    return places.map((p,order)=>({place:p,order}))
      .filter(x=>x.place.type===type&&finite(x.place.latitude,-90,90)&&finite(x.place.longitude,-180,180))
      .map(x=>({place:x.place,order:x.order,meters:haversine(pos,x.place)}))
      .sort((a,b)=>a.meters-b.meters||a.order-b.order).slice(0,n);
  }
  function formatDistance(m){
    if(!Number.isFinite(m)||m<0)return '—';
    if(m<1000)return Math.max(10,Math.round(m/10)*10)+' m';
    return (m/1000).toFixed(m<10000?1:0).replace('.',',')+' km';
  }
  function errorMessage(err){
    switch(err?.code){
      case 1:return 'Position refusée. Tu peux continuer à choisir les lieux dans la liste, ou autoriser la localisation dans les réglages du navigateur puis réessayer.';
      case 2:return 'Position indisponible pour le moment. Réessaie en extérieur, ou choisis les lieux dans la liste.';
      case 3:return 'La position a mis trop de temps à répondre. Réessaie, ou choisis les lieux dans la liste.';
      default:return 'Impossible d’obtenir la position. Choisis les lieux dans la liste.';
    }
  }
  function describe(pos){
    const km=haversine(pos,CLISSON)/1000;
    return {far:km>FAR_KM,poor:pos.accuracy>POOR_ACCURACY_M,kmFromClisson:km};
  }

  function attach(ui,{document:doc,navigator:nav,isMobile=()=>false}){
    const el=id=>doc.getElementById(id),button=el('nearby-btn'),box=el('nearby-results'),msg=el('nearby-status');
    if(!button||!box||!msg)return null;
    let busy=false;
    const say=t=>{msg.textContent=t;};
    function section(title,type,rows){
      const h=doc.createElement('h3');h.className='nearby-title '+(type==='patrimoine'?'is-gold':'is-toscane');
      h.textContent=title;
      const list=doc.createElement('ol');list.className='nearby-list';
      list.setAttribute('aria-label',title+', du plus proche au plus éloigné');
      for(const r of rows){
        const li=doc.createElement('li');li.className='nearby-item';
        const name=doc.createElement('span');name.className='nearby-name';name.textContent=r.place.name;
        const dist=doc.createElement('span');dist.className='nearby-dist';dist.textContent='≈ '+formatDistance(r.meters)+' à vol d’oiseau';
        const go=doc.createElement('button');go.type='button';go.className='nearby-show';
        go.textContent='Afficher sur la carte';
        go.setAttribute('aria-label','Afficher '+r.place.name+' sur la carte, environ '+formatDistance(r.meters)+' à vol d’oiseau');
        go.onclick=()=>{
          ui.showPlace(r.place.id);
          say(r.place.name+' ajouté à tes lieux et recadré sur la carte. Tes autres choix sont conservés.');
          if(isMobile()){ui.closePanel?.();}
        };
        li.append(name,dist,go);list.append(li);
      }
      return [h,list];
    }
    function render(pos){
      box.replaceChildren();
      const d=describe(pos),notes=[];
      notes.push('Précision de la position : environ '+formatDistance(pos.accuracy)+'.');
      if(d.poor)notes.push('Position très imprécise : l’ordre des lieux peut être faux.');
      if(d.far)notes.push('Tu sembles à environ '+Math.round(d.kmFromClisson)+' km de Clisson : ces lieux ne sont pas proches de toi, les distances sont données depuis ta position.');
      notes.push('Distances en ligne droite, depuis des repères OpenStreetMap indicatifs. Ce n’est ni un itinéraire ni la preuve qu’on peut y accéder.');
      const p=doc.createElement('p');p.className='nearby-note';p.textContent=notes.join(' ');
      box.append(p);
      for(const [type,title] of [['patrimoine','Patrimoine · or']]){ // commerces : mise en avant suspendue
        const rows=nearest(ui.places,pos,type);
        if(rows.length)box.append(...section(title,type,rows));
      }
      say(d.far?'Position reçue, mais éloignée de Clisson.':'Lieux les plus proches de ta position, à vol d’oiseau.');
    }
    button.onclick=()=>{
      if(busy)return;
      const geo=nav?.geolocation;
      if(!geo||typeof geo.getCurrentPosition!=='function'){
        box.replaceChildren();say('La localisation n’est pas disponible sur cet appareil ou ce navigateur. Choisis les lieux dans la liste.');return;
      }
      busy=true;button.setAttribute('aria-busy','true');say('Recherche de ta position…');
      let settled=false;
      const done=()=>{busy=false;button.removeAttribute('aria-busy');};
      try{
        geo.getCurrentPosition(raw=>{
          if(settled)return;settled=true;done();
          const pos=readPosition(raw);
          if(!pos){box.replaceChildren();say('Position reçue mais inutilisable (invalide ou trop ancienne). Réessaie.');return;}
          render(pos);
        },err=>{
          if(settled)return;settled=true;done();
          box.replaceChildren();say(errorMessage(err));
        },REQUEST);
      }catch{settled=true;done();box.replaceChildren();say(errorMessage(null));}
    };
    return {button};
  }
  const api={LIST_SIZE,FAR_KM,POOR_ACCURACY_M,MAX_AGE_MS,REQUEST,haversine,readPosition,nearest,formatDistance,errorMessage,describe,attach};
  if(typeof module!=='undefined')module.exports=api;else root.BearNearby=api;
})(typeof window==='undefined'?globalThis:window);
