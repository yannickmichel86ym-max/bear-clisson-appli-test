'use strict';
/*
 * V13 · Découverte : monuments qui s'illuminent en OR à l'approche, fiches sourcées,
 * oursons virtuels à attraper dans les jardins, points du rallye photo placés par l'organisateur.
 * - Position lue uniquement via window.bearRallyeFix (GPS réel lancé par l'utilisateur, jamais en démo) :
 *   aucune nouvelle demande de position, aucun envoi, aucune position stockée.
 * - Stockage local : oursons attrapés (identifiant + date) et points de l'organisateur sur cet appareil.
 */
(function(root){
  const NEAR_M=40, LEAVE_M=70, MAX_ACCURACY_M=30, MAX_AGE_MS=15000, BEAR_M=35, POLL_MS=2000;
  const BEARS_KEY='bear-oursons-v1', RALLY_KEY='bear-rallye-points-v1';
  const BOX={minLat:46.95,maxLat:47.25,minLon:-1.5,maxLon:-1.05};
  // 14 oursons, placés au plus près d’un lieu pertinent, sur un point réel de data/parcours.json (index « i »),
  // à au moins 100 m les uns des autres. Anecdote affichée seulement si le lien historique est sourcé (champ « appui »).
  const B=(id,nom,km,i,latitude,longitude,indice,appui,source)=>Object.freeze({id,nom,km,i,latitude,longitude,indice,appui:appui||null,source:source||null});
  const BEARS=Object.freeze([
    B('ourson-darnel','DARNEL',0.53,64,47.088617,-1.284423,'Comme le sénéchal Pierre-Marie Darnel, qui présida en 1789, à l’église Saint-Jacques, la rédaction du cahier de doléances.','Sous la présidence du sénéchal Pierre-Marie Darnel','sources/wikipedia/Église_Saint-Jacques_de_Clisson.txt'),
    B('ourson-barthy','BARTHY',1.53,213,47.087848,-1.278017,'Comme Barthélemy Lemot, fils du sculpteur, plusieurs fois maire de Clisson jusqu’en 1881.','devient plusieurs fois maire de la ville jusqu\'en 1881','sources/wikipedia/Domaine_de_la_Garenne_Lemot.txt'),
    B('ourson-valentin','VALENTIN',1.67,231,47.087894,-1.276684,'Comme le négociant Jacques-Charles Valentin, ami de Lemot, qui s’installa dans l’ancien couvent des Bénédictines de la Trinité.','Le négociant Jacques-Charles Valentin, amis de Lemot, installe sa résidence dans l\'ancien couvent des Bénédictines de la Trinité','sources/wikipedia/Domaine_de_la_Garenne_Lemot.txt'),
    B('ourson-lemot','LEMOT',3.53,457,47.084745,-1.273551,'Comme le sculpteur François-Frédéric Lemot, qui acquit la Garenne en 1805 et la transforma en parc à l’italienne.','acquiert cette propriété de la Garenne dès le 26 juin 1805','sources/wikipedia/Domaine_de_la_Garenne_Lemot.txt'),
    B('ourson-cleemputte','CLEEMPUTTE',3.82,493,47.084957,-1.276075,'Comme l’architecte Pierre-Louis van Cleemputte, qui construisit la villa Lemot à partir de 1824.','Le bâtiment est édifié par l\'architecte Pierre-Louis van Cleemputte','sources/wikipedia/Domaine_de_la_Garenne_Lemot.txt'),
    B('ourson-crucy','CRUCY',4.02,520,47.086034,-1.274926,'Comme l’architecte Mathurin Crucy, qui dessina les fabriques du parc avec Lemot.','Les fabriques du jardin sont construites par Mathurin Crucy et François-Frédéric Lemot','sources/wikipedia/Domaine_de_la_Garenne_Lemot.txt'),
    B('ourson-loulou','LouLou',6.5,821,47.080396,-1.26189,'LouLou t’attend sur ce tronçon. Ouvre l’œil !',null,null),
    B('ourson-titi','TiTi',8.5,1054,47.072972,-1.253553,'TiTi joue à cache-cache sur ce tronçon. Trouve-le !',null,null),
    B('ourson-cacault','CACAULT',9.4,1155,47.074306,-1.25872,'Comme François Cacault, diplomate, qui fonda avec son frère Pierre un musée à Clisson.','y ont fondé un musée','sources/wikipedia/Domaine_de_la_Garenne_Lemot.txt'),
    B('ourson-lyly','Lyly',10.5,1279,47.080123,-1.263409,'Lyly se cache dans ce coin de la boucle. Cherche bien !',null,null),
    B('ourson-marguerite','MARGUERITE',12.49,1472,47.085708,-1.279575,'Comme Marguerite de Clisson, fille d’Olivier V, dépossédée du château après 1420.','Marguerite de Clisson, fille d\'Olivier V','sources/wikipedia/Château_de_Clisson.txt'),
    B('ourson-jeanne','JEANNE',12.86,1516,47.085719,-1.280967,'Comme Jeanne de Belleville, qui se réfugia en Angleterre avec son fils Olivier.','Sa femme, Jeanne de Belleville, se réfugie en Angleterre avec son fils','sources/wikipedia/Château_de_Clisson.txt'),
    B('ourson-oli','OLI',13.14,1552,47.086693,-1.281273,'Comme Olivier V de Clisson, né au château, devenu connétable en 1380.','devenu connétable en 1380','sources/wikipedia/Château_de_Clisson.txt'),
    B('ourson-menard','MENARD',13.52,1603,47.087601,-1.281317,'Comme l’architecte René Ménard, qui reconstruisit l’église Notre-Dame en 1887-1888.','reconstruite en 1887-1888, par l\'architecte nantais René Ménard','sources/wikipedia/Église_Notre-Dame_de_Clisson.txt')
  ]);
  const finite=(n,min,max)=>typeof n==='number'&&Number.isFinite(n)&&n>=min&&n<=max;
  const text=(s,max)=>typeof s==='string'&&s.trim().length>0&&s.trim().length<=max;

  function haversine(a,b){
    const R=6371008.8,rad=Math.PI/180,dLat=(b.latitude-a.latitude)*rad,dLon=(b.longitude-a.longitude)*rad;
    const h=Math.sin(dLat/2)**2+Math.cos(a.latitude*rad)*Math.cos(b.latitude*rad)*Math.sin(dLon/2)**2;
    return 2*R*Math.asin(Math.min(1,Math.sqrt(h)));
  }
  // Position exploitable : coordonnées valides, précision ≤ 30 m, récente. Sinon null (aucune estimation).
  function readFix(fix,now=Date.now()){
    if(!fix||!finite(fix.latitude,-90,90)||!finite(fix.longitude,-180,180))return null;
    if(!finite(fix.accuracy,0,MAX_ACCURACY_M)||fix.accuracy===0)return null;
    if(!finite(fix.timestamp,0,Infinity)||now-fix.timestamp>MAX_AGE_MS||fix.timestamp-now>5000)return null;
    return fix;
  }
  // Distance au contour OSM (0 à l'intérieur), sinon au repère ponctuel. Projection locale en mètres.
  function distanceToPlace(fix,place){
    const ring=place?.geometry?.type==='Polygon'?place.geometry.coordinates?.[0]:null;
    if(!Array.isArray(ring)||ring.length<4)return haversine(fix,place);
    const k=Math.cos(fix.latitude*Math.PI/180)*111320,m=111132;
    const pts=ring.map(([lon,lat])=>[(lon-fix.longitude)*k,(lat-fix.latitude)*m]);
    let inside=false,best=Infinity;
    for(let i=0,j=pts.length-1;i<pts.length;j=i++){
      const [xi,yi]=pts[i],[xj,yj]=pts[j];
      if((yi>0)!==(yj>0)&&0<(xj-xi)*(0-yi)/(yj-yi)+xi)inside=!inside;
      const dx=xj-xi,dy=yj-yi,len=dx*dx+dy*dy,t=len?Math.max(0,Math.min(1,-(xi*dx+yi*dy)/len)):0;
      best=Math.min(best,Math.hypot(xi+t*dx,yi+t*dy));
    }
    return inside?0:best;
  }
  // Hystérésis : entrée à 40 m (marge d'incertitude comprise), sortie au-delà de 70 m.
  function updateNear(previous,places,fix,now=Date.now()){
    const ok=readFix(fix,now),near=new Set();
    if(ok)for(const p of places){
      const d=distanceToPlace(ok,p);
      if(d+ok.accuracy/2<=NEAR_M||(previous.has(p.id)&&d<=LEAVE_M))near.add(p.id);
    }
    else for(const id of previous)near.add(id); // signal douteux : on ne change rien plutôt que d'inventer
    return {near,entered:[...near].filter(id=>!previous.has(id)),left:[...previous].filter(id=>!near.has(id)),reliable:!!ok};
  }
  function canCatch(bear,fix,now=Date.now()){
    const ok=readFix(fix,now);
    return !!ok&&haversine(ok,bear)+ok.accuracy/2<=BEAR_M;
  }
  function loadJSON(storage,key,fallback){try{const v=JSON.parse(storage?.getItem(key)||'null');return v??fallback;}catch{return fallback;}}
  function saveJSON(storage,key,value){try{storage?.setItem(key,JSON.stringify(value));return true;}catch{return false;}}
  function loadCaught(storage){
    const v=loadJSON(storage,BEARS_KEY,{});const out={};
    for(const b of BEARS)if(finite(v?.[b.id],0,Infinity))out[b.id]=v[b.id];
    return out;
  }
  // Point de rallye : nom et défi obligatoires, coordonnées autour de Clisson, origine déclarée.
  function validRallyPoint(p){
    return !!p&&typeof p.id==='string'&&/^rp-[a-z0-9-]{4,60}$/.test(p.id)&&text(p.nom,80)&&text(p.defi,240)&&
      finite(p.latitude,BOX.minLat,BOX.maxLat)&&finite(p.longitude,BOX.minLon,BOX.maxLon)&&
      ['carte','gps'].includes(p.origine)&&(p.origine!=='gps'||finite(p.precision,0,MAX_ACCURACY_M))&&finite(p.creeLe,0,Infinity);
  }
  function makeRallyPoint({nom,defi,latitude,longitude,origine,precision,now=Date.now(),rand=Math.random}){
    const p={id:'rp-'+now.toString(36)+'-'+Math.floor(rand()*1e8).toString(36),nom:String(nom??'').trim(),defi:String(defi??'').trim(),
      latitude:Math.round(latitude*1e6)/1e6,longitude:Math.round(longitude*1e6)/1e6,origine,creeLe:now};
    if(origine==='gps')p.precision=Math.round(precision);
    return validRallyPoint(p)?p:null;
  }
  function rallyExport(points,now=Date.now()){
    return JSON.stringify({schemaVersion:1,type:'bear-rallye-points',exporteLe:new Date(now).toISOString(),
      avertissement:'Points placés par l’organisateur sur son appareil. À vérifier sur place (sécurité, accès, droit de photographier) avant publication.',
      points:points.filter(validRallyPoint)},null,2);
  }
  const fmtDist=m=>m<1000?Math.round(m/5)*5+' m':(m/1000).toLocaleString('fr-FR',{maximumFractionDigits:1})+' km';

  function attach(ui,{map,Marker,document:doc,window:win=root,storage=null,getFix=()=>win.bearRallyeFix?.()||win.bearDemoFix?.(),fiches=win.BearFiches,shipped=[]}={}){
    const el=id=>doc.getElementById(id);
    const allPlaces=(ui?.places||[]).filter(p=>p.type==='patrimoine'||p.type==='commerce'),byId=new Map(allPlaces.map(p=>[p.id,p]));
    const bears=BEARS;
    let near=new Set(),caught=loadCaught(storage),orga=false,draft=null,toastTimer=null;
    let rally=loadJSON(storage,RALLY_KEY,[]);if(!Array.isArray(rally))rally=[];rally=rally.filter(validRallyPoint);
    const shippedPoints=(Array.isArray(shipped)?shipped:[]).filter(validRallyPoint);
    const glowMarkers=new Map(),bearMarkers=new Map(),rallyMarkers=new Map();
    const toast=msg=>{const t=el('decouverte-toast');if(!t)return;t.textContent=msg;t.hidden=false;win.clearTimeout?.(toastTimer);toastTimer=win.setTimeout?.(()=>{t.hidden=true;},6000);};
    // offset : décalage purement visuel en pixels (les coordonnées OSM restent inchangées).
    const marker=(element,lngLat,offset)=>{try{return new Marker(offset?{element,offset}:{element}).setLngLat(lngLat).addTo(map);}catch{return null;}};

    // ---- Fiche monument ----
    function openFiche(id){
      const p=byId.get(id),sheet=el('monument-sheet');if(!p||!sheet)return false;
      const f=fiches?.fiches?.[id]||null;
      el('monument-title').textContent=p.name;
      el('monument-near').textContent=near.has(id)?'✨ Tu es tout près de ce monument.':'Monument du patrimoine de Clisson.';
      el('monument-resume').textContent=f?f.resume:'La fiche de ce lieu est en préparation : nous n’affichons rien tant que son histoire n’est pas sourcée.';
      el('monument-fait').hidden=!f?.fait;
      el('monument-fait-date').textContent=f?.fait?.date||'';el('monument-fait-texte').textContent=f?.fait?.texte||'';
      el('monument-fait-absent').hidden=!f||!!f.fait;
      const more=el('monument-more');
      if(f){more.href=f.source.url;more.textContent='En savoir plus sur Wikipédia ↗';more.setAttribute('aria-label','En savoir plus : page Wikipédia « '+f.source.titre+' » (nouvel onglet)');}
      else{more.href=p.osm.url;more.textContent='Voir le lieu sur OpenStreetMap ↗';more.setAttribute('aria-label','Voir '+p.name+' sur OpenStreetMap (nouvel onglet)');}
      el('monument-source').textContent=f?'D’après Wikipédia, « '+f.source.titre+' » (version '+f.source.revision+', CC BY-SA 4.0) · fiche en relecture.':'Position : OpenStreetMap, indicative.';
      if(!sheet.open)try{sheet.showModal();}catch{sheet.setAttribute('open','');}
      return true;
    }
    el('monument-close')&&(el('monument-close').onclick=()=>el('monument-sheet').close());

    // ---- Allumage OR à l'approche ----
    function glowFeatures(){
      const of=type=>({type:'FeatureCollection',features:[...near].map(id=>byId.get(id)).filter(p=>p?.type===type&&p.geometry?.type==='Polygon')
        .map(p=>({type:'Feature',properties:{id:p.id},geometry:p.geometry}))});
      return {patrimoine:of('patrimoine'),commerce:of('commerce')};
    }
    function drawGlow(){
      try{
        const f=glowFeatures();
        for(const [type,color,line] of [['patrimoine','#D4AF37','#7A5911'],['commerce','#C96E4B','#7A3420']]){
          const id='bear-near-'+type;
          if(!map.getSource?.(id)){
            map.addSource(id,{type:'geojson',data:f[type]});
            map.addLayer({id:id+'-fill',source:id,type:'fill',paint:{'fill-color':color,'fill-opacity':0.75}});
            map.addLayer({id:id+'-line',source:id,type:'line',paint:{'line-color':line,'line-width':4}});
          }
          map.getSource(id)?.setData?.(f[type]);
        }
      }catch{ /* style en cours de chargement : le repère lumineux reste visible */ }
      for(const [id,m] of glowMarkers)if(!near.has(id)){m?.remove();glowMarkers.delete(id);}
      for(const id of near){
        if(glowMarkers.has(id))continue;
        const p=byId.get(id),b=doc.createElement('button'),patri=p.type==='patrimoine';
        b.type='button';b.className='place-map-pin pin-glow '+(patri?'pin-gold':'pin-toscane');b.textContent=patri?'◆':'●';
        b.setAttribute('aria-label',p.name+(patri?' — tu es tout près, touche pour lire son histoire':' — tu es tout près de ce commerce'));
        b.onclick=()=>patri?openFiche(id):toast(p.name+' · commerce référencé (OpenStreetMap), non partenaire confirmé.');
        glowMarkers.set(id,marker(b,[p.longitude,p.latitude]));
      }
    }

    // ---- Oursons ----
    function renderBears(fix){
      for(const bear of bears){
        let m=bearMarkers.get(bear.id),b=m?.getElement?.()||m?._el;
        if(!m){
          b=doc.createElement('button');b.type='button';
          // Visage animé à l'intérieur : l'animation ne doit jamais toucher le transform de positionnement MapLibre.
          const face=doc.createElement('span');face.className='ourson-face';face.setAttribute('aria-hidden','true');b.append(face);b._face=face;
          b.onclick=()=>tryCatch(bear);
          m=marker(b,[bear.longitude,bear.latitude],[30,-34]);if(m)m._el=b;bearMarkers.set(bear.id,m);
        }
        if(!b)continue;
        const got=!!caught[bear.id],ready=!got&&canCatch(bear,fix);
        // Conserver les classes posées par MapLibre (positionnement du marqueur) : ne remplacer que l'état de l'ourson.
        b.className=[...String(b.className||'').split(/\s+/).filter(c=>c&&!/^ourson-/.test(c)),'ourson-pin',got?'ourson-attrape':ready?'ourson-pret':'ourson-cache'].join(' ');
        (b._face||b).textContent=got?'✓':ready?'🧸':'🐾';
        b.setAttribute('aria-label',got?bear.nom+' est déjà dans ton carnet':ready?bear.nom+' est là ! Touche pour l’attraper':'Traces d’ourson au kilomètre '+String(bear.km).replace('.',',')+' : approche-toi');
      }
      renderCollection();
    }
    function tryCatch(bear){
      if(caught[bear.id]){toast(bear.nom+' est déjà dans ton carnet.');return false;}
      const fix=getFix();
      if(!canCatch(bear,fix)){
        const ok=readFix(fix);
        const km='Cherche vers le kilomètre '+String(bear.km).replace('.',',')+' de la boucle.';
        toast(ok?bear.nom+' est à environ '+fmtDist(haversine(ok,bear))+'. Approche-toi à moins de '+BEAR_M+' m. '+km:
          'Lance « Démarrer le GPS » (précision ≤ '+MAX_ACCURACY_M+' m) pour trouver '+bear.nom+'. '+km);
        return false;
      }
      caught={...caught,[bear.id]:Date.now()};
      const saved=saveJSON(storage,BEARS_KEY,caught);
      bearMarkers.get(bear.id)?._el?.classList?.add('ourson-capture');
      toast('🧸 Bravo ! Tu as attrapé '+bear.nom+'. '+(bear.appui?bear.indice+' ':'')+(saved?'Il t’attend dans le Carnet de l’Ours.':'Il reste avec toi jusqu’au rechargement (stockage indisponible).'));
      try{win.navigator?.vibrate?.(80);}catch{}
      renderBears(fix);return true;
    }
    function renderCollection(){
      const list=el('oursons-list');if(!list)return;
      list.replaceChildren();
      for(const bear of bears){
        const li=doc.createElement('li'),got=caught[bear.id];
        li.className=got?'ourson-slot is-caught':'ourson-slot';
        // Petite tête d'ourson dessinée en CSS (dorée si attrapé, silhouette sinon).
        const head=doc.createElement('span');head.className=got?'ourson-tete':'ourson-tete is-hidden';head.setAttribute('aria-hidden','true');
        const muzzle=doc.createElement('span');muzzle.className='ourson-museau';head.append(muzzle);
        const label=doc.createElement('span');
        label.textContent=got?bear.nom+' · attrapé le '+new Date(got).toLocaleDateString('fr-FR')+' · '+(bear.appui?bear.indice:'Un ourson de la famille Bear is BacK, trouvé au km '+String(bear.km).replace('.',',')+'.'):'Ourson caché vers le km '+String(bear.km).replace('.',',');
        li.append(head,label);list.append(li);
      }
      el('oursons-count').textContent=Object.keys(caught).length+' / '+bears.length+' oursons attrapés';
    }

    // ---- Rallye photo : points ----
    function allRally(){return [...shippedPoints,...rally];}
    function renderRally(){
      for(const [id,m] of rallyMarkers)if(!allRally().some(p=>p.id===id)){m?.remove();rallyMarkers.delete(id);}
      for(const p of allRally()){
        if(rallyMarkers.has(p.id))continue;
        const b=doc.createElement('button');b.type='button';b.className='rallye-pin';b.textContent='📷';
        b.setAttribute('aria-label','Point du rallye photo : '+p.nom);
        b.onclick=()=>toast('📷 '+p.nom+' · Défi : '+p.defi);
        rallyMarkers.set(p.id,marker(b,[p.longitude,p.latitude]));
      }
      const list=el('orga-list');if(!list)return;
      list.replaceChildren();
      for(const p of rally){
        const li=doc.createElement('li'),t=doc.createElement('p'),del=doc.createElement('button');
        t.textContent=p.nom+' — '+p.defi+' ('+(p.origine==='gps'?'GPS ±'+p.precision+' m':'placé sur la carte')+')';
        del.type='button';del.textContent='Retirer';del.setAttribute('aria-label','Retirer le point '+p.nom);
        del.onclick=()=>{if(!win.confirm?.('Retirer le point « '+p.nom+' » de cet appareil ?'))return;rally=rally.filter(x=>x.id!==p.id);saveJSON(storage,RALLY_KEY,rally);renderRally();orgaStatus('Point retiré.');};
        li.append(t,del);list.append(li);
      }
      el('orga-count').textContent=rally.length+' point(s) placé(s) sur cet appareil'+(shippedPoints.length?' · '+shippedPoints.length+' livré(s) avec l’application':'');
      el('orga-export').disabled=!rally.length;
    }
    const orgaStatus=t=>{const s=el('orga-status');if(s)s.textContent=t;};
    function setOrga(on){
      orga=on;const b=el('orga-toggle');
      if(b){b.setAttribute('aria-pressed',String(on));b.textContent=on?'Mode organisateur : activé':'Mode organisateur : désactivé';}
      doc.body?.classList?.toggle('orga-mode',on);
      orgaStatus(on?'Ferme le carnet puis touche la carte à l’endroit du point, ou utilise « Ici (GPS) » sur place.':'Mode organisateur désactivé : la carte réagit normalement.');
    }
    function startDraft(lat,lon,origine,precision){
      draft={latitude:lat,longitude:lon,origine,precision};
      el('orga-form').hidden=false;
      el('orga-where').textContent=(origine==='gps'?'Position GPS (±'+Math.round(precision)+' m) : ':'Point touché sur la carte : ')+lat.toFixed(5)+', '+lon.toFixed(5);
      const dlg=el('rallye');if(dlg&&!dlg.open)try{dlg.showModal();}catch{}
      el('orga-nom')?.focus?.();
    }
    if(el('orga-toggle')){
      el('orga-toggle').onclick=()=>setOrga(!orga);
      el('orga-here').onclick=()=>{
        const ok=readFix(getFix());
        if(!ok){orgaStatus('Position GPS indisponible ou imprécise (> '+MAX_ACCURACY_M+' m) : lance « Démarrer le GPS » ou place le point sur la carte.');return;}
        startDraft(ok.latitude,ok.longitude,'gps',ok.accuracy);
      };
      el('orga-cancel').onclick=()=>{draft=null;el('orga-form').hidden=true;orgaStatus('Point abandonné.');};
      el('orga-save').onclick=()=>{
        if(!draft){orgaStatus('Touche d’abord la carte ou utilise « Ici (GPS) ».');return;}
        const p=makeRallyPoint({...draft,nom:el('orga-nom').value,defi:el('orga-defi').value});
        if(!p){orgaStatus('Indique un nom (80 caractères max) et un défi photo (240 max).');return;}
        rally=[...rally,p];
        if(!saveJSON(storage,RALLY_KEY,rally))orgaStatus('Stockage indisponible : le point disparaîtra au rechargement. Exporte-le maintenant.');
        else orgaStatus('Point « '+p.nom+' » ajouté sur cet appareil.');
        draft=null;el('orga-nom').value='';el('orga-defi').value='';el('orga-form').hidden=true;renderRally();
      };
      el('orga-export').onclick=()=>{
        if(!rally.length)return;
        const url=win.URL.createObjectURL(new win.Blob([rallyExport(rally)],{type:'application/json'})),a=doc.createElement('a');
        a.href=url;a.download='rallye-points-'+new Date().toISOString().slice(0,10)+'.json';doc.body.append(a);a.click();a.remove();
        win.setTimeout?.(()=>win.URL.revokeObjectURL(url),60000);
        orgaStatus('Fichier préparé. Envoie-le pour intégrer ces points à l’application de tout le monde.');
      };
    }
    map.on?.('click',e=>{if(orga&&e?.lngLat)startDraft(e.lngLat.lat,e.lngLat.lng,'carte');});

    // ---- Boucle : lecture passive de la position déjà suivie par le guidage ----
    function tick(fix=getFix(),now=Date.now()){
      const r=updateNear(near,allPlaces,fix,now);
      near=r.near;
      if(r.entered.length){const p=byId.get(r.entered[0]);toast('✨ '+p.name+' s’illumine ! '+(p.type==='patrimoine'?'Touche le repère doré pour découvrir son histoire.':'Touche le repère pour voir le commerce.'));try{win.navigator?.vibrate?.([40,60,40]);}catch{}}
      drawGlow();renderBears(fix);
      return r;
    }
    map.on?.('style.load',drawGlow);
    renderRally();renderBears(null);
    const timer=win.setInterval?.(()=>{if(!doc.hidden)tick();},POLL_MS);
    return {tick,openFiche,tryCatch,setOrga,startDraft,near:()=>new Set(near),caught:()=>({...caught}),rally:()=>allRally(),stop(){win.clearInterval?.(timer);}};
  }
  async function start(ui,{map,Marker}){
    const doc=root.document;let storage=null;try{storage=root.localStorage;}catch{}
    const shipped=Array.isArray(root.BearRallyePoints?.points)?root.BearRallyePoints.points:[];
    const controller=attach(ui,{map,Marker,document:doc,window:root,storage,shipped});
    api.controller=controller;return controller;
  }
  const api={NEAR_M,LEAVE_M,MAX_ACCURACY_M,MAX_AGE_MS,BEAR_M,BEARS,BEARS_KEY,RALLY_KEY,haversine,readFix,distanceToPlace,updateNear,canCatch,loadCaught,validRallyPoint,makeRallyPoint,rallyExport,attach,start,
    openFiche:id=>api.controller?.openFiche(id)};
  if(typeof module!=='undefined')module.exports=api;else root.BearDecouverte=api;
})(typeof window==='undefined'?globalThis:window);
