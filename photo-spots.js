'use strict';
(function(root){
 const text=v=>typeof v==='string'&&v.trim().length>0&&!/à vérifier|inconnu/i.test(v);
 // Une entrée du modèle documentaire n'est jamais une autorisation.
 function eligible(s){
  const p=s?.positionPriseDeVue,a=s?.accessibilite,o=s?.orientation;
  return !!(text(s?.id)&&text(s?.lieu?.nom)&&text(s?.lieu?.source)&&
   p?.certitude==='vérifiée'&&Number.isFinite(p.latitude)&&Math.abs(p.latitude)<=90&&
   Number.isFinite(p.longitude)&&Math.abs(p.longitude)<=180&&text(p.source)&&
   text(o?.direction)&&text(o?.cadrage)&&text(o?.source)&&
   a?.accesPublic===true&&a?.arretSur===true&&text(a.source));
 }
 function catalogue(data){
  const ids=new Set();
  return (Array.isArray(data?.pointsDeVue)?data.pointsDeVue:[]).filter(s=>{
   if(!eligible(s)||ids.has(s.id))return false;ids.add(s.id);return true;
  });
 }
 function mount({map,Marker,document:doc,spots}){
  const panel=doc.getElementById('spots'),list=doc.getElementById('spots-list'),status=doc.getElementById('spots-status');
  const open=doc.getElementById('spots-open');
  const show=()=>{if(!panel.open)panel.showModal();};
  open.onclick=show;
  doc.getElementById('spots-close').onclick=()=>panel.close();
  list.replaceChildren();
  const valid=catalogue({pointsDeVue:spots});
  status.textContent=valid.length?valid.length+' spot(s) documenté(s). Arrête-toi en sécurité avant de photographier.':
   'Les beaux points de vue attendent leurs repères. Aucun spot photo vérifié dans cet atelier : aucune épingle affichée. La balade et le Carnet restent disponibles.';
  const markers=[];
  for(const spot of valid){
   const card=doc.createElement('article');card.className='spot-card';card.tabIndex=-1;
   const title=doc.createElement('h3');title.textContent=spot.lieu.nom;
   const view=doc.createElement('p');view.textContent=spot.orientation.direction+' · '+spot.orientation.cadrage;
   const source=doc.createElement('p');source.className='rallye-note';
   source.textContent='Sources : '+[spot.lieu.source,spot.positionPriseDeVue.source,spot.orientation.source,spot.accessibilite.source].join(' · ');
   const action=doc.createElement('button');action.type='button';action.textContent='Voir sur la carte';
   action.setAttribute('aria-label','Voir '+spot.lieu.nom+' sur la carte');
   const position=[spot.positionPriseDeVue.longitude,spot.positionPriseDeVue.latitude];
   action.onclick=()=>{panel.close();map.easeTo({center:position,zoom:17});};
   const note=doc.createElement('p');note.textContent='Accès depuis la trace non validé : aucun détour guidé proposé.';
   card.append(title,view,source,action,note);list.append(card);
   const pin=doc.createElement('button');pin.type='button';pin.className='spot-pin';pin.textContent='📷';
   pin.setAttribute('aria-label','Spot photo : '+spot.lieu.nom);
   pin.onclick=event=>{event.stopPropagation();show();card.focus();};
   markers.push(new Marker({element:pin}).setLngLat(position).addTo(map));
  }
  // Les marqueurs DOM MapLibre survivent aux changements de style, sans sprites distants.
  return {markers,spots:valid,destroy(){markers.forEach(marker=>marker.remove());}};
 }
 async function start(map,Marker){
  const doc=root.document;
  try{
   const response=await root.fetch('./photo-preparation.json');
   if(!response.ok)throw Error('catalogue');
   return mount({map,Marker,document:doc,spots:catalogue(await response.json())});
  }catch{
   const result=mount({map,Marker,document:doc,spots:[]});
   doc.getElementById('spots-status').textContent='Catalogue de spots indisponible. Aucune épingle affichée ; la trace et le Carnet restent utilisables.';
   return result;
  }
 }
 const api={eligible,catalogue,mount,start};
 if(typeof module!=='undefined')module.exports=api;else root.BearPhotoSpots=api;
})(typeof window==='undefined'?globalThis:window);
