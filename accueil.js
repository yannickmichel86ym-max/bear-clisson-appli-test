'use strict';
/*
 * V15 · Accueil « Choisis ton ours » : galerie des 14 oursons.
 * - Lit seulement les oursons déjà rencontrés, sur cet appareil. Aucune position, aucun envoi.
 * - Un ours rencontré s’ouvre dans le carnet ; les autres restent cachés (« ??? »).
 */
(function(root){
  const doc=root.document;

  function state(){
    let storage=null;try{storage=root.localStorage;}catch{}
    const D=root.BearDecouverte;
    if(!D?.BEARS||!D.loadCaught)return {bears:[],caught:{}};
    return {bears:D.BEARS,caught:D.loadCaught(storage)};
  }

  function render(){
    const list=doc.getElementById('ours-grid');if(!list)return;
    const {bears,caught}=state();
    const photos=root.BearRencontre?.controller?.photo;
    list.replaceChildren();
    bears.forEach((bear,k)=>{
      const met=!!caught[bear.id];
      const li=doc.createElement('li');
      const btn=doc.createElement('button');
      btn.type='button';
      btn.className='ours-card '+(met?'is-met':'is-hidden');
      btn.setAttribute('aria-label',met?'Ourson '+(k+1)+', '+bear.nom+' : ouvrir le carnet':'Ourson '+(k+1)+' : caché, pas encore rencontré');
      const num=doc.createElement('span');num.className='ours-num';num.textContent='N° '+String(k+1).padStart(2,'0');
      const face=doc.createElement('span');face.className='ours-face';face.setAttribute('aria-hidden','true');
      const photo=met&&photos?photos(bear.id):null;
      if(photo){const img=doc.createElement('img');img.src=photo;img.alt='';face.append(img);}
      else face.textContent=met?'🧸':'?';
      const name=doc.createElement('span');name.className='ours-name';name.textContent=met?bear.nom:'???';
      btn.append(num,face,name);
      btn.onclick=()=>{
        if(met){doc.getElementById('rallye-open')?.click();return;}
        const hint=doc.getElementById('ours-hint');
        if(hint)hint.textContent='Il se cache quelque part sur le chemin. Continue la balade pour le découvrir.';
      };
      li.style.setProperty('--i',k);
      li.append(btn);list.append(li);
    });
    const count=bears.filter(b=>caught[b.id]).length;
    const p=doc.getElementById('ours-progress');
    if(p)p.textContent=count+' / '+bears.length+' oursons rencontrés';
    const bar=doc.querySelector('.ours-meter span');
    if(bar)bar.style.width=Math.round(100*count/Math.max(1,bears.length))+'%';
  }

  if(doc){
    doc.getElementById('home')?.addEventListener('click',render);
    render();
  }
  root.BearAccueil={render};
})(typeof window==='undefined'?globalThis:window);
