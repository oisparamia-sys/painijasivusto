"use strict";
(function(root){
 const names={results:'data.js',coverage:'kattavuus.json',bouts:'ottelut-public.json'};
 function validateManifest(value){
  if(value?.version!==1||!/^[a-f0-9]{64}$/.test(value.revision||''))throw Error('Aineiston versiotieto ei kelpaa');
  for(const [key,file]of Object.entries(names))if(value.files?.[key]?.file!==file||!/^[a-f0-9]{64}$/.test(value.files[key].sha256||''))throw Error('Aineiston tiedostoviite ei kelpaa');
  return value;
 }
 function parseResults(text){
  const match=text.match(/^\s*(?:["']use strict["'];\s*)?window\.PAINI_SHARED_DATA\s*=\s*([\s\S]*?)\s*;?\s*$/);
  if(!match)throw Error('Tulosaineiston muoto ei kelpaa');return JSON.parse(match[1]);
 }
 function create({base,fetch,hash,cache}){
  const memory=new Map();
  async function saved(key){try{return await cache?.get(new URL(key,base).href);}catch{return null;}}
  async function save(key,text){try{await cache?.put(new URL(key,base).href,text);}catch{/* Private browsing and storage limits must not prevent use. */}}
  async function manifest(){const response=await fetch(new URL('aineisto-manifest.json',base),{cache:'no-store'});if(!response.ok)throw Error('Versiotieto ei latautunut');return validateManifest(await response.json());}
  async function file(manifest,key){
   validateManifest(manifest);const entry=manifest.files[key],url=new URL(entry.file,base);url.searchParams.set('v',entry.sha256);const address=url.href;
   if(memory.has(address))return memory.get(address);
   const cached=await saved(address);
   if(cached&&await hash(cached)===entry.sha256){memory.set(address,cached);return cached;}
   const response=await fetch(url,{cache:'no-cache'});if(!response.ok)throw Error('Aineisto ei latautunut');const text=await response.text();
   if(await hash(text)!==entry.sha256)throw Error('Julkaisun tiedostot eivät vielä täsmää');
   memory.set(address,text);await save(address,text);return text;
  }
  async function bundle(manifest,includeBouts=false){
   const [results,coverage,bouts]=await Promise.all([file(manifest,'results'),file(manifest,'coverage'),includeBouts?file(manifest,'bouts'):null]);
   const data=parseResults(results),metrics=JSON.parse(coverage);
   if(data.version!==1||!Array.isArray(data.competitions)||metrics.resultsVersion!==(data.exportedAt||data.updatedAt||null)||metrics.total.competitions!==data.competitions.length)throw Error('Aineistoversiot eivät täsmää');
   return {data,coverage:metrics,bouts:bouts?JSON.parse(bouts):null};
  }
  return {manifest,file,bundle,remember:async manifest=>{await save('paini-last-manifest',JSON.stringify(manifest));try{await cache?.prune?.([new URL('paini-last-manifest',base).href,...Object.values(manifest.files).map(entry=>{const url=new URL(entry.file,base);url.searchParams.set('v',entry.sha256);return url.href;})]);}catch{}},previous:async()=>{const text=await saved('paini-last-manifest');return text?validateManifest(JSON.parse(text)):null;},clearMemory:()=>memory.clear()};
 }
 const api={validateManifest,parseResults,create};if(typeof module==='object'&&module.exports)module.exports=api;else root.PAINI_DATA_IO=api;
})(typeof window==='undefined'?globalThis:window);
