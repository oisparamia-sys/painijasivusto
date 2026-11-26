"use strict";
(() => {
 document.addEventListener('submit',event=>{if(!window.PAINI_PAGE_STATE&&event.target.id==='home-search-form'){event.preventDefault();window.PAINI_PENDING_SEARCH=document.getElementById('home-search').value;document.getElementById('nav-results')?.click();}});
 // Navigation is usable before the large result file or registry has arrived.
 document.addEventListener('click',event=>{
  if(window.PAINI_PAGE_STATE)return;
  const button=event.target.closest('button[id^="nav-"],button[data-open-view]');if(!button)return;
  const view=button.dataset.openView||button.id.slice(4);if(!['home','results','competitions','bouts','clubs'].includes(view))return;
  window.PAINI_PENDING_VIEW=view;
  for(const name of ['home','results','competitions','bouts','clubs','club']){const el=document.getElementById(({results:'search',competitions:'competition'}[name]||name)+'-view');if(el)el.hidden=name!==view;document.getElementById('nav-'+name)?.setAttribute('aria-pressed',String(name===view));}
  const heading=document.getElementById(view==='bouts'?'bouts-heading':view==='results'?'results-heading':view==='competitions'?'competition-heading':view+'-heading');heading?.focus();
  const address=new URL(location.href);address.hash=view==='home'?'':new URLSearchParams({nakyma:view}).toString();history.replaceState(null,'',address.href);
 });
})();
