"use strict";
(() => {
 const allowed=['system','light','dark'],query=window.matchMedia?.('(prefers-color-scheme: dark)');let choice='system';
 try{const saved=localStorage.getItem('paini-theme');if(allowed.includes(saved))choice=saved;}catch{}
 function apply(){const dark=choice==='dark'||choice==='system'&&query?.matches;document.documentElement.dataset.theme=dark?'dark':'light';document.documentElement.style.colorScheme=dark?'dark':'light';const select=document.getElementById('theme');if(select)select.value=choice;}
 function bind(){apply();document.getElementById('theme')?.addEventListener('change',event=>{if(!allowed.includes(event.target.value))return;choice=event.target.value;try{localStorage.setItem('paini-theme',choice);}catch{}apply();});}
 query?.addEventListener?.('change',apply);apply();if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
})();
