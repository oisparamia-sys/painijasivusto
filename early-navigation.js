"use strict";
(() => {
 // Run in the head, before the browser restores a previous scroll position.
 if('scrollRestoration' in history)history.scrollRestoration='manual';
 const top=()=>window.scrollTo({top:0,left:0,behavior:'instant'});
 document.addEventListener('DOMContentLoaded',top,{once:true});
 window.addEventListener('pageshow',event=>{if(!event.persisted)top();});
 // Automatic data refresh intentionally has no scroll-reset handler.
 // A second Home tap dismisses this page's panels without changing saved choices.
 document.addEventListener('click',event=>{
  const button=event.target.closest('#nav-home');
  const home=document.getElementById('home-view');
  if(!button||!home||home.hidden)return;
  for(const panel of document.querySelectorAll('#site-settings[open], #home-view details[open]')){
   const summary=panel.querySelector('summary');
   // Desktop header controls are permanently visible and have no visible toggle.
   if(summary&&getComputedStyle(summary).display!=='none')panel.open=false;
  }
  for(const dialog of document.querySelectorAll('dialog[open]'))dialog.close();
  for(const input of home.querySelectorAll('input[aria-expanded="true"]'))input.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
  if(document.activeElement?.matches('input,select,textarea'))document.activeElement.blur();
  window.scrollTo({top:0,left:0,behavior:'instant'});
 },true);

 document.addEventListener('submit',event=>{if(!window.PAINI_PAGE_STATE&&event.target.id==='home-search-form'){event.preventDefault();window.PAINI_PENDING_SEARCH=document.getElementById('home-search').value;window.PAINI_PENDING_HOME_FILTERS={year:document.getElementById('home-year')?.value||'',style:document.getElementById('home-style')?.value||''};document.getElementById('nav-results')?.click();}});
 // Navigation is usable before the large result file or registry has arrived.
 document.addEventListener('click',event=>{
  if(window.PAINI_PAGE_STATE)return;
  const button=event.target.closest('button[id^="nav-"],button[data-open-view]');if(!button)return;
  let view=button.dataset.openView||button.id.slice(4);if(view==='competitions')view='results';if(!['home','results','competitions','bouts','clubs'].includes(view))return;
  window.PAINI_PENDING_VIEW=view;
  for(const name of ['home','results','competitions','bouts','clubs','club']){const el=document.getElementById(({results:'search',competitions:'competition'}[name]||name)+'-view');if(el)el.hidden=name!==view;document.getElementById('nav-'+name)?.setAttribute('aria-pressed',String(name===view));}
  const heading=document.getElementById(view==='bouts'?'bouts-heading':view==='results'?'results-heading':view==='competitions'?'competition-heading':view+'-heading');window.scrollTo({top:0,left:0,behavior:"instant"});heading?.focus({preventScroll:true});
  const address=new URL(location.href);address.hash=view==='home'?'':new URLSearchParams({nakyma:view}).toString();history.replaceState(null,'',address.href);
 });
})();
