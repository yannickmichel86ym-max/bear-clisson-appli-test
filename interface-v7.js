'use strict';
(() => {
 const el=id=>document.getElementById(id), welcome=el('welcome'), sheet=el('settings');
 const background=[document.querySelector('main'),document.querySelector('.map-header')];
 const homeState=on=>background.forEach(node=>{node.inert=on;});
 homeState(true);
 const enter=()=>{homeState(false);welcome.hidden=true;el('map').focus();window.dispatchEvent(new Event('resize'));};
 el('enter').onclick=()=>{enter();window.bearStartGps?.();};
 el('preview').onclick=()=>{enter();if(!el('fit').disabled)el('fit').click();};
 el('try-demo').onclick=()=>{if(el('demo').disabled)return;enter();el('demo').click();};
 el('home').onclick=()=>{welcome.hidden=false;homeState(true);el('enter').focus();};
 const open=()=>sheet.showModal();
 el('settings-open').onclick=open;el('more').onclick=open;
 el('settings-close').onclick=()=>sheet.close();
 new MutationObserver(()=>{el('try-demo').disabled=el('demo').disabled;el('preview').disabled=el('demo').disabled;}).observe(el('demo'),{attributes:true,attributeFilter:['disabled']});
})();
