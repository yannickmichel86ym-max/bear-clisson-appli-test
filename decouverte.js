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
  // 14 oursons, espacés d’au moins 500 m le long du parcours (ordre du parcours). Chacun sur un point réel de data/parcours.json (index « i »).
  // Récit court pour les enfants, lu par les parents. Anecdote historique seulement si le lien est sourcé (champ « appui »).
  const B=(id,nom,km,i,latitude,longitude,indice,appui,source)=>Object.freeze({id,nom,km,i,latitude,longitude,indice,appui:appui||null,source:source||null});
  const BEARS=Object.freeze([
    B('ourson-darnel','DARNEL',0.53,64,47.088617,-1.284423,'Dans cette église, un jour de mai 1789, toute la ville s’est réunie. Le sénéchal Pierre-Marie Darnel présidait, et 119 Clissonnais ont écrit ce qu’ils voulaient changer : que chacun puisse aspirer à tous les emplois, que l’impôt soit plus simple, que la presse soit libre. Les enfants, si vous deviez écrire une demande pour votre école, qu’est-ce que vous mettriez dedans ?','Sous la présidence du sénéchal Pierre-Marie Darnel','sources/wikipedia/Église_Saint-Jacques_de_Clisson.txt'),
    B('ourson-valentin','VALENTIN',1.67,231,47.087894,-1.276684,'Jacques-Charles Valentin était un négociant, et surtout un grand ami de François-Frédéric Lemot. Entre 1810 et 1817, il a transformé l’ancien couvent des Bénédictines de la Trinité en belle demeure, dans le style italien et néo-palladien. Je l’ai vu travailler, et ce domaine a gardé l’esprit de son ami sculpteur. Un bâtiment qui change de vie, c’est aussi une histoire à raconter.','Le négociant Jacques-Charles Valentin, amis de Lemot, installe sa résidence dans l\'ancien couvent des Bénédictines de la Trinité','sources/wikipedia/Domaine_de_la_Garenne_Lemot.txt'),
    B('ourson-barthy','BARTHY',2.2,297,47.086765,-1.276673,'Barthélemy Lemot était le fils du sculpteur. Il s’installe à Clisson en 1841, et il est plusieurs fois maire de la ville, jusqu’en 1881. C’est lui qui achève la villa de son père, et qui fait construire le belvédère, l’escalier monumental et la colonnade. Il promeut le style italianisant dans plusieurs bâtiments publics. Un maire qui aime l’art, ça se voit dans la ville !','devient plusieurs fois maire de la ville jusqu\'en 1881','sources/wikipedia/Domaine_de_la_Garenne_Lemot.txt'),
    B('ourson-lemot','LEMOT',3.53,458,47.084764,-1.273673,'François-Frédéric Lemot est un sculpteur venu de Lyon. Son ami François Cacault l’attire à Clisson en 1805. Il achète la Garenne le 26 juin 1805 et rêve d’un coin d’Italie au bord de la Sèvre. Il devient sculpteur officiel de Napoléon Ier, et il veut donner à ce parc des airs de Tivoli, une ville qu’il admire. Il y travaille jusqu’à sa mort en 1827, et il est enterré dans le temple de l’Amitié. Quand vous marchez ici, vous marchez dans son rêve.','acquiert cette propriété de la Garenne dès le 26 juin 1805','sources/wikipedia/Domaine_de_la_Garenne_Lemot.txt'),
    B('ourson-cleemputte','CLEEMPUTTE',4.03,521,47.086107,-1.274894,'Pierre-Louis van Cleemputte est un architecte parisien. Il reprend les travaux de la villa en 1824, dans le style néo-palladien, avec sa loggia qui regarde la vallée. Lemot n’en voit jamais la fin. Alors chaque fois que vous passez devant la villa, pensez à tous ceux qui ont travaillé à sa construction.','Le bâtiment est édifié par l\'architecte Pierre-Louis van Cleemputte','sources/wikipedia/Domaine_de_la_Garenne_Lemot.txt'),
    B('ourson-crucy','CRUCY',4.53,587,47.085831,-1.270036,'Mathurin Crucy est un architecte nantais, grand prix de Rome en 1774. On lui attribue les plans du temple de Vesta, une des fabriques du parc, avec ses dix-huit colonnes doriques. C’est une allusion au temple de Vesta de Tivoli, en Italie. Un architecte qui a gagné un prix à Rome, et qui dessine un temple à Clisson, quelle belle histoire de voyage !','Les fabriques du jardin sont construites par Mathurin Crucy et François-Frédéric Lemot','sources/wikipedia/Domaine_de_la_Garenne_Lemot.txt'),
    B('ourson-loulou','LouLou',6.5,821,47.080396,-1.26189,'Je te présente LouLou, un ourson drôle, très intelligent et plein d’humour. Il est un peu maladroit, et il trébuche souvent en voulant faire le malin ! Il est le fils de LyLy et le frère de TiTi. Si tu le croises sur le chemin, tu peux être sûr qu’il va te faire rire.',null,null),
    B('ourson-titi','TiTi',8.5,1054,47.072972,-1.253553,'Voici TiTi, très agile, qui grimpe partout, aux arbres, aux murets et aux rochers. Il réfléchit vite et il a beaucoup d’humour. Il préfère jouer dans la nature plutôt qu’étudier, même s’il est très fort à l’école. Il est le fils de LyLy et le frère de LouLou. Si vous voulez le voir, regardez en haut !',null,null),
    B('ourson-pef','PEF',9.4,1155,47.074306,-1.25872,'PEF, c’est pour réunir deux frères : François Cacault, diplomate et ancien député, et Pierre Cacault, peintre. Chassés d’Italie par les émeutiers anti-républicains, ils rentrent en France et s’installent à Clisson en 1798, séduits par la vallée. Ensemble, ils fondent un musée avec les œuvres rapportées de leurs séjours en Italie. Deux frères, deux talents, une seule passion pour l’art.','y ont fondé un musée','sources/wikipedia/Domaine_de_la_Garenne_Lemot.txt'),
    B('ourson-lyly','LyLy',10.5,1279,47.080123,-1.263409,'Voici LyLy, la maman de LouLou et TiTi. Elle est belle, intelligente et sportive, et elle a tout fait pour que ses petits ours ne manquent de rien. Même devenus grands, ses enfants restent ses bébés, et elle continue de les chouchouter. Une maman, c’est le meilleur des guides sur un chemin, non ?',null,null),
    B('ourson-marguerite','MARGUERITE',11.2,1362,47.083786,-1.267385,'Marguerite de Clisson est la fille d’Olivier V. Après 1420, accusée de trahison envers le duc de Bretagne, elle perd ses biens, dont le château de sa famille. Le château devient alors la propriété du duc. Son histoire rappelle que les châteaux changent de maîtres, mais que les familles, elles, ont une mémoire.','Marguerite de Clisson, fille d\'Olivier V','sources/wikipedia/Château_de_Clisson.txt'),
    B('ourson-jeanne','JEANNE',11.99,1460,47.082671,-1.275405,'Jeanne de Belleville est une femme courageuse. Quand son mari, Olivier IV, est décapité à Paris en 1343, elle se réfugie en Angleterre avec son fils, Olivier. Il lui faudra du courage et de la patience pour que son fils retrouve ses terres. C’est une histoire de voyage forcé, mais aussi de fidélité.','Sa femme, Jeanne de Belleville, se réfugie en Angleterre avec son fils','sources/wikipedia/Château_de_Clisson.txt'),
    B('ourson-oli','OLI',12.5,1473,47.08574,-1.279667,'Olivier V de Clisson est né dans ce château, et il devient connétable de France en 1380. C’est un homme puissant, mais il réside peu à Clisson. Il fonde aussi la collégiale Notre-Dame, que vous verrez tout à l’heure. Dans les murs de ce château, il y a l’histoire d’un enfant qui a grandi ici, et qui est devenu un grand seigneur.','devenu connétable en 1380','sources/wikipedia/Château_de_Clisson.txt'),
    B('ourson-menard','MENARD',13.52,1603,47.087601,-1.281317,'René Ménard est un architecte nantais. Il reconstruit l’église Notre-Dame en 1887-1888, en s’inspirant d’une basilique de Rome. Le style italien de la ville a été composé par Lemot au début du XIXe siècle. Quand vous entrez dans cette église, vous voyez une ville qui se rêve dans un autre pays.','reconstruite en 1887-1888, par l\'architecte nantais René Ménard','sources/wikipedia/Église_Notre-Dame_de_Clisson.txt'),
    B('ourson-cuchaud','CUCHAUD',1.04,139,47.088128,-1.280932,'','',null),
    B('ourson-gaudin','GAUDIN',14.21,1684,47.086017,-1.286432,'','',null),
    B('ourson-alain-thomas','ALAIN THOMAS',2.16,291,47.087058,-1.276582,'','',null),
    B('ourson-guillaume','GUILLAUME',3.82,492,47.084916,-1.276038,'','',null),
    B('ourson-vesta','VESTA',3.34,434,47.085158,-1.271421,'','',null),
    B('ourson-diane','DIANE',3.96,513,47.085475,-1.274758,'','',null),
    B('ourson-arsi','ARSI',5.79,735,47.083323,-1.265677,'','',null),
    B('ourson-kayak','KAYAK',7.11,893,47.07723,-1.259884,'','',null),
    B('ourson-foulon','FOULON',8.97,1105,47.074407,-1.25447,'','',null),
    B('ourson-benji','BENJI',11.38,1384,47.084565,-1.269365,'','',null),
    B('ourson-plessi','PLESSI',11.78,1430,47.082869,-1.273278,'','',null),
    B('ourson-jipe-body','JIPÉ BODY',12.41,1461,47.084803,-1.278243,'','',null),
    B('ourson-chevalier','CHEVALIER DE CLISSON',12.74,1502,47.085503,-1.279796,'','',null),
    B('ourson-caillus','CAILLUS',13.24,1565,47.087274,-1.282104,'','',null),
    B('ourson-clisson','CLISSON',13.91,1649,47.086801,-1.283255,'','',null),
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
  // Accepte l'ancien format (date seule) et le format fiche : {t: date, lieu: nom du lieu de rencontre}.
  function loadCaught(storage){
    const v=loadJSON(storage,BEARS_KEY,{});const out={};
    for(const b of BEARS){
      const x=v?.[b.id];
      if(finite(x,0,Infinity))out[b.id]={t:x,lieu:null};
      else if(x&&typeof x==='object'&&finite(x.t,0,Infinity))out[b.id]={t:x.t,lieu:typeof x.lieu==='string'?x.lieu.slice(0,120):null};
    }
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
      if(sheet.dataset)sheet.dataset.monumentId=id;
      const f=fiches?.fiches?.[id]||null;
      el('monument-title').textContent=p.name;
      el('monument-near').textContent=near.has(id)?'✨ Tu es tout près de ce monument.':'Un monument de Clisson à découvrir.';
      el('monument-resume').textContent=f?f.resume:'L’Ours cherche encore les histoires de ce lieu. Reviens bientôt !';
      el('monument-fait').hidden=!f?.fait;
      el('monument-fait-date').textContent=f?.fait?.date||'';el('monument-fait-texte').textContent=f?.fait?.texte||'';
      el('monument-fait-absent').hidden=!f||!!f.fait;
      const more=el('monument-more');
      if(f){more.href=f.source.url;more.textContent='En savoir plus ↗';more.setAttribute('aria-label','En savoir plus : page Wikipédia « '+f.source.titre+' » (nouvel onglet)');}
      else{more.href=p.osm.url;more.textContent='Voir le lieu ↗';more.setAttribute('aria-label','Voir '+p.name+' sur OpenStreetMap (nouvel onglet)');}
      el('monument-source').textContent=f?'Source : Wikipédia, CC BY-SA 4.0.'+(f.faitSource?' Fait marquant : '+f.faitSource.titre+'.':''):'';
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
        b.onclick=()=>patri?openFiche(id):toast(p.name+' · une adresse de la ville à découvrir sur ta route.');
        glowMarkers.set(id,marker(b,[p.longitude,p.latitude]));
      }
    }

    // ---- Oursons ----
    // Lieu de rencontre : le repère le plus proche (≤ 120 m), sinon la position sur la boucle.
    function meetingPlace(bear){
      let best=null;
      for(const p of allPlaces){const d=haversine(bear,p);if(!best||d<best.d)best={p,d};}
      if(best&&best.d<=120)return best.p.name;
      return 'un endroit secret';
    }
    function renderBears(fix){
      for(const bear of bears){
        // Un ours attrapé quitte la carte : il est désormais dans le carnet.
        if(caught[bear.id]){bearMarkers.get(bear.id)?.remove?.();bearMarkers.delete(bear.id);continue;}
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
        b.setAttribute('aria-label',got?bear.nom+' est déjà dans ton carnet':ready?bear.nom+' est là ! Touche pour l’attraper':'Traces d’ourson : approche-toi');
      }
      renderCollection();
    }
    // Entrée dans le carnet : appelée une fois la rencontre terminée (ou directement sans module 3D).
    function commitCatch(bear,photo){
      const win2=win;
      const lieu=meetingPlace(bear);
      caught={...caught,[bear.id]:{t:Date.now(),lieu}};
      const saved=saveJSON(storage,BEARS_KEY,caught);
      const rank=Object.keys(caught).length;
      toast('🧸 '+bear.nom+' rejoint ton carnet ! Votre rencontre : '+lieu+'.'+(saved?'':' Ce souvenir disparaîtra à la fermeture de l’appli.'));
      renderCollection();
      bearMarkers.get(bear.id)?._el?.classList?.add('ourson-capture');
      const pulse=el('rallye-open');pulse?.classList?.add('carnet-pulse');
      win2.setTimeout?.(()=>{pulse?.classList?.remove('carnet-pulse');renderBears(getFix());},900);
      try{win2.navigator?.vibrate?.(80);}catch{}
      return true;
    }
    function tryCatch(bear){
      if(caught[bear.id]){toast(bear.nom+' est déjà dans ton carnet !');return false;}
      const fix=getFix();
      if(!canCatch(bear,fix)){
        const ok=readFix(fix);
        const km='Il se cache quelque part sur le chemin.';
        toast(ok?bear.nom+' n’est pas loin. Avance encore un peu ! '+km:
          'Lance ta balade (Démarrer le GPS) pour partir à la recherche de '+bear.nom+'. '+km);
        return false;
      }
      // Avec le module 3D : rencontre (miel à l'arrêt). Sans lui : entrée directe, comme avant.
      if(win.BearRencontre?.controller){
        win.BearRencontre.controller.open(bear,{index:bears.indexOf(bear),onCaught:photo=>commitCatch(bear,photo)});
        return true;
      }
      return commitCatch(bear,null);
    }
    // Carnet façon pokédex : une fiche par ours, numérotée. Non rencontré = silhouette et « ??? ».
    function renderCollection(){
      const list=el('oursons-list');if(!list)return;
      list.replaceChildren();
      bears.forEach((bear,k)=>{
        const li=doc.createElement('li'),entry=caught[bear.id],km=String(bear.km).replace('.',',');
        li.className='pokedex-entry '+(entry?'is-caught':'is-hidden');
        const add=(tag,text,cls)=>{const n=doc.createElement(tag);n.textContent=text;if(cls)n.className=cls;li.append(n);return n;};
        add('p','N° '+String(k+1).padStart(2,'0'),'pokedex-num');
        const box=doc.createElement('div');box.className='pokedex-photo';box.setAttribute('aria-hidden','true');
        const photo=entry&&win.BearRencontre?.controller?.photo?.(bear.id);
        if(photo){const img=doc.createElement('img');img.src=photo;img.alt='Photo de '+bear.nom+' (rendu 3D)';img.width=84;img.height=84;img.style.cssText='width:100%;height:100%;object-fit:contain';box.append(img);}
        else if(entry){const head=doc.createElement('span');head.className='ourson-tete';head.append(doc.createElement('span'));box.append(head);
          }
        else box.textContent='?';
        li.append(box);
        add('h4',entry?bear.nom:'???');
        add('p',entry?'Rencontré le '+new Date(entry.t).toLocaleDateString('fr-FR')+' à '+(entry.lieu||'un endroit secret')+'.':'Il se cache quelque part sur le chemin.');
        add('p',entry?bear.indice:'Continue la balade pour le découvrir.','pokedex-story');
        list.append(li);
      });
      el('oursons-count').textContent=Object.keys(caught).length+' / '+bears.length+' oursons rencontrés';
    }

    // ---- Rallye photo : points ----
    function allRally(){return [...shippedPoints,...rally];}
    function renderRally(){
      for(const [id,m] of rallyMarkers)if(!allRally().some(p=>p.id===id)){m?.remove();rallyMarkers.delete(id);}
      for(const p of allRally()){
        if(rallyMarkers.has(p.id))continue;
        const b=doc.createElement('button');b.type='button';b.className='rallye-pin';b.textContent='📷';
        b.setAttribute('aria-label','Point du rallye photo : '+p.nom);
        b.onclick=()=>toast('📷 Défi photo : '+p.defi);
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
      if(r.entered.length){const p=byId.get(r.entered[0]);toast('✨ '+p.name+' s’illumine ! '+(p.type==='patrimoine'?'Touche le repère doré pour découvrir son histoire.':'Touche son repère pour le découvrir.'));try{win.navigator?.vibrate?.([40,60,40]);}catch{}}
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
