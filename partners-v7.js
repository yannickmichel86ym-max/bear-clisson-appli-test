'use strict';
(() => {
 const el=id=>document.getElementById(id), partners=el('partners');
 const dialogs=[el('settings'),el('rallye'),el('spots'),partners];
 let page='home', restoring=false, navigating=false;
 const mark=next=>{
  const changed=page!==next;page=next;
  for(const name of ['home','route','book','partners'])el('nav-'+name).setAttribute('aria-current',name===next?'page':'false');
  if(!restoring&&changed)history.pushState({bearPage:next},'',location.href);
 };
 const show=next=>{
  navigating=true;
  dialogs.forEach(dialog=>{if(dialog.open)dialog.close();});
  if(next==='home')el('home').click();
  else {
   el('enter').click();
   if(next==='partners')partners.showModal();
   if(next==='book'){
    el('rallye-open').click();
   }
  }
  navigating=false;mark(next);
 };
 history.replaceState({bearPage:'home'},'',location.href);
 for(const name of ['home','route','book','partners'])el('nav-'+name).onclick=()=>show(name);
 el('partners-close').onclick=()=>partners.close();
 window.addEventListener('popstate',event=>{restoring=true;show(event.state?.bearPage||'home');restoring=false;});
 // Les entrées directes de la couverture rejoignent aussi l’historique local.
 for(const id of ['enter','preview','try-demo'])el(id).addEventListener('click',()=>{if(!navigating&&page==='home')mark('route');});
 el('home').addEventListener('click',()=>{if(!navigating&&page!=='home')mark('home');});
 el('partners-route').onclick=()=>show('route');
 for(const [dialog,name] of [[partners,'partners'],[el('rallye'),'book']]){
  dialog.addEventListener('close',()=>{if(!navigating&&!dialog.open&&page===name)mark('route');});
 }
 el('nav-home').setAttribute('aria-current','page');
})();
