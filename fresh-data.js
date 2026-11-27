"use strict";
(() => {
 const base=new URL('.',document.currentScript.src),notice=document.querySelector('#data-refresh-status'),status=document.querySelector('#status');
 let active=null,checking=null,starting=null,lastCheck=-Infinity,pending=null;
 const setNotice=text=>{if(notice)notice.textContent=text;};
 async function request(url,options={}){
  const controller=new AbortController(),timeout=new URL(url,base).pathname.endsWith('aineisto-manifest.json')?15000:300000,timer=setTimeout(()=>controller.abort(),timeout);
  try{const response=await fetch(url,{...options,signal:controller.signal});if(!response.ok)clearTimeout(timer);
   const read=method=>async()=>{try{return await response[method]();}finally{clearTimeout(timer);}};
   return {ok:response.ok,text:read('text'),json:read('json')};
  }catch(error){clearTimeout(timer);throw error;}
 }
 const cache={async get(key){const store=await window.caches?.open('paini-data-v1');return (await store?.match(key))?.text();},async put(key,text){const store=await window.caches?.open('paini-data-v1');await store?.put(key,new Response(text));},async prune(keys){const store=await window.caches?.open('paini-data-v1');if(store)for(const request of await store.keys())if(!keys.includes(request.url))await store.delete(request);}};
 const hash=async text=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)))).map(n=>n.toString(16).padStart(2,'0')).join('');
 const scripts=new Map();
 function load(file){if(scripts.has(file))return scripts.get(file);const promise=new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=new URL(file+'?v=20261127-styles2',base).href;script.onload=resolve;script.onerror=()=>{scripts.delete(file);script.remove();reject(Error(file));};document.head.append(script);});scripts.set(file,promise);return promise;}
 let io;
 function canApply(){return !document.hidden&&!document.querySelector('#feedback-dialog[open]')&&!document.activeElement?.matches('input,textarea,select,[contenteditable=true]')&&!window.PAINI_PAGE_STATE?.busy();}
 async function applyPending(){
  if(!pending||!canApply())return;
  const {manifest,bundle}=pending;
  // Capture the user's state only after all downloads, so typing/navigation during a download survives.
  const state=window.PAINI_PAGE_STATE.capture(),scroll={left:window.scrollX,top:window.scrollY};
  const previous=window.PAINI_PAGE_STATE.snapshot(),previousManifest=active;
  try{
   window.PAINI_PAGE_STATE.update(bundle);window.PAINI_DATA_ACCESS.current=manifest;
   if(state&&!await window.PAINI_PAGE_STATE.restore(state))throw Error('Käyttötilaa ei voitu palauttaa');
  }catch(error){
   window.PAINI_DATA_ACCESS.current=previousManifest;window.PAINI_PAGE_STATE.update(previous);if(state)await window.PAINI_PAGE_STATE.restore(state);pending=null;throw error;
  }
  active=manifest;pending=null;io.clearMemory();await io.remember(active);
  requestAnimationFrame(()=>requestAnimationFrame(()=>window.scrollTo({...scroll,behavior:'instant'})));
  window.dispatchEvent(new Event('paini-data-ready'));setNotice('Tiedot päivittyvät automaattisesti.');
 }
 async function check(force=false){
  if(!active)return start();if(!window.PAINI_PAGE_STATE)return;if(checking)return checking;
  if(document.hidden||!force&&Date.now()-lastCheck<15000)return;
  lastCheck=Date.now();checking=(async()=>{
   try{if(pending){await applyPending();return;}const manifest=await io.manifest();if(manifest.revision===active.revision){setNotice('Tiedot päivittyvät automaattisesti.');return;}
    const bundle=await io.bundle(manifest,!!window.PAINI_BOUTS?.isReady());window.PainiRegistry.validate(bundle.data);
    window.PAINI_PAGE_STATE.validate(bundle);pending={manifest,bundle};await applyPending();
   }catch{setNotice('Uusia tietoja ei voitu ladata. Aiemmat tiedot ovat käytössä.');}
  })().finally(()=>{checking=null;});return checking;
 }
 async function start(){
  if(starting)return starting;
  starting=(async()=>{
   if(status){status.hidden=false;status.textContent='Ladataan tuloksia…';}
   try{
    if(!io){await load('data-access.js');io=window.PAINI_DATA_IO.create({base,fetch:request,hash,cache});}
    // Existing cached data remains a fallback if a network request or a partial Pages publication fails.
    let manifest,bundle,usingPrevious=false;
    try{manifest=await io.manifest();bundle=await io.bundle(manifest);}catch(error){manifest=await io.previous();if(!manifest)throw error;bundle=await io.bundle(manifest);usingPrevious=true;}
    await load('athlete-registry.js');window.PainiRegistry.validate(bundle.data);
    window.PAINI_SHARED_DATA=bundle.data;window.PAINI_COVERAGE=bundle.coverage;
    window.PAINI_DATA_ACCESS={current:manifest,bouts:async()=>JSON.parse(await io.file(window.PAINI_DATA_ACCESS.current,'bouts'))};
    for(const file of ['site-utils.js','search-assist.js','site-metrics.js','notifications.js','home-settings.js','site-features.js','script.js'])await load(file);
    if(status){status.hidden=true;status.textContent='';}
    active=manifest;io.clearMemory();await io.remember(active);window.dispatchEvent(new Event('paini-data-ready'));
    setNotice(usingPrevious?'Aiemmin ladatut tiedot ovat käytössä.':'Tiedot päivittyvät automaattisesti.');
   }catch{if(status){status.hidden=false;status.dataset.kind='error';status.textContent='Tietoja ei voitu ladata. Tarkista verkkoyhteys. Latausta yritetään uudelleen yhteyden palattua.';}}
  })().finally(()=>{starting=null;});return starting;
 }
 // Legacy cached HTML must not retain a manual refresh button or public comparison navigation.
 document.querySelector('#refresh-data')?.remove();document.querySelector('#nav-compare')?.remove();
 window.addEventListener('focus',()=>check());window.addEventListener('online',()=>check(true));
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)check();});
 document.addEventListener('focusout',()=>setTimeout(()=>{if(pending)check(true);},0));
 window.addEventListener('pageshow',event=>{if(event.persisted)check(true);});
 setInterval(()=>{if(!document.hidden)check();},15*60*1000);
 start();
})();
