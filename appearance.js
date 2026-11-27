"use strict";
(() => {
 const choices=['current','arena'],key='paini-appearance-v1',params=new URLSearchParams(location.search);
 const fromUrl=new Map([['nykyinen','current'],['sinikulta','arena']]).get(params.get('ilme'));let selected=fromUrl||'current';
 if(!fromUrl)try{const saved=localStorage.getItem(key);if(choices.includes(saved))selected=saved;}catch{}
 function apply(){
  document.documentElement.dataset.appearance=selected;
  const select=document.getElementById('appearance');if(select)select.value=selected;
  const theme=document.getElementById('theme');if(theme)theme.disabled=selected==='arena';
  const note=document.getElementById('appearance-note');if(note)note.hidden=selected!=='arena';
 }
 function bind(){
  apply();document.getElementById('appearance')?.addEventListener('change',event=>{
   if(!choices.includes(event.target.value))return;selected=event.target.value;
   try{localStorage.setItem(key,selected);}catch{}
   const address=new URL(location.href);address.searchParams.set('ilme',selected==='arena'?'sinikulta':'nykyinen');history.replaceState(null,'',address.href);
   apply();window.dispatchEvent(new Event('paini-appearance-change'));
  });
 }
 apply();if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
})();
