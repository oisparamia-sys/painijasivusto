"use strict";
(() => {
 const choices=['current','arena','clarity','copper'],key='paini-appearance-v1',params=new URLSearchParams(location.search);
 const fromUrl=new Map([['nykyinen','current'],['sinikulta','arena'],['kuulas','clarity'],['kupari','copper']]).get(params.get('ilme'));let selected=fromUrl||'current';
 if(!fromUrl)try{const saved=localStorage.getItem(key);if(choices.includes(saved))selected=saved;}catch{}
 function apply(){
  document.documentElement.dataset.appearance=selected;
  const select=document.getElementById('appearance');if(select)select.value=selected;
  const theme=document.getElementById('theme');if(theme)theme.disabled=selected!=='current';
  const note=document.getElementById('appearance-note');if(note){note.hidden=selected==='current';note.textContent={arena:'Sinikulta on tumma ulkoasu.',clarity:'Kuulas on vaalea ulkoasu.',copper:'Kupari on tumma ulkoasu.'}[selected]||'';}
 }
 function bind(){
  apply();document.getElementById('appearance')?.addEventListener('change',event=>{
   if(!choices.includes(event.target.value))return;selected=event.target.value;
   try{localStorage.setItem(key,selected);}catch{}
   const address=new URL(location.href);address.searchParams.set('ilme',{current:'nykyinen',arena:'sinikulta',clarity:'kuulas',copper:'kupari'}[selected]);history.replaceState(null,'',address.href);
   apply();
   const panel=document.getElementById('site-settings'),toggle=panel?.querySelector('summary');
   if(toggle&&getComputedStyle(toggle).display!=='none'){panel.open=false;toggle.focus({preventScroll:true});}
   window.dispatchEvent(new Event('paini-appearance-change'));
  });
 }
 apply();if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
})();
