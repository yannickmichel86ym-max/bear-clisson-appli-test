'use strict';
/*
 * Patrimoine OR / Commerces TOSCANE — sélection cartographique locale.
 * Données : OSM sous ODbL, figées au 03/11/2026. Aucun commerce n'est présenté comme partenaire.
 * Aucun effet sur le moteur GPS ni sur la trace canonique.
 */
(function(root){
  const GOLD='#D4AF37', TOSCANE='#C96E4B';
  // En dessous de PIN_ZOOM : regroupements (clusters) par catégorie ; à partir de PIN_ZOOM : un repère par lieu.
  const PIN_ZOOM=15;
  const GROUPS=[['patrimoine','patrimoine-list','patrimoine-count'],['commerce','commerce-list','commerce-count']];
  const finite=(n,min,max)=>typeof n==='number'&&Number.isFinite(n)&&n>=min&&n<=max;
  const nonempty=s=>typeof s==='string'&&s.trim().length>0;

  function eligible(item){
    return !!(item&&/^[nw][0-9]+$/.test(item.id)&&
      ['patrimoine','commerce'].includes(item.type)&&nonempty(item.name)&&
      finite(item.latitude,47.075,47.105)&&finite(item.longitude,-1.315,-1.260)&&
      item.osm&&['node','way'].includes(item.osm.type)&&
      item.id===(item.osm.type==='node'?'n':'w')+item.osm.id&&
      item.osm.url==='https://www.openstreetmap.org/'+item.osm.type+'/'+item.osm.id);
  }
  function validate(data){
    if(data?.schemaVersion!==1||!Array.isArray(data.places)||!nonempty(data.source?.licence))return [];
    const ids=new Set();
    return data.places.filter(item=>{
      if(!eligible(item)||ids.has(item.id))return false;
      ids.add(item.id);return true;
    });
  }
  function createSelection(places,initial=[]){
    const known=new Set(places.map(p=>p.id)),selected=new Set(initial.filter(id=>known.has(id)));
    return {
      has:id=>selected.has(id),
      ids:()=>[...selected],
      set(id,checked){if(!known.has(id))return false;checked?selected.add(id):selected.delete(id);return true;},
      group(type,checked){for(const p of places)if(p.type===type)checked?selected.add(p.id):selected.delete(p.id);},
      items:()=>places.filter(p=>selected.has(p.id)),
      count:type=>places.reduce((n,p)=>n+(p.type===type&&selected.has(p.id)?1:0),0)
    };
  }
  function mount({map,Marker,document:doc,storage,data}){
    const el=id=>doc.getElementById(id),places=validate(data),itemsById=new Map(places.map(p=>[p.id,p]));
    const status=el('places-status'),info=el('places-info'),panel=el('places-panel'),toggle=el('places-toggle');
    const ns='bear-clisson-places-v1';
    let initial=[];
    try{const obj=JSON.parse(storage?.getItem(ns)||'{}');if(Array.isArray(obj.ids))initial=obj.ids;}catch{}
    const state=createSelection(places,initial),markers=new Map(),checkboxes=new Map(),rows=new Map();
    const save=()=>{try{storage?.setItem(ns,JSON.stringify({ids:state.ids()}));}catch{}};
    const selectedFeatures=type=>({
      type:'FeatureCollection',
      features:state.items().filter(p=>p.type===type&&
        p.geometry&&['Polygon','LineString'].includes(p.geometry.type)).map(p=>({
        type:'Feature',properties:{id:p.id,name:p.name},geometry:p.geometry
      }))
    });
    function color(type){return type==='patrimoine'?GOLD:TOSCANE;}
    let clusterOk=false;
    const pointFeatures=type=>({
      type:'FeatureCollection',
      features:state.items().filter(p=>p.type===type).map(p=>({
        type:'Feature',properties:{id:p.id,name:p.name,type:p.type},geometry:{type:'Point',coordinates:[p.longitude,p.latitude]}
      }))
    });
    // Regroupements MapLibre par catégorie (sources distinctes => jamais de mélange de couleurs).
    function updateClusters(){
      let ok=true;
      for(const type of ['patrimoine','commerce']){
        const id='bear-places-pts-'+type;
        try{
          let src=map.getSource(id);
          if(!src){
            map.addSource(id,{type:'geojson',data:pointFeatures(type),cluster:true,clusterMaxZoom:PIN_ZOOM-1,clusterRadius:48});
            map.addLayer({id:id+'-clusters',source:id,type:'circle',maxzoom:PIN_ZOOM,filter:['has','point_count'],
              paint:{'circle-color':color(type),'circle-stroke-color':'#2F2A26','circle-stroke-width':3,
                'circle-radius':['step',['get','point_count'],22,5,26,15,32,40,38],'circle-opacity':0.96}});
            map.addLayer({id:id+'-points',source:id,type:'circle',maxzoom:PIN_ZOOM,filter:['!',['has','point_count']],
              paint:{'circle-color':color(type),'circle-stroke-color':'#2F2A26','circle-stroke-width':3,'circle-radius':9}});
            try{
              map.addLayer({id:id+'-count',source:id,type:'symbol',maxzoom:PIN_ZOOM,filter:['has','point_count'],
                layout:{'text-field':['get','point_count_abbreviated'],'text-font':['Noto Sans Bold'],'text-size':15,'text-allow-overlap':true},
                paint:{'text-color':'#2F2A26'}});
            }catch{ /* Style sans glyphes : le cercle coloré reste lisible. */ }
            src=map.getSource(id);
          }
          if(!src||typeof src.setData!=='function')throw Error('clusters indisponibles');
          src.setData(pointFeatures(type));
        }catch{ok=false;}
      }
      clusterOk=ok;
    }
    function zoomInto(type,event){
      try{
        const id='bear-places-pts-'+type,hit=map.queryRenderedFeatures?.(event.point,{layers:[id+'-clusters']})?.[0];
        if(!hit)return;
        const center=hit.geometry.coordinates,count=hit.properties.point_count;
        const go=zoom=>{
          map.easeTo?.({center,zoom:Math.min(Math.max(zoom,(map.getZoom?.()||0)+1),PIN_ZOOM),duration:500});
          info.textContent=count+' lieux '+(type==='patrimoine'?'patrimoine (or)':'commerces (toscane)')+' dans cette zone · la carte se rapproche.';
        };
        const src=map.getSource(id),r=src.getClusterExpansionZoom(hit.properties.cluster_id,(err,z)=>{if(!err)go(z);});
        if(r&&typeof r.then==='function')r.then(go,()=>go((map.getZoom?.()||0)+2));
      }catch{ /* Aucune erreur visible : le clavier reste possible via la liste. */ }
    }
    const pinsVisible=()=>!clusterOk||(map.getZoom?.()??PIN_ZOOM)>=PIN_ZOOM;
    function syncPins(){
      const show=pinsVisible();
      for(const p of places)setPin(p,show&&state.has(p.id));
    }
    function updateFootprints(){
      updateClusters();
      for(const type of ['patrimoine','commerce']){
        const id='bear-places-'+type,features=selectedFeatures(type);
        try{
          let src=map.getSource(id);
          if(!src){
            map.addSource(id,{type:'geojson',data:features});
            map.addLayer({id:id+'-fill',source:id,type:'fill',
              filter:['==',['geometry-type'],'Polygon'],
              paint:{'fill-color':color(type),'fill-opacity':0.62,'fill-outline-color':'#2F2A26'}});
            map.addLayer({id:id+'-line',source:id,type:'line',
              paint:{'line-color':color(type),'line-width':5,'line-opacity':0.95}});
            src=map.getSource(id);
          }
          src?.setData?.(features);
        }catch{ /* Le style MapLibre peut être en cours de remplacement; style.load réessaiera. */ }
      }
    }
    function setPin(p,checked){
      const old=markers.get(p.id);
      if(!checked){old?.remove();markers.delete(p.id);return;}
      if(old)return;
      const pin=doc.createElement('button');
      pin.type='button';pin.className='place-map-pin '+(p.type==='patrimoine'?'pin-gold':'pin-toscane');
      pin.textContent=p.type==='patrimoine'?'◆':'●';
      pin.title=p.name;
      pin.setAttribute('aria-label',p.name+' — '+(p.type==='patrimoine'?'patrimoine or':'commerce toscane'));
      pin.onclick=()=>{info.textContent=p.name+' · repère indicatif OpenStreetMap';const row=rows.get(p.id);row?.scrollIntoView?.({block:'nearest'});
        if(p.type==='patrimoine')root.BearDecouverte?.openFiche?.(p.id);};
      try{markers.set(p.id,new Marker({element:pin}).setLngLat([p.longitude,p.latitude]).addTo(map));}
      catch{info.textContent='Impossible de placer ce repère pour le moment.';}
    }
    function refresh(){
      for(const p of places){
        const checked=state.has(p.id),checkbox=checkboxes.get(p.id);
        if(checkbox)checkbox.checked=checked;
        rows.get(p.id)?.classList?.toggle('is-selected',checked);
      }
      updateFootprints();
      syncPins();
      for(const [type,,countId] of GROUPS){
        const count=state.count(type),total=places.filter(p=>p.type===type).length;
        el(countId).textContent=count+' / '+total;
      }
      status.textContent=state.ids().length+' lieu(x) affiché(s) sur la carte.';
      save();
    }
    for(const [type,listId] of GROUPS){
      const list=el(listId);
      list.replaceChildren();
      for(const p of places.filter(p=>p.type===type)){
        const row=doc.createElement('div');row.className='place-row';rows.set(p.id,row);
        const label=doc.createElement('label');label.className='place-choice';
        const input=doc.createElement('input');input.type='checkbox';input.value=p.id;input.checked=state.has(p.id);
        input.setAttribute('aria-label','Afficher '+p.name+' sur la carte');
        input.onchange=()=>{state.set(p.id,input.checked);refresh();};
        checkboxes.set(p.id,input);
        const dot=doc.createElement('span');dot.className='place-color-dot '+(type==='patrimoine'?'dot-gold':'dot-toscane');
        dot.setAttribute('aria-hidden','true');
        const name=doc.createElement('span');name.className='place-name';name.textContent=p.name;
        label.append(input,dot,name);
        const go=doc.createElement('button');go.type='button';go.className='place-locate';
        go.textContent='⌖';go.title='Centrer la carte sur '+p.name;
        go.setAttribute('aria-label','Centrer la carte sur '+p.name);
        go.onclick=()=>{
          map.easeTo?.({center:[p.longitude,p.latitude],zoom:Math.max(PIN_ZOOM+1,map.getZoom?.()||0),duration:600});
          info.textContent=p.name+' · position cartographique indicative, non une entrée garantie.';
        };
        row.append(label,go);list.append(row);
      }
    }
    for(const type of ['patrimoine','commerce']){
      el('places-'+type+'-all').onclick=()=>{state.group(type,true);refresh();};
      el('places-'+type+'-none').onclick=()=>{state.group(type,false);refresh();};
    }
    el('places-search').oninput=()=>{
      const q=el('places-search').value.trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
      for(const p of places){
        rows.get(p.id).hidden=!p.name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().includes(q);
      }
    };
    const expanded=open=>{
      panel.classList.toggle('is-open',open);
      toggle.setAttribute('aria-expanded',String(open));
    };
    toggle.onclick=()=>expanded(!panel.classList.contains('is-open'));
    el('places-close').onclick=()=>{expanded(false);toggle.focus();};
    const restyle=()=>{updateFootprints();syncPins();};
    map.on?.('style.load',restyle);
    map.on?.('zoomend',syncPins);
    for(const type of ['patrimoine','commerce'])map.on?.('click','bear-places-pts-'+type+'-clusters',e=>zoomInto(type,e));
    const fit=el('places-fit');
    if(fit)fit.onclick=()=>{
      const sel=state.items();
      if(!sel.length){info.textContent='Aucun lieu coché : coche un lieu pour le voir sur la carte.';return;}
      try{
        let w=180,s0=90,e=-180,n=-90;
        for(const p of sel){w=Math.min(w,p.longitude);e=Math.max(e,p.longitude);s0=Math.min(s0,p.latitude);n=Math.max(n,p.latitude);}
        map.fitBounds?.([[w,s0],[e,n]],{padding:60,maxZoom:PIN_ZOOM+1,duration:600});
        info.textContent=sel.length+' lieu(x) coché(s) cadré(s) sur la carte.';
      }catch{}
    };
    status.textContent=places.length+' lieux documentés, coche ceux que tu souhaites voir.';
    el('places-source-note').textContent='Source : OpenStreetMap (03/11/2026) · positions indicatives. Commerces référencés, non partenaires confirmés.';
    refresh();
    // Action explicite « Afficher » (Autour de moi) : ajoute le lieu aux choix existants et recadre la carte.
    function showPlace(id){
      const p=itemsById.get(id);
      if(!p)return false;
      state.set(id,true);refresh();
      try{map.easeTo?.({center:[p.longitude,p.latitude],zoom:Math.max(PIN_ZOOM+1,map.getZoom?.()||0),duration:600});}catch{}
      info.textContent=p.name+' · position cartographique indicative, non une entrée garantie.';
      return true;
    }
    const closePanel=()=>{expanded(false);toggle.focus?.();};
    return {places,state,markers,refresh,showPlace,closePanel,destroy(){
      for(const m of markers.values())m.remove();
      markers.clear();
    }};
  }
  async function start(map,Marker){
    const doc=root.document;
    try{
      const response=await root.fetch('./data/lieux-carte.json');
      if(!response.ok)throw Error('HTTP '+response.status);
      let storage;try{storage=root.localStorage;}catch{storage=null;}
      const ui=mount({map,Marker,document:doc,storage,data:await response.json()});
      try{
        const mobile=()=>!!root.matchMedia?.('(max-width: 849px)').matches;
        root.BearNearby?.attach(ui,{document:doc,navigator:root.navigator,isMobile:mobile});
      }catch{ /* « Autour de moi » reste optionnel : la liste fonctionne sans lui. */ }
      try{root.BearDecouverte?.start(ui,{map,Marker});}catch{ /* Découverte V13 optionnelle. */ }
      try{root.BearMiel?.start(ui,{map});}catch{ /* Miel V14 optionnel. */ }
      try{root.BearImmersion?.start();}catch{ /* Immersion optionnelle. */ }
      try{root.BearRencontre?.start({});}catch{ /* Rencontre 3D optionnelle. */ }
      return ui;
    }catch(error){
      doc.getElementById('places-status').textContent='Repères indisponibles. Le guidage GPS reste utilisable.';
      return null;
    }
  }
  const api={GOLD,TOSCANE,PIN_ZOOM,eligible,validate,createSelection,mount,start};
  if(typeof module!=='undefined')module.exports=api;else root.BearPlacesMap=api;
})(typeof window==='undefined'?globalThis:window);
